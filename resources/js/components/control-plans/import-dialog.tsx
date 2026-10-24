import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    controlPlanApi,
    orderedLines,
    PHASES,
    type ImportPreview,
    type ImportStatus,
} from '@/lib/control-plans';
import { cn } from '@/lib/utils';
import { Link, router } from '@inertiajs/react';
import { FileUpIcon, TriangleAlertIcon } from 'lucide-react';
import { useRef, useState } from 'react';

/**
 * Brings a plan kept in Word or PDF into the app: read the file, check what came out, then create it as a draft
 * (the usual review workflow) or, for approvers, as the released revision it already is on paper. A plan whose
 * document number is already in the app can replace that plan, for someone who may delete plans.
 */
export function ImportPlanDialog({
    canRelease,
    canReplace,
    onClose,
}: {
    canRelease: boolean;
    canReplace: boolean;
    onClose: () => void;
}) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [docNo, setDocNo] = useState('');
    const [title, setTitle] = useState('');
    const [revNo, setRevNo] = useState('');
    const [status, setStatus] = useState<ImportStatus>('draft');
    const [replace, setReplace] = useState(false);
    const [releaseDate, setReleaseDate] = useState('');
    const [nextReview, setNextReview] = useState('');
    const [busy, setBusy] = useState<'reading' | 'importing' | null>(null);
    const [error, setError] = useState<string | null>(null);
    // The plan the document number belongs to, while it still is the number read from the file.
    const clash =
        preview?.existing && docNo.trim() === preview.existing.doc_no
            ? preview.existing
            : null;

    const read = async (file: File) => {
        setBusy('reading');
        setError(null);
        try {
            const p = await controlPlanApi.importPreview(file);
            setPreview(p);
            setDocNo(p.doc_no);
            setTitle(p.info.title);
            setRevNo(p.rev_no === null ? '' : String(p.rev_no));
            setReleaseDate(p.release_date ?? '');
            setNextReview(p.next_review_date ?? '');
            setStatus('draft');
            setReplace(false);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(null);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const create = async () => {
        if (!preview) return;
        const rev = Number(revNo);
        if (!docNo.trim()) return setError('Enter the document number.');
        if (revNo.trim() === '' || !Number.isInteger(rev) || rev < 0)
            return setError(
                'The revision number must be a whole number, 0 or more.',
            );
        if (clash && !replace)
            return setError(
                `${clash.doc_no} is already in the app. Change the document number, or choose to replace that plan.`,
            );
        if (status === 'released' && !releaseDate)
            return setError('Enter the date this revision was released.');
        setBusy('importing');
        setError(null);
        try {
            const { plan_id } = await controlPlanApi.importPlan({
                status,
                replace: clash !== null && replace,
                file_name: preview.file_name,
                doc_no: docNo.trim(),
                rev_no: rev,
                header: preview.header,
                info: { ...preview.info, title: title.trim() },
                content: preview.content,
                history: preview.history,
                release_date: status === 'released' ? releaseDate : null,
                next_review_date:
                    status === 'released' && nextReview ? nextReview : null,
            });
            router.visit(`/control-plans/${plan_id}`);
        } catch (e) {
            setError((e as Error).message);
            setBusy(null);
        }
    };

    const optCls = (on: boolean, disabled = false) =>
        cn(
            'flex items-start gap-3 rounded-md border p-3',
            on && 'border-primary bg-primary/5',
            disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
        );
    const revLabel = revNo.trim() === '' ? '' : ` ${revNo.padStart(2, '0')}`;

    return (
        <Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Import a control plan</DialogTitle>
                    <DialogDescription>
                        For moving a plan kept in Word or PDF into the app.
                        Nothing is saved until you import it.
                    </DialogDescription>
                </DialogHeader>

                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <input
                    ref={fileRef}
                    type="file"
                    accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="sr-only"
                    aria-label="Choose a Word or PDF file"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) void read(file);
                    }}
                />

                {!preview ? (
                    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed p-8 text-center">
                        <FileUpIcon className="size-8 text-muted-foreground" />
                        <Button
                            onClick={() => fileRef.current?.click()}
                            disabled={busy !== null}
                        >
                            {busy === 'reading'
                                ? 'Reading the file…'
                                : 'Choose a Word or PDF file'}
                        </Button>
                        <p className="max-w-md text-sm text-muted-foreground">
                            A Word file (.docx) reads best. A PDF works when it
                            was saved from Word, not scanned. For an older .doc
                            file, open it in Word and save it as .docx first.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-5">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                            <span>
                                Read from{' '}
                                <b className="font-medium">
                                    {preview.file_name}
                                </b>
                            </span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => fileRef.current?.click()}
                                disabled={busy !== null}
                            >
                                {busy === 'reading'
                                    ? 'Reading…'
                                    : 'Choose another file'}
                            </Button>
                        </div>

                        {preview.warnings.length > 0 && (
                            <Alert>
                                <TriangleAlertIcon />
                                <AlertDescription>
                                    <ul className="list-disc space-y-1 pl-4">
                                        {preview.warnings.map((w) => (
                                            <li key={w}>{w}</li>
                                        ))}
                                    </ul>
                                </AlertDescription>
                            </Alert>
                        )}

                        <div className="grid gap-4 sm:grid-cols-[1fr_2fr_auto]">
                            <div className="space-y-1.5">
                                <Label htmlFor="ip-doc">Document number</Label>
                                <Input
                                    id="ip-doc"
                                    className="font-mono"
                                    value={docNo}
                                    onChange={(e) => setDocNo(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="ip-title">
                                    Control plan title
                                </Label>
                                <Input
                                    id="ip-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="ip-rev">Revision number</Label>
                                <Input
                                    id="ip-rev"
                                    inputMode="numeric"
                                    className="w-28"
                                    value={revNo}
                                    onChange={(e) => setRevNo(e.target.value)}
                                />
                            </div>
                        </div>

                        {clash && (
                            <fieldset className="flex flex-col gap-2">
                                <legend className="mb-2 text-sm font-medium">
                                    <Link
                                        href={`/control-plans/${clash.id}`}
                                        className="font-mono text-primary underline underline-offset-2"
                                    >
                                        {clash.doc_no}
                                    </Link>{' '}
                                    is already in the app
                                    {clash.revisions && ` (${clash.revisions})`}
                                </legend>
                                <label className={optCls(!replace)}>
                                    <input
                                        type="radio"
                                        name="ip-existing"
                                        className="mt-0.5 size-4 accent-primary"
                                        checked={!replace}
                                        onChange={() => setReplace(false)}
                                    />
                                    <span className="flex flex-col gap-0.5">
                                        <b className="text-sm">Keep it</b>
                                        <span className="text-xs text-muted-foreground">
                                            Change the document number above to
                                            import this file as another plan. To
                                            revise the existing plan, open it
                                            and start its next revision instead.
                                        </span>
                                    </span>
                                </label>
                                <label className={optCls(replace, !canReplace)}>
                                    <input
                                        type="radio"
                                        name="ip-existing"
                                        className="mt-0.5 size-4 accent-primary"
                                        checked={replace}
                                        disabled={!canReplace}
                                        onChange={() => setReplace(true)}
                                    />
                                    <span className="flex flex-col gap-0.5">
                                        <b className="text-sm">
                                            Replace it with the imported plan
                                        </b>
                                        <span className="text-xs text-muted-foreground">
                                            {canReplace
                                                ? `Deletes ${clash.revisions ? `${clash.revisions}, ` : 'its revisions, '}with their comments and signatures. Links to ${clash.doc_no} open the imported plan.`
                                                : 'Only someone who can delete control plans can replace one.'}
                                        </span>
                                    </span>
                                </label>
                            </fieldset>
                        )}

                        <Summary preview={preview} />
                        <LinesPreview preview={preview} />
                        {preview.history.length > 0 && (
                            <HistoryPreview preview={preview} />
                        )}

                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-2 text-sm font-medium">
                                Import as
                            </legend>
                            <label className={optCls(status === 'draft')}>
                                <input
                                    type="radio"
                                    name="ip-status"
                                    className="mt-0.5 size-4 accent-primary"
                                    checked={status === 'draft'}
                                    onChange={() => setStatus('draft')}
                                />
                                <span className="flex flex-col gap-0.5">
                                    <b className="text-sm">
                                        Draft Rev{revLabel}
                                    </b>
                                    <span className="text-xs text-muted-foreground">
                                        Check it in the editor, then submit it
                                        for review and release it as usual. Its
                                        revision history row fills in the submit
                                        form.
                                    </span>
                                </span>
                            </label>
                            <label
                                className={optCls(
                                    status === 'released',
                                    !canRelease,
                                )}
                            >
                                <input
                                    type="radio"
                                    name="ip-status"
                                    className="mt-0.5 size-4 accent-primary"
                                    checked={status === 'released'}
                                    disabled={!canRelease}
                                    onChange={() => setStatus('released')}
                                />
                                <span className="flex flex-col gap-0.5">
                                    <b className="text-sm">
                                        Released Rev{revLabel}
                                    </b>
                                    <span className="text-xs text-muted-foreground">
                                        {canRelease
                                            ? 'For a plan already approved on paper: it goes on the shop floor straight away, with its release and review dates.'
                                            : 'Only someone who can release control plans can import one as released.'}
                                    </span>
                                </span>
                            </label>
                        </fieldset>

                        {status === 'released' && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="ip-released">
                                        Release date
                                    </Label>
                                    <Input
                                        id="ip-released"
                                        type="date"
                                        className="w-44"
                                        value={releaseDate}
                                        onChange={(e) =>
                                            setReleaseDate(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="ip-review">
                                        Next review date
                                    </Label>
                                    <Input
                                        id="ip-review"
                                        type="date"
                                        className="w-44"
                                        value={nextReview}
                                        onChange={(e) =>
                                            setNextReview(e.target.value)
                                        }
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Leave empty for the release date +{' '}
                                        {preview.review_period_years}{' '}
                                        {preview.review_period_years === 1
                                            ? 'year'
                                            : 'years'}
                                        .
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={busy !== null}
                    >
                        Cancel
                    </Button>
                    {preview && (
                        <Button
                            onClick={() => void create()}
                            disabled={busy !== null}
                        >
                            {busy === 'importing'
                                ? 'Importing…'
                                : `${clash && replace ? 'Replace with' : 'Import as'} ${status === 'released' ? 'released' : 'draft'}`}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function Summary({ preview }: { preview: ImportPreview }) {
    const { header, info, content } = preview;
    const signers =
        content.signatures.prepared.length + content.signatures.approved.length;
    const notes = content.notes.split('\n').filter((n) => n.trim()).length;
    const rows: [string, string][] = [
        ['Mill', header.mill],
        ['Referensi SP', header.sp_ref],
        ['Issued', header.issued],
        ['Phase', PHASES.find((p) => p.value === info.phase)?.label ?? ''],
        [
            'Organization',
            [info.org_plant, info.org_code].filter(Boolean).join(' · '),
        ],
        ['Notes', notes === 0 ? '' : notes === 1 ? '1 note' : `${notes} notes`],
        [
            'Signature block',
            signers === 0
                ? ''
                : `${content.signatures.prepared.length} Dibuat oleh, ${content.signatures.approved.length} Disetujui oleh`,
        ],
    ];

    return (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[13px]">
            {rows.map(([label, value]) => (
                <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className={value ? '' : 'text-muted-foreground'}>
                        {value || 'Not found'}
                    </dd>
                </div>
            ))}
        </dl>
    );
}

/** The steps and lines as read, step cells merged over their lines as on the printed plan. */
function LinesPreview({ preview }: { preview: ImportPreview }) {
    const rows = orderedLines(preview.content);
    const steps = preview.content.steps.length;
    const cell = 'border px-2 py-1 align-top';

    return (
        <section className="flex flex-col gap-2" aria-label="Characteristics">
            <h3 className="text-sm font-medium">
                {steps === 1 ? '1 step' : `${steps} steps`} ·{' '}
                {rows.length === 1
                    ? '1 characteristic'
                    : `${rows.length} characteristics`}
            </h3>
            <div className="max-h-72 overflow-auto rounded-md border">
                <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 bg-muted">
                        <tr>
                            {[
                                'No.',
                                'Process',
                                'Machine',
                                'Product',
                                'Process char.',
                                'Specification',
                                'Sample',
                                'Reaction plan',
                            ].map((h) => (
                                <th
                                    key={h}
                                    className={cn(
                                        cell,
                                        'text-left font-medium',
                                    )}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(({ step, line }, i) => {
                            const first =
                                i === 0 || rows[i - 1].step.id !== step.id;
                            const span = rows.filter(
                                (r) => r.step.id === step.id,
                            ).length;
                            return (
                                <tr key={line.id}>
                                    {first && (
                                        <>
                                            <td className={cell} rowSpan={span}>
                                                {step.no}
                                            </td>
                                            <td className={cell} rowSpan={span}>
                                                {step.group && (
                                                    <span className="block text-muted-foreground">
                                                        {step.group}
                                                    </span>
                                                )}
                                                {step.name}
                                            </td>
                                            <td className={cell} rowSpan={span}>
                                                {step.machine}
                                            </td>
                                        </>
                                    )}
                                    <td className={cell}>{line.product}</td>
                                    <td className={cell}>{line.process}</td>
                                    <td className={cell}>{line.spec}</td>
                                    <td
                                        className={cn(
                                            cell,
                                            !line.size.trim() &&
                                                'bg-destructive/10',
                                        )}
                                    >
                                        {[
                                            line.size || 'no size',
                                            line.frequency,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </td>
                                    <td className={cell}>
                                        {line.reaction}
                                        {line.reaction_ref &&
                                            ` (${line.reaction_ref})`}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}

function HistoryPreview({ preview }: { preview: ImportPreview }) {
    const cell = 'border px-2 py-1 align-top';

    return (
        <section className="flex flex-col gap-2" aria-label="Revision history">
            <h3 className="text-sm font-medium">
                Revision history ·{' '}
                {preview.history.length === 1
                    ? '1 row'
                    : `${preview.history.length} rows`}
            </h3>
            <div className="max-h-48 overflow-auto rounded-md border">
                <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 bg-muted">
                        <tr>
                            {[
                                'Rev',
                                'Date',
                                'Page',
                                'Description',
                                'Revised by',
                            ].map((h) => (
                                <th
                                    key={h}
                                    className={cn(
                                        cell,
                                        'text-left font-medium',
                                    )}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {preview.history.map((h, i) => (
                            <tr key={i}>
                                <td className={cell}>{h.rev}</td>
                                <td className={cell}>{h.date}</td>
                                <td className={cell}>{h.page}</td>
                                <td className={cn(cell, 'whitespace-pre-line')}>
                                    {h.description}
                                </td>
                                <td className={cell}>{h.revised_by}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
