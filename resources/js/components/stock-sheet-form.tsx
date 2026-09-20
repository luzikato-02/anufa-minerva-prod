import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type RowDraft, RowFieldsForm, draftFrom, emptyDraft, readDraft } from '@/components/stock-sheet-row-fields';
import { type SharedData } from '@/types';
import { type SheetRow, formatNumber, newUuid, stockSheetApi } from '@/lib/stock-sheets';
import { usePage } from '@inertiajs/react';
import { CheckIcon, FilePlusIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'stock-sheet-active';

interface ActiveSheet {
    uuid: string;
    date: string;
    leader: string;
    rows: SheetRow[];
}

const today = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd in local time

function load(leader: string): ActiveSheet {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw) as ActiveSheet;
    } catch {
        // fall through to a new sheet
    }
    return { uuid: newUuid(), date: today(), leader, rows: [] };
}

/** Record the paper stock sheet, one row at a time. Every row is saved as it is added. */
export default function StockSheetForm() {
    const { auth } = usePage<SharedData>().props;
    const [sheet, setSheet] = useState<ActiveSheet>(() => load(auth.user.name));
    const [draft, setDraft] = useState<RowDraft>(emptyDraft);
    const [editing, setEditing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState<'new' | 'delete' | null>(null);

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet));
        } catch {
            // storage full or blocked: the rows are still saved on the server
        }
    }, [sheet]);

    const recent = (pick: (r: SheetRow) => string | null) => {
        const seen: string[] = [];
        for (const r of [...sheet.rows].reverse()) {
            const v = pick(r);
            if (v && !seen.includes(v)) seen.push(v);
            if (seen.length === 4) break;
        }
        return seen;
    };
    const totals = useMemo(() => ({ chs: sheet.rows.reduce((a, r) => a + (r.chs ?? 0), 0), kg: sheet.rows.reduce((a, r) => a + (r.actual_weight ?? 0), 0) }), [sheet.rows]);

    const reset = (keep?: RowDraft) => {
        setEditing(null);
        setError(null);
        // Position and remark stay: rows in a run usually share a rack.
        setDraft(keep ? { ...emptyDraft, position: keep.position, remark: keep.remark } : emptyDraft);
    };

    const submit = async () => {
        const read = readDraft(draft);
        if ('error' in read) return setError(read.error);
        setBusy(true);
        setError(null);
        try {
            if (editing) {
                await stockSheetApi.updateRow(editing, read.fields);
                setSheet((s) => ({ ...s, rows: s.rows.map((r) => (r.client_uuid === editing ? { ...r, ...read.fields } : r)) }));
                reset();
            } else {
                const row: SheetRow = { client_uuid: newUuid(), ...read.fields };
                await stockSheetApi.addRow(sheet, row);
                setSheet((s) => ({ ...s, rows: [...s.rows, row] }));
                reset(draft);
            }
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const removeEditing = async () => {
        if (!editing) return;
        setBusy(true);
        try {
            await stockSheetApi.deleteRow(editing);
            setSheet((s) => ({ ...s, rows: s.rows.filter((r) => r.client_uuid !== editing) }));
            reset();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
            setConfirm(null);
        }
    };

    const startNew = () => {
        setSheet({ uuid: newUuid(), date: today(), leader: auth.user.name, rows: [] });
        reset();
        setConfirm(null);
    };

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
            <Card>
                <CardHeader>
                    <CardTitle>Stock sheet</CardTitle>
                    <CardDescription>Recorded by {sheet.leader}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="sheet-date">Sheet date</Label>
                        <Input id="sheet-date" type="date" value={sheet.date} onChange={(e) => setSheet({ ...sheet, date: e.target.value || today() })} className="w-44" />
                    </div>
                    <Button variant="outline" onClick={() => (sheet.rows.length > 0 ? setConfirm('new') : startNew())}>
                        <FilePlusIcon /> Start new sheet
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{editing ? `Edit row ${sheet.rows.findIndex((r) => r.client_uuid === editing) + 1}` : `Add row ${sheet.rows.length + 1}`}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <RowFieldsForm draft={draft} onChange={setDraft} recentColors={recent((r) => r.color)} recentRemarks={recent((r) => r.remark)} idPrefix="add" />
                    <div className="flex flex-wrap gap-2">
                        <Button onClick={submit} disabled={busy}>
                            {editing ? <CheckIcon /> : <PlusIcon />} {busy ? 'Saving…' : editing ? 'Save changes' : 'Add row'}
                        </Button>
                        {editing && (
                            <>
                                <Button variant="outline" onClick={() => reset()} disabled={busy}>
                                    Cancel
                                </Button>
                                <Button variant="destructive" onClick={() => setConfirm('delete')} disabled={busy}>
                                    <Trash2Icon /> Delete row
                                </Button>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Rows</CardTitle>
                    <CardDescription>
                        {sheet.rows.length === 0 ? 'Rows you add appear here.' : `${sheet.rows.length} ${sheet.rows.length === 1 ? 'row' : 'rows'} · ${formatNumber(totals.chs)} cheeses · ${formatNumber(totals.kg)} kg`}
                    </CardDescription>
                </CardHeader>
                {sheet.rows.length > 0 && (
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-12">No</TableHead>
                                    <TableHead>Colour</TableHead>
                                    <TableHead>Material</TableHead>
                                    <TableHead>Batch</TableHead>
                                    <TableHead>Prod date</TableHead>
                                    <TableHead className="text-right">Chs</TableHead>
                                    <TableHead className="text-right">Weight (kg)</TableHead>
                                    <TableHead className="text-right">Position</TableHead>
                                    <TableHead>Remark</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {sheet.rows.map((r, i) => (
                                    <TableRow key={r.client_uuid} data-state={editing === r.client_uuid ? 'selected' : undefined} className="cursor-pointer" onClick={() => { setEditing(r.client_uuid); setError(null); setDraft(draftFrom(r)); }}>
                                        <TableCell>{i + 1}</TableCell>
                                        <TableCell>{r.color ?? '—'}</TableCell>
                                        <TableCell>{r.material_code}</TableCell>
                                        <TableCell>{r.batch}</TableCell>
                                        <TableCell>{r.prod_date ?? '—'}</TableCell>
                                        <TableCell className="text-right">{formatNumber(r.chs)}</TableCell>
                                        <TableCell className="text-right">{formatNumber(r.actual_weight)}</TableCell>
                                        <TableCell className="text-right">{r.position ?? '—'}</TableCell>
                                        <TableCell>{r.remark ?? '—'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                )}
            </Card>

            <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{confirm === 'new' ? 'Start a new sheet?' : 'Delete this row?'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirm === 'new' ? `The ${sheet.rows.length} rows on this sheet are already saved. You will begin an empty sheet.` : 'It will be removed from the sheet.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirm === 'new' ? startNew : removeEditing}>{confirm === 'new' ? 'Start new sheet' : 'Delete row'}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
