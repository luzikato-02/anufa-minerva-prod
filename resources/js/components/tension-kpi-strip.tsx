import { type KpiItem, KpiStrip } from '@/components/kpi-strip';
import { useCallback, useEffect, useState } from 'react';

interface TensionSummary {
    records: { current: number; previous: number; daily: number[] };
    open_problems: {
        open: number;
        new_today: number;
        older_than_24h: number;
        reported_daily: number[];
    };
    resolve_hours: {
        current_median: number | null;
        previous_median: number | null;
        resolved_current: number;
    };
    out_of_spec: {
        current_pct: number | null;
        previous_pct: number | null;
        current_positions: number;
        current_out: number;
    };
    completion: { current_avg: number | null; previous_avg: number | null };
    machines: { checked_today: number; active_30d: number; overdue: number };
}

const signed = (n: number, digits = 0) => {
    const rounded = Number(n.toFixed(digits));
    if (rounded === 0) return digits ? (0).toFixed(digits) : '0';
    return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(digits)}`;
};

const hours = (h: number) =>
    h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`;

/** Turns the server summary into the five cells; every number comes from the API. */
export function buildTensionKpis(
    s: TensionSummary,
    onOpenProblems?: () => void,
): KpiItem[] {
    const recordDelta = s.records.current - s.records.previous;

    const { current_median: resolveNow, previous_median: resolveBefore } =
        s.resolve_hours;
    let resolveSub = 'none resolved in 7 days';
    let resolveTone: KpiItem['tone'] = 'neutral';
    if (resolveNow !== null && resolveBefore !== null) {
        const diff = resolveNow - resolveBefore;
        resolveSub = `${signed(diff, 1)}h vs prior`;
        resolveTone = diff < 0 ? 'good' : diff > 0 ? 'bad' : 'neutral';
    } else if (resolveNow !== null) {
        resolveSub = `${s.resolve_hours.resolved_current} resolved`;
    }

    const { current_pct: outNow, previous_pct: outBefore } = s.out_of_spec;
    const outDiff =
        outNow !== null && outBefore !== null ? outNow - outBefore : null;

    return [
        {
            label: 'Records · 7 days',
            value: s.records.current.toLocaleString('en-US'),
            sub: `${signed(recordDelta)} vs prior 7d`,
            spark: s.records.daily,
        },
        {
            label: 'Open problems',
            value: s.open_problems.open.toLocaleString('en-US'),
            sub:
                s.open_problems.older_than_24h > 0
                    ? `${s.open_problems.older_than_24h} older than 1 day`
                    : `${s.open_problems.new_today} new today`,
            tone: s.open_problems.older_than_24h > 0 ? 'bad' : 'neutral',
            spark: s.open_problems.reported_daily,
            onClick: onOpenProblems,
        },
        {
            label: 'Median fix time · 7d',
            value: resolveNow !== null ? hours(resolveNow) : '—',
            sub: resolveSub,
            tone: resolveTone,
        },
        {
            // Same rule as the heatmap: max above, or min below, spec ± tolerance.
            label: 'Out of spec · 7d',
            value: outNow !== null ? `${outNow.toFixed(1)}%` : '—',
            sub:
                outDiff !== null
                    ? `${signed(outDiff, 1)} pt vs prior`
                    : `${s.out_of_spec.current_out} of ${s.out_of_spec.current_positions.toLocaleString('en-US')} positions`,
            tone:
                outDiff === null || Math.abs(outDiff) < 0.05
                    ? 'neutral'
                    : outDiff < 0
                      ? 'good'
                      : 'bad',
        },
        {
            label: 'Checked today',
            value: `${s.machines.checked_today}/${s.machines.active_30d}`,
            sub:
                s.machines.overdue > 0
                    ? `${s.machines.overdue} overdue (3+ days)`
                    : 'none overdue',
            tone: s.machines.overdue > 0 ? 'bad' : 'good',
        },
    ];
}

/**
 * Key figures for the tension records page. Days are the viewer's local days.
 * `onOpenProblems` makes the open-problems cell jump to the problem queue.
 */
export function TensionKpiStrip({
    onOpenProblems,
    className,
}: {
    onOpenProblems?: () => void;
    className?: string;
}) {
    const [summary, setSummary] = useState<TensionSummary | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt((a) => a + 1), []);

    useEffect(() => {
        const controller = new AbortController();
        const offset = -new Date().getTimezoneOffset();
        setError(null);
        fetch(`/tension-summary?tz_offset=${offset}`, {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then(async (res) => {
                if (!res.ok) throw new Error(`Server responded ${res.status}`);
                return (await res.json()) as { data: TensionSummary };
            })
            .then((json) => setSummary(json.data))
            .catch((err: unknown) => {
                if (err instanceof DOMException && err.name === 'AbortError')
                    return;
                setError(err instanceof Error ? err.message : 'Request failed');
            });
        return () => controller.abort();
    }, [attempt]);

    return (
        <KpiStrip
            label="Tension key figures"
            loading={!summary && !error}
            error={error}
            onRetry={retry}
            items={summary ? buildTensionKpis(summary, onOpenProblems) : []}
            className={className}
        />
    );
}
