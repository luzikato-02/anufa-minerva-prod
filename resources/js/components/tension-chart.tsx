import { type Band, type HeatCell, type Spec } from '@/lib/tension-heatmap';
import { useMemo } from 'react';
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

/** Colours kept from the original tension chart, so the graph reads as before. */
export const CHART_COLORS = {
    max: '#3b82f6',
    min: '#93c5fd',
    spec: '#16a34a',
    limit: '#f97316',
} as const;

const BAND_DOT: Partial<Record<Band, string>> = {
    above: '#f97316',
    below: '#2563eb',
};

const BAND_TEXT: Record<Band, string> = {
    below: 'Below spec',
    nearLow: 'Near lower limit',
    in: 'In spec',
    nearHigh: 'Near upper limit',
    above: 'Above spec',
    missing: 'Not measured',
};

interface Point {
    key: string;
    label: string;
    position: string;
    max: number | null;
    min: number | null;
    band: Band;
    problems: number;
}

/** Weaving keys look like "AO-3-Col12"; the axis shows "AO 3·12". */
const shortLabel = (cell: HeatCell, weaving: boolean) => {
    if (!weaving) return cell.label;
    const [side, row, col] = cell.key.replace('Col', '').split('-');
    return `${side} ${row}·${col}`;
};

function ChartTooltip({
    active,
    payload,
}: TooltipContentProps<ValueType, NameType>) {
    const point = active
        ? (payload?.[0]?.payload as Point | undefined)
        : undefined;
    if (!point) return null;
    return (
        <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
            <div className="font-mono font-semibold">{point.position}</div>
            {point.band === 'missing' ? (
                <div className="text-muted-foreground">Not measured</div>
            ) : (
                <div className="tabular-nums">
                    Max <strong>{point.max ?? '—'}</strong> · Min{' '}
                    <strong>{point.min ?? '—'}</strong>
                </div>
            )}
            <div className="text-muted-foreground">
                {BAND_TEXT[point.band]}
                {point.problems
                    ? ` · ${point.problems} problem${point.problems > 1 ? 's' : ''}`
                    : ''}
            </div>
        </div>
    );
}

/**
 * Max and min tension per position, with the spec and the ± tolerance limits.
 * Clicking a point selects that position, shared with the heatmap.
 */
export function TensionChart({
    cells,
    spec,
    weaving,
    selectedKey,
    onSelect,
    height = 260,
}: {
    cells: HeatCell[];
    spec: Spec | null;
    weaving: boolean;
    selectedKey: string | null;
    onSelect: (cell: HeatCell) => void;
    height?: number;
}) {
    const data = useMemo<Point[]>(
        () =>
            cells.map((cell) => ({
                key: cell.key,
                label: shortLabel(cell, weaving),
                position: cell.position,
                max: cell.max,
                min: cell.min,
                band: cell.band,
                problems: cell.problems.length,
            })),
        [cells, weaving],
    );

    // Axis ticks: every 10th spindle, or the first position of each creel side.
    const { ticks, sideStarts } = useMemo(() => {
        if (!weaving) {
            const t = data
                .filter((p, i) => i === 0 || Number(p.label) % 10 === 0)
                .map((p) => p.label);
            return {
                ticks: t,
                sideStarts: [] as { label: string; side: string }[],
            };
        }
        const starts: { label: string; side: string }[] = [];
        let previous = '';
        for (const p of data) {
            const side = p.key.split('-')[0];
            if (side !== previous) starts.push({ label: p.label, side });
            previous = side;
        }
        return { ticks: starts.map((s) => s.label), sideStarts: starts };
    }, [data, weaving]);

    // Keep the limits in view even when every reading is inside them.
    const domain = useMemo<[number, number]>(() => {
        const values = data
            .flatMap((p) => [p.max, p.min])
            .filter((v): v is number => v !== null);
        if (spec)
            values.push(
                spec.target - spec.tolerance,
                spec.target + spec.tolerance,
            );
        if (!values.length) return [0, 1];
        const lo = Math.min(...values);
        const hi = Math.max(...values);
        const pad = Math.max((hi - lo) * 0.08, 1);
        return [Math.floor(lo - pad), Math.ceil(hi + pad)];
    }, [data, spec]);

    const selectedLabel = data.find((p) => p.key === selectedKey)?.label;
    const sideOf = (label: string) =>
        sideStarts.find((s) => s.label === label)?.side ?? label;

    const outOfSpecDot =
        (line: 'max' | 'min') =>
        (props: {
            cx?: number;
            cy?: number;
            payload?: Point;
            index?: number;
        }) => {
            const { cx, cy, payload, index } = props;
            const key = `${line}-${payload?.key ?? index}`;
            const flagged =
                payload &&
                ((line === 'max' && payload.band === 'above') ||
                    (line === 'min' && payload.band === 'below'));
            if (!flagged || cx == null || cy == null) return <g key={key} />;
            return (
                <circle
                    key={key}
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={BAND_DOT[payload.band]}
                    stroke="var(--background)"
                    strokeWidth={1.5}
                />
            );
        };

    const counts = data.reduce(
        (acc, p) => {
            if (p.band === 'above') acc.above++;
            if (p.band === 'below') acc.below++;
            return acc;
        },
        { above: 0, below: 0 },
    );

    return (
        <div
            className="rounded-md border p-2 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/50 [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none"
            role="figure"
            aria-label={`Max and min tension for ${data.length} ${weaving ? 'creel positions' : 'spindles'}${
                spec ? `, spec ${spec.target} ±${spec.tolerance} cN` : ''
            }: ${counts.above} above and ${counts.below} below spec. Click a point to select that position.`}
        >
            <ResponsiveContainer width="100%" height={height}>
                <LineChart
                    data={data}
                    margin={{ top: 8, right: 40, bottom: 4, left: 0 }}
                    onClick={(state) => {
                        const index = Number(state?.activeTooltipIndex);
                        const cell = Number.isInteger(index)
                            ? cells[index]
                            : undefined;
                        if (cell) onSelect(cell);
                    }}
                    style={{ cursor: 'pointer' }}
                >
                    <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                        vertical={false}
                    />
                    <XAxis
                        dataKey="label"
                        ticks={ticks}
                        interval={0}
                        tickFormatter={weaving ? sideOf : undefined}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border)' }}
                        label={{
                            value: weaving ? 'Creel side' : 'Spindle',
                            position: 'insideBottomRight',
                            offset: -2,
                            fill: 'var(--muted-foreground)',
                            fontSize: 11,
                        }}
                    />
                    <YAxis
                        domain={domain}
                        width={44}
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        label={{
                            value: 'cN',
                            angle: -90,
                            position: 'insideLeft',
                            fill: 'var(--muted-foreground)',
                            fontSize: 11,
                        }}
                    />
                    <Tooltip content={ChartTooltip} isAnimationActive={false} />

                    {sideStarts.slice(1).map((s) => (
                        <ReferenceLine
                            key={s.side}
                            x={s.label}
                            stroke="var(--border)"
                        />
                    ))}
                    {spec && (
                        <>
                            <ReferenceLine
                                y={spec.target}
                                stroke={CHART_COLORS.spec}
                                strokeDasharray="4 4"
                                label={{
                                    value: 'Spec',
                                    position: 'right',
                                    fill: CHART_COLORS.spec,
                                    fontSize: 11,
                                }}
                            />
                            <ReferenceLine
                                y={spec.target + spec.tolerance}
                                stroke={CHART_COLORS.limit}
                                strokeDasharray="2 2"
                                label={{
                                    value: `+${spec.tolerance}`,
                                    position: 'right',
                                    fill: CHART_COLORS.limit,
                                    fontSize: 11,
                                }}
                            />
                            <ReferenceLine
                                y={spec.target - spec.tolerance}
                                stroke={CHART_COLORS.limit}
                                strokeDasharray="2 2"
                                label={{
                                    value: `−${spec.tolerance}`,
                                    position: 'right',
                                    fill: CHART_COLORS.limit,
                                    fontSize: 11,
                                }}
                            />
                        </>
                    )}
                    {selectedLabel !== undefined && (
                        <ReferenceLine
                            x={selectedLabel}
                            stroke="var(--foreground)"
                            strokeOpacity={0.6}
                        />
                    )}

                    <Line
                        type="monotone"
                        dataKey="max"
                        name="Max"
                        stroke={CHART_COLORS.max}
                        strokeWidth={weaving ? 1.25 : 1.75}
                        dot={outOfSpecDot('max')}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                        connectNulls={false}
                    />
                    <Line
                        type="monotone"
                        dataKey="min"
                        name="Min"
                        stroke={CHART_COLORS.min}
                        strokeWidth={weaving ? 1.25 : 1.75}
                        dot={outOfSpecDot('min')}
                        activeDot={{ r: 4 }}
                        isAnimationActive={false}
                        connectNulls={false}
                    />
                </LineChart>
            </ResponsiveContainer>
        </div>
    );
}
