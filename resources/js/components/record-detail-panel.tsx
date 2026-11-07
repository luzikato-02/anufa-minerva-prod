import { Empty } from '@/components/data-grid-cells';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    type Band,
    type CreelSide,
    type HeatCell,
    type ProblemLike,
    type Spec,
    countBands,
    creelSides,
    specOf,
    twistingCells,
} from '@/lib/tension-heatmap';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, DownloadIcon } from 'lucide-react';
import {
    type KeyboardEvent,
    type ReactNode,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

export interface DetailRecord {
    id: string;
    record_type: 'twisting' | 'weaving';
    form_data: Record<string, unknown> | null;
    measurement_data: Record<string, unknown> | null;
    problems: ProblemLike[] | null;
    metadata: Record<string, unknown> | null;
    created_at?: string;
}

const BAND_CLASS: Record<Band, string> = {
    below: 'bg-blue-500 text-blue-950',
    nearLow: 'bg-blue-200 text-blue-950 dark:bg-blue-900 dark:text-blue-100',
    in: 'bg-muted text-muted-foreground',
    nearHigh:
        'bg-orange-200 text-orange-950 dark:bg-orange-900 dark:text-orange-100',
    above: 'bg-orange-500 text-orange-950',
    missing:
        'border border-dashed border-muted-foreground/50 text-muted-foreground',
};

const BAND_LABEL: Record<Band, string> = {
    below: 'below spec',
    nearLow: 'near lower limit',
    in: 'in spec',
    nearHigh: 'near upper limit',
    above: 'above spec',
    missing: 'not measured',
};

const LEGEND: Band[] = [
    'below',
    'nearLow',
    'in',
    'nearHigh',
    'above',
    'missing',
];

const text = (value: unknown) =>
    value === null || value === undefined || value === ''
        ? null
        : String(value);

const dateTime = (value?: string) =>
    value
        ? new Intl.DateTimeFormat('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          }).format(new Date(value))
        : null;

function Field({
    label,
    children,
    mono,
}: {
    label: string;
    children: ReactNode;
    mono?: boolean;
}) {
    return (
        <div className="min-w-0">
            <dt className="text-[11px] text-muted-foreground">{label}</dt>
            <dd
                className={cn(
                    'mt-0.5 truncate text-[13px] tabular-nums',
                    mono && 'font-mono text-xs',
                )}
            >
                {children ?? <Empty />}
            </dd>
        </div>
    );
}

function Count({
    label,
    value,
    sub,
    tone,
    small,
}: {
    label: string;
    value: ReactNode;
    sub?: ReactNode;
    tone?: 'high' | 'low';
    /** Smaller figure for long values such as a range. */
    small?: boolean;
}) {
    return (
        <div className="border-r px-3 py-2 last:border-r-0">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div
                className={cn(
                    'font-semibold whitespace-nowrap tabular-nums',
                    small ? 'pt-0.5 text-base' : 'text-lg',
                    tone === 'high' && 'text-orange-700 dark:text-orange-400',
                    tone === 'low' && 'text-blue-700 dark:text-blue-400',
                )}
            >
                {value}
                {sub && (
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                        {sub}
                    </span>
                )}
            </div>
        </div>
    );
}

/**
 * A grid of positions as one keyboard stop: arrow keys move between cells,
 * Enter/Space or a click selects. Each cell names its position, readings
 * and band for screen readers.
 */
function HeatGrid({
    cells,
    columns,
    selectedKey,
    onSelect,
    cellClassName,
    label,
}: {
    cells: HeatCell[];
    columns: number;
    selectedKey: string | null;
    onSelect: (cell: HeatCell) => void;
    cellClassName: string;
    label: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const focusIndex = Math.max(
        0,
        cells.findIndex((c) => c.key === selectedKey),
    );

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const current = cells.findIndex(
            (c) => c.key === (event.target as HTMLElement).dataset.key,
        );
        if (current < 0) return;
        const step: Record<string, number> = {
            ArrowRight: 1,
            ArrowLeft: -1,
            ArrowDown: columns,
            ArrowUp: -columns,
        };
        if (!(event.key in step)) return;
        event.preventDefault();
        event.stopPropagation();
        const next = Math.min(
            cells.length - 1,
            Math.max(0, current + step[event.key]),
        );
        onSelect(cells[next]);
        ref.current
            ?.querySelector<HTMLButtonElement>(
                `[data-key="${CSS.escape(cells[next].key)}"]`,
            )
            ?.focus();
    };

    return (
        <div
            ref={ref}
            role="grid"
            aria-label={label}
            onKeyDown={onKeyDown}
            className="grid gap-[3px]"
            style={{
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
        >
            {cells.map((cell, i) => {
                const selected = cell.key === selectedKey;
                const readings =
                    cell.band === 'missing'
                        ? ''
                        : `, max ${cell.max ?? '—'}, min ${cell.min ?? '—'}`;
                return (
                    <button
                        key={cell.key}
                        type="button"
                        role="gridcell"
                        data-key={cell.key}
                        tabIndex={i === focusIndex ? 0 : -1}
                        aria-selected={selected}
                        aria-label={`${cell.position}${readings}, ${BAND_LABEL[cell.band]}${cell.problems.length ? `, ${cell.problems.length} problem${cell.problems.length > 1 ? 's' : ''}` : ''}`}
                        onClick={() => onSelect(cell)}
                        className={cn(
                            'relative flex items-center justify-center rounded-[3px] font-mono text-[10px] leading-none outline-offset-1 focus-visible:outline-2 focus-visible:outline-ring',
                            cellClassName,
                            BAND_CLASS[cell.band],
                            selected && 'outline-2 outline-foreground',
                        )}
                    >
                        {cell.label}
                        {cell.problems.some(
                            (p) => (p.status ?? 'open') !== 'resolved',
                        ) && (
                            <span
                                aria-hidden="true"
                                className="absolute top-0.5 right-0.5 size-1 rounded-full bg-foreground"
                            />
                        )}
                    </button>
                );
            })}
        </div>
    );
}

function SelectedCell({ cell, spec }: { cell: HeatCell; spec: Spec | null }) {
    let delta: ReactNode = null;
    if (spec && cell.band === 'above' && cell.max !== null) {
        delta = (
            <span className="text-orange-700 dark:text-orange-400">
                +{(cell.max - spec.target - spec.tolerance).toFixed(1)} cN over
                the upper limit
            </span>
        );
    } else if (spec && cell.band === 'below' && cell.min !== null) {
        delta = (
            <span className="text-blue-700 dark:text-blue-400">
                −{Math.abs(cell.min - spec.target + spec.tolerance).toFixed(1)}{' '}
                cN under the lower limit
            </span>
        );
    }
    const openProblem = cell.problems.find(
        (p) => (p.status ?? 'open') !== 'resolved',
    );
    return (
        <div
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border bg-muted/40 px-3 py-2 text-xs"
            aria-live="polite"
        >
            <span className="font-mono font-semibold">{cell.position}</span>
            {cell.band === 'missing' ? (
                <span className="text-muted-foreground">Not measured</span>
            ) : (
                <>
                    <span className="tabular-nums">
                        Max <strong>{cell.max ?? '—'}</strong>
                    </span>
                    <span className="tabular-nums">
                        Min <strong>{cell.min ?? '—'}</strong>
                    </span>
                    {delta ?? (
                        <span className="text-muted-foreground">
                            {BAND_LABEL[cell.band]}
                        </span>
                    )}
                </>
            )}
            {openProblem && (
                <span className="text-muted-foreground">
                    Open problem: {openProblem.description ?? 'reported'}
                </span>
            )}
        </div>
    );
}

export function RecordDetailPanel({
    record,
    open,
    onOpenChange,
    onPrevious,
    onNext,
}: {
    record: DetailRecord | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onPrevious?: () => void;
    onNext?: () => void;
}) {
    const [selectedKey, setSelectedKey] = useState<string | null>(null);

    const model = useMemo(() => {
        if (!record) return null;
        const spec = specOf(
            record.form_data as { specTens?: unknown; tensPlus?: unknown },
        );
        const problems = Array.isArray(record.problems) ? record.problems : [];
        if (record.record_type === 'weaving') {
            const sides = creelSides(record.measurement_data, spec, problems);
            return {
                spec,
                problems,
                sides,
                cells: sides.flatMap((s) => s.cells),
            };
        }
        const total = Number(record.metadata?.total_measurements ?? 0) || null;
        const cells = twistingCells(
            record.measurement_data,
            total,
            spec,
            problems,
        );
        return { spec, problems, sides: null as CreelSide[] | null, cells };
    }, [record]);

    // Start each record on its most important position: an open problem, else the worst reading.
    useEffect(() => {
        if (!model) return;
        const flagged =
            model.cells.find((c) =>
                c.problems.some((p) => (p.status ?? 'open') !== 'resolved'),
            ) ??
            model.cells.find((c) => c.band === 'above' || c.band === 'below') ??
            model.cells[0];
        setSelectedKey(flagged?.key ?? null);
    }, [model]);

    if (!record || !model) return null;

    const form = record.form_data ?? {};
    const meta = record.metadata ?? {};
    const counts = countBands(model.cells);
    const openProblems = model.problems.filter(
        (p) => (p.status ?? 'open') !== 'resolved',
    ).length;
    const selected = model.cells.find((c) => c.key === selectedKey) ?? null;
    const machine =
        text(meta.machine_number) ?? text(form.machineNumber) ?? 'Record';
    const isWeaving = record.record_type === 'weaving';

    const onPanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const target = event.target as HTMLElement;
        if (target.closest('input, textarea, select, [role="grid"]')) return;
        if (event.key === 'ArrowUp' && onPrevious) {
            event.preventDefault();
            onPrevious();
        } else if (event.key === 'ArrowDown' && onNext) {
            event.preventDefault();
            onNext();
        }
    };

    const problemReading = (p: ProblemLike) => {
        const cell = isWeaving
            ? model.cells.find((c) => c.key === p.position)
            : model.cells.find((c) => c.key === String(p.spindleNumber));
        return cell ?? null;
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
            <SheetContent
                side="right"
                className="w-full gap-0 sm:max-w-2xl"
                onKeyDown={onPanelKeyDown}
                // Clicking another row should switch records, not close the panel.
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
            >
                <SheetHeader className="flex-row items-center gap-2 border-b px-4 py-2.5 pr-12">
                    <div className="min-w-0 flex-1">
                        <SheetTitle className="font-mono text-base">
                            {machine}
                        </SheetTitle>
                        <SheetDescription className="truncate text-xs">
                            {isWeaving ? 'Weaving' : 'Twisting'} ·{' '}
                            {dateTime(record.created_at) ?? 'no date'}
                            {text(meta.operator)
                                ? ` · ${text(meta.operator)}`
                                : ''}
                        </SheetDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label="Previous record"
                        onClick={onPrevious}
                        disabled={!onPrevious}
                    >
                        <ChevronUp />
                    </Button>
                    <Button
                        variant="outline"
                        size="icon-xs"
                        aria-label="Next record"
                        onClick={onNext}
                        disabled={!onNext}
                    >
                        <ChevronDown />
                    </Button>
                    <Button variant="outline" size="xs" asChild>
                        <a href={`/tension-records/${record.id}/download`}>
                            <DownloadIcon />
                            CSV
                        </a>
                    </Button>
                </SheetHeader>

                <div className="flex flex-col gap-3.5 overflow-y-auto px-4 py-3">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-4">
                        {isWeaving ? (
                            <>
                                <Field label="Production order" mono>
                                    {text(form.productionOrder)}
                                </Field>
                                <Field label="Item no." mono>
                                    {text(meta.item_number)}
                                </Field>
                                <div className="col-span-2 min-w-0">
                                    <Field label="Item description">
                                        {text(meta.item_description)}
                                    </Field>
                                </div>
                                <Field label="Bale" mono>
                                    {text(form.baleNumber)}
                                </Field>
                                <Field label="Colour" mono>
                                    {text(form.colorCode)}
                                </Field>
                            </>
                        ) : (
                            <>
                                <Field label="Item no." mono>
                                    {text(meta.item_number)}
                                </Field>
                                <Field label="Yarn code" mono>
                                    {text(meta.yarn_code)}
                                </Field>
                                <Field label="Density">
                                    {text(form.dtexNumber) &&
                                        `${text(form.dtexNumber)} dtex`}
                                </Field>
                                <Field label="Table twist">
                                    {text(form.tpm) && `${text(form.tpm)} TPM`}
                                </Field>
                                <Field label="Cycle speed">
                                    {text(form.rpm) && `${text(form.rpm)} RPM`}
                                </Field>
                            </>
                        )}
                        <Field label="Spec tension">
                            {model.spec
                                ? `${model.spec.target} ±${model.spec.tolerance} cN`
                                : null}
                        </Field>
                        <Field label="Meters check">
                            {text(form.metersCheck) &&
                                `${text(form.metersCheck)} m`}
                        </Field>
                    </dl>

                    <div className="grid grid-cols-3 overflow-hidden rounded-lg border sm:grid-cols-6">
                        <Count
                            label="Measured"
                            value={counts.measured}
                            sub={`/ ${counts.total}`}
                        />
                        <Count
                            label="Above spec"
                            value={counts.above}
                            tone={counts.above ? 'high' : undefined}
                        />
                        <Count
                            label="Below spec"
                            value={counts.below}
                            tone={counts.below ? 'low' : undefined}
                        />
                        <Count label="Near limit" value={counts.near} />
                        <Count
                            label="Open problems"
                            value={openProblems}
                            sub={`of ${model.problems.length}`}
                        />
                        <Count
                            label="Range"
                            small
                            value={
                                counts.min !== null && counts.max !== null
                                    ? `${counts.min}–${counts.max}`
                                    : '—'
                            }
                        />
                    </div>

                    <section
                        aria-label={
                            isWeaving ? 'Creel tension' : 'Spindle tension'
                        }
                        className="flex flex-col gap-2"
                    >
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <h3 className="text-[13px] font-semibold">
                                {isWeaving ? 'Creel positions' : 'Spindles'}
                            </h3>
                            {!model.spec && (
                                <span className="text-xs text-muted-foreground">
                                    No spec on this record, so nothing is
                                    flagged.
                                </span>
                            )}
                            <ul className="ml-auto flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] text-muted-foreground">
                                {LEGEND.map((band) => (
                                    <li
                                        key={band}
                                        className="inline-flex items-center gap-1"
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={cn(
                                                'inline-block size-2.5 rounded-[2px]',
                                                BAND_CLASS[band],
                                            )}
                                        />
                                        {BAND_LABEL[band]}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {model.cells.length === 0 ? (
                            <p className="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                                No readings recorded yet.
                            </p>
                        ) : model.sides ? (
                            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
                                {model.sides.map((side) => {
                                    const c = countBands(side.cells);
                                    return (
                                        <div
                                            key={side.side}
                                            className="flex min-w-0 flex-col gap-1"
                                        >
                                            <div className="flex items-baseline justify-between text-[11px]">
                                                <span className="font-mono text-xs font-semibold">
                                                    {side.side}
                                                </span>
                                                <span
                                                    className={
                                                        c.above + c.below
                                                            ? 'text-orange-700 dark:text-orange-400'
                                                            : 'text-muted-foreground'
                                                    }
                                                >
                                                    {c.above + c.below
                                                        ? [
                                                              c.above &&
                                                                  `${c.above} above`,
                                                              c.below &&
                                                                  `${c.below} below`,
                                                          ]
                                                              .filter(Boolean)
                                                              .join(' · ')
                                                        : 'all in spec'}
                                                </span>
                                            </div>
                                            <HeatGrid
                                                cells={side.cells}
                                                columns={Math.max(1, side.cols)}
                                                selectedKey={selectedKey}
                                                onSelect={(cell) =>
                                                    setSelectedKey(cell.key)
                                                }
                                                cellClassName="h-4"
                                                label={`Side ${side.side}, ${side.rows} rows by ${side.cols} columns`}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <HeatGrid
                                cells={model.cells}
                                columns={20}
                                selectedKey={selectedKey}
                                onSelect={(cell) => setSelectedKey(cell.key)}
                                cellClassName="h-6"
                                label={`${model.cells.length} spindles`}
                            />
                        )}

                        {selected && (
                            <SelectedCell cell={selected} spec={model.spec} />
                        )}
                    </section>

                    <section
                        aria-label="Problems"
                        className="flex flex-col gap-1.5"
                    >
                        <h3 className="text-[13px] font-semibold">
                            Problems{' '}
                            <span className="font-normal text-muted-foreground tabular-nums">
                                {model.problems.length}
                            </span>
                        </h3>
                        {model.problems.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                No problems reported on this record.
                            </p>
                        ) : (
                            <div className="overflow-hidden rounded-lg border">
                                <Table size="dense">
                                    <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead>Position</TableHead>
                                            <TableHead>Issue</TableHead>
                                            <TableHead className="text-right">
                                                Max
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Min
                                            </TableHead>
                                            <TableHead className="text-right">
                                                After repair
                                            </TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {model.problems.map((p, i) => {
                                            const cell = problemReading(p);
                                            const resolved =
                                                p.status === 'resolved';
                                            const after =
                                                p.resolution
                                                    ?.after_repair_max !=
                                                    null ||
                                                p.resolution
                                                    ?.after_repair_min != null
                                                    ? `${p.resolution?.after_repair_max ?? '—'} / ${p.resolution?.after_repair_min ?? '—'}`
                                                    : null;
                                            return (
                                                <TableRow
                                                    key={p.id ?? i}
                                                    className="cursor-pointer"
                                                    onClick={() =>
                                                        cell &&
                                                        setSelectedKey(cell.key)
                                                    }
                                                >
                                                    <TableCell className="font-mono text-xs font-medium">
                                                        {isWeaving
                                                            ? (cell?.position ??
                                                              p.position)
                                                            : `Sp ${p.spindleNumber}`}
                                                    </TableCell>
                                                    <TableCell
                                                        className="max-w-56 truncate"
                                                        title={p.description}
                                                    >
                                                        {p.description ?? (
                                                            <Empty />
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {cell?.max ?? <Empty />}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {cell?.min ?? <Empty />}
                                                    </TableCell>
                                                    <TableCell className="text-right text-muted-foreground">
                                                        {after ?? <Empty />}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="inline-flex items-center gap-1.5 text-xs">
                                                            <span
                                                                aria-hidden="true"
                                                                className={cn(
                                                                    'size-1.5 rounded-full',
                                                                    resolved
                                                                        ? 'bg-emerald-600'
                                                                        : 'bg-orange-500',
                                                                )}
                                                            />
                                                            <span
                                                                className={
                                                                    resolved
                                                                        ? 'text-emerald-700 dark:text-emerald-400'
                                                                        : 'text-orange-700 dark:text-orange-400'
                                                                }
                                                            >
                                                                {resolved
                                                                    ? 'Resolved'
                                                                    : 'Open'}
                                                            </span>
                                                        </span>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </section>
                </div>
            </SheetContent>
        </Sheet>
    );
}
