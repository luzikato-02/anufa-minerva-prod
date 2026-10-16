import { RefChip, RefText } from '@/components/control-plans/ref-text';
import { ScMark, StatusBadge } from '@/components/control-plans/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import {
    controlPlanApi,
    hasClass,
    type Line,
    type PlanRef,
    type Revision,
    type Step,
} from '@/lib/control-plans';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem, type SharedData } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { CheckIcon } from 'lucide-react';
import { useState } from 'react';

interface DiffRow {
    kind: 'added' | 'changed' | 'removed';
    step: Step;
    line: Line;
    /** Old values of the fields that changed; step fields are prefixed step_. */
    old: Record<string, string>;
}

interface Comment {
    id: number;
    kind:
        | 'comment'
        | 'submitted'
        | 'changes_requested'
        | 'approved'
        | 'released'
        | 'withdrawn';
    body: string;
    who: string;
    at: string | null;
}

interface Props {
    plan: PlanRef;
    revision: Revision;
    base: { id: number; rev: string } | null;
    diff: { rows: DiffRow[]; added: number; changed: number; removed: number };
    comments: Comment[];
}

const KIND_LABEL: Partial<Record<Comment['kind'], string>> = {
    submitted: 'Submitted',
    changes_requested: 'Changes requested',
    approved: 'Approved',
    released: 'Released',
    withdrawn: 'Taken back to draft',
};

const plural = (n: number, one: string, many: string) =>
    `${n} ${n === 1 ? one : many}`;

export default function ControlPlanReview({
    plan,
    revision,
    base,
    diff,
    comments,
}: Props) {
    const { can } = usePermissions();
    const me = usePage<SharedData>().props.auth.user.id;
    const [draft, setDraft] = useState('');
    const [needComment, setNeedComment] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const s = revision.status;
    const own = revision.submitted_by === me;

    const allowed = {
        review: can('control-plans.review') && s === 'in_review' && !own,
        release: can('control-plans.approve') && s === 'approved' && !own,
        withdraw:
            can('control-plans.author') &&
            (s === 'in_review' || s === 'approved'),
        edit:
            can('control-plans.author') &&
            (s === 'draft' || s === 'changes_requested'),
    };

    let waitText = '';
    if (s === 'released')
        waitText = `Rev ${revision.rev} is released${base ? `. Rev ${base.rev} is now superseded` : ''}.`;
    else if (s === 'superseded')
        waitText = 'A later revision has replaced this one.';
    else if (s === 'draft')
        waitText = 'Not submitted yet. The author submits it from the editor.';
    else if (s === 'changes_requested')
        waitText = 'Waiting for the author to make the requested changes.';
    else if (s === 'in_review' && !allowed.review)
        waitText =
            own && can('control-plans.review')
                ? 'You submitted this revision, so someone else has to review it.'
                : 'Waiting for QA review.';
    else if (s === 'approved' && !allowed.release)
        waitText =
            own && can('control-plans.approve')
                ? 'Approved by QA. You submitted it, so another approver has to release it.'
                : 'Approved by QA. Waiting for release by the approver.';

    const act = async (fn: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
            setDraft('');
            router.reload();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const requestChanges = () => {
        if (draft.trim() === '') {
            setNeedComment(true);
            document.getElementById('cm')?.focus();
            return;
        }
        void act(() =>
            controlPlanApi.requestChanges(revision.id, draft.trim()),
        );
    };

    const stepState = (done: boolean, now: boolean) =>
        done ? 'done' : now ? 'now' : 'todo';
    const steps = [
        {
            label: revision.submitter
                ? `Submitted by ${revision.submitter}`
                : 'Submit',
            state: stepState(
                !['draft', 'changes_requested'].includes(s) ||
                    !!revision.submitter,
                s === 'draft',
            ),
        },
        {
            label: 'QA review',
            state: stepState(
                ['approved', 'released', 'superseded'].includes(s),
                s === 'in_review' || s === 'changes_requested',
            ),
        },
        {
            label: 'Release by approver',
            state: stepState(
                ['released', 'superseded'].includes(s),
                s === 'approved',
            ),
        },
    ];

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Control Plans', href: '/control-plans' },
        {
            title: `${plan.doc_no} · Rev ${revision.rev}`,
            href: `/control-plans/${plan.id}`,
        },
        {
            title: 'Review',
            href: `/control-plan-revisions/${revision.id}/review`,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Review ${plan.doc_no} Rev ${revision.rev}`} />
            <header className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4">
                <div className="flex min-w-0 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[13px] text-muted-foreground">
                        <Link
                            href={`/control-plans/${plan.id}`}
                            className="hover:underline"
                        >
                            {plan.doc_no}
                        </Link>
                        · Rev {revision.rev}{' '}
                        {base
                            ? `compared with Rev ${base.rev}`
                            : '· first revision'}{' '}
                        <StatusBadge status={s} />
                    </div>
                    <h1 className="text-xl font-semibold">
                        Review Rev {revision.rev}
                    </h1>
                    <ol
                        className="flex flex-wrap items-center gap-2 text-xs"
                        aria-label="Revision progress"
                    >
                        {steps.map((st, i) => (
                            <li
                                key={st.label}
                                className="flex items-center gap-2"
                            >
                                {i > 0 && (
                                    <span
                                        aria-hidden
                                        className="h-px w-6 bg-border"
                                    />
                                )}
                                <span
                                    className={cn(
                                        'grid size-[18px] place-items-center rounded-full border text-[11px] font-semibold',
                                        st.state === 'done' &&
                                            'border-primary bg-primary text-primary-foreground',
                                        st.state === 'now' &&
                                            'border-2 border-primary text-primary',
                                    )}
                                >
                                    {st.state === 'done' ? (
                                        <CheckIcon className="size-3" />
                                    ) : (
                                        i + 1
                                    )}
                                </span>
                                <span
                                    className={cn(
                                        st.state === 'todo'
                                            ? 'text-muted-foreground'
                                            : 'text-foreground',
                                        st.state === 'now' && 'font-semibold',
                                    )}
                                >
                                    {st.label}
                                    {st.state === 'done' && (
                                        <span className="sr-only"> (done)</span>
                                    )}
                                    {st.state === 'now' && (
                                        <span className="sr-only">
                                            {' '}
                                            (current step)
                                        </span>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ol>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                    {allowed.edit && (
                        <Button variant="outline" asChild>
                            <Link href={`/control-plans/${plan.id}`}>
                                Open in editor
                            </Link>
                        </Button>
                    )}
                    {allowed.withdraw && (
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                                void act(() =>
                                    controlPlanApi.withdraw(revision.id),
                                )
                            }
                        >
                            Back to draft
                        </Button>
                    )}
                    {allowed.review && (
                        <>
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={requestChanges}
                            >
                                Request changes
                            </Button>
                            <Button
                                disabled={busy}
                                onClick={() =>
                                    void act(() =>
                                        controlPlanApi.approve(revision.id),
                                    )
                                }
                            >
                                Approve
                            </Button>
                        </>
                    )}
                    {allowed.release && (
                        <Button
                            disabled={busy}
                            onClick={() =>
                                void act(() =>
                                    controlPlanApi.release(revision.id),
                                )
                            }
                        >
                            Release Rev {revision.rev}
                        </Button>
                    )}
                    {waitText && (
                        <span className="text-sm text-muted-foreground">
                            {waitText}
                        </span>
                    )}
                </div>
            </header>

            <div className="flex flex-wrap items-start gap-4 p-4">
                <main className="flex min-w-0 flex-[999_1_640px] flex-col gap-3">
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="font-semibold">
                                {base
                                    ? `Changes since Rev ${base.rev}`
                                    : 'All lines (first revision)'}
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                {plural(diff.added, 'line', 'lines')} added ·{' '}
                                {plural(diff.changed, 'line', 'lines')} changed
                                · {diff.removed} removed
                            </p>
                        </div>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                                <i className="grid size-4 place-items-center rounded-sm bg-emerald-100 text-emerald-900 not-italic dark:bg-emerald-500/15 dark:text-emerald-300">
                                    +
                                </i>
                                Added
                            </span>
                            <span className="flex items-center gap-1">
                                <i className="grid size-4 place-items-center rounded-sm bg-red-100 text-red-900 not-italic dark:bg-red-500/15 dark:text-red-300">
                                    −
                                </i>
                                Removed
                            </span>
                            <span className="flex items-center gap-1">
                                <i className="grid size-4 place-items-center rounded-sm bg-amber-100 text-amber-900 not-italic dark:bg-amber-500/15 dark:text-amber-300">
                                    ~
                                </i>
                                Changed
                            </span>
                        </div>
                    </div>
                    <div className="rounded-md border">
                        <Table className="text-[13px]">
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8">
                                        <span className="sr-only">Change</span>
                                    </TableHead>
                                    <TableHead>Step</TableHead>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Process</TableHead>
                                    <TableHead>Class</TableHead>
                                    <TableHead>Specification</TableHead>
                                    <TableHead>Measurement</TableHead>
                                    <TableHead>Size</TableHead>
                                    <TableHead>Freq</TableHead>
                                    <TableHead>Control method</TableHead>
                                    <TableHead>PIC</TableHead>
                                    <TableHead>Reaction plan</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {diff.rows.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={12}
                                            className="h-20 text-center text-muted-foreground"
                                        >
                                            No characteristic lines changed
                                            {base
                                                ? ` since Rev ${base.rev}`
                                                : ''}
                                            .
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    diff.rows.map((r) => (
                                        <DiffLine
                                            key={`${r.kind}-${r.line.id}`}
                                            row={r}
                                        />
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" asChild>
                            <Link
                                href={`/control-plan-revisions/${revision.id}/preview`}
                            >
                                Open print preview
                            </Link>
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                            <Link href={`/control-plans/${plan.id}`}>
                                Open full plan
                            </Link>
                        </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Only changed lines are listed; the print preview shows
                        the whole document. Changes to the document header and
                        plan information are not listed here.
                    </p>
                </main>

                <aside className="flex max-w-[420px] min-w-[300px] flex-[1_1_340px] flex-col gap-4">
                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <CardTitle className="text-base">
                                Revision history entries
                            </CardTitle>
                            <p className="text-xs text-muted-foreground">
                                Written by the author on submit. Printed on page
                                1 when Rev {revision.rev} is released.
                            </p>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2 px-4">
                            {revision.history.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    None yet.
                                </p>
                            ) : (
                                <div className="rounded-md border">
                                    <Table className="text-[13px]">
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead className="w-14">
                                                    Page
                                                </TableHead>
                                                <TableHead>
                                                    Description
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {revision.history.map((h, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="align-top">
                                                        {h.pages}
                                                    </TableCell>
                                                    <TableCell className="whitespace-normal">
                                                        <ul className="list-disc pl-4">
                                                            {h.description
                                                                .split('\n')
                                                                .filter(
                                                                    (l) =>
                                                                        l.trim() !==
                                                                        '',
                                                                )
                                                                .map((l, j) => (
                                                                    <li key={j}>
                                                                        {l}
                                                                    </li>
                                                                ))}
                                                        </ul>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                                {revision.release_date
                                    ? `Released ${revision.release_date}`
                                    : `On release: Rev ${revision.rev} · release date`}
                                {revision.submitter
                                    ? ` · ${revision.submitter}`
                                    : ''}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <CardTitle className="text-base">
                                Comments
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-3 px-4">
                            {comments.length === 0 && (
                                <p className="text-sm text-muted-foreground">
                                    No comments yet.
                                </p>
                            )}
                            {comments.map((c) => (
                                <div
                                    key={c.id}
                                    className="flex flex-col gap-0.5 rounded-md bg-muted px-3 py-2 text-sm"
                                >
                                    <span className="text-xs font-semibold">
                                        {c.who}
                                        {KIND_LABEL[c.kind] && (
                                            <span className="font-normal text-muted-foreground">
                                                {' '}
                                                · {KIND_LABEL[c.kind]}
                                            </span>
                                        )}
                                        {c.at && (
                                            <span className="font-normal text-muted-foreground">
                                                {' '}
                                                ·{' '}
                                                {new Date(
                                                    c.at,
                                                ).toLocaleString()}
                                            </span>
                                        )}
                                    </span>
                                    <span className="whitespace-pre-line">
                                        {c.body}
                                    </span>
                                </div>
                            ))}
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="cm">Add a comment</Label>
                                <Textarea
                                    id="cm"
                                    value={draft}
                                    placeholder="Ask about a line or explain a requested change"
                                    aria-invalid={needComment || undefined}
                                    aria-describedby={
                                        needComment ? 'cm-err' : undefined
                                    }
                                    onChange={(e) => {
                                        setDraft(e.target.value);
                                        setNeedComment(false);
                                    }}
                                />
                                {needComment && (
                                    <span
                                        id="cm-err"
                                        className="text-xs text-destructive"
                                    >
                                        Write what needs to change before
                                        requesting changes.
                                    </span>
                                )}
                            </div>
                            <div>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy || draft.trim() === ''}
                                    onClick={() =>
                                        void act(() =>
                                            controlPlanApi.comment(
                                                revision.id,
                                                draft.trim(),
                                            ),
                                        )
                                    }
                                >
                                    Post comment
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </AppLayout>
    );
}

function DiffLine({ row }: { row: DiffRow }) {
    const { kind, step, line, old } = row;
    const cell = (field: string, value: React.ReactNode, oldValue?: string) =>
        field in old ? (
            <TableCell className="bg-amber-50 whitespace-normal dark:bg-amber-500/10">
                <span className="block text-xs text-muted-foreground line-through">
                    {oldValue ?? old[field]}
                </span>
                {value}
            </TableCell>
        ) : (
            <TableCell className="whitespace-normal">{value}</TableCell>
        );
    const stepChanged = Object.keys(old).some((k) => k.startsWith('step_'));
    const ref = line.reaction_ref.trim();

    return (
        <TableRow
            className={cn(
                kind === 'added' && 'bg-emerald-50 dark:bg-emerald-500/10',
                kind === 'removed' &&
                    'bg-red-50 text-muted-foreground line-through dark:bg-red-500/10',
            )}
        >
            <TableCell
                className="text-center font-mono font-semibold"
                aria-label={kind}
            >
                {kind === 'added' ? '+' : kind === 'removed' ? '−' : '~'}
            </TableCell>
            {stepChanged ? (
                <TableCell className="min-w-40 bg-amber-50 whitespace-normal dark:bg-amber-500/10">
                    <span className="block text-xs text-muted-foreground line-through">
                        {old.step_no ?? step.no} · {old.step_name ?? step.name}
                    </span>
                    {step.no} · {step.name}
                </TableCell>
            ) : (
                <TableCell className="min-w-40 whitespace-normal">
                    {step.no} · {step.name}
                </TableCell>
            )}
            {cell('product', line.product)}
            {cell('process', line.process)}
            {cell(
                'sc',
                hasClass(line.sc) ? <ScMark value={line.sc} /> : line.sc,
            )}
            {cell('spec', <RefText text={line.spec} />)}
            {cell('measurement', line.measurement)}
            {cell('size', line.size)}
            {cell('frequency', line.frequency)}
            {cell('control', <RefText text={line.control} />)}
            {cell('pic', line.pic)}
            {cell(
                'reaction_ref' in old && !('reaction' in old)
                    ? 'reaction_ref'
                    : 'reaction',
                <span className="inline-flex flex-wrap items-center gap-1">
                    {line.reaction} {ref && <RefChip code={ref} known />}
                </span>,
                'reaction' in old || 'reaction_ref' in old
                    ? `${old.reaction ?? line.reaction} ${old.reaction_ref ?? line.reaction_ref}`.trim()
                    : undefined,
            )}
        </TableRow>
    );
}
