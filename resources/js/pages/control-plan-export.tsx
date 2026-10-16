import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AppLayout from '@/layouts/app-layout';
import { type PlanRef, type RevisionStatus } from '@/lib/control-plans';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ChevronLeftIcon, DownloadIcon } from 'lucide-react';
import { useState } from 'react';

interface Option {
    id: number;
    rev: string;
    status: RevisionStatus;
    release_date: string | null;
}

const FORMATS = [
    {
        value: 'docx',
        label: 'Word (.docx)',
        help: 'For the document control system and further editing.',
    },
    { value: 'pdf', label: 'PDF', help: 'For printing and sharing.' },
] as const;

export default function ControlPlanExport({
    plan,
    options,
    selected,
    dateFormat,
}: {
    plan: PlanRef;
    options: Option[];
    selected: number;
    dateFormat: 'id' | 'en';
}) {
    const [rev, setRev] = useState(
        options.some((o) => o.id === selected) ? selected : options[0].id,
    );
    const [fmt, setFmt] = useState<'docx' | 'pdf'>('docx');
    const chosen = options.find((o) => o.id === rev)!;
    const isDraft =
        chosen.status !== 'released' && chosen.status !== 'superseded';
    const fileName = `${plan.doc_no} Rev ${chosen.rev}${isDraft ? ' DRAFT' : ''}.${fmt}`;

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Control Plans', href: '/control-plans' },
        { title: plan.doc_no, href: `/control-plans/${plan.id}` },
        { title: 'Export', href: `/control-plans/${plan.id}/export` },
    ];
    const optCls = (on: boolean) =>
        cn(
            'flex cursor-pointer items-start gap-3 rounded-md border p-3',
            on && 'border-primary bg-primary/5',
        );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Export ${plan.doc_no}`} />
            <div className="flex justify-center px-4 py-8">
                <Card className="w-full max-w-xl py-5">
                    <CardContent className="flex flex-col gap-5 px-5">
                        <div>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="-ml-2"
                                asChild
                            >
                                <Link href={`/control-plans/${plan.id}`}>
                                    <ChevronLeftIcon /> Back to editor
                                </Link>
                            </Button>
                            <h1 className="mt-2 text-xl font-semibold">
                                Export {plan.doc_no}
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                The whole document, in the W-WSD layout:
                                revision history, then the control plan.
                            </p>
                        </div>

                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-2 text-sm font-medium">
                                Revision
                            </legend>
                            {options.map((o) => {
                                const draft =
                                    o.status !== 'released' &&
                                    o.status !== 'superseded';
                                return (
                                    <label
                                        key={o.id}
                                        className={optCls(rev === o.id)}
                                    >
                                        <input
                                            type="radio"
                                            name="ex-rev"
                                            className="mt-0.5 size-4 accent-primary"
                                            checked={rev === o.id}
                                            onChange={() => setRev(o.id)}
                                        />
                                        <span className="flex flex-col gap-0.5">
                                            <b className="text-sm">
                                                {draft
                                                    ? `Rev ${o.rev} · ${o.status === 'draft' ? 'draft' : 'not released'}`
                                                    : `Rev ${o.rev} · released ${o.release_date}`}
                                            </b>
                                            <span className="text-xs text-muted-foreground">
                                                {draft
                                                    ? 'Current edits. Every page carries a DRAFT watermark; not for the shop floor.'
                                                    : 'The controlled version, exactly as released.'}
                                            </span>
                                        </span>
                                    </label>
                                );
                            })}
                        </fieldset>

                        <fieldset className="flex flex-col gap-2">
                            <legend className="mb-2 text-sm font-medium">
                                Format
                            </legend>
                            {FORMATS.map((f) => (
                                <label
                                    key={f.value}
                                    className={optCls(fmt === f.value)}
                                >
                                    <input
                                        type="radio"
                                        name="ex-fmt"
                                        className="mt-0.5 size-4 accent-primary"
                                        checked={fmt === f.value}
                                        onChange={() => setFmt(f.value)}
                                    />
                                    <span className="flex flex-col gap-0.5">
                                        <b className="text-sm">{f.label}</b>
                                        <span className="text-xs text-muted-foreground">
                                            {f.help}
                                        </span>
                                    </span>
                                </label>
                            ))}
                        </fieldset>

                        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-[13px]">
                            <dt className="text-muted-foreground">Pages</dt>
                            <dd>
                                1 · Revision history
                                <br />2 · Control plan information and
                                characteristics
                            </dd>
                            <dt className="text-muted-foreground">Paper</dt>
                            <dd>
                                A4 landscape, header rows repeat on every page
                            </dd>
                            <dt className="text-muted-foreground">Dates</dt>
                            <dd>
                                {dateFormat === 'id'
                                    ? 'Indonesian month names (09 Oktober 2026)'
                                    : 'English month names (09 October 2026)'}
                            </dd>
                            <dt className="text-muted-foreground">File name</dt>
                            <dd className="font-mono">{fileName}</dd>
                        </dl>

                        <div className="flex justify-end gap-2 border-t pt-4">
                            <Button variant="outline" asChild>
                                <Link
                                    href={`/control-plan-revisions/${rev}/preview`}
                                >
                                    Print preview
                                </Link>
                            </Button>
                            <Button asChild>
                                <a
                                    href={`/control-plan-revisions/${rev}/download/${fmt}`}
                                    download={fileName}
                                >
                                    <DownloadIcon /> Export
                                </a>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AppLayout>
    );
}
