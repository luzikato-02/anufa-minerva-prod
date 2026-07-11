import { type BatchPosition, type RowName, type SideName, Creel3DViewer, PALETTE_HEX } from '@/components/creel-3d-viewer';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { AlertCircle, AlertTriangle, Check, CheckCircle2, ChevronDown, Loader2, Save, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

// ── types ─────────────────────────────────────────────────────────────────────

interface RawBatch {
    batch: string;
    net_weight: number;
    count: number;
    creel_side: string;
    creel_from: string;
    creel_to: string;
    material: string | null;
    shift_load?: string;
    user_name?: string | null;
}

interface AssignedBatch {
    batch: string;
    positions: BatchPosition[];
}

interface BatchItem {
    batch: string;
    net_weight: number;
    creel_side: string;
    creel_from: string;
    creel_to: string;
    count: number;
    material: string | null;
    positions: BatchPosition[];
}

interface FinishedPosition {
    side: string;
    column: number;
    row: string;
    meters: number;
}

interface Props {
    record: {
        id: number;
        order_number: string;
        machine: string | null;
        date_string: string | null;
        operator: string | null;
        metadata: {
            batch_count: number;
            total_weight: number;
            file_name: string;
            upload_date: string;
            df_width?: number | null;
            gf_width?: number | null;
            standard_total_ends?: number | null;
        } | null;
        raw_batches: RawBatch[] | null;
        batches: Array<AssignedBatch & Record<string, unknown>>;
    };
    finishedPositions: FinishedPosition[];
}

// ── RawDataDialog ─────────────────────────────────────────────────────────────

function RawDataDialog({
    recordId,
    initialRaw,
    onSaved,
    onClose,
}: {
    recordId: number;
    initialRaw: RawBatch[];
    onSaved: (raw: RawBatch[]) => void;
    onClose: () => void;
}) {
    const [rows, setRows]   = useState<RawBatch[]>(() => initialRaw.map((r) => ({ ...r })));
    const [saving, setSaving] = useState(false);
    const [error, setError]   = useState<string | null>(null);

    const update = (i: number, field: keyof RawBatch, val: string | number) =>
        setRows((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: val } : r)));

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const csrf = await axios.get('/csrf-token');
            const res  = await axios.patch(
                `/creel-records/${recordId}/raw`,
                { raw_batches: rows },
                { headers: { 'X-CSRF-TOKEN': csrf.data.csrfToken } },
            );
            onSaved(res.data.raw_batches);
        } catch (err: unknown) {
            setError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : 'Save failed. Please try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-[1100px]">
                <DialogHeader>
                    <DialogTitle>Raw XLSX Data</DialogTitle>
                    <DialogDescription>
                        Edit ERP import metadata. Assigned bobbin positions are not affected.
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 overflow-y-auto">
                    <Table>
                        <TableHeader className="sticky top-0 z-10 bg-background">
                            <TableRow>
                                <TableHead className="w-[140px]">Batch</TableHead>
                                <TableHead className="w-[130px]">Material</TableHead>
                                <TableHead className="w-[80px] text-right">Wt (kg)</TableHead>
                                <TableHead className="w-[110px]">Side</TableHead>
                                <TableHead className="w-[90px]">From</TableHead>
                                <TableHead className="w-[90px]">To</TableHead>
                                <TableHead className="w-[80px] text-right">Quota</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r, i) => (
                                <TableRow key={i}>
                                    <TableCell className="font-mono text-xs">{r.batch}</TableCell>
                                    <TableCell className="font-mono text-xs text-muted-foreground">{r.material ?? '—'}</TableCell>
                                    <TableCell className="text-right text-xs">{r.net_weight.toFixed(1)}</TableCell>
                                    <TableCell>
                                        <Input
                                            value={r.creel_side}
                                            onChange={(e) => update(i, 'creel_side', e.target.value.toUpperCase())}
                                            className="h-7 px-2 font-mono text-xs uppercase"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            value={r.creel_from}
                                            onChange={(e) => update(i, 'creel_from', e.target.value.toUpperCase())}
                                            className="h-7 px-2 font-mono text-xs uppercase"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            value={r.creel_to}
                                            onChange={(e) => update(i, 'creel_to', e.target.value.toUpperCase())}
                                            className="h-7 px-2 font-mono text-xs uppercase"
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Input
                                            type="number"
                                            value={r.count}
                                            onChange={(e) => update(i, 'count', parseInt(e.target.value) || 0)}
                                            className="h-7 px-2 text-right text-xs"
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {error && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}

                <div className="flex justify-end gap-2 border-t pt-4">
                    <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving
                            ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</>
                            : <><CheckCircle2 className="mr-2 h-4 w-4" />Save Changes</>}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

// ── RangeSelectForm ───────────────────────────────────────────────────────────

const ROWS_ORDER: RowName[] = ['A', 'B', 'C', 'D', 'E'];

function parsePos(s: string): { col: number; row: RowName } | null {
    const m = s.trim().toUpperCase().match(/^(\d+)([A-E])$/);
    if (!m) return null;
    const col = parseInt(m[1]);
    if (col < 1 || col > 100) return null;
    return { col, row: m[2] as RowName };
}

function buildRange(sides: SideName[], start: { col: number; row: RowName }, end: { col: number; row: RowName }): BatchPosition[] {
    const positions: BatchPosition[] = [];
    for (const side of sides) {
        for (let col = start.col; col <= end.col; col++) {
            const rowStart = col === start.col ? ROWS_ORDER.indexOf(start.row) : 0;
            const rowEnd   = col === end.col   ? ROWS_ORDER.indexOf(end.row)   : ROWS_ORDER.length - 1;
            for (let ri = rowStart; ri <= rowEnd; ri++) {
                positions.push({ side, column: col, row: ROWS_ORDER[ri] });
            }
        }
    }
    return positions;
}

// buildZigzag: one bobbin per column, row bounces A↔E following the initial direction.
function buildZigzag(
    sides: SideName[],
    start: { col: number; row: RowName },
    toCol: number,
    direction: 'up' | 'down',
): BatchPosition[] {
    if (toCol < start.col) return [];
    const positions: BatchPosition[] = [];
    let rowIdx = ROWS_ORDER.indexOf(start.row);
    let dir    = direction === 'up' ? 1 : -1;

    for (let col = start.col; col <= toCol; col++) {
        for (const side of sides) {
            positions.push({ side, column: col, row: ROWS_ORDER[rowIdx] });
        }
        const next = rowIdx + dir;
        if (next >= ROWS_ORDER.length) {
            rowIdx = ROWS_ORDER.length - 2;   // bounce down from E
            dir    = -1;
        } else if (next < 0) {
            rowIdx = 1;                        // bounce up from A
            dir    = 1;
        } else {
            rowIdx = next;
        }
    }
    return positions;
}

function RangeSelectForm({ onSelect }: {
    onSelect: (positions: BatchPosition[]) => void;
}) {
    const [open, setOpen]   = useState(false);
    const [sides, setSides] = useState<SideName[]>(['AI']);
    const [from, setFrom]   = useState('');
    const [to, setTo]       = useState('');

    const toggleSide = (s: SideName) =>
        setSides((prev) =>
            prev.includes(s)
                ? prev.length > 1 ? prev.filter((x) => x !== s) : prev
                : [...prev, s],
        );

    const fromParsed = parsePos(from);
    const toParsed   = parsePos(to);

    // Normalise so start ≤ end in column-then-row order
    const getRange = () => {
        if (!fromParsed || !toParsed) return null;
        const ri = (r: RowName) => ROWS_ORDER.indexOf(r);
        const aFirst =
            fromParsed.col < toParsed.col ||
            (fromParsed.col === toParsed.col && ri(fromParsed.row) <= ri(toParsed.row));
        return aFirst
            ? { start: fromParsed, end: toParsed }
            : { start: toParsed,   end: fromParsed };
    };

    const range = getRange();

    const count = range
        ? sides.length * (() => {
            const { start, end } = range;
            const ri = (r: RowName) => ROWS_ORDER.indexOf(r);
            if (start.col === end.col) return ri(end.row) - ri(start.row) + 1;
            return (ROWS_ORDER.length - ri(start.row))
                + (end.col - start.col - 1) * ROWS_ORDER.length
                + (ri(end.row) + 1);
        })()
        : 0;

    const valid = range !== null && sides.length > 0;

    const handleAdd = () => {
        if (!range) return;
        onSelect(buildRange(sides, range.start, range.end));
    };

    return (
        <div className="border-b border-border">
            <button
                onClick={() => setOpen((p) => !p)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50"
            >
                <span>Range Select</span>
                <span className="text-[9px]">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div className="space-y-2 px-3 pb-3">
                    {/* Side */}
                    <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">Side</p>
                        <div className="flex gap-1">
                            {(['AI', 'AO', 'BI', 'BO'] as SideName[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => toggleSide(s)}
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                        sides.includes(s)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* From / To */}
                    <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">Range (col + row)</p>
                        <div className="flex items-center gap-1.5">
                            <Input
                                value={from}
                                onChange={(e) => setFrom(e.target.value.toUpperCase())}
                                className={`h-7 w-16 px-2 text-center font-mono text-xs ${from && !fromParsed ? 'border-destructive' : ''}`}
                                placeholder="1A"
                                maxLength={4}
                            />
                            <span className="text-[10px] text-muted-foreground">→</span>
                            <Input
                                value={to}
                                onChange={(e) => setTo(e.target.value.toUpperCase())}
                                className={`h-7 w-16 px-2 text-center font-mono text-xs ${to && !toParsed ? 'border-destructive' : ''}`}
                                placeholder="12E"
                                maxLength={4}
                            />
                        </div>
                        <p className="mt-1 text-[10px] text-muted-foreground/60">e.g. 1A → 12E selects 1A,1B…1E,2A…12E</p>
                    </div>

                    <Button
                        size="sm"
                        className="h-6 w-full text-xs"
                        disabled={!valid}
                        onClick={handleAdd}
                    >
                        Add {count > 0 ? count : ''} to Selection
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── CountSelectForm ───────────────────────────────────────────────────────────
// Start position + count: 1A + 9 → 1A,1B,1C,1D,1E,2A,2B,2C,2D

function buildFromCount(
    sides: SideName[],
    start: { col: number; row: RowName },
    countPerSide: number,
): BatchPosition[] {
    const positions: BatchPosition[] = [];
    let col    = start.col;
    let rowIdx = ROWS_ORDER.indexOf(start.row);
    for (let n = 0; n < countPerSide && col <= 100; n++) {
        for (const side of sides) {
            positions.push({ side, column: col, row: ROWS_ORDER[rowIdx] });
        }
        rowIdx++;
        if (rowIdx >= ROWS_ORDER.length) { rowIdx = 0; col++; }
    }
    return positions;
}

function computeEndPos(
    start: { col: number; row: RowName },
    countPerSide: number,
): { col: number; row: RowName } | null {
    if (countPerSide <= 0) return null;
    const linearEnd = (start.col - 1) * 5 + ROWS_ORDER.indexOf(start.row) + countPerSide - 1;
    const endCol = Math.floor(linearEnd / 5) + 1;
    if (endCol > 100) return null;
    return { col: endCol, row: ROWS_ORDER[linearEnd % 5] };
}

function CountSelectForm({ onSelect }: { onSelect: (positions: BatchPosition[]) => void }) {
    const [open, setOpen]   = useState(false);
    const [sides, setSides] = useState<SideName[]>(['AI']);
    const [from, setFrom]   = useState('');
    const [count, setCount] = useState('');

    const fromParsed = parsePos(from);
    const countNum   = count.trim() !== '' ? parseInt(count.trim()) : null;
    const countValid = countNum !== null && !isNaN(countNum) && countNum > 0 && countNum <= 500;
    const valid      = fromParsed !== null && countValid;
    const end        = valid ? computeEndPos(fromParsed!, countNum!) : null;

    const toggleSide = (s: SideName) =>
        setSides((prev) =>
            prev.includes(s)
                ? prev.length > 1 ? prev.filter((x) => x !== s) : prev
                : [...prev, s],
        );

    const handleAdd = () => {
        if (!valid || !end) return;
        onSelect(buildFromCount(sides, fromParsed!, countNum!));
        setFrom('');
        setCount('');
    };

    return (
        <div className="border-b border-border">
            <button
                onClick={() => setOpen((p) => !p)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50"
            >
                <span>Count Select</span>
                <span className="text-[9px]">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div className="space-y-2 px-3 pb-3">
                    <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">Side</p>
                        <div className="flex gap-1">
                            {(['AI', 'AO', 'BI', 'BO'] as SideName[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => toggleSide(s)}
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                        sides.includes(s)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">Start · Count per side</p>
                        <div className="flex items-center gap-1.5">
                            <Input
                                value={from}
                                onChange={(e) => setFrom(e.target.value.toUpperCase())}
                                className={`h-7 w-16 px-2 text-center font-mono text-xs ${from && !fromParsed ? 'border-destructive' : ''}`}
                                placeholder="1A"
                                maxLength={4}
                            />
                            <span className="text-[10px] text-muted-foreground">+</span>
                            <Input
                                value={count}
                                onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))}
                                className={`h-7 w-16 px-2 text-center font-mono text-xs ${count && !countValid ? 'border-destructive' : ''}`}
                                placeholder="10"
                                maxLength={3}
                            />
                        </div>
                        {valid && end && (
                            <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                                {fromParsed!.col}{fromParsed!.row} → {end.col}{end.row}
                                {sides.length > 1 && (
                                    <span className="ml-1 text-muted-foreground/60">
                                        ({countNum} × {sides.length})
                                    </span>
                                )}
                            </p>
                        )}
                        {valid && !end && (
                            <p className="mt-1 text-[10px] text-destructive">Exceeds column 100</p>
                        )}
                    </div>

                    <Button
                        size="sm"
                        className="h-6 w-full text-xs"
                        disabled={!valid || !end}
                        onClick={handleAdd}
                    >
                        Add {valid && end ? countNum! * sides.length : ''} to Selection
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── ZigzagSelectForm ──────────────────────────────────────────────────────────

function ZigzagSelectForm({ onSelect }: { onSelect: (positions: BatchPosition[]) => void }) {
    const [open, setOpen]           = useState(false);
    const [sides, setSides]         = useState<SideName[]>(['AI']);
    const [from, setFrom]           = useState('');
    const [toCol, setToCol]         = useState('');
    const [direction, setDirection] = useState<'up' | 'down'>('up');

    const fromParsed = parsePos(from);
    const toColNum   = toCol.trim() !== '' ? parseInt(toCol.trim()) : null;
    const toColValid = toColNum !== null && !isNaN(toColNum) && toColNum >= 1 && toColNum <= 100;
    const valid      = fromParsed !== null && toColValid && toColNum! >= fromParsed.col;

    // Preview path using a single side so it's col→row steps, not multiplied by sides
    const previewSteps = valid
        ? buildZigzag(['AI'], fromParsed!, toColNum!, direction).slice(0, 7)
        : [];
    const count = valid
        ? buildZigzag(sides, fromParsed!, toColNum!, direction).length
        : 0;

    const toggleSide = (s: SideName) =>
        setSides((prev) =>
            prev.includes(s)
                ? prev.length > 1 ? prev.filter((x) => x !== s) : prev
                : [...prev, s],
        );

    const handleAdd = () => {
        if (!valid) return;
        onSelect(buildZigzag(sides, fromParsed!, toColNum!, direction));
        setFrom('');
        setToCol('');
    };

    return (
        <div className="border-b border-border">
            <button
                onClick={() => setOpen((p) => !p)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50"
            >
                <span>Zigzag Select</span>
                <span className="text-[9px]">{open ? '▲' : '▼'}</span>
            </button>

            {open && (
                <div className="space-y-2 px-3 pb-3">
                    {/* Side */}
                    <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">Side</p>
                        <div className="flex gap-1">
                            {(['AI', 'AO', 'BI', 'BO'] as SideName[]).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => toggleSide(s)}
                                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                                        sides.includes(s)
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* From / To column */}
                    <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">Start → end column</p>
                        <div className="flex items-center gap-1.5">
                            <Input
                                value={from}
                                onChange={(e) => setFrom(e.target.value.toUpperCase())}
                                className={`h-7 w-16 px-2 text-center font-mono text-xs ${from && !fromParsed ? 'border-destructive' : ''}`}
                                placeholder="14A"
                                maxLength={4}
                            />
                            <span className="text-[10px] text-muted-foreground">→ col</span>
                            <Input
                                value={toCol}
                                onChange={(e) => setToCol(e.target.value.replace(/\D/g, ''))}
                                className={`h-7 w-14 px-2 text-center font-mono text-xs ${toCol && !toColValid ? 'border-destructive' : ''}`}
                                placeholder="30"
                                maxLength={3}
                            />
                        </div>
                    </div>

                    {/* Direction */}
                    <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">Initial direction</p>
                        <div className="flex gap-1">
                            {(['up', 'down'] as const).map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDirection(d)}
                                    className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                                        direction === d
                                            ? 'bg-primary text-primary-foreground'
                                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                    }`}
                                >
                                    {d === 'up' ? '↑ Up (→E)' : '↓ Down (→A)'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Path preview */}
                    {previewSteps.length > 0 && (
                        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                            {previewSteps.map((p) => `${p.column}${p.row}`).join(' → ')}
                            {count / sides.length > previewSteps.length ? ' …' : ''}
                        </p>
                    )}

                    <Button
                        size="sm"
                        className="h-6 w-full text-xs"
                        disabled={!valid}
                        onClick={handleAdd}
                    >
                        Add {count > 0 ? count : ''} to Selection
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── SpecsForm ─────────────────────────────────────────────────────────────────

function SpecsForm({ recordId, initialDfWidth, initialGfWidth, initialTotalEnds }: {
    recordId: number;
    initialDfWidth: number | null;
    initialGfWidth: number | null;
    initialTotalEnds: number | null;
}) {
    const [open, setOpen]           = useState(false);
    const [dfWidth, setDfWidth]     = useState(initialDfWidth?.toString() ?? '');
    const [gfWidth, setGfWidth]     = useState(initialGfWidth?.toString() ?? '');
    const [totalEnds, setTotalEnds] = useState(initialTotalEnds?.toString() ?? '');
    const [saving, setSaving]       = useState(false);
    const [saved, setSaved]         = useState(false);
    const [error, setError]         = useState<string | null>(null);

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const csrf = await axios.get('/csrf-token');
            await axios.patch(
                `/creel-records/${recordId}/specs`,
                {
                    df_width:             dfWidth !== ''   ? parseFloat(dfWidth)   : null,
                    gf_width:             gfWidth !== ''   ? parseFloat(gfWidth)   : null,
                    standard_total_ends:  totalEnds !== '' ? parseInt(totalEnds)   : null,
                },
                { headers: { 'X-CSRF-TOKEN': csrf.data.csrfToken } },
            );
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : 'Save failed.',
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="border-b border-border">
            <button
                onClick={() => setOpen((p) => !p)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50"
            >
                <span>Weaving Specs</span>
                <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="space-y-2 px-3 pb-3">
                    <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">DF Width (mm)</p>
                        <Input
                            type="number"
                            value={dfWidth}
                            onChange={(e) => setDfWidth(e.target.value)}
                            className="h-7 text-xs"
                            placeholder="e.g. 150"
                        />
                    </div>
                    <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">GF Width (mm)</p>
                        <Input
                            type="number"
                            value={gfWidth}
                            onChange={(e) => setGfWidth(e.target.value)}
                            className="h-7 text-xs"
                            placeholder="e.g. 145"
                        />
                    </div>
                    <div>
                        <p className="mb-1 text-[10px] text-muted-foreground">Standard Total Ends</p>
                        <Input
                            type="number"
                            value={totalEnds}
                            onChange={(e) => setTotalEnds(e.target.value)}
                            className="h-7 text-xs"
                            placeholder="e.g. 500"
                        />
                    </div>
                    {error && <p className="text-[10px] text-destructive">{error}</p>}
                    <Button
                        size="sm"
                        className="h-6 w-full text-xs"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : saved ? (
                            <Check className="mr-1 h-3 w-3" />
                        ) : (
                            <Save className="mr-1 h-3 w-3" />
                        )}
                        {saved ? 'Saved' : 'Save Specs'}
                    </Button>
                </div>
            )}
        </div>
    );
}

// ── Page ──────────────────────────────────────────────────────────────────────

const ALL_SIDES: SideName[] = ['AI', 'AO', 'BI', 'BO'];

function posKey(p: BatchPosition) {
    return `${p.side}:${p.column}:${p.row}`;
}

export default function CreelViewer({ record, finishedPositions }: Props) {
    const [rawBatches, setRawBatches]           = useState<RawBatch[]>(record.raw_batches ?? []);
    const [assignedBatches, setAssignedBatches] = useState<AssignedBatch[]>(
        () => (record.batches ?? []).map((b) => ({ batch: b.batch, positions: b.positions ?? [] })),
    );
    const [pendingBatches, setPendingBatches]   = useState<AssignedBatch[] | null>(null);
    const [selectedPositions, setSelectedPositions] = useState<Set<string>>(new Set());
    const [visibleSides, setVisibleSides]       = useState<SideName[]>([...ALL_SIDES]);
    const [rawEditOpen, setRawEditOpen]         = useState(false);
    const [saving, setSaving]                   = useState(false);
    const [saveError, setSaveError]             = useState<string | null>(null);

    const displayBatches = pendingBatches ?? assignedBatches;

    // Merge raw XLSX metadata with current position assignments for the 3D viewer.
    // useMemo keeps the array reference stable so SceneWrapper's React.memo can
    // prevent Canvas re-renders when only tooltip state changes.
    const batchItems = useMemo<BatchItem[]>(() => rawBatches.map((rb) => {
        const assigned = displayBatches.find((b) => b.batch === rb.batch);
        return {
            batch:      rb.batch,
            net_weight: rb.net_weight,
            creel_side: rb.creel_side,
            creel_from: rb.creel_from,
            creel_to:   rb.creel_to,
            count:      rb.count,
            material:   rb.material ?? null,
            positions:  assigned?.positions ?? [],
        };
    }), [rawBatches, displayBatches]);

    // Per-batch counters
    const batchStats = rawBatches.map((rb, i) => {
        const assigned = (displayBatches.find((b) => b.batch === rb.batch)?.positions ?? []).length;
        return {
            ...rb,
            assigned,
            remaining: rb.count - assigned,
            colorHex:  PALETTE_HEX[i % PALETTE_HEX.length],
        };
    });

    const handleRangeSelect = useCallback(
        (positions: BatchPosition[]) => {
            setSelectedPositions((prev) => {
                const next = new Set(prev);
                positions.forEach((p) => next.add(`${p.side}:${p.column}:${p.row}`));
                return next;
            });
        },
        [],
    );

    const handlePositionToggle = useCallback((pos: BatchPosition) => {
        const key = posKey(pos);
        setSelectedPositions((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const handleAssignSelected = useCallback(
        (batchId: string | null) => {
            if (selectedPositions.size === 0) return;
            const keys = new Set(selectedPositions);
            const parsedPositions: BatchPosition[] = [];
            keys.forEach((key) => {
                const [side, col, row] = key.split(':');
                parsedPositions.push({
                    side:   side as BatchPosition['side'],
                    column: parseInt(col),
                    row:    row   as BatchPosition['row'],
                });
            });
            setPendingBatches((prev) => {
                const base = prev ?? assignedBatches;
                return base.map((b) => {
                    const without = b.positions.filter((p) => !keys.has(posKey(p)));
                    const withPos = batchId === b.batch ? [...without, ...parsedPositions] : without;
                    return { ...b, positions: withPos };
                });
            });
            setSelectedPositions(new Set());
        },
        [selectedPositions, assignedBatches],
    );

    const handleSavePositions = async () => {
        if (!pendingBatches) return;
        setSaving(true);
        setSaveError(null);
        try {
            const csrf = await axios.get('/csrf-token');
            const res  = await axios.patch(
                `/creel-records/${record.id}/positions`,
                { batches: pendingBatches.map((b) => ({ batch: b.batch, positions: b.positions })) },
                { headers: { 'X-CSRF-TOKEN': csrf.data.csrfToken } },
            );
            setAssignedBatches(
                (res.data.batches ?? []).map((b: { batch: string; positions?: BatchPosition[] }) => ({
                    batch:     b.batch,
                    positions: b.positions ?? [],
                })),
            );
            setPendingBatches(null);
        } catch (err: unknown) {
            setSaveError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : 'Save failed. Please try again.',
            );
        } finally {
            setSaving(false);
        }
    };

    const toggleSide = (side: SideName) => {
        setVisibleSides((prev) =>
            prev.includes(side)
                ? prev.length > 1 ? prev.filter((s) => s !== side) : prev
                : [...prev, side],
        );
    };

    const finishedCount = finishedPositions.length;
    const isDirty = pendingBatches !== null;

    return (
        <div className="flex h-screen flex-col overflow-hidden bg-background">
            <Head title={`Creel — ${record.order_number}`} />

            {/* ── Header ── */}
            <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-2.5">
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-tight text-foreground">
                        {record.order_number}
                        {record.machine && <span className="ml-2 text-xs font-normal text-muted-foreground">· {record.machine}</span>}
                        {record.date_string && <span className="ml-2 text-xs font-normal text-muted-foreground">{record.date_string}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {rawBatches.length} batches
                        {record.metadata?.total_weight != null && ` · ${record.metadata.total_weight.toFixed(1)} kg`}
                        {finishedCount > 0 && (
                            <span className="ml-2 font-medium text-amber-500">{finishedCount} finished-earlier</span>
                        )}
                    </p>
                </div>

                {/* Side filter chips */}
                <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Show:</span>
                    {ALL_SIDES.map((side) => (
                        <button
                            key={side}
                            onClick={() => toggleSide(side)}
                            className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                                visibleSides.includes(side)
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                        >
                            {side}
                        </button>
                    ))}
                    {visibleSides.length < ALL_SIDES.length && (
                        <button
                            onClick={() => setVisibleSides([...ALL_SIDES])}
                            className="rounded px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                            All
                        </button>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {finishedCount === 0 && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                            <AlertTriangle className="size-3" />
                            No finish-earlier data
                        </p>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setRawEditOpen(true)}>
                        Raw Data
                    </Button>
                    {isDirty && (
                        <>
                            <Button
                                size="sm"
                                onClick={handleSavePositions}
                                disabled={saving}
                                className="gap-1.5"
                            >
                                {saving
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Save className="h-3.5 w-3.5" />}
                                Save
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setPendingBatches(null)}
                                disabled={saving}
                            >
                                Discard
                            </Button>
                        </>
                    )}
                    <button
                        onClick={() => window.close()}
                        className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="Close"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex min-h-0 flex-1">
                {/* Left panel — batch list */}
                <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-background">
                    {/* Count select form — start position + total bobbins */}
                    <CountSelectForm onSelect={handleRangeSelect} />

                    {/* Range select form */}
                    <RangeSelectForm onSelect={handleRangeSelect} />

                    {/* Zigzag select form */}
                    <ZigzagSelectForm onSelect={handleRangeSelect} />

                    {/* Weaving specs */}
                    <SpecsForm
                        recordId={record.id}
                        initialDfWidth={record.metadata?.df_width ?? null}
                        initialGfWidth={record.metadata?.gf_width ?? null}
                        initialTotalEnds={record.metadata?.standard_total_ends ?? null}
                    />

                    {/* Selection bar */}
                    {selectedPositions.size > 0 && (
                        <div className="border-b border-border p-3">
                            <p className="mb-2 text-xs font-semibold text-foreground">
                                {selectedPositions.size} bobbin{selectedPositions.size !== 1 ? 's' : ''} selected
                            </p>
                            <div className="flex gap-1.5">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                                    onClick={() => handleAssignSelected(null)}
                                >
                                    Unload
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 px-2 text-xs"
                                    onClick={() => setSelectedPositions(new Set())}
                                >
                                    Clear
                                </Button>
                            </div>
                            <p className="mt-1.5 text-[11px] text-muted-foreground">
                                Click a batch below to assign
                            </p>
                        </div>
                    )}

                    {/* Batch list with counters */}
                    <div className="min-h-0 flex-1 overflow-y-auto">
                        <p className="px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Batches
                        </p>
                        {batchStats.map((stat) => {
                            const done    = stat.remaining <= 0;
                            const over    = stat.remaining < 0;
                            const partial = stat.assigned > 0 && !done;
                            return (
                                <button
                                    key={stat.batch}
                                    onClick={() =>
                                        selectedPositions.size > 0
                                            ? handleAssignSelected(stat.batch)
                                            : undefined
                                    }
                                    className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                                        selectedPositions.size > 0
                                            ? 'cursor-pointer hover:bg-accent'
                                            : 'cursor-default'
                                    }`}
                                    title={
                                        selectedPositions.size > 0
                                            ? `Assign ${selectedPositions.size} bobbin${selectedPositions.size !== 1 ? 's' : ''} to ${stat.batch}`
                                            : stat.batch
                                    }
                                >
                                    <span
                                        className="h-3 w-3 shrink-0 rounded-sm border border-black/10"
                                        style={{ backgroundColor: stat.colorHex }}
                                    />
                                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
                                        {stat.batch}
                                    </span>
                                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                        over    ? 'bg-destructive/15 text-destructive' :
                                        done    ? 'bg-green-500/15 text-green-700 dark:text-green-400' :
                                        partial ? 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400' :
                                                  'bg-muted text-muted-foreground'
                                    }`}>
                                        {done && !over
                                            ? <Check className="inline h-3 w-3" />
                                            : over
                                              ? `+${Math.abs(stat.remaining)}`
                                              : `−${stat.remaining}`}
                                    </span>
                                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                                        {stat.assigned}/{stat.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </aside>

                {/* 3D Viewer */}
                <div className="relative min-w-0 flex-1">
                    <Creel3DViewer
                        batches={batchItems}
                        finishedPositions={finishedPositions}
                        visibleSides={visibleSides}
                        selectedPositions={selectedPositions}
                        onPositionToggle={handlePositionToggle}
                    />
                </div>
            </div>

            {/* Save error */}
            {saveError && (
                <div className="absolute bottom-14 left-3 z-50 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {saveError}
                </div>
            )}

            {/* Raw data edit dialog */}
            {rawEditOpen && (
                <RawDataDialog
                    recordId={record.id}
                    initialRaw={rawBatches}
                    onSaved={(updated) => { setRawBatches(updated); setRawEditOpen(false); }}
                    onClose={() => setRawEditOpen(false)}
                />
            )}
        </div>
    );
}
