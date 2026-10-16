import { Badge } from '@/components/ui/badge';
import { type RevisionStatus } from '@/lib/control-plans';
import { cn } from '@/lib/utils';

export const STATUS_LABELS: Record<RevisionStatus, string> = {
    draft: 'Draft',
    in_review: 'In review',
    changes_requested: 'Changes requested',
    approved: 'Approved by QA',
    released: 'Released',
    superseded: 'Superseded',
};

const TONES = {
    draft: 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-300',
    review: 'bg-blue-100 text-blue-900 dark:bg-blue-500/15 dark:text-blue-300',
    released:
        'bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-300',
    muted: 'bg-muted text-muted-foreground',
    overdue: 'bg-red-100 text-red-900 dark:bg-red-500/15 dark:text-red-300',
};

export type Tone = keyof typeof TONES;

const STATUS_TONE: Record<RevisionStatus, Tone> = {
    draft: 'draft',
    in_review: 'review',
    changes_requested: 'draft',
    approved: 'review',
    released: 'released',
    superseded: 'muted',
};

export function ToneBadge({
    tone,
    className,
    children,
}: {
    tone: Tone;
    className?: string;
    children: React.ReactNode;
}) {
    return (
        <Badge className={cn('border-transparent', TONES[tone], className)}>
            {children}
        </Badge>
    );
}

export function StatusBadge({
    status,
    label,
}: {
    status: RevisionStatus;
    label?: string;
}) {
    return (
        <ToneBadge tone={STATUS_TONE[status]}>
            {label ?? STATUS_LABELS[status]}
        </ToneBadge>
    );
}

/** The "SC" special-characteristic marker. */
export function ScMark({ value }: { value: string }) {
    return (
        <span
            title="Special characteristic"
            className="inline-flex h-5 items-center rounded bg-orange-100 px-1.5 text-[11px] font-semibold text-orange-900 dark:bg-orange-500/15 dark:text-orange-300"
        >
            {value}
        </span>
    );
}
