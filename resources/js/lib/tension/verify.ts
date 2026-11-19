/** Checks that a saved tension record matches what was sent. */

import type { TensionRecordPayload } from '@/types/tension';

/** Counts `{ max, min }` leaves at any depth (spindle or creel shape). */
function countMeasurementLeaves(node: unknown): number {
    if (!node || typeof node !== 'object') return 0;
    if ('max' in node && 'min' in node) return 1;
    return Object.values(node).reduce(
        (sum: number, child) => sum + countMeasurementLeaves(child),
        0,
    );
}

export function verifyPersistedRecord(
    sent: TensionRecordPayload,
    fetched: TensionRecordPayload | null,
): { ok: boolean; reason?: string } {
    if (!fetched) {
        return {
            ok: false,
            reason: 'Could not retrieve the saved record from the database for verification.',
        };
    }

    const sentMeasurements = countMeasurementLeaves(sent.measurement_data);
    const fetchedMeasurements = countMeasurementLeaves(
        fetched.measurement_data,
    );
    if (sentMeasurements !== fetchedMeasurements) {
        return {
            ok: false,
            reason: `Measurement count mismatch: sent ${sentMeasurements}, saved ${fetchedMeasurements}.`,
        };
    }

    const sentProblems = sent.problems?.length ?? 0;
    const fetchedProblems = fetched.problems?.length ?? 0;
    if (sentProblems !== fetchedProblems) {
        return {
            ok: false,
            reason: `Problem count mismatch: sent ${sentProblems}, saved ${fetchedProblems}.`,
        };
    }

    if (
        sent.metadata.completed_measurements !==
        fetched.metadata?.completed_measurements
    ) {
        return {
            ok: false,
            reason: `Completed measurements mismatch: sent ${sent.metadata.completed_measurements}, saved ${fetched.metadata?.completed_measurements}.`,
        };
    }

    return { ok: true };
}
