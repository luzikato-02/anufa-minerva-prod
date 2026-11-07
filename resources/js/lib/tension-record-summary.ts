/** Derived figures shared by the twisting and weaving record tables. */

interface SummarySource {
    problems?: unknown;
    metadata?: {
        total_measurements?: number;
        completed_measurements?: number;
        progress_percentage?: number;
    } | null;
}

/** Percentage measured, from metadata (falls back to completed / total). */
export function progressOf(record: SummarySource): number | null {
    const meta = record.metadata;
    if (!meta) return null;
    if (typeof meta.progress_percentage === 'number') {
        return meta.progress_percentage;
    }
    if (meta.total_measurements) {
        return (
            ((meta.completed_measurements ?? 0) / meta.total_measurements) * 100
        );
    }
    return null;
}

/** Open (not resolved) and total reported problems on one record. */
export function problemCounts(record: SummarySource) {
    const problems = Array.isArray(record.problems)
        ? (record.problems as { status?: string }[])
        : [];
    const open = problems.filter(
        (p) => (p?.status ?? 'open') !== 'resolved',
    ).length;
    return { open, total: problems.length };
}
