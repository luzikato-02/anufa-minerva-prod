import { StatusBadge } from '@/components/control-plans/status-badge';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import {
    fetchSheet,
    loadLogoChoice,
    type PlanRef,
    type Revision,
} from '@/lib/control-plans';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { ChevronLeftIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

/**
 * The document exactly as it exports: the server renders the same page the PDF is made from, shown here in a
 * frame that grows to its full height. The page is fetched and passed in as srcDoc rather than loaded by URL,
 * because the server sends X-Frame-Options: DENY on every response, which stops even a same-origin frame. It
 * prints the logo chosen for this plan in the editor.
 */
export default function ControlPlanPreview({
    plan,
    revision,
}: {
    plan: PlanRef;
    revision: Revision;
}) {
    const unreleased =
        revision.status !== 'released' && revision.status !== 'superseded';
    const [watermark, setWatermark] = useState(true);
    const [height, setHeight] = useState(1600);
    const [html, setHtml] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setError(null);
        fetchSheet(revision.id, 'print', loadLogoChoice(plan.id), {
            watermark: watermark ? '1' : '0',
        })
            .then((res) => res.text())
            .then((text) => !cancelled && setHtml(text))
            .catch((e) => !cancelled && setError((e as Error).message));
        return () => {
            cancelled = true;
        };
    }, [revision.id, plan.id, watermark]);

    const breadcrumbs: BreadcrumbItem[] = [
        { title: 'Control Plans', href: '/control-plans' },
        {
            title: `${plan.doc_no} · Rev ${revision.rev}`,
            href: `/control-plans/${plan.id}`,
        },
        {
            title: 'Print preview',
            href: `/control-plan-revisions/${revision.id}/preview`,
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title={`Print preview ${plan.doc_no} Rev ${revision.rev}`} />
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b bg-background px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-3">
                    <Button size="sm" variant="ghost" asChild>
                        <Link href={`/control-plans/${plan.id}`}>
                            <ChevronLeftIcon /> Back to editor
                        </Link>
                    </Button>
                    <span className="font-mono text-[13px] font-medium">
                        {plan.doc_no} · Rev {revision.rev}
                    </span>
                    <StatusBadge status={revision.status} />
                    <span className="text-xs text-muted-foreground">
                        2 pages · A4 landscape · as it will export
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    {unreleased && (
                        <label className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                            <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={watermark}
                                onChange={(e) => setWatermark(e.target.checked)}
                            />
                            DRAFT watermark
                        </label>
                    )}
                    <Button size="sm" asChild>
                        <Link
                            href={`/control-plans/${plan.id}/export?revision=${revision.id}`}
                        >
                            Export
                        </Link>
                    </Button>
                </div>
            </div>
            {error && (
                <p
                    role="alert"
                    className="p-4 text-center text-sm text-destructive"
                >
                    {error}
                </p>
            )}
            {html === null && !error && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                    Loading preview…
                </p>
            )}
            <iframe
                title={`${plan.doc_no} Rev ${revision.rev}, print preview`}
                srcDoc={html ?? ''}
                hidden={html === null}
                className="w-full border-0"
                style={{ height }}
                onLoad={(e) => {
                    const body = e.currentTarget.contentDocument?.body;
                    if (body) setHeight(body.scrollHeight + 8);
                }}
            />
            <p className="px-4 pb-6 text-center text-xs text-muted-foreground">
                Square brackets mark values the document does not have yet: they
                fill in from the plan details and on release.
                {unreleased &&
                    ' Exported files of an unreleased revision always carry the DRAFT watermark.'}
            </p>
        </AppLayout>
    );
}
