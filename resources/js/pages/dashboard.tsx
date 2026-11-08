import { Empty } from '@/components/data-grid-cells';
import { type KpiItem, KpiStrip } from '@/components/kpi-strip';
import { PageHeader } from '@/components/page-header';
import {
    buildTensionKpis,
    type TensionSummary,
} from '@/components/tension-kpi-strip';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useJson } from '@/hooks/use-json';
import AppLayout from '@/layouts/app-layout';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import {
    ClipboardListIcon,
    GaugeIcon,
    ScanBarcodeIcon,
    ZapIcon,
} from 'lucide-react';
import { type ReactNode } from 'react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';

// Props from DashboardController::stats() (shared with the mobile home screen).
interface Props {
    tension: {
        total: number;
        twisting: number;
        weaving: number;
        open_problems: number;
    } | null;
    stockTake: {
        total: number;
        in_progress: number;
        completed: number;
        completion: number;
    } | null;
    users: { total: number; unassigned: number } | null;
}

// From DashboardController::overview().
interface Overview {
    tension: {
        daily: { date: string; twisting: number; weaving: number }[];
        open_problems_total: number;
        open_problems: {
            record_id: string;
            record_type: 'twisting' | 'weaving';
            machine: string | null;
            position: string | null;
            description: string | null;
            reported_at: string | null;
            age_hours: number | null;
        }[];
        machines: {
            machine: string;
            type: 'twisting' | 'weaving';
            last_checked: string;
            open_problems: number;
        }[];
    } | null;
    stock_take:
        | {
              id: number;
              session_id: string;
              leader: string | null;
              status: string | null;
              checked: number;
              total: number;
              started_at: string | null;
          }[]
        | null;
    activity:
        | { id: number; at: string | null; who: string; summary: string }[]
        | null;
}

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Home', href: '' }];

const QUICK_ACTIONS = [
    {
        label: 'Twisting tension',
        href: '/twisting-tension-main',
        permission: 'tension-records.create',
        icon: ZapIcon,
    },
    {
        label: 'Weaving tension',
        href: '/weaving-tension-main',
        permission: 'tension-records.create',
        icon: GaugeIcon,
    },
    {
        label: 'Start stock take',
        href: '/batch-stock-taking-main',
        permission: 'stock-take.create',
        icon: ClipboardListIcon,
    },
    {
        label: 'Scan finish earlier',
        href: '/finish-earlier-scan',
        permission: 'finish-earlier.create',
        icon: ScanBarcodeIcon,
    },
] as const;

/** A machine counts as overdue when it hasn't been checked today or in the two days before. */
const OVERDUE_DAYS = 3;

const tzOffset = () => -new Date().getTimezoneOffset();

const formatAge = (hours: number | null) => {
    if (hours === null) return null;
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
    if (hours < 24) return `${Math.floor(hours)}h`;
    const days = Math.floor(hours / 24);
    const rest = Math.floor(hours % 24);
    return rest && days < 3 ? `${days}d ${rest}h` : `${days}d`;
};

/** Whole local days between a timestamp and today (0 = today). */
const daysAgo = (iso: string) => {
    const then = new Date(iso);
    const start = (d: Date) =>
        new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return Math.round((start(new Date()) - start(then)) / 86_400_000);
};

const shortDate = (iso: string) =>
    new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' }).format(
        new Date(`${iso}T00:00:00`),
    );

const clock = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const days = daysAgo(iso);
    const time = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(d);
    if (days === 0) return time;
    if (days === 1) return `Yest. ${time}`;
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: '2-digit',
    }).format(d);
};

function Panel({
    title,
    meta,
    action,
    children,
    className,
}: {
    title: string;
    meta?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            aria-label={title}
            className={cn(
                'flex min-w-0 flex-col overflow-hidden rounded-lg border',
                className,
            )}
        >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
                <h2 className="truncate text-[13px] font-semibold">{title}</h2>
                {meta && (
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                        {meta}
                    </span>
                )}
                {action && <div className="ml-auto shrink-0">{action}</div>}
            </div>
            {children}
        </section>
    );
}

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
    return (
        <Link
            href={href}
            className="text-xs text-muted-foreground hover:text-foreground"
        >
            {children} →
        </Link>
    );
}

function PanelSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-3 p-3">
            {Array.from({ length: rows }, (_, i) => (
                <Skeleton
                    key={i}
                    className="h-3.5"
                    style={{ width: `${90 - ((i * 13) % 35)}%` }}
                />
            ))}
        </div>
    );
}

function RecordsChart({
    daily,
}: {
    daily: NonNullable<Overview['tension']>['daily'];
}) {
    const twisting = daily.reduce((s, d) => s + d.twisting, 0);
    const weaving = daily.reduce((s, d) => s + d.weaving, 0);
    const busiest = daily.reduce(
        (best, d) =>
            d.twisting + d.weaving > best.twisting + best.weaving ? d : best,
        daily[0],
    );
    const last7 = daily
        .slice(-7)
        .reduce((s, d) => s + d.twisting + d.weaving, 0);
    const prior7 = daily
        .slice(-14, -7)
        .reduce((s, d) => s + d.twisting + d.weaving, 0);
    const total = twisting + weaving;

    const stats: [string, ReactNode][] = [
        ['Total · 30 days', total.toLocaleString('en-US')],
        [
            'Twisting',
            <>
                {twisting.toLocaleString('en-US')}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                    {total ? Math.round((twisting / total) * 100) : 0}%
                </span>
            </>,
        ],
        [
            'Weaving',
            <>
                {weaving.toLocaleString('en-US')}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                    {total ? Math.round((weaving / total) * 100) : 0}%
                </span>
            </>,
        ],
        [
            'Daily average',
            <>
                {(total / daily.length).toFixed(1)}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                    peak {busiest.twisting + busiest.weaving}
                </span>
            </>,
        ],
        [
            'Last 7 days',
            <>
                {last7}{' '}
                <span className="text-xs font-normal text-muted-foreground">
                    {last7 - prior7 >= 0 ? '+' : '−'}
                    {Math.abs(last7 - prior7)} vs prior
                </span>
            </>,
        ],
    ];

    return (
        <>
            <div
                className="min-h-[196px] flex-1 px-2 pt-3 pb-1"
                role="figure"
                aria-label={`Tension records per day for the last 30 days: ${twisting} twisting and ${weaving} weaving.`}
            >
                <ResponsiveContainer
                    width="100%"
                    height="100%"
                    minHeight={180}
                    initialDimension={{ width: 600, height: 180 }}
                >
                    <BarChart
                        data={daily}
                        margin={{ top: 4, right: 8, bottom: 0, left: -12 }}
                        barCategoryGap={3}
                    >
                        <CartesianGrid
                            vertical={false}
                            stroke="var(--border)"
                            strokeDasharray="3 3"
                        />
                        <XAxis
                            dataKey="date"
                            tickFormatter={shortDate}
                            interval={6}
                            tick={{
                                fill: 'var(--muted-foreground)',
                                fontSize: 11,
                            }}
                            tickLine={false}
                            axisLine={{ stroke: 'var(--border)' }}
                        />
                        <YAxis
                            allowDecimals={false}
                            width={36}
                            tick={{
                                fill: 'var(--muted-foreground)',
                                fontSize: 11,
                            }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            cursor={{ fill: 'var(--muted)' }}
                            labelFormatter={(d) => shortDate(String(d))}
                            contentStyle={{
                                background: 'var(--popover)',
                                border: '1px solid var(--border)',
                                borderRadius: 6,
                                fontSize: 12,
                                color: 'var(--popover-foreground)',
                            }}
                        />
                        <Bar
                            dataKey="twisting"
                            name="Twisting"
                            stackId="r"
                            fill="var(--foreground)"
                            fillOpacity={0.75}
                            isAnimationActive={false}
                        />
                        <Bar
                            dataKey="weaving"
                            name="Weaving"
                            stackId="r"
                            fill="var(--muted-foreground)"
                            fillOpacity={0.45}
                            radius={[2, 2, 0, 0]}
                            isAnimationActive={false}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <dl className="mt-auto grid grid-cols-2 border-t sm:grid-cols-5">
                {stats.map(([label, value]) => (
                    <div
                        key={label}
                        className="min-w-0 border-r px-3 py-2 last:border-r-0"
                    >
                        <dt className="truncate text-[11px] text-muted-foreground">
                            {label}
                        </dt>
                        <dd className="mt-0.5 truncate text-[15px] font-semibold tabular-nums">
                            {value}
                        </dd>
                    </div>
                ))}
            </dl>
        </>
    );
}

function MachineGrid({
    machines,
}: {
    machines: NonNullable<Overview['tension']>['machines'];
}) {
    const groups = (['twisting', 'weaving'] as const)
        .map((type) => ({
            type,
            list: machines.filter((m) => m.type === type),
        }))
        .filter((g) => g.list.length);

    if (!groups.length) {
        return (
            <p className="p-3 text-xs text-muted-foreground">
                No machines checked in the last 30 days.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-2.5 p-3">
            {groups.map((group) => (
                <div key={group.type}>
                    <div className="mb-1 text-[11px] text-muted-foreground capitalize">
                        {group.type} · {group.list.length}{' '}
                        {group.list.length === 1 ? 'machine' : 'machines'}
                    </div>
                    <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.75rem,1fr))] gap-1">
                        {group.list.map((m) => {
                            const days = daysAgo(m.last_checked);
                            const state =
                                m.open_problems > 0
                                    ? 'open'
                                    : days >= OVERDUE_DAYS
                                      ? 'overdue'
                                      : 'ok';
                            const ago = days === 0 ? 'today' : `${days}d ago`;
                            return (
                                <li key={`${m.type}-${m.machine}`}>
                                    <Link
                                        href={`/tension-records-display?tab=${m.type}`}
                                        title={`${m.machine}: last checked ${ago}${m.open_problems ? `, ${m.open_problems} open problem${m.open_problems > 1 ? 's' : ''}` : ''}`}
                                        className={cn(
                                            'flex flex-col rounded px-1.5 py-1 text-[11px] leading-tight transition-colors',
                                            state === 'open' &&
                                                'border border-orange-200 bg-orange-50 hover:bg-orange-100 dark:border-orange-900 dark:bg-orange-950/40',
                                            state === 'overdue' &&
                                                'border border-dashed border-muted-foreground/50 hover:bg-muted',
                                            state === 'ok' &&
                                                'border border-emerald-100 bg-emerald-50 hover:bg-emerald-100 dark:border-emerald-950 dark:bg-emerald-950/30',
                                        )}
                                    >
                                        <span className="font-mono font-medium">
                                            {m.machine}
                                        </span>
                                        <span
                                            className={cn(
                                                'tabular-nums',
                                                state === 'open' &&
                                                    'text-orange-700 dark:text-orange-400',
                                                state === 'overdue' &&
                                                    'text-muted-foreground',
                                                state === 'ok' &&
                                                    'text-emerald-700 dark:text-emerald-400',
                                            )}
                                        >
                                            {state === 'open'
                                                ? `${m.open_problems} open`
                                                : ago}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </div>
    );
}

export default function Dashboard({ stockTake, users }: Props) {
    const { can } = usePermissions();
    const actions = QUICK_ACTIONS.filter((a) => can(a.permission));
    const canTension = can('tension-records.view');

    const offset = tzOffset();
    const overview = useJson<Overview>(
        `/dashboard-overview?tz_offset=${offset}`,
    );
    const summary = useJson<{ data: TensionSummary }>(
        canTension ? `/tension-summary?tz_offset=${offset}` : null,
    );

    const kpis: KpiItem[] = [];
    if (canTension && summary.data) {
        kpis.push(
            ...buildTensionKpis(summary.data.data, () =>
                router.visit('/tension-records-display?tab=problems'),
            ),
        );
    }
    if (stockTake) {
        kpis.push({
            label: 'Stock take',
            value: `${stockTake.completion}%`,
            sub: stockTake.in_progress
                ? `${stockTake.in_progress} in progress`
                : 'none in progress',
            onClick: () => router.visit('/stock-take-records-main'),
        });
    }
    if (users && users.unassigned > 0) {
        kpis.push({
            label: 'Users without a role',
            value: users.unassigned,
            sub: 'assign a role',
            tone: 'bad',
            onClick: () => router.visit('/user-maintenance'),
        });
    }

    const t = overview.data?.tension ?? null;
    const loadingOverview = !overview.data && !overview.error;
    const today = new Intl.DateTimeFormat('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date());

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Overview" />
            <div className="flex flex-1 flex-col gap-(--density-gutter) p-4">
                <PageHeader
                    title="Overview"
                    meta={today}
                    actions={actions.map(({ label, href, icon: Icon }) => (
                        <Button key={href} variant="outline" size="xs" asChild>
                            <Link href={href}>
                                <Icon />
                                {label}
                            </Link>
                        </Button>
                    ))}
                />

                {(canTension ||
                    stockTake ||
                    (users && users.unassigned > 0)) && (
                    <KpiStrip
                        label="Key figures"
                        loading={canTension && !summary.data && !summary.error}
                        error={summary.error}
                        onRetry={summary.retry}
                        items={kpis}
                    />
                )}

                {overview.error && (
                    <div
                        role="status"
                        className="flex items-center gap-3 rounded-lg border px-3 py-2 text-xs"
                    >
                        <span>
                            Couldn&apos;t load the overview panels (
                            {overview.error}).
                        </span>
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={overview.retry}
                        >
                            Try again
                        </Button>
                    </div>
                )}

                {(canTension || loadingOverview) && (
                    <div className="grid gap-(--density-gutter) lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
                        <Panel
                            title="Tension records per day"
                            meta="last 30 days"
                            action={
                                <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                        <span
                                            aria-hidden="true"
                                            className="size-2.5 rounded-[2px] bg-foreground/75"
                                        />
                                        Twisting
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <span
                                            aria-hidden="true"
                                            className="size-2.5 rounded-[2px] bg-muted-foreground/45"
                                        />
                                        Weaving
                                    </span>
                                </span>
                            }
                        >
                            {t ? (
                                <RecordsChart daily={t.daily} />
                            ) : (
                                <PanelSkeleton rows={6} />
                            )}
                        </Panel>

                        <Panel
                            title="Open problems"
                            meta={
                                t
                                    ? `${t.open_problems_total} total · oldest first`
                                    : undefined
                            }
                            action={
                                <PanelLink href="/tension-records-display?tab=problems">
                                    View all
                                </PanelLink>
                            }
                        >
                            {!t ? (
                                <PanelSkeleton rows={8} />
                            ) : t.open_problems.length === 0 ? (
                                <p className="p-3 text-xs text-muted-foreground">
                                    No open problems. Everything reported has
                                    been resolved.
                                </p>
                            ) : (
                                <Table size="dense" className="table-fixed">
                                    <colgroup>
                                        <col className="w-16" />
                                        <col className="w-24" />
                                        <col />
                                        <col className="w-16" />
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Machine</TableHead>
                                            <TableHead>Position</TableHead>
                                            <TableHead>Issue</TableHead>
                                            <TableHead className="text-right">
                                                Age
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {t.open_problems.map((p, i) => (
                                            <TableRow
                                                key={`${p.record_id}-${i}`}
                                                className="cursor-pointer"
                                                onClick={() =>
                                                    router.visit(
                                                        '/tension-records-display?tab=problems',
                                                    )
                                                }
                                            >
                                                <TableCell className="font-mono text-xs font-medium">
                                                    {p.machine ?? <Empty />}
                                                </TableCell>
                                                <TableCell className="font-mono text-xs text-muted-foreground">
                                                    {p.position ?? <Empty />}
                                                </TableCell>
                                                <TableCell
                                                    className="truncate"
                                                    title={
                                                        p.description ??
                                                        undefined
                                                    }
                                                >
                                                    {p.description ?? <Empty />}
                                                </TableCell>
                                                <TableCell
                                                    className={cn(
                                                        'text-right',
                                                        (p.age_hours ?? 0) >=
                                                            24 &&
                                                            'font-medium text-orange-700 dark:text-orange-400',
                                                    )}
                                                >
                                                    {formatAge(p.age_hours) ?? (
                                                        <Empty />
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </Panel>
                    </div>
                )}

                <div className="grid gap-(--density-gutter) lg:grid-cols-[minmax(0,5fr)_minmax(0,4fr)_minmax(0,4fr)]">
                    {(canTension || loadingOverview) && (
                        <Panel
                            title="Last tension check"
                            action={
                                <span className="flex items-center gap-2.5 text-[11px] text-muted-foreground">
                                    <span className="inline-flex items-center gap-1">
                                        <span
                                            aria-hidden="true"
                                            className="size-2 rounded-full bg-emerald-600"
                                        />
                                        OK
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <span
                                            aria-hidden="true"
                                            className="size-2 rounded-full bg-orange-500"
                                        />
                                        Open problem
                                    </span>
                                    <span className="inline-flex items-center gap-1">
                                        <span
                                            aria-hidden="true"
                                            className="size-2 rounded-full border border-dashed border-muted-foreground"
                                        />
                                        {OVERDUE_DAYS}+ days
                                    </span>
                                </span>
                            }
                        >
                            {t ? (
                                <MachineGrid machines={t.machines} />
                            ) : (
                                <PanelSkeleton rows={4} />
                            )}
                        </Panel>
                    )}

                    {(overview.data?.stock_take ||
                        (loadingOverview && can('stock-take.view'))) && (
                        <Panel
                            title="Stock take sessions"
                            action={
                                <PanelLink href="/stock-take-records-main">
                                    All
                                </PanelLink>
                            }
                        >
                            {!overview.data?.stock_take ? (
                                <PanelSkeleton />
                            ) : overview.data.stock_take.length === 0 ? (
                                <p className="p-3 text-xs text-muted-foreground">
                                    No stock take sessions yet.
                                </p>
                            ) : (
                                <Table size="dense" className="table-fixed">
                                    <colgroup>
                                        <col />
                                        <col className="w-24" />
                                        <col className="w-24" />
                                    </colgroup>
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Session</TableHead>
                                            <TableHead>Progress</TableHead>
                                            <TableHead className="text-right">
                                                Batches
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {overview.data.stock_take.map((s) => {
                                            const pct = s.total
                                                ? Math.round(
                                                      (s.checked / s.total) *
                                                          100,
                                                  )
                                                : 0;
                                            const inProgress =
                                                s.status === 'In Progress';
                                            return (
                                                <TableRow key={s.id}>
                                                    <TableCell
                                                        className="truncate"
                                                        title={`${s.session_id}${s.leader ? ` · ${s.leader}` : ''}`}
                                                    >
                                                        <span className="font-mono text-xs font-medium">
                                                            {s.session_id}
                                                        </span>
                                                        {inProgress && (
                                                            <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] text-blue-700 dark:text-blue-400">
                                                                <span
                                                                    aria-hidden="true"
                                                                    className="size-1.5 rounded-full bg-blue-600"
                                                                />
                                                                open
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <span
                                                                aria-hidden="true"
                                                                className="h-1 w-8 overflow-hidden rounded-full bg-muted"
                                                            >
                                                                <span
                                                                    className="block h-full bg-foreground/70"
                                                                    style={{
                                                                        width: `${pct}%`,
                                                                    }}
                                                                />
                                                            </span>
                                                            <span className="text-xs">
                                                                {pct}%
                                                            </span>
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-right text-xs text-muted-foreground">
                                                        {s.checked.toLocaleString(
                                                            'en-US',
                                                        )}
                                                        /
                                                        {s.total.toLocaleString(
                                                            'en-US',
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            )}
                        </Panel>
                    )}

                    {(overview.data?.activity ||
                        (loadingOverview && can('activity-log.view'))) && (
                        <Panel
                            title="Recent activity"
                            action={
                                <PanelLink href="/activity-log">Log</PanelLink>
                            }
                        >
                            {!overview.data?.activity ? (
                                <PanelSkeleton rows={8} />
                            ) : overview.data.activity.length === 0 ? (
                                <p className="p-3 text-xs text-muted-foreground">
                                    Nothing recorded yet.
                                </p>
                            ) : (
                                <ol className="py-1">
                                    {overview.data.activity.map((a) => (
                                        <li
                                            key={a.id}
                                            className="flex items-baseline gap-2.5 px-3 py-1 text-xs"
                                        >
                                            <span className="w-20 shrink-0 font-mono text-[11px] whitespace-nowrap text-muted-foreground tabular-nums">
                                                {clock(a.at)}
                                            </span>
                                            <span
                                                className="min-w-0 truncate"
                                                title={`${a.who} ${a.summary}`}
                                            >
                                                <strong className="font-semibold">
                                                    {a.who}
                                                </strong>{' '}
                                                <span className="text-muted-foreground">
                                                    {a.summary}
                                                </span>
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            )}
                        </Panel>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}
