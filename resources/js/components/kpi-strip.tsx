import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { type CSSProperties, type ReactNode } from 'react';

export type KpiTone = 'neutral' | 'good' | 'bad';

export interface KpiItem {
    label: string;
    value: ReactNode;
    /** Comparison or context line, e.g. "+12 vs prior 7 days". */
    sub?: ReactNode;
    /** Colours the sub line; the text itself always states the direction. */
    tone?: KpiTone;
    /** Recent values for a small trend line (oldest first). */
    spark?: number[];
    /** Makes the cell a button, e.g. to jump to a filtered view. */
    onClick?: () => void;
}

const toneClass: Record<KpiTone, string> = {
    neutral: 'text-muted-foreground',
    good: 'text-emerald-700 dark:text-emerald-400',
    bad: 'text-orange-700 dark:text-orange-400',
};

function Sparkline({ values, tone }: { values: number[]; tone: KpiTone }) {
    if (values.length < 2) return null;
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    const points = values
        .map((v, i) => {
            const x = 2 + (i * 68) / (values.length - 1);
            const y = 25 - ((v - min) / span) * 22;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
        })
        .join(' ');
    return (
        <svg
            width="72"
            height="28"
            viewBox="0 0 72 28"
            aria-hidden="true"
            className={cn(
                'shrink-0',
                tone === 'bad' ? 'text-orange-500' : 'text-muted-foreground',
            )}
        >
            <polyline
                points={points}
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
                strokeLinecap="round"
            />
        </svg>
    );
}

/**
 * One row of key figures for a review screen: label, value, a comparison
 * line and an optional sparkline per cell. Wraps to two columns on narrow
 * screens instead of stacking tall cards.
 */
export function KpiStrip({
    items,
    loading,
    error,
    onRetry,
    label,
    className,
}: {
    items: KpiItem[];
    loading?: boolean;
    error?: string | null;
    onRetry?: () => void;
    label: string;
    className?: string;
}) {
    const count = loading ? 5 : items.length;

    if (error) {
        return (
            <div
                role="status"
                className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2 text-xs',
                    className,
                )}
            >
                <span>Couldn&apos;t load the key figures ({error}).</span>
                {onRetry && (
                    <Button variant="outline" size="xs" onClick={onRetry}>
                        Try again
                    </Button>
                )}
            </div>
        );
    }

    return (
        <section
            aria-label={label}
            aria-busy={loading}
            className={cn(
                'grid grid-cols-2 overflow-hidden rounded-lg border sm:grid-cols-3 lg:[grid-template-columns:repeat(var(--kpi-count),minmax(0,1fr))]',
                className,
            )}
            style={{ '--kpi-count': count } as CSSProperties}
        >
            {loading
                ? Array.from({ length: count }, (_, i) => (
                      <div
                          key={i}
                          className="flex flex-col gap-2 border-r border-b px-3 py-2 last:border-r-0 lg:border-b-0"
                      >
                          <Skeleton className="h-3 w-24" />
                          <Skeleton className="h-5 w-16" />
                      </div>
                  ))
                : items.map((item) => {
                      const tone = item.tone ?? 'neutral';
                      const body = (
                          <>
                              <span className="flex min-w-0 flex-1 flex-col">
                                  <span className="truncate text-xs text-muted-foreground">
                                      {item.label}
                                  </span>
                                  <span className="text-xl leading-tight font-semibold tracking-tight tabular-nums">
                                      {item.value}
                                  </span>
                                  {item.sub && (
                                      <span
                                          className={cn(
                                              'truncate text-xs tabular-nums',
                                              toneClass[tone],
                                          )}
                                          title={
                                              typeof item.sub === 'string'
                                                  ? item.sub
                                                  : undefined
                                          }
                                      >
                                          {item.sub}
                                      </span>
                                  )}
                              </span>
                              {item.spark && (
                                  // Only when the cell has room for it.
                                  <span className="hidden @[15rem]:block">
                                      <Sparkline
                                          values={item.spark}
                                          tone={tone}
                                      />
                                  </span>
                              )}
                          </>
                      );
                      const cellClass =
                          '@container flex min-w-0 items-center gap-2 border-r border-b px-3 py-2 text-left last:border-r-0 lg:border-b-0';
                      return item.onClick ? (
                          <button
                              key={item.label}
                              type="button"
                              onClick={item.onClick}
                              className={cn(
                                  cellClass,
                                  'transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset',
                              )}
                          >
                              {body}
                          </button>
                      ) : (
                          <div key={item.label} className={cellClass}>
                              {body}
                          </div>
                      );
                  })}
        </section>
    );
}
