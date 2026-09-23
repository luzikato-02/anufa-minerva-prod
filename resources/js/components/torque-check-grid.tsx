import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { type CreelType, creelTypeApi, formatNumber, inRange } from '@/lib/creel-types';
import { TORQUE_COLUMNS, TORQUE_MAX_ROW, TORQUE_SIDES, type TorqueColumn, type TorqueSide, newUuid, torqueCheckApi } from '@/lib/torque-checks';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, FilePlusIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'torque-check-active';

interface Reading {
    clientUuid: string;
    value: number;
    note: string;
}

interface ActiveSheet {
    uuid: string;
    sessionId: string | null;
    checkDate: string;
    operatorName: string;
    machineNumber: string;
    side: TorqueSide;
    creelTypeId: number | null;
    readings: Record<string, Reading>;
}

const today = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd in local time
const position = (row: number, col: TorqueColumn) => `${row}${col}`;

function freshSheet(operatorName: string): ActiveSheet {
    return { uuid: newUuid(), sessionId: null, checkDate: today(), operatorName, machineNumber: '', side: 'Ai', creelTypeId: null, readings: {} };
}

function load(operatorName: string): ActiveSheet {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as ActiveSheet;
    } catch {
        // fall through to a new sheet
    }
    return freshSheet(operatorName);
}

/** Record a torque check: the paper form's header, then one grid cell at a time — same flow as the mobile app. */
export default function TorqueCheckGrid() {
    const { auth } = usePage<SharedData>().props;
    const [sheet, setSheet] = useState<ActiveSheet>(() => load(auth.user.name));
    const [types, setTypes] = useState<CreelType[]>([]);
    const [typesError, setTypesError] = useState<string | null>(null);
    const [confirmNew, setConfirmNew] = useState(false);

    const [row, setRow] = useState(1);
    const [col, setCol] = useState<TorqueColumn>('A');
    const [digits, setDigits] = useState('');
    const [note, setNote] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sessionInput, setSessionInput] = useState('');
    const [sessionError, setSessionError] = useState<string | null>(null);
    const [loadingSession, setLoadingSession] = useState(false);

    useEffect(() => {
        creelTypeApi.list().then(setTypes).catch((e) => setTypesError((e as Error).message));
    }, []);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet));
        } catch {
            // storage full or blocked: readings are still saved on the server
        }
    }, [sheet]);

    // A sheet started offline has no session id until the server has actually seen it. Best-effort: look it up
    // by its own uuid (the endpoint also matches on that), so the id appears once connectivity allows the
    // first cell through — even if that happened via a background retry rather than the save that's on screen.
    useEffect(() => {
        if (sheet.sessionId || Object.keys(sheet.readings).length === 0) return;
        let cancelled = false;
        torqueCheckApi
            .getSession(sheet.uuid)
            .then(({ session_id }) => {
                if (!cancelled && session_id) setSheet((s) => (s.sessionId ? s : { ...s, sessionId: session_id }));
            })
            .catch(() => {
                // Offline, or the first cell hasn't reached the server yet — fine, try again next time.
            });
        return () => {
            cancelled = true;
        };
    }, [sheet.uuid, sheet.sessionId, sheet.readings]);

    const creelType = types.find((t) => t.id === sheet.creelTypeId) ?? null;
    const filledCount = Object.keys(sheet.readings).length;
    const pos = position(row, col);
    const value = digits.trim() === '' ? null : Number(digits);
    const outOfRange = creelType !== null && value !== null && Number.isFinite(value) && !inRange(creelType, value);

    const goTo = (nextRow: number, nextCol: TorqueColumn) => {
        setRow(nextRow);
        setCol(nextCol);
        const existing = sheet.readings[position(nextRow, nextCol)];
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
        if (value === null || !Number.isFinite(value) || value < 0) return setError('Enter a reading.');
        if ((value * 2) % 1 !== 0) return setError('Reading must be in steps of 0.5.');
        if (outOfRange && !note.trim()) return setError(`This reading is outside ${creelType?.name}'s range (${formatNumber(creelType?.torque_min)}–${formatNumber(creelType?.torque_max)}). Add a note before saving.`);

        const clientUuid = sheet.readings[pos]?.clientUuid ?? newUuid();
        setBusy(true);
        setError(null);
        try {
            await torqueCheckApi.submitReading(
                { uuid: sheet.uuid, sessionId: sheet.sessionId, checkDate: sheet.checkDate, operatorName: sheet.operatorName, machineNumber: sheet.machineNumber, side: sheet.side, creelTypeId: sheet.creelTypeId! },
                { row_no: row, column_letter: col, value, note: note.trim() || null },
                clientUuid,
            );
            setSheet((s) => ({ ...s, readings: { ...s.readings, [pos]: { clientUuid, value, note: note.trim() } } }));
            // Move on to the next cell so the operator can keep going without retyping the position.
            const colIndex = TORQUE_COLUMNS.indexOf(col);
            if (colIndex < TORQUE_COLUMNS.length - 1) {
                goTo(row, TORQUE_COLUMNS[colIndex + 1]);
            } else if (row < TORQUE_MAX_ROW) {
                goTo(row + 1, TORQUE_COLUMNS[0]);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const startNew = () => {
        setSheet(freshSheet(auth.user.name));
        goTo(1, 'A');
        setConfirmNew(false);
    };

    const loadSession = async () => {
        const id = sessionInput.trim();
        if (!id) return setSessionError('Enter a session ID.');
        setLoadingSession(true);
        setSessionError(null);
        try {
            const s = await torqueCheckApi.getSession(id);
            setSheet({
                uuid: newUuid(),
                sessionId: s.session_id,
                checkDate: s.check_date.slice(0, 10),
                operatorName: s.operator_name,
                machineNumber: s.machine_number,
                side: s.side,
                creelTypeId: s.creel_type_id,
                readings: Object.fromEntries(s.readings.map((r) => [position(r.row_no, r.column_letter), { clientUuid: String(r.id), value: r.value, note: r.note ?? '' }])),
            });
            goTo(1, 'A');
        } catch (e) {
            setSessionError((e as Error).message === 'Session not found' ? `Session "${id}" was not found.` : (e as Error).message);
        } finally {
            setLoadingSession(false);
        }
    };

    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4">
            {!sheet.sessionId && (
                <Card>
                    <CardHeader>
                        <CardTitle>Resume a session</CardTitle>
                        <CardDescription>Have a session ID from another device? Enter it to keep recording into that sheet.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {sessionError && (
                            <Alert variant="destructive" role="alert">
                                <AlertDescription>{sessionError}</AlertDescription>
                            </Alert>
                        )}
                        <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-1.5">
                                <Label htmlFor="tc-session">Session ID</Label>
                                <Input id="tc-session" placeholder="e.g. 483920" value={sessionInput} onChange={(e) => setSessionInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void loadSession()} />
                            </div>
                            <Button onClick={() => void loadSession()} disabled={loadingSession}>
                                {loadingSession ? 'Loading…' : 'Load'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
            <Card>
                <CardHeader>
                    <CardTitle>Torque check</CardTitle>
                    <CardDescription>
                        {[sheet.sessionId && `Session ${sheet.sessionId}`, sheet.operatorName, `${filledCount} of ${TORQUE_MAX_ROW * TORQUE_COLUMNS.length} cells filled`].filter(Boolean).join(' · ')}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {typesError && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{typesError}</AlertDescription>
                        </Alert>
                    )}
                    <Button variant="outline" size="sm" onClick={() => (filledCount > 0 ? setConfirmNew(true) : startNew())}>
                        <FilePlusIcon /> Start new sheet
                    </Button>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="tc-date">Date</Label>
                            <Input id="tc-date" type="date" value={sheet.checkDate} onChange={(e) => setSheet((s) => ({ ...s, checkDate: e.target.value || today() }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tc-machine">Machine number</Label>
                            <Input id="tc-machine" value={sheet.machineNumber} onChange={(e) => setSheet((s) => ({ ...s, machineNumber: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tc-side">Side</Label>
                            <Select value={sheet.side} onValueChange={(v) => setSheet((s) => ({ ...s, side: v as TorqueSide }))}>
                                <SelectTrigger id="tc-side">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TORQUE_SIDES.map((side) => (
                                        <SelectItem key={side} value={side}>
                                            {side}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="tc-type">Creel type</Label>
                            <Select value={sheet.creelTypeId?.toString() ?? ''} onValueChange={(v) => setSheet((s) => ({ ...s, creelTypeId: Number(v) }))}>
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
                            Row {row}, column {col}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {error && (
                            <Alert variant="destructive" role="alert">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">Row</span>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="icon" aria-label="Previous row" disabled={row <= 1} onClick={() => goTo(row - 1, col)}>
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
                                        if (Number.isInteger(n) && n >= 1 && n <= TORQUE_MAX_ROW) goTo(n, col);
                                    }}
                                />
                                <Button variant="outline" size="icon" aria-label="Next row" disabled={row >= TORQUE_MAX_ROW} onClick={() => goTo(row + 1, col)}>
                                    <ChevronRightIcon />
                                </Button>
                            </div>
                        </div>
                        <ToggleGroup type="single" variant="outline" value={col} onValueChange={(v) => v && goTo(row, v as TorqueColumn)} className="w-full">
                            {TORQUE_COLUMNS.map((c) => {
                                const filled = position(row, c) in sheet.readings;
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

            <AlertDialog open={confirmNew} onOpenChange={setConfirmNew}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Start a new sheet?</AlertDialogTitle>
                        <AlertDialogDescription>The {filledCount} readings on this sheet are already saved. You will begin an empty sheet.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={startNew}>Start new sheet</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
