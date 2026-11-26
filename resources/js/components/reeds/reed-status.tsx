import {
    GRADE_META,
    STATUS_META,
    type ReedGrade,
    type ReedStatus,
} from '@/lib/reeds';
import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

/** Status as a coloured dot plus its word, so it never relies on colour alone. */
export function ReedStatusLabel({
    status,
    className,
}: {
    status: ReedStatus;
    className?: string;
}) {
    const meta = STATUS_META[status];
    return (
        <span
            className={cn(
                'inline-flex items-center gap-1.5 whitespace-nowrap',
                meta.tone,
                className,
            )}
        >
            <span
                aria-hidden
                className={cn('size-2 shrink-0 rounded-full', meta.dot)}
            />
            {meta.label}
        </span>
    );
}

const gradeClass: Record<ReedGrade, string> = {
    A: 'border-emerald-600/40 text-emerald-700 dark:text-emerald-400',
    B: 'border-sky-600/40 text-sky-700 dark:text-sky-400',
    C: 'border-orange-600/50 text-orange-700 dark:text-orange-400',
    X: 'border-red-600/50 text-red-700 dark:text-red-400',
};

export function ReedGradeBadge({ grade }: { grade: ReedGrade }) {
    return (
        <span
            title={`Grade ${grade}: ${GRADE_META[grade]}`}
            className={cn(
                'inline-flex size-5 items-center justify-center rounded border text-[11px] font-semibold',
                gradeClass[grade],
            )}
        >
            {grade}
            <span className="sr-only">, {GRADE_META[grade]}</span>
        </span>
    );
}

/** Label + control stacked, used by every reed form. */
export function Field({
    label,
    htmlFor,
    hint,
    children,
    className,
}: {
    label: string;
    htmlFor?: string;
    hint?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <label htmlFor={htmlFor} className="text-xs font-medium">
                {label}
            </label>
            {children}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

/** A plain native select styled like the inputs: quick on phones, works with a hardware keyboard. */
export function NativeSelect({
    id,
    value,
    onChange,
    children,
    className,
    ...rest
}: {
    id?: string;
    value: string | number;
    onChange: (value: string) => void;
    children: ReactNode;
    className?: string;
    'aria-label'?: string;
}) {
    return (
        <select
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
                'h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30',
                className,
            )}
            {...rest}
        >
            {children}
        </select>
    );
}
