import { RefChip, RefText } from '@/components/control-plans/ref-text';
import { ScMark } from '@/components/control-plans/status-badge';
import {
    blank,
    type Content,
    hasClass,
    type Line,
    type LineField,
    orderedLines,
    type Step,
    type StepField,
} from '@/lib/control-plans';
import { cn } from '@/lib/utils';

const HEADINGS = [
    'No.',
    'Group',
    'Process name',
    'Machine / tools',
    'Product',
    'Process',
    'Class',
    'Specification',
    'Measurement',
    'Size',
    'Freq',
    'Control method',
    'PIC',
    'Reaction plan',
];

const COLUMNS =
    '44px 104px 140px 110px minmax(130px,1.2fr) minmax(80px,.8fr) 56px minmax(130px,1.3fr) minmax(120px,1.2fr) 52px minmax(100px,.9fr) minmax(150px,1.3fr) minmax(84px,.8fr) minmax(170px,1.5fr)';

/** Lengths of runs of equal keys: the first index of each run gets its length, the rest 0. */
function runs<T>(items: T[], key: (item: T) => string): number[] {
    const out = new Array<number>(items.length).fill(0);
    for (let i = 0; i < items.length; ) {
        const k = key(items[i]);
        let j = i;
        while (j < items.length && key(items[j]) === k) j++;
        out[i] = j - i;
        i = j;
    }
    return out;
}

interface Props {
    content: Content;
    /** The last saved content, to mark new lines and changed cells; null marks nothing. */
    base: Content | null;
    selectedId: string | null;
    onPick?: (lineId: string) => void;
    knownCodes: Set<string>;
}

/**
 * The plan as a spreadsheet: one row per characteristic line, with the process no., group, process name and
 * machine merged down over the lines that share them, as on the printed document. New lines show green and
 * changed cells yellow until the draft is saved.
 */
export function PlanGrid({
    content,
    base,
    selectedId,
    onPick,
    knownCodes,
}: Props) {
    const rows = orderedLines(content);
    const baseLines = new Map(base?.lines.map((l) => [l.id, l]) ?? []);
    const baseSteps = new Map(base?.steps.map((s) => [s.id, s]) ?? []);
    const selIdx = rows.findIndex((r) => r.line.id === selectedId);
    const noRun = runs(rows, (r) => r.step.no);
    const groupRun = runs(rows, (r) => `${r.step.no}|${r.step.group}`);
    const stepRun = runs(rows, (r) => r.step.id);

    const lineState = (line: Line, f: LineField) => {
        if (!base) return '';
        const was = baseLines.get(line.id);
        if (!was) return 'new';
        return was[f] !== line[f] ? 'dirty' : '';
    };
    const stepState = (step: Step, f: StepField) => {
        if (!base) return '';
        const was = baseSteps.get(step.id);
        if (!was) return 'new';
        return was[f] !== step[f] ? 'dirty' : '';
    };
    const cellCls = (state: string, selected: boolean, extra?: string) =>
        cn(
            'relative min-w-0 border-r border-b px-2 py-1.5',
            selected ? 'bg-primary/10' : 'bg-background',
            state === 'new' && 'bg-emerald-50 dark:bg-emerald-500/10',
            state === 'dirty' && 'bg-amber-50 dark:bg-amber-500/10',
            state === 'dirty' &&
                "after:absolute after:top-0 after:right-0 after:border-t-[7px] after:border-l-[7px] after:border-t-amber-600 after:border-l-transparent after:content-['']",
            extra,
        );
    const pickBtn =
        'cursor-pointer text-left focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

    return (
        <div className="overflow-x-auto rounded-md border">
            <div
                className="grid min-w-[1570px] text-[13px] leading-[18px]"
                style={{ gridTemplateColumns: COLUMNS }}
            >
                {HEADINGS.map((h, i) => (
                    <div
                        key={h}
                        className={cn(
                            'border-b bg-muted px-2 py-1.5 text-xs font-semibold whitespace-nowrap text-muted-foreground',
                            i < HEADINGS.length - 1 && 'border-r',
                            i === 0 && 'text-center',
                        )}
                        style={{ gridRow: 1, gridColumn: i + 1 }}
                    >
                        {h}
                    </div>
                ))}
                {rows.map(({ step, line }, i) => {
                    const gr = i + 2;
                    const sel = i === selIdx;
                    const inStep = (span: number) =>
                        selIdx >= i && selIdx < i + span;
                    const pick = onPick ? () => onPick(line.id) : undefined;
                    const lc = (f: LineField, extra?: string) =>
                        cellCls(lineState(line, f), sel, cn('truncate', extra));
                    const spec = line.spec.trim();
                    const ref = line.reaction_ref.trim();
                    return [
                        noRun[i] > 0 && (
                            <div
                                key={`${line.id}-no`}
                                className={cellCls(
                                    stepState(step, 'no'),
                                    inStep(noRun[i]),
                                    'text-center font-mono text-xs text-muted-foreground',
                                )}
                                style={{
                                    gridRow: `${gr} / span ${noRun[i]}`,
                                    gridColumn: 1,
                                }}
                            >
                                {step.no}
                            </div>
                        ),
                        groupRun[i] > 0 && (
                            <div
                                key={`${line.id}-group`}
                                className={cellCls(
                                    stepState(step, 'group'),
                                    inStep(groupRun[i]),
                                )}
                                style={{
                                    gridRow: `${gr} / span ${groupRun[i]}`,
                                    gridColumn: 2,
                                }}
                            >
                                {step.group}
                            </div>
                        ),
                        stepRun[i] > 0 && (
                            <div
                                key={`${line.id}-name`}
                                className={cellCls(
                                    stepState(step, 'name'),
                                    inStep(stepRun[i]),
                                    'font-semibold',
                                )}
                                style={{
                                    gridRow: `${gr} / span ${stepRun[i]}`,
                                    gridColumn: 3,
                                }}
                            >
                                {pick ? (
                                    <button
                                        type="button"
                                        className={cn(
                                            pickBtn,
                                            blank(step.name) &&
                                                'font-normal text-muted-foreground italic',
                                        )}
                                        onClick={pick}
                                    >
                                        {blank(step.name)
                                            ? 'New process step'
                                            : step.name}
                                    </button>
                                ) : (
                                    step.name
                                )}
                            </div>
                        ),
                        stepRun[i] > 0 && (
                            <div
                                key={`${line.id}-machine`}
                                className={cellCls(
                                    stepState(step, 'machine'),
                                    inStep(stepRun[i]),
                                )}
                                style={{
                                    gridRow: `${gr} / span ${stepRun[i]}`,
                                    gridColumn: 4,
                                }}
                            >
                                {step.machine}
                            </div>
                        ),
                        <div
                            key={`${line.id}-product`}
                            className={lc(
                                'product',
                                cn(
                                    sel &&
                                        pick &&
                                        'ring-2 ring-primary ring-inset',
                                    (blank(line.product) ||
                                        line.product === '-') &&
                                        'text-muted-foreground',
                                ),
                            )}
                            style={{ gridRow: gr, gridColumn: 5 }}
                        >
                            {pick ? (
                                <button
                                    type="button"
                                    className={cn(
                                        pickBtn,
                                        'max-w-full truncate',
                                        blank(line.product) && 'italic',
                                    )}
                                    onClick={pick}
                                >
                                    {blank(line.product)
                                        ? 'New characteristic'
                                        : line.product}
                                </button>
                            ) : (
                                line.product
                            )}
                        </div>,
                        <div
                            key={`${line.id}-process`}
                            className={lc(
                                'process',
                                line.process === '-'
                                    ? 'text-muted-foreground'
                                    : '',
                            )}
                            style={{ gridRow: gr, gridColumn: 6 }}
                        >
                            {line.process}
                        </div>,
                        <div
                            key={`${line.id}-sc`}
                            className={lc(
                                'sc',
                                hasClass(line.sc)
                                    ? ''
                                    : 'text-muted-foreground',
                            )}
                            style={{ gridRow: gr, gridColumn: 7 }}
                        >
                            {hasClass(line.sc) ? (
                                <ScMark value={line.sc} />
                            ) : (
                                line.sc
                            )}
                        </div>,
                        <div
                            key={`${line.id}-spec`}
                            className={lc('spec')}
                            style={{ gridRow: gr, gridColumn: 8 }}
                        >
                            <RefText text={spec} known={knownCodes} />
                        </div>,
                        <div
                            key={`${line.id}-measurement`}
                            className={lc('measurement')}
                            style={{ gridRow: gr, gridColumn: 9 }}
                        >
                            {line.measurement}
                        </div>,
                        <div
                            key={`${line.id}-size`}
                            className={lc(
                                'size',
                                blank(line.size)
                                    ? 'ring-1 ring-destructive ring-inset'
                                    : '',
                            )}
                            style={{ gridRow: gr, gridColumn: 10 }}
                            title={
                                blank(line.size)
                                    ? 'Sample size is required'
                                    : undefined
                            }
                        >
                            {line.size}
                        </div>,
                        <div
                            key={`${line.id}-frequency`}
                            className={lc('frequency')}
                            style={{ gridRow: gr, gridColumn: 11 }}
                        >
                            {line.frequency}
                        </div>,
                        <div
                            key={`${line.id}-control`}
                            className={lc('control')}
                            style={{ gridRow: gr, gridColumn: 12 }}
                        >
                            <RefText text={line.control} known={knownCodes} />
                        </div>,
                        <div
                            key={`${line.id}-pic`}
                            className={lc('pic')}
                            style={{ gridRow: gr, gridColumn: 13 }}
                        >
                            {line.pic}
                        </div>,
                        <div
                            key={`${line.id}-reaction`}
                            className={cellCls(
                                lineState(line, 'reaction') ||
                                    lineState(line, 'reaction_ref'),
                                sel,
                                'truncate border-r-0',
                            )}
                            style={{ gridRow: gr, gridColumn: 14 }}
                        >
                            {line.reaction}
                            {ref !== '' && (
                                <>
                                    {' '}
                                    <RefChip
                                        code={ref}
                                        known={knownCodes.has(ref)}
                                    />
                                </>
                            )}
                        </div>,
                    ];
                })}
            </div>
        </div>
    );
}
