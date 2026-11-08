import { type KpiItem, KpiStrip } from '@/components/kpi-strip';
import { useCallback, useEffect, useState } from 'react';

interface StockTakeStats {
    total_sessions: number;
    in_progress_sessions: number;
    completed_sessions: number;
    total_batches: number;
    total_checked_batches: number;
    overall_completion: number;
    average_similitude_ratio: number;
}

const n = (v: number) => v.toLocaleString('en-US');

/** Key figures for the stock take records page, from /stock-take-statistics. */
export function StockTakeKpiStrip({ className }: { className?: string }) {
    const [stats, setStats] = useState<StockTakeStats | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt((a) => a + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        setError(null);
        fetch('/stock-take-statistics', {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(`Server responded ${res.status}`);
                return ((await res.json()) as { data: StockTakeStats }).data;
            })
            .then(setStats)
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError')
                    return;
                setError(err instanceof Error ? err.message : 'Request failed');
            });
        return () => controller.abort();
    }, [attempt]);

    const items: KpiItem[] = stats
        ? [
              {
                  label: 'Sessions',
                  value: n(stats.total_sessions),
                  sub: `${n(stats.completed_sessions)} completed`,
              },
              {
                  label: 'In progress',
                  value: n(stats.in_progress_sessions),
                  sub:
                      stats.in_progress_sessions === 1
                          ? 'open session'
                          : 'open sessions',
              },
              {
                  label: 'Batches checked',
                  value: `${stats.overall_completion}%`,
                  sub: `${n(stats.total_checked_batches)} of ${n(stats.total_batches)}`,
              },
              {
                  label: 'Avg. similitude',
                  value: `${stats.average_similitude_ratio}%`,
                  sub: 'checked ÷ expected, per session',
              },
          ]
        : [];

    return (
        <KpiStrip
            label="Stock take key figures"
            className={className}
            loading={!stats && !error}
            error={error}
            onRetry={retry}
            items={items}
        />
    );
}
