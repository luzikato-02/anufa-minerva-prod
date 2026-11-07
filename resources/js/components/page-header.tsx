import { cn } from '@/lib/utils';
import { type ReactNode } from 'react';

/**
 * One-row page header for review screens: title, optional inline meta
 * (counts, last-updated) and tabs on the leading side, actions trailing.
 * Wraps on narrow screens instead of stacking into separate blocks.
 */
export function PageHeader({
    title,
    meta,
    tabs,
    actions,
    className,
}: {
    title: ReactNode;
    meta?: ReactNode;
    tabs?: ReactNode;
    actions?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                'flex flex-wrap items-center gap-x-4 gap-y-2',
                className,
            )}
        >
            <div className="flex min-w-0 items-baseline gap-2">
                <h1 className="truncate text-base font-semibold tracking-tight">
                    {title}
                </h1>
                {meta && (
                    <span className="truncate text-xs text-muted-foreground">
                        {meta}
                    </span>
                )}
            </div>
            {tabs}
            {actions && (
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    {actions}
                </div>
            )}
        </div>
    );
}
