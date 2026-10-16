import { Field } from '@/components/control-plans/field';
import { ScMark, ToneBadge } from '@/components/control-plans/status-badge';
import { Button } from '@/components/ui/button';
import {
    blank,
    hasClass,
    type Line,
    type LineField,
    type Step,
    type StepField,
} from '@/lib/control-plans';
import { ChevronDownIcon, ChevronUpIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';

interface Props {
    step: Step;
    line: Line;
    baseStep: Step | undefined;
    baseLine: Line | undefined;
    hasBase: boolean;
    indexInStep: number;
    stepLineCount: number;
    isFirst: boolean;
    isLast: boolean;
    onlyLine: boolean;
    knownCodes: Set<string>;
    onStep: (f: StepField, v: string) => void;
    onLine: (f: LineField, v: string) => void;
    onPrev: () => void;
    onNext: () => void;
    onDelete: () => void;
}

/** The fields of the selected line and its process step, docked at the bottom of the screen. */
export function LinePanel(p: Props) {
    const { step, line, baseStep, baseLine, hasBase } = p;
    const [open, setOpen] = useState(true);
    const [askDelete, setAskDelete] = useState(false);
    const title =
        !blank(line.product) && line.product !== '-'
            ? line.product
            : !blank(line.process) && line.process !== '-'
              ? line.process
              : 'New characteristic';
    const stepName = blank(step.name) ? 'New process step' : step.name;
    const ref = line.reaction_ref.trim();
    const refMissing = ref !== '' && !p.knownCodes.has(ref);

    const sf = (f: StepField) => ({
        value: step[f],
        dirty: hasBase && !!baseStep && baseStep[f] !== step[f],
        onChange: (v: string) => p.onStep(f, v),
    });
    const lf = (f: LineField) => ({
        value: line[f],
        dirty: hasBase && !!baseLine && baseLine[f] !== line[f],
        onChange: (v: string) => p.onLine(f, v),
    });

    return (
        <section
            aria-label="Selected line"
            className="sticky bottom-0 z-10 flex flex-col gap-2.5 border-t-2 bg-card px-4 pt-2.5 pb-3.5 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex items-center gap-2 font-semibold focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring"
                        aria-expanded={open}
                        aria-controls="dock-body"
                        onClick={() => setOpen((o) => !o)}
                    >
                        {open ? (
                            <ChevronDownIcon className="size-4" />
                        ) : (
                            <ChevronUpIcon className="size-4" />
                        )}
                        {title}
                    </button>
                    {hasClass(line.sc) && <ScMark value={line.sc} />}
                    {hasBase && !baseLine && (
                        <ToneBadge tone="released">New line</ToneBadge>
                    )}
                    <span className="text-xs text-muted-foreground">
                        Step {step.no} · {stepName} · line {p.indexInStep} of{' '}
                        {p.stepLineCount}
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {askDelete ? (
                        <>
                            <span className="text-xs">
                                {p.stepLineCount === 1
                                    ? 'Delete this line? It is the only line in its step, so the step is removed too.'
                                    : 'Delete this line?'}
                            </span>
                            <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                    setAskDelete(false);
                                    p.onDelete();
                                }}
                            >
                                Delete
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setAskDelete(false)}
                            >
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive"
                                onClick={() => setAskDelete(true)}
                                disabled={p.onlyLine}
                            >
                                <Trash2Icon /> Delete line
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={p.onPrev}
                                disabled={p.isFirst}
                            >
                                <ChevronUpIcon /> Previous line
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={p.onNext}
                                disabled={p.isLast}
                            >
                                <ChevronDownIcon /> Next line
                            </Button>
                        </>
                    )}
                </div>
            </div>
            {open && (
                <div
                    id="dock-body"
                    className="flex max-h-[45vh] flex-col gap-2.5 overflow-y-auto"
                >
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 lg:grid-cols-6">
                        <Field
                            id="f-stepno"
                            label="Process no."
                            {...sf('no')}
                        />
                        <Field id="f-group" label="Group" {...sf('group')} />
                        <Field
                            id="f-stepname"
                            className="col-span-2"
                            label={
                                <>
                                    Process name{' '}
                                    <span className="font-normal">
                                        (all {p.stepLineCount} lines in this
                                        step)
                                    </span>
                                </>
                            }
                            {...sf('name')}
                        />
                        <Field
                            id="f-machine"
                            className="col-span-2"
                            label="Machine, device, jig, tools"
                            {...sf('machine')}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t pt-2.5 lg:grid-cols-6">
                        <Field
                            id="f-product"
                            label="Product characteristic"
                            {...lf('product')}
                        />
                        <Field
                            id="f-process"
                            label="Process characteristic"
                            {...lf('process')}
                        />
                        <Field
                            id="f-sc"
                            label="Special char. class"
                            {...lf('sc')}
                        />
                        <Field
                            id="f-spec"
                            className="col-span-2"
                            label="Specification / tolerance"
                            help="Printed exactly as typed."
                            {...lf('spec')}
                        />
                        <Field
                            id="f-meas"
                            label="Evaluation / measurement"
                            {...lf('measurement')}
                        />
                        <Field
                            id="f-size"
                            label="Sample size"
                            error={
                                blank(line.size)
                                    ? 'Sample size is required.'
                                    : null
                            }
                            {...lf('size')}
                        />
                        <Field
                            id="f-freq"
                            label="Sample frequency"
                            {...lf('frequency')}
                        />
                        <Field id="f-pic" label="PIC" {...lf('pic')} />
                        <Field
                            id="f-ctrl"
                            className="col-span-2 lg:col-span-3"
                            label={
                                <>
                                    Control method{' '}
                                    <span className="font-normal">
                                        (separate items with commas)
                                    </span>
                                </>
                            }
                            {...lf('control')}
                        />
                        <Field
                            id="f-react"
                            className="col-span-2 lg:col-span-3"
                            label="Reaction plan"
                            {...lf('reaction')}
                        />
                        <Field
                            id="f-ref"
                            className="col-span-2 lg:col-span-3"
                            label="Reaction plan reference"
                            mono
                            error={
                                refMissing
                                    ? 'Not in the reference library. Check the code against the issued document, or add it to the library.'
                                    : null
                            }
                            {...lf('reaction_ref')}
                        />
                    </div>
                </div>
            )}
        </section>
    );
}
