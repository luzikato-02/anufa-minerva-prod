import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

/** Consistent "no value" marker instead of 'N/A' text. */
export function Empty() {
    return (
        <span className="text-muted-foreground" aria-label="No value">
            —
        </span>
    );
}

const isBlank = (value: unknown) =>
    value === null || value === undefined || value === '';

/** Codes and identifiers (machine, item, yarn, batch): monospace. */
export function CodeCell({
    value,
    muted,
    strong,
}: {
    value: unknown;
    muted?: boolean;
    strong?: boolean;
}) {
    if (isBlank(value)) return <Empty />;
    return (
        <span
            className={cn(
                'font-mono text-xs',
                muted && 'text-muted-foreground',
                strong && 'font-medium',
            )}
        >
            {String(value)}
        </span>
    );
}

export function TextCell({ value }: { value: unknown }) {
    if (isBlank(value)) return <Empty />;
    return <span>{String(value)}</span>;
}

const numberFormat = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
});

/** Right-aligned figures; pair with `meta: { align: 'right' }`. */
export function NumberCell({
    value,
    suffix,
}: {
    value: unknown;
    suffix?: ReactNode;
}) {
    if (isBlank(value)) return <Empty />;
    const n = Number(value);
    return (
        <span className="tabular-nums">
            {Number.isFinite(n) ? numberFormat.format(n) : String(value)}
            {suffix && (
                <span className="ml-1 text-xs text-muted-foreground">
                    {suffix}
                </span>
            )}
        </span>
    );
}

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
});

/** "07/11/26, 21:04" with the full timestamp on hover. */
export function DateTimeCell({ value }: { value: unknown }) {
    if (isBlank(value)) return <Empty />;
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return <TextCell value={value} />;
    return (
        <time
            dateTime={date.toISOString()}
            title={date.toLocaleString()}
            className="tabular-nums"
        >
            {dateTimeFormat.format(date)}
        </time>
    );
}

/** Thin bar plus percentage; complete rows are de-emphasised. */
export function ProgressCell({
    percent,
}: {
    percent: number | null | undefined;
}) {
    if (percent === null || percent === undefined || Number.isNaN(percent)) {
        return <Empty />;
    }
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    const complete = clamped >= 100;
    return (
        <span className="inline-flex items-center gap-1.5">
            <span
                className="h-1 w-12 overflow-hidden rounded-full bg-muted"
                aria-hidden="true"
            >
                <span
                    className="block h-full rounded-full bg-foreground/70"
                    style={{ width: `${clamped}%` }}
                />
            </span>
            <span
                className={cn(
                    'text-xs tabular-nums',
                    complete && 'text-muted-foreground',
                )}
            >
                {clamped}%
            </span>
        </span>
    );
}

/**
 * Open vs total problems with a status dot. Orange = open problems,
 * green = all resolved, grey = none reported. Text always states the status,
 * so colour is never the only signal.
 */
export function ProblemsCell({ open, total }: { open: number; total: number }) {
    const tone = total === 0 ? 'none' : open > 0 ? 'open' : 'resolved';
    return (
        <span className="inline-flex items-center gap-1.5 text-xs">
            <span
                aria-hidden="true"
                className={cn(
                    'size-1.5 rounded-full',
                    tone === 'none' && 'bg-muted-foreground/40',
                    tone === 'open' && 'bg-orange-500',
                    tone === 'resolved' && 'bg-emerald-600',
                )}
            />
            <span
                className={cn(
                    'tabular-nums',
                    tone === 'none' && 'text-muted-foreground',
                    tone === 'open' && 'text-orange-700 dark:text-orange-400',
                    tone === 'resolved' &&
                        'text-emerald-700 dark:text-emerald-400',
                )}
            >
                {tone === 'none'
                    ? 'None'
                    : tone === 'open'
                      ? `${open} open / ${total}`
                      : `${total} resolved`}
            </span>
        </span>
    );
}
