import { ImportPlanDialog } from '@/components/control-plans/import-dialog';
import {
    StatusBadge,
    ToneBadge,
} from '@/components/control-plans/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import AppLayout from '@/layouts/app-layout';
import { controlPlanApi, type RevisionStatus } from '@/lib/control-plans';
import { usePermissions } from '@/lib/permissions';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { FileUpIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Quality Documents', href: '#' },
    { title: 'Control Plans', href: '/control-plans' },
];

interface PlanRow {
    id: number;
    doc_no: string;
    title: string;
    released: { id: number; rev: string; release_date: string } | null;
    open: { id: number; rev: string; status: RevisionStatus } | null;
    next_review: string | null;
}

interface RevisionSummary {
    id: number;
    plan_id: number;
    doc_no: string;
    rev: string;
    status: RevisionStatus;
    mill: string;
    based_on: string | null;
    /** The person viewing has a signature box in it that they have not signed. */
    to_sign: boolean;
}

interface Props {
    plans: PlanRow[];
    myDrafts: RevisionSummary[];
    waiting: RevisionSummary[];
    upcoming: {
        id: number;
        doc_no: string;
        next_review: string;
        overdue: boolean;
    }[];
    canWork: boolean;
}

export default function ControlPlans({
    plans,
    myDrafts,
    waiting,
    upcoming,
    canWork,
}: Props) {
    const { can } = usePermissions();
    const [q, setQ] = useState('');
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);

    const needle = q.trim().toLowerCase();
    const shown = plans.filter(
        (p) =>
            needle === '' ||
            `${p.doc_no} ${p.title}`.toLowerCase().includes(needle),
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Control Plans" />
            <div className="flex flex-col gap-6 p-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold">Control plans</h1>
                        <p className="text-sm text-muted-foreground">
                            {plans.length === 1
                                ? '1 document'
                                : `${plans.length} documents`}{' '}
                            · W-WSD work station documents
                        </p>
                    </div>
                    {can('control-plans.author') && (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setImporting(true)}
                            >
                                <FileUpIcon /> Import from Word/PDF
                            </Button>
                            <Button onClick={() => setCreating(true)}>
                                <PlusIcon /> New control plan
                            </Button>
                        </div>
                    )}
                </div>

                {canWork && (
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card className="gap-3 py-4">
                            <CardHeader className="px-4">
                                <CardTitle className="text-base">
                                    My drafts
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 px-4">
                                {myDrafts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        You have no drafts. Open a released plan
                                        to start its next revision.
                                    </p>
                                ) : (
                                    myDrafts.map((d) => (
                                        <RevisionItem
                                            key={d.id}
                                            r={d}
                                            href={`/control-plans/${d.plan_id}`}
                                        />
                                    ))
                                )}
                            </CardContent>
                        </Card>
                        <Card className="gap-3 py-4">
                            <CardHeader className="px-4">
                                <CardTitle className="text-base">
                                    Waiting for me
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 px-4">
                                {waiting.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">
                                        Nothing is waiting for you. Revisions
                                        submitted for review show here for
                                        reviewers and approvers, and plans you
                                        are asked to sign for everyone.
                                    </p>
                                ) : (
                                    waiting.map((d) => (
                                        <RevisionItem
                                            key={d.id}
                                            r={d}
                                            href={`/control-plan-revisions/${d.id}/review`}
                                        />
                                    ))
                                )}
                            </CardContent>
                        </Card>
                        <Card className="gap-3 py-4">
                            <CardHeader className="px-4">
                                <CardTitle className="text-base">
                                    Upcoming review dates
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex flex-col gap-2 px-4 text-sm">
                                {upcoming.length === 0 ? (
                                    <p className="text-muted-foreground">
                                        No released plan has a review date yet.
                                    </p>
                                ) : (
                                    upcoming.map((u) => (
                                        <div
                                            key={u.id}
                                            className="flex items-center justify-between gap-2"
                                        >
                                            <Link
                                                href={`/control-plans/${u.id}`}
                                                className="font-mono text-[13px] hover:underline"
                                            >
                                                {u.doc_no}
                                            </Link>
                                            <span className="flex items-center gap-2">
                                                {u.overdue && (
                                                    <ToneBadge tone="overdue">
                                                        Overdue
                                                    </ToneBadge>
                                                )}
                                                {u.next_review}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
                {!canWork && waiting.length > 0 && (
                    <Card className="gap-3 py-4">
                        <CardHeader className="px-4">
                            <CardTitle className="text-base">
                                Waiting for your signature
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2 px-4">
                            {waiting.map((d) => (
                                <RevisionItem
                                    key={d.id}
                                    r={d}
                                    href={`/control-plan-revisions/${d.id}/review`}
                                />
                            ))}
                        </CardContent>
                    </Card>
                )}

                <section
                    className="flex flex-col gap-3"
                    aria-label="All control plans"
                >
                    <div className="flex flex-wrap items-end justify-between gap-3">
                        <h2 className="font-semibold">All control plans</h2>
                        <div className="w-full max-w-xs space-y-1.5">
                            <Label htmlFor="cp-q">
                                Search by document number or title
                            </Label>
                            <Input
                                id="cp-q"
                                value={q}
                                placeholder="e.g. W-WSD-W-30"
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Document</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Released revision</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Next review</TableHead>
                                    <TableHead>Open</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {shown.length === 0 ? (
                                    <TableRow>
                                        <TableCell
                                            colSpan={6}
                                            className="h-24 text-center text-muted-foreground"
                                        >
                                            {plans.length === 0
                                                ? 'No control plans yet.'
                                                : `No control plan matches “${q}”.`}
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    shown.map((p) => (
                                        <TableRow key={p.id}>
                                            <TableCell>
                                                <Link
                                                    href={`/control-plans/${p.id}`}
                                                    className="font-mono text-[13px] font-medium text-primary hover:underline"
                                                >
                                                    {p.doc_no}
                                                </Link>
                                            </TableCell>
                                            <TableCell
                                                className={
                                                    p.title
                                                        ? 'whitespace-normal'
                                                        : 'text-muted-foreground'
                                                }
                                            >
                                                {p.title || 'Title not set yet'}
                                            </TableCell>
                                            <TableCell>
                                                {p.released ? (
                                                    `Rev ${p.released.rev} · ${p.released.release_date}`
                                                ) : (
                                                    <span className="text-muted-foreground">
                                                        Not released yet
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {p.open ? (
                                                    <StatusBadge
                                                        status={p.open.status}
                                                        label={`${statusShort(p.open.status)} Rev ${p.open.rev}`}
                                                    />
                                                ) : p.released ? (
                                                    <StatusBadge status="released" />
                                                ) : null}
                                            </TableCell>
                                            <TableCell>
                                                {p.next_review ?? '—'}
                                            </TableCell>
                                            <TableCell className="space-x-3 text-sm">
                                                <Link
                                                    href={`/control-plans/${p.id}`}
                                                    className="text-primary hover:underline"
                                                >
                                                    {p.open?.status ===
                                                        'draft' ||
                                                    p.open?.status ===
                                                        'changes_requested'
                                                        ? 'Edit'
                                                        : 'Open'}
                                                </Link>
                                                {p.open &&
                                                    p.open.status !==
                                                        'draft' && (
                                                        <Link
                                                            href={`/control-plan-revisions/${p.open.id}/review`}
                                                            className="text-primary hover:underline"
                                                        >
                                                            Review
                                                        </Link>
                                                    )}
                                                {p.released && (
                                                    <Link
                                                        href={`/control-plans/${p.id}/viewer`}
                                                        className="text-primary hover:underline"
                                                    >
                                                        Shop-floor view
                                                    </Link>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </section>
            </div>

            {creating && <NewPlanDialog onClose={() => setCreating(false)} />}
            {importing && (
                <ImportPlanDialog
                    canRelease={can('control-plans.approve')}
                    onClose={() => setImporting(false)}
                />
            )}
        </AppLayout>
    );
}

function statusShort(status: RevisionStatus): string {
    return {
        draft: 'Draft',
        in_review: 'In review',
        changes_requested: 'Changes requested',
        approved: 'Approved',
        released: 'Released',
        superseded: 'Superseded',
    }[status];
}

function RevisionItem({ r, href }: { r: RevisionSummary; href: string }) {
    return (
        <Link
            href={href}
            className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2 hover:bg-muted/70"
        >
            <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[13px] font-medium">
                    {r.doc_no} · Rev {r.rev}
                </span>
                <StatusBadge status={r.status} />
                {r.to_sign && (
                    <ToneBadge tone="review">Needs your signature</ToneBadge>
                )}
            </span>
            <span className="text-xs text-muted-foreground">
                {[
                    r.mill,
                    r.based_on
                        ? `started from Rev ${r.based_on}`
                        : 'new document',
                ]
                    .filter(Boolean)
                    .join(' · ')}
            </span>
        </Link>
    );
}

function NewPlanDialog({ onClose }: { onClose: () => void }) {
    const [docNo, setDocNo] = useState('');
    const [title, setTitle] = useState('');
    const [revNo, setRevNo] = useState('0');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const create = async () => {
        const rev = Number(revNo);
        if (!docNo.trim()) return setError('Enter the document number.');
        if (!Number.isInteger(rev) || rev < 0)
            return setError(
                'The first revision number must be a whole number, 0 or more.',
            );
        setBusy(true);
        setError(null);
        try {
            const { plan_id } = await controlPlanApi.create({
                doc_no: docNo.trim(),
                title: title.trim(),
                rev_no: rev,
            });
            router.visit(`/control-plans/${plan_id}`);
        } catch (e) {
            setError((e as Error).message);
            setBusy(false);
        }
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>New control plan</DialogTitle>
                    <DialogDescription>
                        Starts a draft filled with the document defaults from
                        Settings.
                    </DialogDescription>
                </DialogHeader>
                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="np-doc">Document number</Label>
                        <Input
                            id="np-doc"
                            className="font-mono"
                            value={docNo}
                            placeholder="e.g. W-WSD-W-31"
                            onChange={(e) => setDocNo(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="np-title">Control plan title</Label>
                        <Input
                            id="np-title"
                            value={title}
                            placeholder="e.g. Production Preparation Area (PPA) Control Plan"
                            onChange={(e) => setTitle(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="np-rev">First revision number</Label>
                        <Input
                            id="np-rev"
                            inputMode="numeric"
                            className="w-28"
                            value={revNo}
                            onChange={(e) => setRevNo(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">
                            For a document already issued on paper, use its next
                            revision number.
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    <Button onClick={() => void create()} disabled={busy}>
                        {busy ? 'Creating…' : 'Create draft'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
