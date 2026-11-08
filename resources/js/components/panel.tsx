import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { type ReactNode } from 'react';

/**
 * A bordered block with a 40px title bar: title, optional meta text (hidden on
 * phones) and an action on the right. Used for dashboard panels and settings
 * pages that show more than one table.
 */
export function Panel({
    title,
    meta,
    action,
    children,
    className,
}: {
    title: string;
    meta?: ReactNode;
    action?: ReactNode;
    children: ReactNode;
    className?: string;
}) {
    return (
        <section
            aria-label={title}
            className={cn(
                'flex min-w-0 flex-col overflow-hidden rounded-lg border',
                className,
            )}
        >
            <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
                <h2 className="truncate text-[13px] font-semibold">{title}</h2>
                {meta && (
                    <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                        {meta}
                    </span>
                )}
                {action && <div className="ml-auto shrink-0">{action}</div>}
            </div>
            {children}
        </section>
    );
}

export function PanelLink({
    href,
    children,
}: {
    href: string;
    children: ReactNode;
}) {
    return (
        <Link
            href={href}
            className="text-xs text-muted-foreground hover:text-foreground"
        >
            {children} →
        </Link>
    );
}

export function PanelSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-3 p-3">
            {Array.from({ length: rows }, (_, i) => (
                <Skeleton
                    key={i}
                    className="h-3.5"
                    style={{ width: `${90 - ((i * 13) % 35)}%` }}
                />
            ))}
        </div>
    );
}
