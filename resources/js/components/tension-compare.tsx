import { type DetailRecord } from '@/components/record-detail-panel';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    type CompareMetric,
    comparisonsApi,
    type SavedComparison,
    type SavedComparisonListItem,
} from '@/lib/tension-comparisons';
import {
    classify,
    creelSides,
    type HeatCell,
    type Reading,
    type Spec,
    specOf,
    twistingCells,
} from '@/lib/tension-heatmap';
import { cn } from '@/lib/utils';
import {
    BookmarkIcon,
    ChartLineIcon,
    CheckIcon,
    DownloadIcon,
    EyeOffIcon,
    Loader2Icon,
    PencilIcon,
    SaveIcon,
    Trash2Icon,
    XIcon,
} from 'lucide-react';
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    CartesianGrid,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    type TooltipContentProps,
    XAxis,
    YAxis,
} from 'recharts';
import {
    type NameType,
    type ValueType,
} from 'recharts/types/component/DefaultTooltipContent';

/** The most records one chart can tell apart: one per palette slot. */
export const MAX_COMPARE = 8;

/**
 * Categorical slots, in a fixed order that keeps neighbouring colours apart
 * for colour-blind readers (validated for both themes). Each record keeps its
 * slot while it stays selected, so hiding or removing one never repaints the
 * others. Defined as CSS variables so dark mode gets its own steps.
 */
const SLOT_VARS =
    '[--s0:#2a78d6] [--s1:#eb6834] [--s2:#1baf7a] [--s3:#eda100] [--s4:#e87ba4] [--s5:#008300] [--s6:#6250d6] [--s7:#e34948] ' +
    'dark:[--s0:#3987e5] dark:[--s1:#d95926] dark:[--s2:#199e70] dark:[--s3:#c98500] dark:[--s4:#d55181] dark:[--s5:#008300] dark:[--s6:#9085e9] dark:[--s7:#e66767]';
const slotColor = (slot: number) => `var(--s${slot})`;

export interface CompareItem {
    record: DetailRecord;
    /** Palette slot, 0–7, kept for as long as the record stays selected. */
    slot: number;
}

type Metric = CompareMetric;

const METRICS: { id: Metric; label: string; help: string }[] = [
    { id: 'max', label: 'Max', help: 'Highest reading at each position' },
    { id: 'min', label: 'Min', help: 'Lowest reading at each position' },
    {
        id: 'avg',
        label: 'Average',
        help: 'Midpoint of max and min at each position',
    },
    {
        id: 'spread',
        label: 'Spread',
        help: 'Max minus min at each position',
    },
];

const valueOf = (r: Reading, metric: Metric): number | null => {
    const { max, min } = r;
    switch (metric) {
        case 'max':
            return max;
        case 'min':
            return min;
        case 'avg':
            if (max !== null && min !== null) return (max + min) / 2;
            return max ?? min;
        case 'spread':
            return max !== null && min !== null ? max - min : null;
    }
};

const round1 = (v: number) => Math.round(v * 10) / 10;
const fmt = (v: number | null) =>
    v === null
        ? '—'
        : round1(v).toLocaleString('en-US', { maximumFractionDigits: 1 });

const str = (v: unknown) =>
    v === null || v === undefined || v === '' ? null : String(v);

/** "TW-05", "07/11 22:18", "Asep R." for legend, tooltip and table. */
function describe(record: DetailRecord) {
    const meta = (record.metadata ?? {}) as Record<string, unknown>;
    const form = (record.form_data ?? {}) as Record<string, unknown>;
    const machine =
        str(meta.machine_number) ?? str(form.machineNumber) ?? 'Record';
    const at = record.created_at ? new Date(record.created_at) : null;
    const when =
        at && !Number.isNaN(at.getTime())
            ? new Intl.DateTimeFormat('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
              }).format(at)
            : null;
    return {
        machine,
        when,
        operator: str(meta.operator),
        item: str(meta.item_number) ?? str(form.itemNumber),
        label: [machine, when].filter(Boolean).join(' · '),
    };
}

const SIDE_ORDER = ['AI', 'AO', 'BI', 'BO'];

/** Weaving keys "AO-3-Col12" → side order, then row, then column. */
function weavingKeyOrder(a: string, b: string) {
    const parse = (k: string) => {
        const [side, row, col] = k.replace('Col', '').split('-');
        const si = SIDE_ORDER.indexOf(side);
        return [si === -1 ? 99 : si, side, Number(row), Number(col)] as const;
    };
    const [sa, na, ra, ca] = parse(a);
    const [sb, nb, rb, cb] = parse(b);
    return sa - sb || na.localeCompare(nb) || ra - rb || ca - cb;
}

interface Series {
    item: CompareItem;
    info: ReturnType<typeof describe>;
    spec: Spec | null;
    cells: Map<string, HeatCell>;
    stats: {
        measured: number;
        positions: number;
        avgMax: number | null;
        avgMin: number | null;
        avgSpread: number | null;
        above: number;
        below: number;
    };
}

function buildSeries(item: CompareItem): Series {
    const { record } = item;
    const spec = specOf(
        record.form_data as { specTens?: unknown; tensPlus?: unknown },
    );
    const cellList =
        record.record_type === 'weaving'
            ? creelSides(record.measurement_data, spec).flatMap((s) => s.cells)
            : twistingCells(
                  record.measurement_data,
                  Number(
                      (record.metadata as Record<string, unknown> | null)
                          ?.total_measurements ?? 0,
                  ) || null,
                  spec,
              );

    const mean = (xs: number[]) =>
        xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null;
    const maxes: number[] = [];
    const mins: number[] = [];
    const spreads: number[] = [];
    let measured = 0;
    let above = 0;
    let below = 0;
    for (const c of cellList) {
        if (c.max === null && c.min === null) continue;
        measured++;
        if (c.max !== null) maxes.push(c.max);
        if (c.min !== null) mins.push(c.min);
        if (c.max !== null && c.min !== null) spreads.push(c.max - c.min);
        const band = classify(c, spec);
        if (band === 'above') above++;
        if (band === 'below') below++;
    }

    return {
        item,
        info: describe(record),
        spec,
        cells: new Map(cellList.map((c) => [c.key, c])),
        stats: {
            measured,
            positions: cellList.length,
            avgMax: mean(maxes),
            avgMin: mean(mins),
            avgSpread: mean(spreads),
            above,
            below,
        },
    };
}

type Row = { key: string; position: string } & Record<
    string,
    number | string | null
>;

function CompareTooltip({
    active,
    payload,
    series,
    metric,
}: TooltipContentProps<ValueType, NameType> & {
    series: Series[];
    metric: Metric;
}) {
    const row = active ? (payload?.[0]?.payload as Row | undefined) : undefined;
    if (!row) return null;
    return (
        <div className="min-w-48 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
            <div className="mb-1 font-mono font-semibold">{row.position}</div>
            <table className="w-full">
                <tbody>
                    {series.map((s) => {
                        const cell = s.cells.get(row.key);
                        const v = cell ? valueOf(cell, metric) : null;
                        const band =
                            cell && metric !== 'spread'
                                ? classify(cell, s.spec)
                                : null;
                        return (
                            <tr key={s.item.record.id}>
                                <td className="pr-2">
                                    <span className="inline-flex items-center gap-1.5">
                                        <span
                                            aria-hidden="true"
                                            className="h-0.5 w-3 rounded-full"
                                            style={{
                                                background: slotColor(
                                                    s.item.slot,
                                                ),
                                            }}
                                        />
                                        <span className="font-mono">
                                            {s.info.machine}
                                        </span>
                                        <span className="text-muted-foreground">
                                            {s.info.when}
                                        </span>
                                    </span>
                                </td>
                                <td className="text-right font-semibold tabular-nums">
                                    {fmt(v)}
                                </td>
                                <td className="pl-1.5 text-muted-foreground">
                                    {band === 'above'
                                        ? '↑ above'
                                        : band === 'below'
                                          ? '↓ below'
                                          : ''}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

/**
 * Several tension records of one type on one chart: one line per record across
 * its spindles (twisting) or creel positions (weaving), with a figures table.
 */
export function TensionCompareDialog({
    items,
    open,
    onOpenChange,
    onRemove,
    metric,
    onMetricChange: setMetric,
    hidden,
    onToggleHidden: toggle,
    title,
    saveControls,
    notice,
}: {
    items: CompareItem[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRemove: (id: string) => void;
    metric: Metric;
    onMetricChange: (metric: Metric) => void;
    /** Ids of records kept in the comparison but not drawn. */
    hidden: Set<string>;
    onToggleHidden: (id: string) => void;
    /** A saved comparison's name, shown above the default title. */
    title?: string;
    /** Save, rename and delete controls, shown at the end of the toolbar. */
    saveControls?: ReactNode;
    /** A line under the title, e.g. records deleted since saving. */
    notice?: ReactNode;
}) {
    // Close once fewer than two records are left to compare.
    useEffect(() => {
        if (open && items.length < 2) onOpenChange(false);
    }, [open, items.length, onOpenChange]);

    const series = useMemo(() => items.map(buildSeries), [items]);
    const weaving = items[0]?.record.record_type === 'weaving';
    const visible = series.filter((s) => !hidden.has(String(s.item.record.id)));

    const rows = useMemo<Row[]>(() => {
        const keys = new Set<string>();
        for (const s of series) for (const k of s.cells.keys()) keys.add(k);
        const ordered = [...keys].sort(
            weaving ? weavingKeyOrder : (a, b) => Number(a) - Number(b),
        );
        return ordered.map((key) => {
            const first = series
                .map((s) => s.cells.get(key))
                .find(Boolean) as HeatCell;
            const row: Row = { key, position: first.position };
            for (const s of series) {
                const cell = s.cells.get(key);
                const v = cell ? valueOf(cell, metric) : null;
                row[`s${s.item.slot}`] = v === null ? null : round1(v);
            }
            return row;
        });
    }, [series, metric, weaving]);

    // Spec lines only make sense when every record shares one spec.
    const sharedSpec = useMemo(() => {
        const specs = series.map((s) => s.spec);
        const first = specs[0];
        if (!first) return null;
        return specs.every(
            (s) =>
                s &&
                s.target === first.target &&
                s.tolerance === first.tolerance,
        )
            ? first
            : null;
    }, [series]);
    const specsDiffer =
        !sharedSpec && series.some((s) => s.spec) && metric !== 'spread';

    const ticks = useMemo(() => {
        if (!weaving)
            return rows
                .filter((r, i) => i === 0 || Number(r.key) % 10 === 0)
                .map((r) => r.key);
        const starts: string[] = [];
        let previous = '';
        for (const r of rows) {
            const side = r.key.split('-')[0];
            if (side !== previous) starts.push(r.key);
            previous = side;
        }
        return starts;
    }, [rows, weaving]);

    // Direct labels at each line's last point, when few enough to stay legible.
    const lastIndex = useMemo(() => {
        const out = new Map<number, number>();
        for (const s of visible) {
            for (let i = rows.length - 1; i >= 0; i--) {
                if (rows[i][`s${s.item.slot}`] != null) {
                    out.set(s.item.slot, i);
                    break;
                }
            }
        }
        return out;
    }, [rows, visible]);
    // ...and only when the line ends sit far enough apart not to collide.
    const directLabels = useMemo(() => {
        if (visible.length > 4) return false;
        const all: number[] = [];
        for (const r of rows)
            for (const s of visible) {
                const v = r[`s${s.item.slot}`];
                if (typeof v === 'number') all.push(v);
            }
        const ends = visible
            .map((s) => {
                const i = lastIndex.get(s.item.slot);
                const v = i === undefined ? null : rows[i][`s${s.item.slot}`];
                return typeof v === 'number' ? v : null;
            })
            .filter((v): v is number => v !== null)
            .sort((a, b) => a - b);
        if (!all.length) return false;
        const span = Math.max(...all) - Math.min(...all) || 1;
        return ends.every(
            (v, i) => i === 0 || (v - ends[i - 1]) / span >= 0.06,
        );
    }, [rows, visible, lastIndex]);

    const downloadCsv = () => {
        const header = [
            'Position',
            ...series.map((s) => `${s.info.label} (${metricLabel})`),
        ];
        const lines = [
            header,
            ...rows.map((r) => [
                r.position,
                ...series.map((s) => r[`s${s.item.slot}`] ?? ''),
            ]),
        ].map((cols) =>
            cols
                .map((c) => {
                    const t = String(c ?? '');
                    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
                })
                .join(','),
        );
        const url = URL.createObjectURL(
            new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }),
        );
        const a = document.createElement('a');
        a.href = url;
        a.download = `${weaving ? 'weaving' : 'twisting'}-tension-compare-${metric}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const metricInfo = METRICS.find((m) => m.id === metric)!;
    const metricLabel = metricInfo.label.toLowerCase();
    const kind = weaving ? 'weaving' : 'twisting';
    const axisName = weaving ? 'creel position' : 'spindle';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                // Escape inside the name box cancels the rename, not the whole window.
                onEscapeKeyDown={(e) => {
                    if (
                        (e.target as HTMLElement | null)?.closest?.(
                            '[data-escape-local]',
                        )
                    )
                        e.preventDefault();
                }}
                className={cn(
                    SLOT_VARS,
                    'flex max-h-[92vh] flex-col gap-3 overflow-y-auto p-4 sm:max-w-6xl',
                )}
            >
                <DialogHeader className="gap-0.5 pr-8">
                    <DialogTitle className="text-base">
                        {title ?? `Compare ${items.length} ${kind} records`}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        {title && `${items.length} ${kind} records. `}
                        {metricInfo.help}, per {axisName}. Click a record in the
                        legend to hide or show it.
                    </DialogDescription>
                    {notice}
                </DialogHeader>

                <div className="flex flex-wrap items-center gap-2">
                    <div
                        role="group"
                        aria-label="Value to plot"
                        className="inline-flex gap-0.5 rounded-md bg-muted p-0.5"
                    >
                        {METRICS.map((m) => (
                            <button
                                key={m.id}
                                type="button"
                                title={m.help}
                                aria-pressed={metric === m.id}
                                onClick={() => setMetric(m.id)}
                                className={cn(
                                    'inline-flex h-6 items-center rounded px-2.5 text-xs font-medium',
                                    metric === m.id
                                        ? 'bg-background shadow-xs'
                                        : 'text-muted-on-muted hover:text-foreground',
                                )}
                            >
                                {m.label}
                            </button>
                        ))}
                    </div>
                    {sharedSpec && metric !== 'spread' && (
                        <span className="text-xs text-muted-foreground tabular-nums">
                            Spec {sharedSpec.target} ±{sharedSpec.tolerance} cN
                        </span>
                    )}
                    {specsDiffer && (
                        <span className="text-xs text-muted-foreground">
                            Specs differ, so no limit lines are drawn; see the
                            table below.
                        </span>
                    )}
                    <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        {saveControls}
                        <Button
                            variant="outline"
                            size="xs"
                            onClick={downloadCsv}
                        >
                            <DownloadIcon />
                            CSV
                        </Button>
                    </div>
                </div>

                <ul
                    aria-label="Records in this chart"
                    className="flex flex-wrap gap-1.5"
                >
                    {series.map((s) => {
                        const id = String(s.item.record.id);
                        const off = hidden.has(id);
                        return (
                            <li
                                key={id}
                                className={cn(
                                    'inline-flex items-center rounded-md border',
                                    off && 'border-dashed',
                                )}
                            >
                                <button
                                    type="button"
                                    aria-pressed={!off}
                                    title={
                                        off
                                            ? 'Show on chart'
                                            : 'Hide from chart'
                                    }
                                    onClick={() => toggle(id)}
                                    className={cn(
                                        'inline-flex h-7 items-center gap-1.5 rounded-l-md pr-1.5 pl-2 text-xs hover:bg-muted',
                                        off && 'text-muted-foreground',
                                    )}
                                >
                                    {off ? (
                                        <EyeOffIcon
                                            className="size-3"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <span
                                            aria-hidden="true"
                                            className="h-0.5 w-3.5 rounded-full"
                                            style={{
                                                background: slotColor(
                                                    s.item.slot,
                                                ),
                                            }}
                                        />
                                    )}
                                    <span className="font-mono font-medium">
                                        {s.info.machine}
                                    </span>
                                    {s.info.when && (
                                        <span className="text-muted-foreground tabular-nums">
                                            {s.info.when}
                                        </span>
                                    )}
                                    {s.info.operator && (
                                        <span className="hidden text-muted-foreground sm:inline">
                                            · {s.info.operator}
                                        </span>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    aria-label={`Remove ${s.info.label} from the comparison`}
                                    onClick={() => onRemove(id)}
                                    className="inline-flex h-7 w-6 items-center justify-center rounded-r-md text-muted-foreground hover:bg-muted hover:text-foreground"
                                >
                                    <XIcon
                                        className="size-3"
                                        aria-hidden="true"
                                    />
                                </button>
                            </li>
                        );
                    })}
                </ul>

                <figure
                    aria-label={`${metricInfo.label} tension per ${axisName} for ${visible.map((s) => s.info.label).join(', ')}`}
                    className="m-0 rounded-lg border px-1 pt-3 pb-1"
                >
                    {visible.length === 0 ? (
                        <p className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                            Every record is hidden. Click one in the legend to
                            show it.
                        </p>
                    ) : (
                        <ResponsiveContainer width="100%" height={340}>
                            <LineChart
                                data={rows}
                                margin={{
                                    top: 8,
                                    right: directLabels ? 64 : 16,
                                    bottom: 4,
                                    left: 0,
                                }}
                            >
                                <CartesianGrid
                                    stroke="var(--border)"
                                    strokeDasharray="3 3"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="key"
                                    ticks={ticks}
                                    interval={0}
                                    tickFormatter={(k: string) =>
                                        weaving ? k.split('-')[0] : k
                                    }
                                    tick={{
                                        fill: 'var(--muted-foreground)',
                                        fontSize: 11,
                                    }}
                                    tickLine={false}
                                    axisLine={{ stroke: 'var(--border)' }}
                                />
                                <YAxis
                                    width={44}
                                    domain={['auto', 'auto']}
                                    allowDecimals={false}
                                    tick={{
                                        fill: 'var(--muted-foreground)',
                                        fontSize: 11,
                                    }}
                                    tickLine={false}
                                    axisLine={false}
                                    label={{
                                        value: 'cN',
                                        angle: -90,
                                        position: 'insideLeft',
                                        offset: 12,
                                        fill: 'var(--muted-foreground)',
                                        fontSize: 11,
                                    }}
                                />
                                {weaving &&
                                    ticks
                                        .slice(1)
                                        .map((k) => (
                                            <ReferenceLine
                                                key={k}
                                                x={k}
                                                stroke="var(--border)"
                                            />
                                        ))}
                                {sharedSpec && metric !== 'spread' && (
                                    <>
                                        <ReferenceLine
                                            y={sharedSpec.target}
                                            stroke="var(--foreground)"
                                            strokeOpacity={0.55}
                                            strokeDasharray="6 4"
                                            ifOverflow="extendDomain"
                                            label={{
                                                value: 'Spec',
                                                position: 'insideTopLeft',
                                                fill: 'var(--muted-foreground)',
                                                fontSize: 11,
                                            }}
                                        />
                                        {[-1, 1].map((sign) => (
                                            <ReferenceLine
                                                key={sign}
                                                y={
                                                    sharedSpec.target +
                                                    sign * sharedSpec.tolerance
                                                }
                                                stroke="var(--muted-foreground)"
                                                strokeOpacity={0.6}
                                                strokeDasharray="2 3"
                                                ifOverflow="extendDomain"
                                                label={{
                                                    value: `${sign > 0 ? '+' : '−'}${sharedSpec.tolerance}`,
                                                    position: 'insideTopLeft',
                                                    fill: 'var(--muted-foreground)',
                                                    fontSize: 11,
                                                }}
                                            />
                                        ))}
                                    </>
                                )}
                                <Tooltip
                                    cursor={{
                                        stroke: 'var(--muted-foreground)',
                                        strokeWidth: 1,
                                    }}
                                    content={(props) => (
                                        <CompareTooltip
                                            {...props}
                                            series={visible}
                                            metric={metric}
                                        />
                                    )}
                                />
                                {visible.map((s) => {
                                    const slot = s.item.slot;
                                    const last = lastIndex.get(slot);
                                    return (
                                        <Line
                                            key={s.item.record.id}
                                            type="linear"
                                            dataKey={`s${slot}`}
                                            name={s.info.label}
                                            stroke={slotColor(slot)}
                                            strokeWidth={
                                                visible.length > 4 ? 1.5 : 2
                                            }
                                            dot={false}
                                            activeDot={{
                                                r: 4,
                                                stroke: 'var(--background)',
                                                strokeWidth: 2,
                                            }}
                                            connectNulls={false}
                                            isAnimationActive={false}
                                            label={
                                                directLabels
                                                    ? (props: {
                                                          x?: number | string;
                                                          y?: number | string;
                                                          index?: number;
                                                      }) =>
                                                          props.index ===
                                                          last ? (
                                                              <text
                                                                  key="end"
                                                                  x={
                                                                      Number(
                                                                          props.x,
                                                                      ) + 6
                                                                  }
                                                                  y={
                                                                      Number(
                                                                          props.y,
                                                                      ) + 4
                                                                  }
                                                                  fontSize={11}
                                                                  fontFamily="var(--font-mono, ui-monospace)"
                                                                  fill="var(--foreground)"
                                                                  stroke="var(--background)"
                                                                  strokeWidth={
                                                                      3
                                                                  }
                                                                  paintOrder="stroke"
                                                              >
                                                                  {
                                                                      s.info
                                                                          .machine
                                                                  }
                                                              </text>
                                                          ) : (
                                                              <g
                                                                  key={
                                                                      props.index
                                                                  }
                                                              />
                                                          )
                                                    : false
                                            }
                                        />
                                    );
                                })}
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </figure>

                <div className="overflow-x-auto rounded-lg border">
                    <Table
                        size="dense"
                        aria-label="Figures for each compared record"
                    >
                        <TableHeader>
                            <TableRow className="hover:bg-transparent">
                                <TableHead>Record</TableHead>
                                <TableHead>Operator</TableHead>
                                <TableHead>Item</TableHead>
                                <TableHead className="text-right">
                                    Spec (cN)
                                </TableHead>
                                <TableHead className="text-right">
                                    Measured
                                </TableHead>
                                <TableHead className="text-right">
                                    Avg max
                                </TableHead>
                                <TableHead className="text-right">
                                    Avg min
                                </TableHead>
                                <TableHead className="text-right">
                                    Avg spread
                                </TableHead>
                                <TableHead className="text-right">
                                    Out of spec
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {series.map((s) => {
                                const out = s.stats.above + s.stats.below;
                                const pct = s.stats.measured
                                    ? Math.round(
                                          (out / s.stats.measured) * 1000,
                                      ) / 10
                                    : null;
                                return (
                                    <TableRow
                                        key={s.item.record.id}
                                        className={cn(
                                            hidden.has(
                                                String(s.item.record.id),
                                            ) && 'text-muted-foreground',
                                        )}
                                    >
                                        <TableCell>
                                            <span className="inline-flex items-center gap-1.5">
                                                <span
                                                    aria-hidden="true"
                                                    className="h-0.5 w-3 rounded-full"
                                                    style={{
                                                        background: slotColor(
                                                            s.item.slot,
                                                        ),
                                                    }}
                                                />
                                                <span className="font-mono text-xs font-medium">
                                                    {s.info.machine}
                                                </span>
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {s.info.when}
                                                </span>
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {s.info.operator ?? '—'}
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">
                                            {s.info.item ?? '—'}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {s.spec
                                                ? `${s.spec.target} ±${s.spec.tolerance}`
                                                : '—'}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {s.stats.measured}
                                            <span className="text-muted-foreground">
                                                /{s.stats.positions}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmt(s.stats.avgMax)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmt(s.stats.avgMin)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {fmt(s.stats.avgSpread)}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                'text-right tabular-nums',
                                                out > 0 &&
                                                    'font-medium text-orange-700 dark:text-orange-400',
                                            )}
                                            title={
                                                s.spec
                                                    ? `${s.stats.above} above, ${s.stats.below} below`
                                                    : 'No spec on this record'
                                            }
                                        >
                                            {s.spec ? (
                                                <>
                                                    {out}
                                                    <span className="font-normal text-muted-foreground">
                                                        {' '}
                                                        · {pct}%
                                                    </span>
                                                </>
                                            ) : (
                                                '—'
                                            )}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </DialogContent>
        </Dialog>
    );
}

/**
 * Remembers the selected records across pages (the table only holds the
 * current page) and gives each one a palette slot for as long as it stays
 * selected. Records past the eighth wait without a slot.
 */
export function useCompareSelection(
    rows: DetailRecord[],
    rowSelection: Record<string, boolean>,
) {
    const [items, setItems] = useState<
        { record: DetailRecord; slot: number | null }[]
    >([]);

    useEffect(() => {
        setItems((prev) => {
            const selectedIds = new Set(
                Object.keys(rowSelection).filter((id) => rowSelection[id]),
            );
            const kept = prev.filter((i) =>
                selectedIds.has(String(i.record.id)),
            );
            const known = new Set(kept.map((i) => String(i.record.id)));
            const used = new Set(kept.map((i) => i.slot));
            const freeSlot = () => {
                for (let s = 0; s < MAX_COMPARE; s++) {
                    if (!used.has(s)) {
                        used.add(s);
                        return s;
                    }
                }
                return null;
            };
            const added = rows
                .filter(
                    (r) =>
                        selectedIds.has(String(r.id)) &&
                        !known.has(String(r.id)),
                )
                .map((record) => ({ record, slot: null as number | null }));
            if (!added.length && kept.length === prev.length) return prev;
            // Earlier picks waiting without a colour get the first one freed.
            return [...kept, ...added].map((i) =>
                i.slot === null ? { ...i, slot: freeSlot() } : i,
            );
        });
    }, [rows, rowSelection]);

    const compareItems = useMemo<CompareItem[]>(
        () =>
            items
                .filter((i) => i.slot !== null)
                .map((i) => ({ record: i.record, slot: i.slot as number })),
        [items],
    );

    return { count: items.length, compareItems };
}

type CompareMode =
    | { kind: 'selection' }
    | {
          kind: 'saved';
          saved: SavedComparison;
          items: CompareItem[];
          missing: number;
      };

const sameIds = (
    a: readonly (string | number)[],
    b: readonly (string | number)[],
) => a.length === b.length && a.every((x, i) => String(x) === String(b[i]));

const shortDate = (iso: string | null) =>
    iso
        ? new Intl.DateTimeFormat('en-GB', {
              day: 'numeric',
              month: 'short',
          }).format(new Date(iso))
        : '';

/** "TW-05, TW-19, TW-13" — a starting name the user can change. */
const suggestName = (items: CompareItem[]) => {
    const machines = [...new Set(items.map((i) => describe(i.record).machine))];
    const head = machines.slice(0, 4).join(', ');
    return machines.length > 4 ? `${head} +${machines.length - 4}` : head;
};

/**
 * Everything a tension table needs to compare records: the Compare button for
 * ticked rows, the Saved menu, and the compare window with save, rename and
 * delete. A saved comparison opens with its own records, plotted value and
 * hidden lines, independent of what is ticked in the table.
 */
export function useTensionCompare({
    type,
    rows,
    rowSelection,
    onDeselect,
}: {
    type: 'twisting' | 'weaving';
    rows: DetailRecord[];
    rowSelection: Record<string, boolean>;
    onDeselect: (id: string) => void;
}) {
    const selection = useCompareSelection(rows, rowSelection);
    const [open, setOpen] = useState(false);
    const [mode, setMode] = useState<CompareMode>({ kind: 'selection' });
    const [metric, setMetric] = useState<CompareMetric>('avg');
    const [hidden, setHidden] = useState<Set<string>>(new Set());

    const [savedList, setSavedList] = useState<
        SavedComparisonListItem[] | null
    >(null);
    const [listError, setListError] = useState<string | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [naming, setNaming] = useState<'save' | 'rename' | null>(null);
    const [nameDraft, setNameDraft] = useState('');
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [justSaved, setJustSaved] = useState(false);

    const refreshList = useCallback(() => {
        setListError(null);
        comparisonsApi
            .list(type)
            .then(setSavedList)
            .catch((e: unknown) =>
                setListError(
                    e instanceof Error
                        ? e.message
                        : 'Could not load saved comparisons',
                ),
            );
    }, [type]);
    useEffect(refreshList, [refreshList]);

    const items = mode.kind === 'saved' ? mode.items : selection.compareItems;
    const tooMany = selection.count > MAX_COMPARE;

    const resetTransient = () => {
        setNaming(null);
        setConfirmDelete(false);
        setActionError(null);
        setJustSaved(false);
    };

    // Ids arrive from the API as numbers; hidden ids are kept as text throughout.
    const toggleHidden = (raw: string) =>
        setHidden((prev) => {
            const id = String(raw);
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    const openSelection = () => {
        resetTransient();
        setMode({ kind: 'selection' });
        setMetric('avg');
        setHidden(new Set());
        setOpen(true);
    };

    const openSaved = async (id: number) => {
        resetTransient();
        setBusy('open');
        try {
            const saved = await comparisonsApi.get(id);
            setMode({
                kind: 'saved',
                saved,
                items: saved.records.map((record, i) => ({ record, slot: i })),
                missing: saved.missing_ids.length,
            });
            setMetric(saved.metric);
            setHidden(new Set(saved.hidden_ids.map(String)));
            setOpen(true);
        } catch (e) {
            setListError(
                e instanceof Error
                    ? e.message
                    : 'Could not open that comparison',
            );
        } finally {
            setBusy(null);
        }
    };

    const remove = (raw: string) => {
        const id = String(raw);
        setHidden((prev) => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        if (mode.kind === 'saved') {
            setMode({
                ...mode,
                items: mode.items.filter((i) => String(i.record.id) !== id),
            });
        } else {
            onDeselect(id);
        }
    };

    const payload = () => ({
        record_ids: items.map((i) => Number(i.record.id)),
        metric,
        hidden_ids: items
            .filter((i) => hidden.has(String(i.record.id)))
            .map((i) => Number(i.record.id)),
    });

    const run = async (label: string, action: () => Promise<void>) => {
        setBusy(label);
        setActionError(null);
        try {
            await action();
        } catch (e) {
            setActionError(
                e instanceof Error
                    ? e.message
                    : 'That did not work. Try again.',
            );
        } finally {
            setBusy(null);
        }
    };

    const saveNew = () =>
        run('save', async () => {
            const saved = await comparisonsApi.create({
                name: nameDraft.trim(),
                record_type: type,
                ...payload(),
            });
            // From here on the window shows the saved comparison, not the live ticks.
            setMode({ kind: 'saved', saved, items: [...items], missing: 0 });
            setNaming(null);
            setJustSaved(true);
            refreshList();
        });

    const saveChanges = () =>
        run('update', async () => {
            if (mode.kind !== 'saved') return;
            const saved = await comparisonsApi.update(mode.saved.id, payload());
            setMode({ ...mode, saved, missing: 0 });
            setJustSaved(true);
            refreshList();
        });

    const rename = () =>
        run('rename', async () => {
            if (mode.kind !== 'saved') return;
            const saved = await comparisonsApi.update(mode.saved.id, {
                name: nameDraft.trim(),
            });
            setMode({ ...mode, saved });
            setNaming(null);
            refreshList();
        });

    const destroy = () =>
        run('delete', async () => {
            if (mode.kind !== 'saved') return;
            await comparisonsApi.remove(mode.saved.id);
            refreshList();
            setOpen(false);
        });

    const dirty =
        mode.kind === 'saved' &&
        (metric !== mode.saved.metric ||
            !sameIds(
                items.map((i) => i.record.id),
                mode.saved.record_ids,
            ) ||
            !sameIds(
                items
                    .filter((i) => hidden.has(String(i.record.id)))
                    .map((i) => i.record.id),
                mode.saved.hidden_ids,
            ));

    const nameForm = (
        <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
                e.preventDefault();
                if (!nameDraft.trim()) return;
                if (naming === 'save') saveNew();
                else rename();
            }}
        >
            <Input
                autoFocus
                aria-label="Comparison name"
                data-escape-local
                value={nameDraft}
                maxLength={100}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Escape') setNaming(null);
                }}
                className="h-7 w-56 text-xs"
            />
            <Button
                type="submit"
                size="xs"
                disabled={!nameDraft.trim() || busy !== null}
            >
                {busy === 'save' || busy === 'rename' ? (
                    <Loader2Icon className="animate-spin" />
                ) : (
                    <CheckIcon />
                )}
                {naming === 'save' ? 'Save' : 'Rename'}
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setNaming(null)}
            >
                Cancel
            </Button>
        </form>
    );

    let saveControls: ReactNode;
    if (naming) {
        saveControls = nameForm;
    } else if (confirmDelete && mode.kind === 'saved') {
        saveControls = (
            <span className="inline-flex items-center gap-1.5 text-xs">
                Delete “{mode.saved.name}”?
                <Button
                    variant="destructive"
                    size="xs"
                    onClick={destroy}
                    disabled={busy !== null}
                >
                    {busy === 'delete' && (
                        <Loader2Icon className="animate-spin" />
                    )}
                    Delete
                </Button>
                <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => setConfirmDelete(false)}
                >
                    Cancel
                </Button>
            </span>
        );
    } else if (mode.kind === 'saved') {
        saveControls = (
            <>
                {justSaved && !dirty && (
                    <span
                        role="status"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                    >
                        <CheckIcon className="size-3" aria-hidden="true" />
                        Saved
                    </span>
                )}
                {dirty && (
                    <Button
                        size="xs"
                        onClick={saveChanges}
                        disabled={busy !== null || items.length < 2}
                    >
                        {busy === 'update' ? (
                            <Loader2Icon className="animate-spin" />
                        ) : (
                            <SaveIcon />
                        )}
                        Save changes
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Rename this comparison"
                    onClick={() => {
                        setNameDraft(mode.saved.name);
                        setNaming('rename');
                        setJustSaved(false);
                    }}
                >
                    <PencilIcon />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Delete this saved comparison"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(true)}
                >
                    <Trash2Icon />
                </Button>
            </>
        );
    } else {
        saveControls = (
            <Button
                variant="outline"
                size="xs"
                onClick={() => {
                    setNameDraft(suggestName(items));
                    setNaming('save');
                }}
            >
                <SaveIcon />
                Save
            </Button>
        );
    }
    if (actionError) {
        saveControls = (
            <>
                <span role="alert" className="text-xs text-destructive">
                    {actionError}
                </span>
                {saveControls}
            </>
        );
    }

    const dialog = (
        <TensionCompareDialog
            items={items}
            open={open}
            onOpenChange={(next) => {
                setOpen(next);
                if (!next) resetTransient();
            }}
            onRemove={remove}
            metric={metric}
            onMetricChange={setMetric}
            hidden={hidden}
            onToggleHidden={toggleHidden}
            title={mode.kind === 'saved' ? mode.saved.name : undefined}
            saveControls={saveControls}
            notice={
                mode.kind === 'saved' && mode.missing > 0 ? (
                    <p className="text-xs text-orange-700 dark:text-orange-400">
                        {mode.missing === 1
                            ? '1 record in this comparison was deleted since it was saved.'
                            : `${mode.missing} records in this comparison were deleted since it was saved.`}{' '}
                        Save changes to drop{' '}
                        {mode.missing === 1 ? 'it' : 'them'} for good.
                    </p>
                ) : undefined
            }
        />
    );

    const selectionActions = (
        <>
            <Button
                variant="outline"
                size="xs"
                disabled={selection.count < 2 || tooMany}
                onClick={openSelection}
            >
                <ChartLineIcon />
                Compare
            </Button>
            {selection.count === 1 && (
                <span className="text-xs text-muted-foreground">
                    Tick one more to compare
                </span>
            )}
            {tooMany && (
                <span className="text-xs text-orange-700 dark:text-orange-400">
                    Compare up to {MAX_COMPARE} at a time
                </span>
            )}
        </>
    );

    const savedMenu = (
        <DropdownMenu onOpenChange={(o) => o && refreshList()}>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="xs" disabled={busy === 'open'}>
                    {busy === 'open' ? (
                        <Loader2Icon className="animate-spin" />
                    ) : (
                        <BookmarkIcon />
                    )}
                    Saved
                    {savedList && savedList.length > 0 && (
                        <span className="text-muted-foreground tabular-nums">
                            {savedList.length}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs">
                    Saved {type} comparisons
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {listError ? (
                    <p
                        role="alert"
                        className="px-2 py-1.5 text-xs text-destructive"
                    >
                        {listError}
                    </p>
                ) : savedList === null ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        Loading…
                    </p>
                ) : savedList.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                        None yet. Tick records, press Compare, then Save.
                    </p>
                ) : (
                    savedList.map((c) => {
                        const missing = c.record_ids.length - c.available;
                        return (
                            <DropdownMenuItem
                                key={c.id}
                                onSelect={() => void openSaved(c.id)}
                                className="flex-col items-start gap-0"
                            >
                                <span className="w-full truncate text-xs font-medium">
                                    {c.name}
                                </span>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {missing > 0
                                        ? `${c.available} of ${c.record_ids.length} records`
                                        : `${c.record_ids.length} records`}{' '}
                                    ·{' '}
                                    {METRICS.find(
                                        (m) => m.id === c.metric,
                                    )?.label.toLowerCase()}{' '}
                                    · {shortDate(c.updated_at)}
                                </span>
                            </DropdownMenuItem>
                        );
                    })
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );

    return { count: selection.count, selectionActions, savedMenu, dialog };
}
