/**
 * Turns stored tension readings into heatmap cells.
 *
 * Shapes in `measurement_data`:
 *   twisting: { "<spindle>": { max, min } }
 *   weaving:  { "<side>": { "<row>": { "<col>": { max, min } } } }
 * Spec and tolerance come from form_data.specTens and form_data.tensPlus.
 * The same rules are mirrored in TensionRecordController::outOfSpec().
 */

export type Band =
    | 'below'
    | 'nearLow'
    | 'in'
    | 'nearHigh'
    | 'above'
    | 'missing';

export interface Reading {
    max: number | null;
    min: number | null;
}

export interface HeatCell extends Reading {
    /** Stable key: spindle number, or "SIDE-row-col" for weaving. */
    key: string;
    /** Short label drawn in the cell (spindle number, or empty for creel). */
    label: string;
    /** Human position, e.g. "Spindle 37" or "AO · R3 · C12". */
    position: string;
    band: Band;
    /** Problems reported at this position. */
    problems: ProblemLike[];
}

export interface ProblemLike {
    id?: string | number;
    spindleNumber?: number;
    position?: string;
    description?: string;
    status?: string;
    timestamp?: string;
    resolution?: {
        action?: string;
        after_repair_max?: number | null;
        after_repair_min?: number | null;
        resolved_by?: string;
        resolved_at?: string;
    } | null;
}

export interface Spec {
    target: number;
    tolerance: number;
}

/** Share of the tolerance band, from the edge inwards, counted as "near" the limit. */
const NEAR_FRACTION = 0.25;

const toNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
};

export function specOf(
    form: { specTens?: unknown; tensPlus?: unknown } | null | undefined,
): Spec | null {
    const target = toNumber(form?.specTens);
    const tolerance = toNumber(form?.tensPlus);
    if (target === null || tolerance === null || tolerance <= 0) return null;
    return { target, tolerance };
}

/**
 * Out of spec when the max reading is above target + tolerance or the min is
 * below target − tolerance. "Near" means inside the band but within its
 * outer quarter. Without a spec, any reading counts as in spec.
 */
export function classify(reading: Reading, spec: Spec | null): Band {
    const { max, min } = reading;
    if (max === null && min === null) return 'missing';
    if (!spec) return 'in';
    const hi = spec.target + spec.tolerance;
    const lo = spec.target - spec.tolerance;
    if (max !== null && max > hi) return 'above';
    if (min !== null && min < lo) return 'below';
    const margin = spec.tolerance * NEAR_FRACTION;
    if (max !== null && max > hi - margin) return 'nearHigh';
    if (min !== null && min < lo + margin) return 'nearLow';
    return 'in';
}

const readingOf = (value: unknown): Reading => {
    const v = (value ?? {}) as { max?: unknown; min?: unknown };
    return { max: toNumber(v.max), min: toNumber(v.min) };
};

/** One cell per spindle 1…total, including spindles with no reading yet. */
export function twistingCells(
    measurements: Record<string, unknown> | null | undefined,
    total: number | null | undefined,
    spec: Spec | null,
    problems: ProblemLike[] = [],
): HeatCell[] {
    const data = measurements ?? {};
    const measured = Object.keys(data).map(Number).filter(Number.isFinite);
    const count = Math.max(total ?? 0, ...measured, 0);
    const bySpindle = new Map<number, ProblemLike[]>();
    for (const p of problems) {
        if (p?.spindleNumber == null) continue;
        const key = Number(p.spindleNumber);
        bySpindle.set(key, [...(bySpindle.get(key) ?? []), p]);
    }

    return Array.from({ length: count }, (_, i) => {
        const n = i + 1;
        const reading = readingOf(data[String(n)]);
        return {
            key: String(n),
            label: String(n),
            position: `Spindle ${n}`,
            band: classify(reading, spec),
            problems: bySpindle.get(n) ?? [],
            ...reading,
        };
    });
}

export interface CreelSide {
    side: string;
    rows: number;
    cols: number;
    cells: HeatCell[];
}

const SIDE_ORDER = ['AI', 'AO', 'BI', 'BO'];

/**
 * One grid per creel side. The grid size is the largest row and column seen
 * on that side, so unmeasured positions inside it show as missing.
 */
export function creelSides(
    measurements: Record<string, unknown> | null | undefined,
    spec: Spec | null,
    problems: ProblemLike[] = [],
): CreelSide[] {
    const data = (measurements ?? {}) as Record<
        string,
        Record<string, Record<string, unknown>>
    >;
    const byPosition = new Map<string, ProblemLike[]>();
    for (const p of problems) {
        if (!p?.position) continue;
        byPosition.set(p.position, [...(byPosition.get(p.position) ?? []), p]);
    }

    const sides = Object.keys(data).filter(
        (s) => data[s] && !Array.isArray(data[s]),
    );
    sides.sort((a, b) => {
        const ia = SIDE_ORDER.indexOf(a);
        const ib = SIDE_ORDER.indexOf(b);
        return (
            (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b)
        );
    });

    return sides.map((side) => {
        const rowsData = data[side];
        const rowKeys = Object.keys(rowsData)
            .map(Number)
            .filter(Number.isFinite);
        const rows = Math.max(0, ...rowKeys);
        let cols = 0;
        for (const r of Object.keys(rowsData)) {
            const colKeys = Object.keys(rowsData[r] ?? {})
                .map(Number)
                .filter(Number.isFinite);
            cols = Math.max(cols, ...colKeys);
        }

        const cells: HeatCell[] = [];
        for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
                const raw = (
                    rowsData[String(r)] as Record<string, unknown> | undefined
                )?.[String(c)];
                const reading = readingOf(raw);
                const storedPosition = `${side}-${r}-Col${c}`;
                cells.push({
                    key: storedPosition,
                    label: '',
                    position: `${side} · R${r} · C${c}`,
                    band: classify(reading, spec),
                    problems: byPosition.get(storedPosition) ?? [],
                    ...reading,
                });
            }
        }
        return { side, rows, cols, cells };
    });
}

export interface BandCounts {
    measured: number;
    total: number;
    above: number;
    below: number;
    near: number;
    min: number | null;
    max: number | null;
}

export function countBands(cells: HeatCell[]): BandCounts {
    const counts: BandCounts = {
        measured: 0,
        total: cells.length,
        above: 0,
        below: 0,
        near: 0,
        min: null,
        max: null,
    };
    for (const cell of cells) {
        if (cell.band === 'missing') continue;
        counts.measured++;
        if (cell.band === 'above') counts.above++;
        if (cell.band === 'below') counts.below++;
        if (cell.band === 'nearHigh' || cell.band === 'nearLow') counts.near++;
        if (cell.min !== null)
            counts.min =
                counts.min === null ? cell.min : Math.min(counts.min, cell.min);
        if (cell.max !== null)
            counts.max =
                counts.max === null ? cell.max : Math.max(counts.max, cell.max);
    }
    return counts;
}
