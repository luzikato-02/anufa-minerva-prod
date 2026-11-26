import { BarcodeScanner } from '@/components/barcode-scanning';
import { KpiStrip, type KpiItem } from '@/components/kpi-strip';
import { PageHeader } from '@/components/page-header';
import { ReedDetailSheet } from '@/components/reeds/reed-detail-sheet';
import { ReedMatchDialog } from '@/components/reeds/reed-match-dialog';
import { ReedReceiveDialog } from '@/components/reeds/reed-receive-dialog';
import {
    NativeSelect,
    ReedGradeBadge,
    ReedStatusLabel,
} from '@/components/reeds/reed-status';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { usePermissions } from '@/lib/permissions';
import {
    fmt,
    fmtDate,
    reedApi,
    STATUS_META,
    STATUS_ORDER,
    type Paged,
    type Reed,
    type ReedListParams,
    type ReedOptions,
    type ReedStats,
    type ReedStatus,
} from '@/lib/reeds';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import {
    ArrowDownIcon,
    ArrowUpIcon,
    PackagePlusIcon,
    PrinterIcon,
    ScanLineIcon,
    SearchIcon,
    Settings2Icon,
} from 'lucide-react';
import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Reed Inventory', href: '/reeds' },
];

const PER_PAGE = 50;

type SortKey = 'serial' | 'status' | 'grade' | 'meters' | 'days' | 'inspected';

/** Every reed, where it is and how worn it is; scan or click one to act on it. */
export default function Reeds() {
    const { can } = usePermissions();
    const [options, setOptions] = useState<ReedOptions | null>(null);
    const [stats, setStats] = useState<ReedStats | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);
    const [page, setPage] = useState<Paged<Reed> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<{
        text: string;
        labelIds?: number[];
    } | null>(null);

    const [search, setSearch] = useState('');
    const [status, setStatus] = useState<ReedStatus | ''>('');
    const [specId, setSpecId] = useState('');
    const [grade, setGrade] = useState('');
    const [locationId, setLocationId] = useState('');
    const [includeScrapped, setIncludeScrapped] = useState(false);
    const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
        key: 'serial',
        dir: 'asc',
    });
    const [pageNo, setPageNo] = useState(1);
    const [selected, setSelected] = useState<Set<number>>(new Set());

    const [openId, setOpenId] = useState<number | null>(null);
    const [scanning, setScanning] = useState(false);
    const [receiving, setReceiving] = useState(false);
    const [matching, setMatching] = useState(false);

    const params: ReedListParams = {
        search: search.trim() || undefined,
        status: status || undefined,
        spec_id: specId ? Number(specId) : undefined,
        grade: grade || undefined,
        location_id: locationId ? Number(locationId) : undefined,
        include_scrapped: includeScrapped,
        sort_by: sort.key,
        sort_dir: sort.dir,
        page: pageNo,
        per_page: PER_PAGE,
    };
    const paramsKey = JSON.stringify(params);

    const loadList = useCallback(() => {
        setLoading(true);
        reedApi
            .list(JSON.parse(paramsKey) as ReedListParams)
            .then((p) => {
                setPage(p);
                setError(null);
            })
            .catch((e) => setError((e as Error).message))
            .finally(() => setLoading(false));
    }, [paramsKey]);

    const loadStats = useCallback(() => {
        reedApi
            .stats()
            .then((s) => {
                setStats(s);
                setStatsError(null);
            })
            .catch((e) => setStatsError((e as Error).message));
    }, []);

    useEffect(() => {
        const t = setTimeout(loadList, 200);
        return () => clearTimeout(t);
    }, [loadList]);
    useEffect(loadStats, [loadStats]);
    useEffect(() => {
        reedApi
            .options()
            .then(setOptions)
            .catch(() => setOptions({ specs: [], styles: [], locations: [] }));
    }, []);
    useEffect(
        () => setPageNo(1),
        [
            search,
            status,
            specId,
            grade,
            locationId,
            includeScrapped,
            sort.key,
            sort.dir,
        ],
    );

    const refresh = () => {
        loadList();
        loadStats();
    };

    const openBySerial = async (code: string) => {
        try {
            const found = await reedApi.byCode(code);
            setOpenId(found.id);
            return true;
        } catch (e) {
            setNotice({ text: (e as Error).message });
            return false;
        }
    };

    // A USB scanner types the serial and presses Enter: open that reed straight away.
    const onSearchKey = async (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter' || !search.trim()) return;
        const rows = page?.data ?? [];
        const exact = rows.find(
            (r) => r.serial_no.toLowerCase() === search.trim().toLowerCase(),
        );
        if (exact) setOpenId(exact.id);
        else if (await openBySerial(search.trim())) setSearch('');
    };

    const by = stats?.by_status;
    const short = stats?.short_specs ?? [];
    const kpis: KpiItem[] = by
        ? [
              {
                  label: 'In stock',
                  value: fmt(by.in_stock),
                  sub: (() => {
                      const usable = stats!.specs.reduce(
                          (n, s) => n + s.usable_in_stock,
                          0,
                      );
                      return usable === by.in_stock
                          ? 'All ready to mount'
                          : `${fmt(usable)} ready to mount (grade A/B)`;
                  })(),
                  onClick: () => setStatus('in_stock'),
              },
              {
                  label: 'On loom',
                  value: fmt(by.on_loom),
                  sub: `${fmt(by.reserved)} reserved`,
                  onClick: () => setStatus('on_loom'),
              },
              {
                  label: 'Waiting for inspection',
                  value: fmt(by.returned),
                  sub: by.returned
                      ? 'Returned from loom or repair'
                      : 'None waiting',
                  tone: by.returned ? 'bad' : 'neutral',
                  onClick: () => setStatus('returned'),
              },
              {
                  label: 'Quarantine / repair',
                  value: `${fmt(by.quarantine)} / ${fmt(by.in_repair)}`,
                  sub: 'Grade C or X, or at the vendor',
                  tone: by.quarantine ? 'bad' : 'neutral',
                  onClick: () => setStatus('quarantine'),
              },
              {
                  label: 'Specs below min stock',
                  value: fmt(short.length),
                  sub: short.length
                      ? short
                            .map((s) => s.code)
                            .slice(0, 3)
                            .join(', ')
                      : `All ${stats!.specs.length} specs covered`,
                  tone: short.length ? 'bad' : 'good',
              },
          ]
        : [];

    const rows = page?.data ?? [];
    const allSelected =
        rows.length > 0 && rows.every((r) => selected.has(r.id));
    const toggleAll = () =>
        setSelected((prev) => {
            const next = new Set(prev);
            rows.forEach((r) =>
                allSelected ? next.delete(r.id) : next.add(r.id),
            );
            return next;
        });
    const toggle = (id: number) =>
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const sortHead = (key: SortKey, label: string, className?: string) => (
        <TableHead
            className={className}
            aria-sort={
                sort.key === key
                    ? sort.dir === 'asc'
                        ? 'ascending'
                        : 'descending'
                    : undefined
            }
        >
            <button
                type="button"
                className={cn(
                    'inline-flex items-center gap-1 hover:text-foreground',
                    className?.includes('text-right') && 'flex-row-reverse',
                )}
                onClick={() =>
                    setSort((s) => ({
                        key,
                        dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc',
                    }))
                }
            >
                {label}
                {sort.key === key &&
                    (sort.dir === 'asc' ? (
                        <ArrowUpIcon className="size-3" />
                    ) : (
                        <ArrowDownIcon className="size-3" />
                    ))}
            </button>
        </TableHead>
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Reed Inventory" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <PageHeader
                    title="Reed Inventory"
                    meta={
                        page
                            ? `${fmt(page.total)} reeds${includeScrapped ? ' incl. scrapped' : ''}`
                            : undefined
                    }
                    actions={
                        <>
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setScanning(true)}
                            >
                                <ScanLineIcon />
                                Scan
                            </Button>
                            <Button
                                size="xs"
                                variant="outline"
                                onClick={() => setMatching(true)}
                            >
                                <SearchIcon />
                                Find for style
                            </Button>
                            {can('reeds.operate') && (
                                <Button
                                    size="xs"
                                    onClick={() => setReceiving(true)}
                                >
                                    <PackagePlusIcon />
                                    Receive
                                </Button>
                            )}
                            <Button
                                size="icon-xs"
                                variant="ghost"
                                asChild
                                aria-label="Reed settings"
                            >
                                <Link href="/reed-settings">
                                    <Settings2Icon />
                                </Link>
                            </Button>
                        </>
                    }
                />

                <KpiStrip
                    label="Reed stock"
                    items={kpis}
                    loading={!stats && !statsError}
                    error={statsError}
                    onRetry={loadStats}
                />

                {short.length > 0 && (
                    <div
                        role="status"
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-orange-300/60 bg-orange-50/60 px-3 py-2 text-xs dark:border-orange-900 dark:bg-orange-950/30"
                    >
                        <span className="font-medium text-orange-800 dark:text-orange-300">
                            Below minimum stock
                        </span>
                        {short.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                className="tabular-nums hover:underline"
                                onClick={() => setSpecId(String(s.id))}
                            >
                                {s.code}: {s.usable_in_stock} of {s.min_stock}{' '}
                                spare · {s.on_loom} on looms
                            </button>
                        ))}
                    </div>
                )}

                {notice && (
                    <Alert role="status">
                        <AlertDescription className="flex flex-wrap items-center gap-3">
                            {notice.text}
                            {notice.labelIds && (
                                <a
                                    className="font-medium underline"
                                    href={`/reed-labels?ids=${notice.labelIds.join(',')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Print {notice.labelIds.length} labels
                                </a>
                            )}
                            <button
                                type="button"
                                className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                                onClick={() => setNotice(null)}
                            >
                                Dismiss
                            </button>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-wrap items-center gap-2">
                    <Input
                        aria-label="Search reeds"
                        placeholder="Search or scan a serial, loom, PO…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => void onSearchKey(e)}
                        className="h-8 w-full sm:w-80"
                    />
                    <NativeSelect
                        aria-label="Status"
                        value={status}
                        onChange={(v) => setStatus(v as ReedStatus | '')}
                        className="h-8 w-auto"
                    >
                        <option value="">All statuses</option>
                        {STATUS_ORDER.filter(
                            (s) => s !== 'scrapped' || includeScrapped,
                        ).map((s) => (
                            <option key={s} value={s}>
                                {STATUS_META[s].label}
                            </option>
                        ))}
                    </NativeSelect>
                    <NativeSelect
                        aria-label="Spec"
                        value={specId}
                        onChange={setSpecId}
                        className="h-8 w-auto"
                    >
                        <option value="">All specs</option>
                        {(options?.specs ?? []).map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.code}
                            </option>
                        ))}
                    </NativeSelect>
                    <NativeSelect
                        aria-label="Grade"
                        value={grade}
                        onChange={setGrade}
                        className="h-8 w-auto"
                    >
                        <option value="">All grades</option>
                        {['A', 'B', 'C', 'X'].map((g) => (
                            <option key={g} value={g}>
                                Grade {g}
                            </option>
                        ))}
                    </NativeSelect>
                    <NativeSelect
                        aria-label="Location"
                        value={locationId}
                        onChange={setLocationId}
                        className="h-8 w-auto"
                    >
                        <option value="">All locations</option>
                        {(options?.locations ?? []).map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.code}
                            </option>
                        ))}
                    </NativeSelect>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                            checked={includeScrapped}
                            onCheckedChange={(v) =>
                                setIncludeScrapped(v === true)
                            }
                        />
                        Show scrapped
                    </label>
                    {selected.size > 0 && (
                        <Button
                            size="xs"
                            variant="outline"
                            className="ml-auto"
                            asChild
                        >
                            <a
                                href={`/reed-labels?ids=${[...selected].join(',')}`}
                                target="_blank"
                                rel="noreferrer"
                            >
                                <PrinterIcon />
                                Print {selected.size} labels
                            </a>
                        </Button>
                    )}
                </div>

                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div className="overflow-x-auto rounded-lg border">
                    <Table size="dense" aria-label="Reeds" aria-busy={loading}>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead className="w-8">
                                    <Checkbox
                                        aria-label="Select all on this page"
                                        checked={allSelected}
                                        onCheckedChange={toggleAll}
                                    />
                                </TableHead>
                                {sortHead('serial', 'Reed')}
                                <TableHead>Spec</TableHead>
                                {sortHead('status', 'Status')}
                                {sortHead('grade', 'Grade')}
                                <TableHead>Location / loom</TableHead>
                                <TableHead>Style</TableHead>
                                {sortHead(
                                    'meters',
                                    'Meters woven',
                                    'text-right',
                                )}
                                {sortHead('days', 'Days on loom', 'text-right')}
                                {sortHead('inspected', 'Last inspected')}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.length === 0 ? (
                                <TableRow className="hover:bg-transparent">
                                    <TableCell
                                        colSpan={10}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        {loading
                                            ? 'Loading reeds…'
                                            : page &&
                                                page.total === 0 &&
                                                !search &&
                                                !status &&
                                                !specId
                                              ? 'No reeds yet. Receive the first ones to start.'
                                              : 'No reed matches these filters.'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((r) => (
                                    <TableRow
                                        key={r.id}
                                        className="cursor-pointer"
                                        onClick={() => setOpenId(r.id)}
                                        data-state={
                                            selected.has(r.id)
                                                ? 'selected'
                                                : undefined
                                        }
                                    >
                                        <TableCell
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Checkbox
                                                aria-label={`Select ${r.serial_no}`}
                                                checked={selected.has(r.id)}
                                                onCheckedChange={() =>
                                                    toggle(r.id)
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <button
                                                type="button"
                                                className="font-mono font-medium underline-offset-2 hover:underline"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setOpenId(r.id);
                                                }}
                                            >
                                                {r.serial_no}
                                            </button>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {r.spec?.code}
                                        </TableCell>
                                        <TableCell>
                                            <ReedStatusLabel
                                                status={r.status}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <ReedGradeBadge grade={r.grade} />
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {r.status === 'on_loom' ? (
                                                <span>
                                                    Loom <b>{r.loom_number}</b>
                                                </span>
                                            ) : (
                                                <>
                                                    {r.location?.code ?? (
                                                        <span className="text-muted-foreground">
                                                            —
                                                        </span>
                                                    )}
                                                    {r.status === 'reserved' &&
                                                        r.loom_number && (
                                                            <span className="text-muted-foreground">
                                                                {' '}
                                                                →{' '}
                                                                {r.loom_number}
                                                            </span>
                                                        )}
                                                </>
                                            )}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">
                                            {r.fabric_style?.code ?? (
                                                <span className="text-muted-foreground">
                                                    —
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmt(r.meters_woven)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmt(r.days_mounted)}
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap tabular-nums">
                                            {fmtDate(r.last_inspected_at)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {page && page.last_page > 1 && (
                    <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                        <span className="tabular-nums">
                            Page {page.current_page} of {page.last_page}
                        </span>
                        <Button
                            size="xs"
                            variant="outline"
                            disabled={page.current_page <= 1}
                            onClick={() => setPageNo((p) => p - 1)}
                        >
                            Previous
                        </Button>
                        <Button
                            size="xs"
                            variant="outline"
                            disabled={page.current_page >= page.last_page}
                            onClick={() => setPageNo((p) => p + 1)}
                        >
                            Next
                        </Button>
                    </div>
                )}
            </div>

            <ReedDetailSheet
                reedId={openId}
                options={options}
                onClose={() => setOpenId(null)}
                onChanged={refresh}
            />

            <BarcodeScanner
                open={scanning}
                onClose={() => setScanning(false)}
                title="Scan a reed label"
                description="Point the camera at the QR code on the reed frame."
                onScan={(code) => {
                    setScanning(false);
                    void openBySerial(code);
                }}
            />

            {receiving && (
                <ReedReceiveDialog
                    options={options}
                    onClose={() => setReceiving(false)}
                    onDone={(reeds) => {
                        setReceiving(false);
                        setNotice({
                            text: `${reeds.length} reeds received (${reeds[0]?.serial_no}${reeds.length > 1 ? ` – ${reeds[reeds.length - 1].serial_no}` : ''}).`,
                            labelIds: reeds.map((r) => r.id),
                        });
                        refresh();
                    }}
                />
            )}

            {matching && (
                <ReedMatchDialog
                    options={options}
                    onClose={() => setMatching(false)}
                    onReserved={refresh}
                    onOpenReed={(id) => {
                        setMatching(false);
                        setOpenId(id);
                    }}
                />
            )}
        </AppLayout>
    );
}
