import {
    AddStepDialog,
    type NewStep,
    SubmitDialog,
} from '@/components/control-plans/editor-dialogs';
import { LinePanel } from '@/components/control-plans/line-panel';
import { PlanDetails } from '@/components/control-plans/plan-details';
import {
    footerChanges,
    PlanFooter,
} from '@/components/control-plans/plan-footer';
import { PlanGrid } from '@/components/control-plans/plan-grid';
import {
    StatusBadge,
    ToneBadge,
} from '@/components/control-plans/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import {
    blank,
    type Content,
    controlPlanApi,
    type DocHeader,
    emptyLine,
    LINE_FIELDS,
    type LineField,
    newId,
    orderedLines,
    type Person,
    type PlanInfo,
    type PlanRef,
    type Revision,
    STEP_FIELDS,
    type StepField,
} from '@/lib/control-plans';
import { usePermissions } from '@/lib/permissions';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
    plan: PlanRef;
    revision: Revision;
    released: Revision | null;
    referenceCodes: string[];
    reviewPeriod: number;
    people: Person[];
}

interface Doc {
    doc_no: string;
    header: DocHeader;
    info: PlanInfo;
    content: Content;
}

const docOf = (plan: PlanRef, r: Revision): Doc => ({
    doc_no: plan.doc_no,
    header: r.header,
    info: r.info,
    content: r.content,
});

/** Counts the differences between the draft and its last saved state, the way the design's "N unsaved changes" does. */
function countChanges(doc: Doc, base: Doc): number {
    let n = doc.doc_no === base.doc_no ? 0 : 1;
    (Object.keys(doc.header) as (keyof DocHeader)[]).forEach(
        (k) => (n += doc.header[k] === base.header[k] ? 0 : 1),
    );
    (Object.keys(doc.info) as (keyof PlanInfo)[]).forEach(
        (k) => (n += doc.info[k] === base.info[k] ? 0 : 1),
    );
    const baseLines = new Map(base.content.lines.map((l) => [l.id, l]));
    const baseSteps = new Map(base.content.steps.map((s) => [s.id, s]));
    const lineIds = new Set(doc.content.lines.map((l) => l.id));
    const stepIds = new Set(doc.content.steps.map((s) => s.id));
    doc.content.lines.forEach((l) => {
        const b = baseLines.get(l.id);
        n += b ? LINE_FIELDS.filter((f) => b[f] !== l[f]).length : 1;
    });
    doc.content.steps.forEach((s) => {
        const b = baseSteps.get(s.id);
        n += b ? STEP_FIELDS.filter((f) => b[f] !== s[f]).length : 1;
    });
    // Moving a step or line also changes the document.
    const order = (c: Content) =>
        orderedLines(c)
            .map((e) => e.line.id)
            .join(',');
    if (order(doc.content) !== order(base.content) && n === 0) n = 1;
    n +=
        base.content.lines.filter((l) => !lineIds.has(l.id)).length +
        base.content.steps.filter((s) => !stepIds.has(s.id)).length;
    return n + footerChanges(doc.content, base.content);
}

export default function ControlPlanEditor({
    plan,
    revision,
    released,
    referenceCodes,
    reviewPeriod,
    people,
}: Props) {
    const { can } = usePermissions();
    const editable = revision.editable && can('control-plans.author');
    const [doc, setDoc] = useState<Doc>(() => docOf(plan, revision));
    const [base, setBase] = useState<Doc>(() => docOf(plan, revision));
    const [sel, setSel] = useState<string | null>(
        () => orderedLines(revision.content)[0]?.line.id ?? null,
    );
    const [addingStep, setAddingStep] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [signed, setSigned] = useState(revision.signed);
    const leaving = useRef(false);

    const knownCodes = useMemo(() => new Set(referenceCodes), [referenceCodes]);
    const changes = editable ? countChanges(doc, base) : 0;
    const ordered = orderedLines(doc.content);
    const selIdx = Math.max(
        0,
        ordered.findIndex((e) => e.line.id === sel),
    );
    const cur = ordered[selIdx];
    const stepLines = cur
        ? ordered.filter((e) => e.step.id === cur.step.id)
        : [];
    const isReleased =
        revision.status === 'released' || revision.status === 'superseded';

    // Keep unsaved edits from being lost to a reload or a link.
    useEffect(() => {
        if (changes === 0) return;
        const onUnload = (e: BeforeUnloadEvent) => e.preventDefault();
        window.addEventListener('beforeunload', onUnload);
        const off = router.on('before', (e) => {
            if (leaving.current || e.detail.visit.method !== 'get') return;
            if (
                !window.confirm(
                    'You have unsaved changes in this draft. Leave without saving them?',
                )
            )
                e.preventDefault();
        });
        return () => {
            window.removeEventListener('beforeunload', onUnload);
            off();
        };
    }, [changes]);

    const leave = (url: string) => {
        leaving.current = true;
        router.visit(url);
    };

    const setContent = (fn: (c: Content) => Content) =>
        setDoc((d) => ({ ...d, content: fn(d.content) }));
    const editStep = (f: StepField, v: string) =>
        cur &&
        setContent((c) => ({
            ...c,
            steps: c.steps.map((s) =>
                s.id === cur.step.id ? { ...s, [f]: v } : s,
            ),
        }));
    const editLine = (f: LineField, v: string) =>
        cur &&
        setContent((c) => ({
            ...c,
            lines: c.lines.map((l) =>
                l.id === cur.line.id ? { ...l, [f]: v } : l,
            ),
        }));

    const addLine = () => {
        if (!cur) return;
        const line = emptyLine(cur.step.id);
        setContent((c) => {
            const at = c.lines.findIndex((l) => l.id === cur.line.id);
            const lines = [...c.lines];
            lines.splice(at + 1, 0, line);
            return { ...c, lines };
        });
        setSel(line.id);
    };

    const createStep = (s: NewStep) => {
        const step = {
            id: newId(),
            no: s.no.trim(),
            group: s.group.trim(),
            name: s.name.trim(),
            machine: s.machine.trim(),
        };
        const line = { ...emptyLine(step.id), product: s.product.trim() };
        setContent((c) => {
            const steps = [...c.steps];
            const at =
                s.where === 'after' && cur
                    ? steps.findIndex((x) => x.id === cur.step.id) + 1
                    : steps.length;
            steps.splice(at, 0, step);
            return { ...c, steps, lines: [...c.lines, line] };
        });
        setSel(line.id);
        setAddingStep(false);
    };

    const deleteLine = () => {
        if (!cur) return;
        const next = ordered[selIdx + 1] ?? ordered[selIdx - 1];
        setContent((c) => {
            const lines = c.lines.filter((l) => l.id !== cur.line.id);
            const steps = lines.some((l) => l.step_id === cur.step.id)
                ? c.steps
                : c.steps.filter((s) => s.id !== cur.step.id);
            return { ...c, steps, lines };
        });
        setSel(next?.line.id ?? null);
    };

    const save = async (): Promise<boolean> => {
        setBusy(true);
        setError(null);
        try {
            const saved = await controlPlanApi.save(revision.id, doc);
            const fresh = {
                ...doc,
                header: saved.header,
                info: saved.info,
                content: saved.content,
            };
            setDoc(fresh);
            setBase(fresh);
            const cleared =
                Object.keys(signed).length > 0 &&
                Object.keys(saved.signed).length === 0;
            setSigned(saved.signed);
            setNotice(
                cleared
                    ? 'Draft saved. The signatures were removed because the plan changed; the signers need to sign again.'
                    : 'Draft saved.',
            );
            return true;
        } catch (e) {
            setError((e as Error).message);
            return false;
        } finally {
            setBusy(false);
        }
    };

    const discard = () => {
        setDoc(base);
        if (!base.content.lines.some((l) => l.id === sel))
            setSel(orderedLines(base.content)[0]?.line.id ?? null);
        setNotice(null);
    };

    const submit = async (history: Revision['history']) => {
        if (changes > 0) {
            // Throws into the dialog, which shows the message.
            const saved = await controlPlanApi.save(revision.id, doc);
            setBase({
                ...doc,
                header: saved.header,
                info: saved.info,
                content: saved.content,
            });
        }
        await controlPlanApi.submit(revision.id, history);
        leave(`/control-plan-revisions/${revision.id}/review`);
    };

    const startRevision = async () => {
        setBusy(true);
        setError(null);
        try {
            await controlPlanApi.startRevision(plan.id);
            leave(`/control-plans/${plan.id}`);
        } catch (e) {
            setError((e as Error).message);
            setBusy(false);
        }
    };

    const deleteDraft = async () => {
        setConfirmDelete(false);
        try {
            await controlPlanApi.discard(revision.id);
            leave('/control-plans');
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Control Plans', href: '/control-plans' },
        {
            title: `${doc.doc_no} · Rev ${revision.rev}`,
            href: `/control-plans/${plan.id}`,
        },
    ];
    const groups = [
        ...new Set(
            doc.content.steps.map((s) => s.group).filter((g) => !blank(g)),
        ),
    ];
    const maxNo = Math.max(
        0,
        ...doc.content.steps
            .map((s) => parseInt(s.no, 10))
            .filter((n) => !Number.isNaN(n)),
    );
    const missingSize = ordered.filter((e) => blank(e.line.size)).length;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`${doc.doc_no} Rev ${revision.rev}`} />
            <div className="flex min-h-full flex-col">
                <header className="flex flex-wrap items-start justify-between gap-4 border-b px-4 py-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 font-mono text-[13px] text-muted-foreground">
                            {doc.doc_no} · Rev {revision.rev}{' '}
                            <StatusBadge status={revision.status} />
                        </div>
                        <h1 className="text-xl font-semibold">
                            {doc.header.mill ||
                                doc.info.title ||
                                'Control plan'}
                        </h1>
                        <dl className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                            <div className="flex gap-1.5">
                                <dt className="text-muted-foreground">
                                    Referensi SP
                                </dt>
                                <dd className="font-mono">
                                    {doc.header.sp_ref || '—'}
                                </dd>
                            </div>
                            <div className="flex gap-1.5">
                                <dt className="text-muted-foreground">
                                    Last release
                                </dt>
                                <dd>
                                    {released
                                        ? `Rev ${released.rev} · ${released.release_date}`
                                        : 'Not released yet'}
                                </dd>
                            </div>
                            <div className="flex gap-1.5">
                                <dt className="text-muted-foreground">
                                    Next review
                                </dt>
                                <dd>{released?.next_review ?? '—'}</dd>
                            </div>
                        </dl>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {!isReleased && (
                            <Button variant="outline" asChild>
                                <Link
                                    href={`/control-plan-revisions/${revision.id}/review`}
                                >
                                    {released
                                        ? `Compare with Rev ${released.rev}`
                                        : 'Review page'}
                                </Link>
                            </Button>
                        )}
                        <Button variant="outline" asChild>
                            <Link
                                href={`/control-plan-revisions/${revision.id}/preview`}
                            >
                                Print preview
                            </Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link
                                href={`/control-plans/${plan.id}/export?revision=${revision.id}`}
                            >
                                Export
                            </Link>
                        </Button>
                        {editable && (
                            <>
                                <Button
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() => setConfirmDelete(true)}
                                >
                                    <Trash2Icon /> Delete draft
                                </Button>
                                <Button
                                    onClick={() => setSubmitting(true)}
                                    disabled={busy}
                                >
                                    Submit for review
                                </Button>
                            </>
                        )}
                        {isReleased &&
                            revision.status === 'released' &&
                            can('control-plans.author') && (
                                <Button
                                    onClick={() => void startRevision()}
                                    disabled={busy}
                                >
                                    Start Rev{' '}
                                    {String(revision.rev_no + 1).padStart(
                                        2,
                                        '0',
                                    )}
                                </Button>
                            )}
                    </div>
                </header>

                <div className="flex flex-col gap-4 px-4 pt-4">
                    {!editable && !isReleased && (
                        <Alert>
                            <AlertDescription>
                                <span>
                                    {revision.status === 'in_review' &&
                                        'This revision is with QA for review, so it cannot be edited. '}
                                    {revision.status === 'approved' &&
                                        'QA approved this revision; it is waiting to be released. '}
                                    {(revision.status === 'draft' ||
                                        revision.status ===
                                            'changes_requested') &&
                                        'Only authors can edit a draft. '}
                                    <Link
                                        href={`/control-plan-revisions/${revision.id}/review`}
                                        className="font-medium underline"
                                    >
                                        Open the review page
                                    </Link>
                                </span>
                            </AlertDescription>
                        </Alert>
                    )}
                    {revision.status === 'changes_requested' && editable && (
                        <Alert>
                            <AlertDescription>
                                <span>
                                    QA asked for changes. See their comments on
                                    the{' '}
                                    <Link
                                        href={`/control-plan-revisions/${revision.id}/review`}
                                        className="font-medium underline"
                                    >
                                        review page
                                    </Link>
                                    , then submit again.
                                </span>
                            </AlertDescription>
                        </Alert>
                    )}
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <PlanDetails
                        docNo={doc.doc_no}
                        header={doc.header}
                        info={doc.info}
                        base={editable ? base : null}
                        revLabel={revision.rev}
                        lastRelease={
                            released
                                ? `${released.rev} / ${released.release_date}`
                                : null
                        }
                        nextReview={released?.next_review ?? null}
                        reviewPeriod={reviewPeriod}
                        released={isReleased}
                        onDocNo={
                            editable
                                ? (v) => setDoc((d) => ({ ...d, doc_no: v }))
                                : undefined
                        }
                        onHeader={
                            editable
                                ? (k, v) =>
                                      setDoc((d) => ({
                                          ...d,
                                          header: { ...d.header, [k]: v },
                                      }))
                                : undefined
                        }
                        onInfo={
                            editable
                                ? (k, v) =>
                                      setDoc((d) => ({
                                          ...d,
                                          info: { ...d.info, [k]: v },
                                      }))
                                : undefined
                        }
                    />
                </div>

                <main className="flex flex-1 flex-col gap-3 px-4 pt-4 pb-6">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h2 className="font-semibold">
                                Process steps and characteristics
                            </h2>
                            <p className="text-xs text-muted-foreground">
                                {doc.content.steps.length} process steps ·{' '}
                                {doc.content.lines.length} characteristics
                                {missingSize > 0 &&
                                    ` · ${missingSize} without a sample size`}
                            </p>
                        </div>
                        {editable && (
                            <div className="flex flex-wrap items-center gap-2">
                                {changes > 0 ? (
                                    <ToneBadge tone="draft">
                                        {changes === 1
                                            ? '1 unsaved change'
                                            : `${changes} unsaved changes`}
                                    </ToneBadge>
                                ) : (
                                    notice && (
                                        <span
                                            role="status"
                                            className="text-xs text-muted-foreground"
                                        >
                                            {notice}
                                        </span>
                                    )
                                )}
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setAddingStep(true)}
                                >
                                    <PlusIcon /> Add step
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={addLine}
                                    disabled={!cur}
                                    title="Adds a line below the selected one, in the same step"
                                >
                                    <PlusIcon /> Add characteristic
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={discard}
                                    disabled={changes === 0 || busy}
                                >
                                    Discard
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => void save()}
                                    disabled={changes === 0 || busy}
                                >
                                    {busy ? 'Saving…' : 'Save draft'}
                                </Button>
                            </div>
                        )}
                    </div>

                    <PlanGrid
                        content={doc.content}
                        base={editable ? base.content : null}
                        selectedId={editable ? (cur?.line.id ?? null) : null}
                        onPick={editable ? setSel : undefined}
                        knownCodes={knownCodes}
                    />
                    {editable && (
                        <p className="text-xs text-muted-foreground">
                            Select a process name or a characteristic to edit it
                            in the panel at the bottom of the screen. Add
                            characteristic puts a new line under the selected
                            one, in the same step. New lines are green, changed
                            cells yellow, until you save the draft.
                        </p>
                    )}
                    <PlanFooter
                        footer={doc.content}
                        base={editable ? base.content : null}
                        signed={signed}
                        people={people}
                        onChange={
                            editable
                                ? (f) => setContent((c) => ({ ...c, ...f }))
                                : undefined
                        }
                    />
                </main>

                {editable && cur && (
                    <LinePanel
                        key={cur.line.id}
                        step={cur.step}
                        line={cur.line}
                        baseStep={base.content.steps.find(
                            (s) => s.id === cur.step.id,
                        )}
                        baseLine={base.content.lines.find(
                            (l) => l.id === cur.line.id,
                        )}
                        hasBase
                        indexInStep={
                            stepLines.findIndex(
                                (e) => e.line.id === cur.line.id,
                            ) + 1
                        }
                        stepLineCount={stepLines.length}
                        isFirst={selIdx === 0}
                        isLast={selIdx === ordered.length - 1}
                        onlyLine={ordered.length === 1}
                        knownCodes={knownCodes}
                        onStep={editStep}
                        onLine={editLine}
                        onPrev={() =>
                            setSel(ordered[selIdx - 1]?.line.id ?? sel)
                        }
                        onNext={() =>
                            setSel(ordered[selIdx + 1]?.line.id ?? sel)
                        }
                        onDelete={deleteLine}
                    />
                )}
            </div>

            {addingStep && cur && (
                <AddStepDialog
                    initialNo={String(maxNo + 1)}
                    groups={groups}
                    currentLabel={`step ${cur.step.no} · ${blank(cur.step.name) ? 'New process step' : cur.step.name}`}
                    onClose={() => setAddingStep(false)}
                    onCreate={createStep}
                />
            )}
            {submitting && (
                <SubmitDialog
                    rev={revision.rev}
                    unsaved={changes}
                    initial={revision.history}
                    onClose={() => setSubmitting(false)}
                    onSubmit={submit}
                />
            )}

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete the Rev {revision.rev} draft?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {released
                                ? `Every change made since Rev ${released.rev} is lost. Rev ${released.rev} stays released.`
                                : 'This plan has never been released, so the whole document is deleted.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void deleteDraft()}>
                            Delete draft
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
