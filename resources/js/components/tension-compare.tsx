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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
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
import { DownloadIcon, EyeOffIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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

type Metric = 'max' | 'min' | 'avg' | 'spread';

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
}: {
    items: CompareItem[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onRemove: (id: string) => void;
}) {
    const [metric, setMetric] = useState<Metric>('avg');
    const [hidden, setHidden] = useState<Set<string>>(new Set());

    // Close once fewer than two records are left to compare.
    useEffect(() => {
        if (open && items.length < 2) onOpenChange(false);
    }, [open, items.length, onOpenChange]);

    const series = useMemo(() => items.map(buildSeries), [items]);
    const weaving = items[0]?.record.record_type === 'weaving';
    const visible = series.filter((s) => !hidden.has(s.item.record.id));

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

    const toggle = (id: string) =>
        setHidden((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

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
                className={cn(
                    SLOT_VARS,
                    'flex max-h-[92vh] flex-col gap-3 overflow-y-auto p-4 sm:max-w-6xl',
                )}
            >
                <DialogHeader className="gap-0.5 pr-8">
                    <DialogTitle className="text-base">
                        Compare {items.length} {kind} records
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        {metricInfo.help}, per {axisName}. Click a record in the
                        legend to hide or show it.
                    </DialogDescription>
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
                    <Button
                        variant="outline"
                        size="xs"
                        className="ml-auto"
                        onClick={downloadCsv}
                    >
                        <DownloadIcon />
                        CSV
                    </Button>
                </div>

                <ul
                    aria-label="Records in this chart"
                    className="flex flex-wrap gap-1.5"
                >
                    {series.map((s) => {
                        const id = s.item.record.id;
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
                                            hidden.has(s.item.record.id) &&
                                                'text-muted-foreground',
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
