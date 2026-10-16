import { RefText } from '@/components/control-plans/ref-text';
import { ScMark, StatusBadge } from '@/components/control-plans/status-badge';
import AppLayout from '@/layouts/app-layout';
import {
    hasClass,
    orderedLines,
    type PlanRef,
    type Revision,
} from '@/lib/control-plans';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import { useState } from 'react';

/**
 * The released plan for the shop floor, one process step at a time, sized for a phone. Opened with
 * ?machine=<machine name> (for example from a QR code on the machine) it starts at that machine's step.
 */
export default function ControlPlanViewer({
    plan,
    revision,
    machine,
}: {
    plan: PlanRef;
    revision: Revision | null;
    machine: string | null;
}) {
    const steps = revision?.content.steps ?? [];
    const fromMachine = machine
        ? steps.find(
              (s) =>
                  s.machine.trim().toLowerCase() ===
                  machine.trim().toLowerCase(),
          )
        : undefined;
    const [stepId, setStepId] = useState(fromMachine?.id ?? steps[0]?.id ?? '');
    const cur = steps.find((s) => s.id === stepId);
    const lines = revision
        ? orderedLines(revision.content).filter((e) => e.step.id === stepId)
        : [];

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Control Plans', href: '/control-plans' },
        {
            title: `${plan.doc_no} · shop floor`,
            href: `/control-plans/${plan.id}/viewer`,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${plan.doc_no} shop floor`} />
            <div className="mx-auto flex w-full max-w-md flex-col">
                {!revision ? (
                    <p className="p-4 text-sm text-muted-foreground">
                        {plan.doc_no} has no released revision yet. Drafts never
                        show here.
                    </p>
                ) : (
                    <>
                        <header className="flex flex-col gap-2.5 border-b px-4 pt-3.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[13px] text-muted-foreground">
                                    {plan.doc_no} · Rev {revision.rev}
                                </span>
                                <StatusBadge status="released" />
                            </div>
                            <h1 className="text-lg font-semibold">
                                {revision.header.mill || revision.info.title}
                            </h1>
                            {fromMachine && (
                                <p className="text-xs text-muted-foreground">
                                    Opened at{' '}
                                    <b className="text-foreground">
                                        {fromMachine.machine}
                                    </b>
                                </p>
                            )}
                            <div
                                role="tablist"
                                aria-label="Process steps"
                                className="-mx-4 flex overflow-x-auto"
                            >
                                {steps.map((s) => (
                                    <button
                                        key={s.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={s.id === stepId}
                                        onClick={() => setStepId(s.id)}
                                        className={cn(
                                            'flex min-h-11 shrink-0 flex-col items-start border-b-2 px-4 py-2 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                                            s.id === stepId
                                                ? 'border-primary'
                                                : 'border-transparent text-muted-foreground',
                                        )}
                                    >
                                        <span className="text-[11px]">
                                            Step {s.no}
                                        </span>
                                        <b className="text-[13px] font-semibold">
                                            {s.name}
                                        </b>
                                    </button>
                                ))}
                            </div>
                        </header>

                        <main
                            className="flex flex-col gap-2.5 px-4 pt-3 pb-4"
                            role="tabpanel"
                        >
                            {cur && (
                                <p className="text-xs text-muted-foreground">
                                    {[
                                        cur.group,
                                        cur.machine,
                                        lines.length === 1
                                            ? '1 check'
                                            : `${lines.length} checks`,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </p>
                            )}
                            {lines.map(({ line }) => {
                                const title =
                                    line.product.trim() && line.product !== '-'
                                        ? line.product
                                        : line.process;
                                return (
                                    <article
                                        key={line.id}
                                        className="flex flex-col gap-2 rounded-lg border bg-card p-3"
                                    >
                                        <h3 className="flex items-center justify-between gap-2 font-semibold">
                                            {title}
                                            {hasClass(line.sc) && (
                                                <ScMark value={line.sc} />
                                            )}
                                        </h3>
                                        <div className="text-base font-medium">
                                            <RefText text={line.spec} />
                                        </div>
                                        <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1 text-[13px]">
                                            <dt className="text-muted-foreground">
                                                Check with
                                            </dt>
                                            <dd>{line.measurement}</dd>
                                            <dt className="text-muted-foreground">
                                                Sample
                                            </dt>
                                            <dd>
                                                {line.size} · {line.frequency}
                                            </dd>
                                            <dt className="text-muted-foreground">
                                                Record in
                                            </dt>
                                            <dd>
                                                <RefText text={line.control} />
                                            </dd>
                                            <dt className="text-muted-foreground">
                                                Who
                                            </dt>
                                            <dd>{line.pic}</dd>
                                        </dl>
                                        <div className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[13px] dark:bg-amber-500/10">
                                            <b>If out of spec:</b>{' '}
                                            {line.reaction}
                                            {line.reaction_ref.trim() &&
                                                ` (${line.reaction_ref.trim()})`}
                                        </div>
                                    </article>
                                );
                            })}
                        </main>

                        <footer className="border-t px-4 py-2.5 text-xs text-muted-foreground">
                            Released {revision.release_date} · next review{' '}
                            {revision.next_review}. This is the controlled
                            version; drafts never show here.
                        </footer>
                    </>
                )}
            </div>
        </AppLayout>
    );
}
