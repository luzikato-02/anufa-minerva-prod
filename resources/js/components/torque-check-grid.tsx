import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { type CellReading, TorqueCell } from '@/components/torque-check-cell';
import { type CreelType, creelTypeApi } from '@/lib/creel-types';
import { TORQUE_COLUMNS, TORQUE_MAX_ROW, TORQUE_SIDES, type TorqueColumn, type TorqueSide, newUuid, torqueCheckApi } from '@/lib/torque-checks';
import { type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { FilePlusIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'torque-check-active';

interface ActiveSheet {
    uuid: string;
    checkDate: string;
    operatorName: string;
    machineNumber: string;
    side: TorqueSide;
    creelTypeId: number | null;
    readings: Record<string, CellReading>;
}

const today = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd in local time

function load(operatorName: string): ActiveSheet {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as ActiveSheet;
    } catch {
        // fall through to a new sheet
    }
    return { uuid: newUuid(), checkDate: today(), operatorName, machineNumber: '', side: 'Ai', creelTypeId: null, readings: {} };
}

function parsePosition(position: string): { rowNo: number; columnLetter: TorqueColumn } {
    return { rowNo: Number(position.slice(0, -1)), columnLetter: position.slice(-1) as TorqueColumn };
}

/** Record a torque check: the paper form's header, and its 105x5 grid, saved cell by cell as they are typed. */
export default function TorqueCheckGrid() {
    const { auth } = usePage<SharedData>().props;
    const [sheet, setSheet] = useState<ActiveSheet>(() => load(auth.user.name));
    const [types, setTypes] = useState<CreelType[]>([]);
    const [typesError, setTypesError] = useState<string | null>(null);
    const [confirmNew, setConfirmNew] = useState(false);

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

    const creelType = types.find((t) => t.id === sheet.creelTypeId) ?? null;
    const filledCount = Object.keys(sheet.readings).length;

    const setReading = (position: string, patch: Partial<CellReading>) =>
        setSheet((s) => ({ ...s, readings: { ...s.readings, [position]: { ...(s.readings[position] ?? { clientUuid: newUuid(), value: '', note: '', savingValue: false }), ...patch } } }));

    const submit = async (position: string, value: string, note: string) => {
        const { rowNo, columnLetter } = parsePosition(position);
        const n = Number(value.trim().replace(',', '.'));
        if (value.trim() === '' || !Number.isFinite(n) || n < 0) return setReading(position, { value, error: 'Enter a reading.' });
        if ((n * 2) % 1 !== 0) return setReading(position, { value, error: 'Must be in steps of 0.5.' });

        const clientUuid = sheet.readings[position]?.clientUuid ?? newUuid();
        setReading(position, { value, note, clientUuid, savingValue: true, error: undefined });
        try {
            await torqueCheckApi.submitReading(
                { uuid: sheet.uuid, checkDate: sheet.checkDate, operatorName: sheet.operatorName, machineNumber: sheet.machineNumber, side: sheet.side, creelTypeId: sheet.creelTypeId! },
                { row_no: rowNo, column_letter: columnLetter, value: n, note: note.trim() || null },
                clientUuid,
            );
            setReading(position, { savingValue: false });
        } catch (e) {
            setReading(position, { savingValue: false, error: (e as Error).message });
        }
    };

    const rows = useMemo(() => Array.from({ length: TORQUE_MAX_ROW }, (_, i) => i + 1), []);

    const startNew = () => {
        setSheet({ uuid: newUuid(), checkDate: today(), operatorName: auth.user.name, machineNumber: '', side: 'Ai', creelTypeId: null, readings: {} });
        setConfirmNew(false);
    };

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
            <Card>
                <CardHeader>
                    <CardTitle>Torque check</CardTitle>
                    <CardDescription>
                        {sheet.operatorName} · {filledCount} of {TORQUE_MAX_ROW * TORQUE_COLUMNS.length} cells filled
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {typesError && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{typesError}</AlertDescription>
                        </Alert>
                    )}
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    <Button variant="outline" size="sm" onClick={() => (filledCount > 0 ? setConfirmNew(true) : startNew())}>
                        <FilePlusIcon /> Start new sheet
                    </Button>
                </CardContent>
            </Card>

            {!sheet.creelTypeId ? (
                <Alert>
                    <AlertDescription>Select a creel type above to start recording readings.</AlertDescription>
                </Alert>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>Readings</CardTitle>
                        <CardDescription>Tab through the grid like the paper form. A reading outside {creelType?.name}&apos;s range ({creelType?.torque_min}–{creelType?.torque_max}) turns red and asks for a note.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="overflow-x-auto">
                            <table className="border-separate border-spacing-1">
                                <thead>
                                    <tr>
                                        <th className="w-10 text-left text-xs font-medium text-muted-foreground">NO</th>
                                        {TORQUE_COLUMNS.map((c) => (
                                            <th key={c} className="text-xs font-medium text-muted-foreground">
                                                {c}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row) => (
                                        <tr key={row}>
                                            <td className="text-xs text-muted-foreground">{row}</td>
                                            {TORQUE_COLUMNS.map((col) => {
                                                const position = `${row}${col}`;
                                                return (
                                                    <td key={col}>
                                                        <TorqueCell
                                                            position={position}
                                                            reading={sheet.readings[position]}
                                                            creelType={creelType}
                                                            onValueBlur={(pos, value) => submit(pos, value, sheet.readings[pos]?.note ?? '')}
                                                            onNoteBlur={(pos, note) => submit(pos, sheet.readings[pos]?.value ?? '', note)}
                                                        />
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
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
