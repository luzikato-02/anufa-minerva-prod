import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type CreelType, creelTypeApi, formatNumber, inRange } from '@/lib/creel-types';
import {
    TORQUE_COLUMNS,
    TORQUE_MAX_ROW,
    TORQUE_SIDES,
    loadActiveTorqueSheet,
    newUuid,
    saveActiveTorqueSheet,
    torqueCheckApi,
    torquePosition,
    type TorqueActiveSheet,
    type TorqueColumn,
    type TorqueSide,
} from '@/lib/torque-checks';
import { torqueCheckSession } from '@/routes';
import { router } from '@inertiajs/react';
import { ArrowLeftRightIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

const TOTAL_CELLS = TORQUE_SIDES.length * TORQUE_MAX_ROW * TORQUE_COLUMNS.length;

/** Record a torque check: the paper form's header, then one grid cell at a time — same flow as the mobile app.
 *  Side is a grid axis (like row and column), not a header field: one sheet holds a separate 105x5 grid per side.
 *  Starting or resuming a sheet happens on a separate page (torque-check-session); this screen always assumes
 *  one is already active, and bounces back there if it finds nothing to work with (e.g. a direct/first visit). */
export default function TorqueCheckGrid() {
    const [sheet, setSheet] = useState<TorqueActiveSheet | null>(() => loadActiveTorqueSheet());
    const [types, setTypes] = useState<CreelType[]>([]);
    const [typesError, setTypesError] = useState<string | null>(null);

    const [side, setSide] = useState<TorqueSide>('Ai');
    const [row, setRow] = useState(1);
    const [col, setCol] = useState<TorqueColumn>('A');
    const [digits, setDigits] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!sheet) router.visit(torqueCheckSession());
    }, [sheet]);

    useEffect(() => {
        creelTypeApi.list().then(setTypes).catch((e) => setTypesError((e as Error).message));
    }, []);

    useEffect(() => {
        if (sheet) saveActiveTorqueSheet(sheet);
    }, [sheet]);

    // A sheet started offline has no session id until the server has actually seen it. Best-effort: look it up
    // by its own uuid (the endpoint also matches on that), so the id appears once connectivity allows the
    // first cell through — even if that happened via a background retry rather than the save that's on screen.
    useEffect(() => {
        if (!sheet || sheet.sessionId || Object.keys(sheet.readings).length === 0) return;
        let cancelled = false;
        torqueCheckApi
            .getSession(sheet.uuid)
            .then(({ session_id }) => {
                if (!cancelled && session_id) setSheet((s) => (s && !s.sessionId ? { ...s, sessionId: session_id } : s));
            })
            .catch(() => {
                // Offline, or the first cell hasn't reached the server yet — fine, try again next time.
            });
        return () => {
            cancelled = true;
        };
    }, [sheet]);

    const creelType = types.find((t) => t.id === sheet?.creelTypeId) ?? null;
    const filledCount = sheet ? Object.keys(sheet.readings).length : 0;
    const pos = torquePosition(side, row, col);
    const value = digits.trim() === '' ? null : Number(digits);
    const outOfRange = creelType !== null && value !== null && Number.isFinite(value) && !inRange(creelType, value);

    const goTo = (nextSide: TorqueSide, nextRow: number, nextCol: TorqueColumn) => {
        setSide(nextSide);
        setRow(nextRow);
        setCol(nextCol);
        const existing = sheet?.readings[torquePosition(nextSide, nextRow, nextCol)];
        setDigits(existing ? String(existing.value) : '');
        setNote(existing?.note ?? '');
        setError(null);
    };

    const step = (delta: number) => {
        const n = (Number(digits) || 0) + delta;
        if (n < 0) return;
        setDigits(String(n));
    };

    const save = async () => {
        if (!sheet) return;
        if (value === null || !Number.isFinite(value) || value < 0) return setError('Enter a reading.');
        if (outOfRange && !note.trim()) return setError(`This reading is outside ${creelType?.name}'s range (${formatNumber(creelType?.torque_min)}–${formatNumber(creelType?.torque_max)}). Add a note before saving.`);

        const clientUuid = sheet.readings[pos]?.clientUuid ?? newUuid();
        setBusy(true);
        setError(null);
        try {
            await torqueCheckApi.submitReading(
                { uuid: sheet.uuid, sessionId: sheet.sessionId, checkDate: sheet.checkDate, operatorName: sheet.operatorName, machineNumber: sheet.machineNumber, creelTypeId: sheet.creelTypeId! },
                { side, row_no: row, column_letter: col, value, note: note.trim() || null },
                clientUuid,
            );
            setSheet((s) => (s ? { ...s, readings: { ...s.readings, [pos]: { clientUuid, value, note: note.trim() } } } : s));
            // Move on to the next cell so the operator can keep going without retyping the position.
            const colIndex = TORQUE_COLUMNS.indexOf(col);
            if (colIndex < TORQUE_COLUMNS.length - 1) {
                goTo(side, row, TORQUE_COLUMNS[colIndex + 1]);
            } else if (row < TORQUE_MAX_ROW) {
                goTo(side, row + 1, TORQUE_COLUMNS[0]);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    if (!sheet) return null; // redirecting to the session page

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
            <Card>
                <CardHeader>
                    <CardTitle>Torque check</CardTitle>
                    <CardDescription>{[sheet.sessionId && `Session ${sheet.sessionId}`, sheet.operatorName, `${filledCount} of ${TOTAL_CELLS} cells filled`].filter(Boolean).join(' · ')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {typesError && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{typesError}</AlertDescription>
                        </Alert>
                    )}
                    <Button variant="outline" size="sm" onClick={() => router.visit(torqueCheckSession())}>
                        <ArrowLeftRightIcon /> Change session
                    </Button>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="tc-date">Date</Label>
                            <Input id="tc-date" type="date" value={sheet.checkDate} onChange={(e) => setSheet((s) => (s ? { ...s, checkDate: e.target.value || s.checkDate } : s))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tc-machine">Machine number</Label>
                            <Input id="tc-machine" value={sheet.machineNumber} onChange={(e) => setSheet((s) => (s ? { ...s, machineNumber: e.target.value } : s))} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="tc-type">Creel type</Label>
                            <Select value={sheet.creelTypeId?.toString() ?? ''} onValueChange={(v) => setSheet((s) => (s ? { ...s, creelTypeId: Number(v) } : s))}>
                                <SelectTrigger id="tc-type">
                                    <SelectValue placeholder="Select a creel type…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {types.map((t) => (
                                        <SelectItem key={t.id} value={t.id.toString()}>
                                            {t.name} ({t.torque_min}–{t.torque_max})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {!sheet.creelTypeId ? (
                <Alert>
                    <AlertDescription>Select a creel type above to start recording readings.</AlertDescription>
                </Alert>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Side {side}, row {row}, column {col}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {error && (
                            <Alert variant="destructive" role="alert">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <ToggleGroup type="single" variant="outline" value={side} onValueChange={(v) => v && goTo(v as TorqueSide, row, col)} className="w-full">
                            {TORQUE_SIDES.map((s) => {
                                const filled = Object.keys(sheet.readings).some((k) => k.startsWith(`${s}-`));
                                return (
                                    <ToggleGroupItem key={s} value={s} className="flex-1 gap-1">
                                        {s}
                                        {filled && <CheckIcon className="size-3" />}
                                    </ToggleGroupItem>
                                );
                            })}
                        </ToggleGroup>
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">Row</span>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" aria-label="Previous row" disabled={row <= 1} onClick={() => goTo(side, row - 1, col)}>
                                    <ChevronLeftIcon />
                                </Button>
                                <Input
                                    aria-label="Row number"
                                    type="number"
                                    min={1}
                                    max={TORQUE_MAX_ROW}
                                    className="w-20 text-center"
                                    value={row}
                                    onChange={(e) => {
                                        const n = Number(e.target.value);
                                        if (Number.isInteger(n) && n >= 1 && n <= TORQUE_MAX_ROW) goTo(side, n, col);
                                    }}
                                />
                                <Button variant="outline" size="icon" aria-label="Next row" disabled={row >= TORQUE_MAX_ROW} onClick={() => goTo(side, row + 1, col)}>
                                    <ChevronRightIcon />
                                </Button>
                            </div>
                        </div>
                        <ToggleGroup type="single" variant="outline" value={col} onValueChange={(v) => v && goTo(side, row, v as TorqueColumn)} className="w-full">
                            {TORQUE_COLUMNS.map((c) => {
                                const filled = torquePosition(side, row, c) in sheet.readings;
                                return (
                                    <ToggleGroupItem key={c} value={c} className="flex-1 gap-1">
                                        {c}
                                        {filled && <CheckIcon className="size-3" />}
                                    </ToggleGroupItem>
                                );
                            })}
                        </ToggleGroup>
                        <div className={`flex flex-col items-center gap-1 rounded-lg border-2 py-4 ${outOfRange ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20 bg-primary/5'}`}>
                            <span className={`text-xs font-medium ${outOfRange ? 'text-destructive' : 'text-primary'}`}>Reading</span>
                            <Input
                                aria-label="Reading"
                                inputMode="decimal"
                                className={`h-12 w-32 border-none bg-transparent text-center text-2xl font-bold shadow-none focus-visible:ring-0 ${outOfRange ? 'text-destructive' : 'text-primary'}`}
                                value={digits}
                                onChange={(e) => {
                                    setDigits(e.target.value);
                                    setError(null);
                                }}
                            />
                            {creelType && <span className="text-xs text-muted-foreground">Range {formatNumber(creelType.torque_min)}–{formatNumber(creelType.torque_max)}</span>}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" className="flex-1" onClick={() => step(-0.5)}>
                                -0.5
                            </Button>
                            <Button variant="outline" className="flex-1" onClick={() => step(0.5)}>
                                +0.5
                            </Button>
                        </div>
                        {outOfRange && (
                            <div className="space-y-1.5">
                                <Label htmlFor="tc-note">Note (required — this reading is out of range)</Label>
                                <Input id="tc-note" placeholder="e.g. Felt worn/dirty, replaced with new" value={note} onChange={(e) => setNote(e.target.value)} />
                            </div>
                        )}
                        <Button className="w-full" onClick={() => void save()} disabled={busy}>
                            <CheckIcon /> {busy ? 'Saving…' : 'Save cell'}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
