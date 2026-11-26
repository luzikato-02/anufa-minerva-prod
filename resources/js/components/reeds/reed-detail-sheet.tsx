import {
    ACTION_TITLE,
    ReedActionDialog,
} from '@/components/reeds/reed-action-dialog';
import {
    ReedGradeBadge,
    ReedStatusLabel,
} from '@/components/reeds/reed-status';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePermissions } from '@/lib/permissions';
import {
    allowedActions,
    CHECKS,
    fmt,
    fmtDate,
    MANAGE_ACTIONS,
    MOVEMENT_LABEL,
    reedApi,
    specLabel,
    STATUS_META,
    type ReedAction,
    type ReedDetail,
    type ReedOptions,
} from '@/lib/reeds';
import { PrinterIcon } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="truncate text-xs text-muted-foreground">{label}</dt>
            <dd className="truncate text-sm tabular-nums">{children}</dd>
        </div>
    );
}

/** One reed: where it is, its wear, the moves it allows, and its whole history. */
export function ReedDetailSheet({
    reedId,
    options,
    onClose,
    onChanged,
}: {
    reedId: number | null;
    options: ReedOptions | null;
    onClose: () => void;
    onChanged: () => void;
}) {
    const { can } = usePermissions();
    const [detail, setDetail] = useState<ReedDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [action, setAction] = useState<ReedAction | null>(null);

    const load = useCallback(() => {
        if (!reedId) return;
        setError(null);
        reedApi
            .show(reedId)
            .then(setDetail)
            .catch((e) => setError((e as Error).message));
    }, [reedId]);

    useEffect(() => {
        setDetail(null);
        load();
    }, [load]);

    const reed = detail?.reed;
    const actions = reed
        ? allowedActions(reed).filter((a) =>
              MANAGE_ACTIONS.includes(a)
                  ? can('reeds.manage')
                  : can('reeds.operate'),
          )
        : [];

    const done = () => {
        setAction(null);
        load();
        onChanged();
    };

    return (
        <Sheet open={reedId !== null} onOpenChange={(o) => !o && onClose()}>
            <SheetContent
                side="right"
                className="w-full gap-0 overflow-y-auto sm:max-w-xl"
            >
                <SheetHeader className="border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <span className="font-mono">
                            {reed?.serial_no ?? 'Reed'}
                        </span>
                        {reed && <ReedGradeBadge grade={reed.grade} />}
                        {reed && (
                            <ReedStatusLabel
                                status={reed.status}
                                className="text-sm font-normal"
                            />
                        )}
                    </SheetTitle>
                    <SheetDescription>
                        {reed?.spec ? specLabel(reed.spec) : 'Loading…'}
                    </SheetDescription>
                </SheetHeader>

                {error && (
                    <Alert
                        variant="destructive"
                        className="m-4 w-auto"
                        role="alert"
                    >
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {!reed ? (
                    !error && (
                        <div className="space-y-3 p-4">
                            <Skeleton className="h-4 w-2/3" />
                            <Skeleton className="h-4 w-1/2" />
                            <Skeleton className="h-24 w-full" />
                        </div>
                    )
                ) : (
                    <div className="flex flex-col gap-4 p-4">
                        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                            {reed.status === 'on_loom' && (
                                <>
                                    On loom <b>{reed.loom_number}</b>
                                    {reed.fabric_style && (
                                        <>
                                            {' '}
                                            running style{' '}
                                            <b>{reed.fabric_style.code}</b>
                                        </>
                                    )}
                                    {reed.order_no && (
                                        <> · order {reed.order_no}</>
                                    )}{' '}
                                    since {fmtDate(reed.mounted_at, true)}.
                                </>
                            )}
                            {reed.status === 'reserved' && (
                                <>
                                    Reserved
                                    {reed.loom_number && (
                                        <>
                                            {' '}
                                            for loom <b>{reed.loom_number}</b>
                                        </>
                                    )}
                                    {reed.fabric_style && (
                                        <>
                                            , style{' '}
                                            <b>{reed.fabric_style.code}</b>
                                        </>
                                    )}{' '}
                                    since {fmtDate(reed.reserved_at, true)}
                                    {reed.location && (
                                        <>
                                            . Still in{' '}
                                            <b>{reed.location.code}</b>
                                        </>
                                    )}
                                    .
                                </>
                            )}
                            {reed.status === 'in_repair' && (
                                <>
                                    At the repair vendor (
                                    {detail.repairs.find((r) => !r.returned_on)
                                        ?.vendor ?? '—'}
                                    ).
                                </>
                            )}
                            {!['on_loom', 'reserved', 'in_repair'].includes(
                                reed.status,
                            ) && (
                                <>
                                    {STATUS_META[reed.status].label}
                                    {reed.location ? (
                                        <>
                                            {' '}
                                            in <b>{reed.location.code}</b>
                                            {reed.location.zone &&
                                                ` (${reed.location.zone})`}
                                        </>
                                    ) : (
                                        reed.status !== 'scrapped' &&
                                        ' — no location set'
                                    )}
                                    .
                                </>
                            )}
                        </div>

                        {actions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {actions.map((a, i) => (
                                    <Button
                                        key={a}
                                        size="sm"
                                        variant={
                                            i === 0
                                                ? 'default'
                                                : a === 'scrap'
                                                  ? 'ghost'
                                                  : 'outline'
                                        }
                                        onClick={() => setAction(a)}
                                    >
                                        {ACTION_TITLE[a]}
                                    </Button>
                                ))}
                            </div>
                        )}

                        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                            <Fact label="Meters woven">
                                {fmt(reed.meters_woven)} m
                            </Fact>
                            <Fact label="Days on loom">
                                {fmt(reed.days_mounted)}
                            </Fact>
                            <Fact label="Times mounted">
                                {fmt(reed.issue_count)}
                            </Fact>
                            <Fact label="Repairs">
                                {fmt(reed.repair_count)}
                            </Fact>
                            <Fact label="Last inspected">
                                {fmtDate(reed.last_inspected_at)}
                            </Fact>
                            <Fact label="Received">
                                {fmtDate(reed.received_on)}
                            </Fact>
                            <Fact label="Supplier">{reed.supplier ?? '—'}</Fact>
                            <Fact label="PO">{reed.po_no ?? '—'}</Fact>
                            <Fact label="Unit cost">
                                {reed.unit_cost !== null
                                    ? `Rp ${fmt(reed.unit_cost)}`
                                    : '—'}
                            </Fact>
                        </dl>

                        <Tabs defaultValue="history">
                            <TabsList>
                                <TabsTrigger value="history">
                                    History ({detail.movements.length})
                                </TabsTrigger>
                                <TabsTrigger value="inspections">
                                    Inspections ({detail.inspections.length})
                                </TabsTrigger>
                                <TabsTrigger value="repairs">
                                    Repairs ({detail.repairs.length})
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="history">
                                <ol className="relative ml-2 border-l">
                                    {detail.movements.map((m) => (
                                        <li
                                            key={m.id}
                                            className="relative pb-3 pl-4"
                                        >
                                            <span
                                                aria-hidden
                                                className={`absolute top-1.5 -left-[5px] size-2.5 rounded-full ring-2 ring-background ${STATUS_META[m.to_status].dot}`}
                                            />
                                            <div className="flex flex-wrap items-baseline gap-x-2">
                                                <span className="text-sm font-medium">
                                                    {MOVEMENT_LABEL[m.type] ??
                                                        m.type}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {fmtDate(
                                                        m.occurred_at,
                                                        true,
                                                    )}
                                                </span>
                                                {m.user && (
                                                    <span className="text-xs text-muted-foreground">
                                                        · {m.user.name}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {[
                                                    m.loom_number &&
                                                        `Loom ${m.loom_number}`,
                                                    m.fabric_style &&
                                                        `style ${m.fabric_style.code}`,
                                                    m.order_no &&
                                                        `order ${m.order_no}`,
                                                    m.meters !== null &&
                                                        `${fmt(m.meters)} m`,
                                                    m.type === 'transfer' &&
                                                        `${m.from_location?.code ?? '—'} → ${m.to_location?.code ?? '—'}`,
                                                    m.type !== 'transfer' &&
                                                        m.to_location &&
                                                        `in ${m.to_location.code}`,
                                                    m.note,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </p>
                                        </li>
                                    ))}
                                </ol>
                            </TabsContent>

                            <TabsContent
                                value="inspections"
                                className="space-y-2"
                            >
                                {detail.inspections.length === 0 && (
                                    <p className="py-4 text-sm text-muted-foreground">
                                        Not inspected yet.
                                    </p>
                                )}
                                {detail.inspections.map((i) => {
                                    const found = CHECKS.filter(
                                        (c) => i.checklist?.[c.key],
                                    ).map((c) => c.label);
                                    return (
                                        <div
                                            key={i.id}
                                            className="rounded-md border px-3 py-2 text-sm"
                                        >
                                            <div className="flex items-center gap-2">
                                                <ReedGradeBadge
                                                    grade={i.grade}
                                                />
                                                <span className="text-xs text-muted-foreground">
                                                    {fmtDate(
                                                        i.inspected_at,
                                                        true,
                                                    )}
                                                    {i.user &&
                                                        ` · ${i.user.name}`}
                                                </span>
                                            </div>
                                            <p className="mt-1">
                                                {found.length
                                                    ? found.join(', ')
                                                    : 'No defects found'}
                                            </p>
                                            {(i.defect_dents || i.note) && (
                                                <p className="text-xs text-muted-foreground">
                                                    {[
                                                        i.defect_dents &&
                                                            `Dents ${i.defect_dents}`,
                                                        i.note,
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' · ')}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </TabsContent>

                            <TabsContent value="repairs" className="space-y-2">
                                {detail.repairs.length === 0 && (
                                    <p className="py-4 text-sm text-muted-foreground">
                                        Never repaired.
                                    </p>
                                )}
                                {detail.repairs.map((r) => (
                                    <div
                                        key={r.id}
                                        className="rounded-md border px-3 py-2 text-sm"
                                    >
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                            <span className="font-medium">
                                                {r.vendor}
                                            </span>
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {fmtDate(r.sent_on)} →{' '}
                                                {r.returned_on
                                                    ? fmtDate(r.returned_on)
                                                    : 'still out'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {[
                                                r.defects,
                                                r.work_done,
                                                r.cost !== null &&
                                                    `Rp ${fmt(r.cost)}`,
                                            ]
                                                .filter(Boolean)
                                                .join(' · ') || '—'}
                                        </p>
                                    </div>
                                ))}
                            </TabsContent>
                        </Tabs>

                        <Button
                            variant="outline"
                            size="sm"
                            className="self-start"
                            asChild
                        >
                            <a
                                href={`/reed-labels?ids=${reed.id}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <PrinterIcon />
                                Print label
                            </a>
                        </Button>
                    </div>
                )}

                {reed && action && (
                    <ReedActionDialog
                        reed={reed}
                        action={action}
                        options={options}
                        onClose={() => setAction(null)}
                        onDone={done}
                    />
                )}
            </SheetContent>
        </Sheet>
    );
}
