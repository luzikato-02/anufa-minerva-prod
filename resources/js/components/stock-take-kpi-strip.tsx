import { type KpiItem, KpiStrip } from '@/components/kpi-strip';
import { useJson } from '@/hooks/use-json';

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
    const { data, error, retry } = useJson<{ data: StockTakeStats }>(
        '/stock-take-statistics',
    );
    const stats = data?.data ?? null;

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
