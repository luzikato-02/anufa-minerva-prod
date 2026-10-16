import { Field } from '@/components/control-plans/field';
import { RefChip } from '@/components/control-plans/ref-text';
import { ToneBadge } from '@/components/control-plans/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AppLayout from '@/layouts/app-layout';
import {
    blank,
    controlPlanApi,
    type ReferenceFields,
} from '@/lib/control-plans';
import { usePermissions } from '@/lib/permissions';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';

interface Use {
    plan_id: number;
    doc_no: string;
    /** Column name => number of lines. */
    where: Record<string, number>;
}

interface Reference extends ReferenceFields {
    id: number;
    uses: Use[];
}

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Quality Documents', href: '#' },
    { title: 'Reference Library', href: '/control-plan-references' },
];

const describe = (where: Record<string, number>) => {
    const parts = Object.entries(where);
    const cols = parts.map(([k]) => k);
    const lines = Math.max(...parts.map(([, n]) => n));
    const label =
        cols.length > 1
            ? `${cols[0]}, ${cols.slice(1).join(', ').toLowerCase()}`
            : cols[0];
    return cols.length === 1 && cols[0] === 'Referensi SP'
        ? label
        : `${label} · ${lines === 1 ? '1 line' : `${lines} lines`}`;
};

const EMPTY: ReferenceFields = {
    code: '',
    title: '',
    type: '',
    revision: '',
    link: '',
};

export default function ControlPlanReferences({
    references,
    unknownCodes,
}: {
    references: Reference[];
    unknownCodes: string[];
}) {
    const { can } = usePermissions();
    const canEdit = can('control-plans.author');
    const [q, setQ] = useState('');
    const [selId, setSelId] = useState<number | 'new' | null>(
        references[0]?.id ?? null,
    );
    const [form, setForm] = useState<ReferenceFields>(() =>
        pick(references[0]),
    );
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const needle = q.trim().toLowerCase();
    const shown = references.filter(
        (r) =>
            needle === '' ||
            `${r.code} ${r.title}`.toLowerCase().includes(needle),
    );
    const sel =
        selId === 'new'
            ? null
            : (references.find((r) => r.id === selId) ?? null);
    const dirty =
        selId === 'new' ||
        (sel !== null &&
            (Object.keys(EMPTY) as (keyof ReferenceFields)[]).some(
                (k) => form[k] !== sel[k],
            ));

    const select = (r: Reference) => {
        setSelId(r.id);
        setForm(pick(r));
        setError(null);
        setSaved(false);
    };
    const startNew = (code = '') => {
        setSelId('new');
        setForm({ ...EMPTY, code });
        setQ('');
        setError(null);
        setSaved(false);
    };

    const save = async () => {
        setBusy(true);
        setError(null);
        try {
            if (selId === 'new') {
                const { id } = await controlPlanApi.createReference(form);
                setSelId(id);
            } else if (sel) {
                await controlPlanApi.updateReference(sel.id, form);
            }
            setSaved(true);
            router.reload({ only: ['references', 'unknownCodes'] });
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Reference Library" />
            <div className="flex flex-col gap-4 p-4">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <h1 className="text-xl font-semibold">
                            Reference library
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {references.length} codes ·{' '}
                            {references.filter((r) => blank(r.title)).length}{' '}
                            still need a title · codes are matched when you type
                            them in a control plan
                        </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-2">
                        <div className="w-72 max-w-full space-y-1.5">
                            <Label htmlFor="rq">Search codes and titles</Label>
                            <Input
                                id="rq"
                                value={q}
                                placeholder="e.g. QA-IK"
                                onChange={(e) => setQ(e.target.value)}
                            />
                        </div>
                        {canEdit && (
                            <Button onClick={() => startNew()}>
                                <PlusIcon /> Add reference
                            </Button>
                        )}
                    </div>
                </div>

                {canEdit && unknownCodes.length > 0 && (
                    <Alert>
                        <AlertDescription>
                            <span className="flex flex-wrap items-center gap-1.5">
                                Used in a control plan but not in the library:
                                {unknownCodes.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        title={`Add ${c}`}
                                        className="rounded focus-visible:outline-2 focus-visible:outline-ring"
                                        onClick={() => startNew(c)}
                                    >
                                        <RefChip code={c} known={false} />
                                    </button>
                                ))}
                            </span>
                        </AlertDescription>
                    </Alert>
                )}

                <div className="flex flex-wrap items-start gap-4">
                    <div className="min-w-0 flex-[999_1_620px] overflow-hidden rounded-md border">
                        <div className="grid grid-cols-[150px_minmax(0,1.6fr)_90px_minmax(0,1.4fr)] gap-3 border-b bg-muted px-3 py-2 text-xs font-semibold text-muted-foreground">
                            <span>Code</span>
                            <span>Title</span>
                            <span>Type</span>
                            <span>Used in</span>
                        </div>
                        {shown.length === 0 && (
                            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                {references.length === 0
                                    ? 'No references yet.'
                                    : `No code matches “${q}”.`}
                            </div>
                        )}
                        {shown.map((r) => (
                            <button
                                key={r.id}
                                type="button"
                                aria-pressed={r.id === selId}
                                onClick={() => select(r)}
                                className={cn(
                                    'grid w-full grid-cols-[150px_minmax(0,1.6fr)_90px_minmax(0,1.4fr)] items-center gap-3 border-b px-3 py-2 text-left text-[13px] last:border-b-0 hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                                    r.id === selId && 'bg-primary/10',
                                )}
                            >
                                <span>
                                    <RefChip code={r.code} known />
                                </span>
                                <span
                                    className={cn(
                                        'truncate',
                                        blank(r.title) &&
                                            'text-muted-foreground',
                                    )}
                                >
                                    {r.title || 'Title not set'}
                                </span>
                                <span
                                    className={cn(
                                        blank(r.type) &&
                                            'text-muted-foreground',
                                    )}
                                >
                                    {r.type || 'Not set'}
                                </span>
                                <span className="truncate text-muted-foreground">
                                    {r.uses.length
                                        ? `${r.uses.map((u) => u.doc_no).join(', ')} · ${describe(r.uses[0].where)}`
                                        : 'Not used yet'}
                                </span>
                            </button>
                        ))}
                    </div>

                    {(sel || selId === 'new') && (
                        <Card
                            className="max-w-[440px] flex-[1_1_340px] py-4"
                            aria-label="Selected reference"
                        >
                            <CardContent className="flex flex-col gap-3 px-4">
                                <div className="flex items-center gap-2">
                                    <RefChip
                                        code={form.code || 'NEW-CODE'}
                                        known
                                    />
                                    {selId === 'new' && (
                                        <ToneBadge tone="released">
                                            New
                                        </ToneBadge>
                                    )}
                                </div>
                                {error && (
                                    <Alert variant="destructive" role="alert">
                                        <AlertDescription>
                                            {error}
                                        </AlertDescription>
                                    </Alert>
                                )}
                                {(selId === 'new' || canEdit) && (
                                    <Field
                                        id="r-code"
                                        label="Code (exactly as issued)"
                                        mono
                                        placeholder="e.g. QA-IK-15"
                                        value={form.code}
                                        onChange={
                                            canEdit
                                                ? (v) =>
                                                      setForm((f) => ({
                                                          ...f,
                                                          code: v,
                                                      }))
                                                : undefined
                                        }
                                    />
                                )}
                                <Field
                                    id="r-title"
                                    label="Title"
                                    placeholder="As on the issued document"
                                    value={form.title}
                                    onChange={
                                        canEdit
                                            ? (v) =>
                                                  setForm((f) => ({
                                                      ...f,
                                                      title: v,
                                                  }))
                                            : undefined
                                    }
                                />
                                <div className="grid grid-cols-2 gap-3">
                                    <Field
                                        id="r-type"
                                        label="Type"
                                        placeholder="e.g. SP, WI, form"
                                        value={form.type}
                                        onChange={
                                            canEdit
                                                ? (v) =>
                                                      setForm((f) => ({
                                                          ...f,
                                                          type: v,
                                                      }))
                                                : undefined
                                        }
                                    />
                                    <Field
                                        id="r-rev"
                                        label="Current revision"
                                        value={form.revision}
                                        onChange={
                                            canEdit
                                                ? (v) =>
                                                      setForm((f) => ({
                                                          ...f,
                                                          revision: v,
                                                      }))
                                                : undefined
                                        }
                                    />
                                </div>
                                <Field
                                    id="r-link"
                                    label="Link to the document"
                                    placeholder="Document control system address"
                                    value={form.link}
                                    onChange={
                                        canEdit
                                            ? (v) =>
                                                  setForm((f) => ({
                                                      ...f,
                                                      link: v,
                                                  }))
                                            : undefined
                                    }
                                />
                                {!canEdit &&
                                    form.link &&
                                    /^https?:\/\//.test(form.link) && (
                                        <a
                                            href={form.link}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-sm text-primary underline"
                                        >
                                            Open the document
                                        </a>
                                    )}
                                {canEdit && (
                                    <div className="flex items-center justify-end gap-2">
                                        {saved && !dirty && (
                                            <span
                                                role="status"
                                                className="text-xs text-muted-foreground"
                                            >
                                                Saved.
                                            </span>
                                        )}
                                        {selId === 'new' && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    references[0] &&
                                                    select(references[0])
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                        <Button
                                            size="sm"
                                            onClick={() => void save()}
                                            disabled={
                                                busy ||
                                                !dirty ||
                                                blank(form.code)
                                            }
                                        >
                                            {busy
                                                ? 'Saving…'
                                                : selId === 'new'
                                                  ? 'Add reference'
                                                  : 'Save'}
                                        </Button>
                                    </div>
                                )}
                                {sel && (
                                    <div className="flex flex-col gap-2 border-t pt-3">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Where it is used
                                        </span>
                                        {sel.uses.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">
                                                Not used in any control plan
                                                yet.
                                            </p>
                                        ) : (
                                            sel.uses.map((u) => (
                                                <div
                                                    key={u.plan_id}
                                                    className="flex flex-wrap justify-between gap-2 text-[13px]"
                                                >
                                                    <Link
                                                        href={`/control-plans/${u.plan_id}`}
                                                        className="font-mono text-primary hover:underline"
                                                    >
                                                        {u.doc_no}
                                                    </Link>
                                                    <span className="text-muted-foreground">
                                                        {describe(u.where)}
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    A title or link edited here shows in every
                                    draft at once. Released revisions keep the
                                    reference as it was when they were released.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </AppLayout>
    );
}

function pick(r: Reference | undefined): ReferenceFields {
    return r
        ? {
              code: r.code,
              title: r.title,
              type: r.type,
              revision: r.revision,
              link: r.link,
          }
        : EMPTY;
}
