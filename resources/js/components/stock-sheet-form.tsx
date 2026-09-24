import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type RowDraft, RowFieldsForm, draftFrom, emptyDraft, readDraft } from '@/components/stock-sheet-row-fields';
import {
    type SheetRow,
    type StockSheetActiveSheet,
    formatNumber,
    loadActiveStockSheet,
    newUuid,
    saveActiveStockSheet,
    stockSheetApi,
    stockSheetToday,
} from '@/lib/stock-sheets';
import { stockSheetSession } from '@/routes';
import { router } from '@inertiajs/react';
import { ArrowLeftRightIcon, CheckIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

/** Record the paper stock sheet, one row at a time. Starting or resuming a sheet happens on a separate page
 *  (stock-sheet-session); this screen always assumes one is already active, and bounces back there if it
 *  finds nothing to work with (e.g. a direct/first visit). Every row is saved on the server as it is added. */
export default function StockSheetForm() {
    const [sheet, setSheet] = useState<StockSheetActiveSheet | null>(() => loadActiveStockSheet());
    const [draft, setDraft] = useState<RowDraft>(emptyDraft);
    const [editing, setEditing] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        if (!sheet) router.visit(stockSheetSession());
    }, [sheet]);

    useEffect(() => {
        if (sheet) saveActiveStockSheet(sheet);
    }, [sheet]);

    // A sheet started offline has no session id until the server has actually seen it. Best-effort: look it up
    // by its own uuid (the endpoint also matches on that), so the id appears once connectivity allows the
    // first row through — even if that happened via a background retry rather than the save that's on screen.
    useEffect(() => {
        if (!sheet || sheet.sessionId || sheet.rows.length === 0) return;
        let cancelled = false;
        stockSheetApi
            .getSession(sheet.uuid)
            .then(({ session_id }) => {
                if (!cancelled && session_id) setSheet((s) => (s && !s.sessionId ? { ...s, sessionId: session_id } : s));
            })
            .catch(() => {
                // Offline, or the first row hasn't reached the server yet — fine, try again next time.
            });
        return () => {
            cancelled = true;
        };
    }, [sheet]);

    const recent = (pick: (r: SheetRow) => string | null) => {
        const seen: string[] = [];
        for (const r of [...(sheet?.rows ?? [])].reverse()) {
            const v = pick(r);
            if (v && !seen.includes(v)) seen.push(v);
            if (seen.length === 4) break;
        }
        return seen;
    };
    const totals = useMemo(() => ({ chs: (sheet?.rows ?? []).reduce((a, r) => a + (r.chs ?? 0), 0), kg: (sheet?.rows ?? []).reduce((a, r) => a + (r.actual_weight ?? 0), 0) }), [sheet]);

    const reset = (keep?: RowDraft) => {
        setEditing(null);
        setError(null);
        // Position and remark stay: rows in a run usually share a rack.
        setDraft(keep ? { ...emptyDraft, position: keep.position, remark: keep.remark } : emptyDraft);
    };

    const submit = async () => {
        if (!sheet) return;
        const read = readDraft(draft);
        if ('error' in read) return setError(read.error);
        setBusy(true);
        setError(null);
        try {
            if (editing) {
                await stockSheetApi.updateRow(editing, read.fields);
                setSheet((s) => (s ? { ...s, rows: s.rows.map((r) => (r.client_uuid === editing ? { ...r, ...read.fields } : r)) } : s));
                reset();
            } else {
                const row: SheetRow = { client_uuid: newUuid(), ...read.fields };
                await stockSheetApi.addRow(sheet, row);
                setSheet((s) => (s ? { ...s, rows: [...s.rows, row] } : s));
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
            setSheet((s) => (s ? { ...s, rows: s.rows.filter((r) => r.client_uuid !== editing) } : s));
            reset();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
            setConfirmDelete(false);
        }
    };

    if (!sheet) return null; // redirecting to the session page

    return (
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
            <Card>
                <CardHeader>
                    <CardTitle>Stock sheet</CardTitle>
                    <CardDescription>{[sheet.sessionId && `Session ${sheet.sessionId}`, `Recorded by ${sheet.leader}`].filter(Boolean).join(' · ')}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap items-end gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="sheet-date">Sheet date</Label>
                        <Input id="sheet-date" type="date" value={sheet.date} onChange={(e) => setSheet((s) => (s ? { ...s, date: e.target.value || stockSheetToday() } : s))} className="w-44" />
                    </div>
                    <Button variant="outline" onClick={() => router.visit(stockSheetSession())}>
                        <ArrowLeftRightIcon /> Change session
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
                                <Button variant="destructive" onClick={() => setConfirmDelete(true)} disabled={busy}>
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

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this row?</AlertDialogTitle>
                        <AlertDialogDescription>It will be removed from the sheet.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void removeEditing()}>Delete row</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
