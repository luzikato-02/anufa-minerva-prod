import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePermissions } from '@/lib/permissions';
import { TORQUE_COLUMNS, TORQUE_MAX_ROW, TORQUE_SIDES, type TorqueCheckDetail, type TorqueCheckSummary, type TorqueSide, torqueCheckApi } from '@/lib/torque-checks';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 10;
const TOTAL_CELLS = TORQUE_SIDES.length * TORQUE_MAX_ROW * TORQUE_COLUMNS.length;
const day = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

function saveCsv(filename: string, csv: string) {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

const csvCell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function TorqueChecksTable() {
    const [search, setSearch] = useState('');
    const [debounced, setDebounced] = useState('');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<TorqueCheckSummary[]>([]);
    const [lastPage, setLastPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [openId, setOpenId] = useState<number | null>(null);

    useEffect(() => {
        const t = setTimeout(() => {
            setDebounced(search);
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const reload = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({ page: String(page), per_page: String(PAGE_SIZE) });
            if (debounced) params.set('search', debounced);
            const json = await torqueCheckApi.list(params);
            setRows(json.data);
            setLastPage(json.last_page);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }, [page, debounced]);

    useEffect(() => {
        void reload();
    }, [reload]);

    return (
        <div className="space-y-4">
            <Input aria-label="Search torque checks" placeholder="Search session, operator or machine number" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            {error && (
                <Alert variant="destructive" role="alert">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Session</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Operator</TableHead>
                            <TableHead>Machine</TableHead>
                            <TableHead>Sides</TableHead>
                            <TableHead>Creel type</TableHead>
                            <TableHead className="text-right">Filled</TableHead>
                            <TableHead className="text-right">Out of range</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                                    {loading ? 'Loading…' : 'No torque checks yet.'}
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((s) => (
                                <TableRow key={s.id} className="cursor-pointer" tabIndex={0} onClick={() => setOpenId(s.id)} onKeyDown={(e) => e.key === 'Enter' && setOpenId(s.id)}>
                                    <TableCell className="font-mono text-sm">{s.session_id ?? '—'}</TableCell>
                                    <TableCell className="font-medium">{day(s.check_date)}</TableCell>
                                    <TableCell>{s.operator_name}</TableCell>
                                    <TableCell>{s.machine_number}</TableCell>
                                    <TableCell>{s.sides_recorded.join(', ') || '—'}</TableCell>
                                    <TableCell>{s.creel_type?.name ?? '—'}</TableCell>
                                    <TableCell className="text-right">
                                        {s.readings_count}/{TOTAL_CELLS}
                                    </TableCell>
                                    <TableCell className="text-right">{s.out_of_range_count > 0 ? <Badge variant="destructive">{s.out_of_range_count}</Badge> : '—'}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-muted-foreground">
                    Page {page} of {lastPage}
                </span>
                <Button variant="outline" size="icon" aria-label="Previous page" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeftIcon />
                </Button>
                <Button variant="outline" size="icon" aria-label="Next page" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRightIcon />
                </Button>
            </div>
            {openId !== null && <SheetDialog id={openId} onClose={() => setOpenId(null)} onChanged={() => void reload()} />}
        </div>
    );
}

function SheetDialog({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
    const { can } = usePermissions();
    const [sheet, setSheet] = useState<TorqueCheckDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [side, setSide] = useState<TorqueSide | null>(null);

    useEffect(() => {
        torqueCheckApi
            .show(id)
            .then((s) => {
                setSheet(s);
                setSide(TORQUE_SIDES.find((side) => s.readings.some((r) => r.side === side)) ?? null);
            })
            .catch((e) => setError((e as Error).message));
    }, [id]);

    const recordedSides = useMemo(() => TORQUE_SIDES.filter((s) => (sheet?.readings ?? []).some((r) => r.side === s)), [sheet]);
    const byPosition = new Map((sheet?.readings ?? []).filter((r) => r.side === side).map((r) => [`${r.row_no}${r.column_letter}`, r]));
    const lastRow = Math.max(0, ...(sheet?.readings ?? []).filter((r) => r.side === side).map((r) => r.row_no));

    const download = async () => {
        try {
            const { sections } = await torqueCheckApi.download(id);
            const lines: string[] = [];
            for (const section of sections) {
                if (lines.length > 0) lines.push('');
                lines.push(`SIDE ${section.side}`);
                if (section.grid.length > 0) {
                    const headers = Object.keys(section.grid[0]);
                    lines.push(headers.join(','));
                    lines.push(...section.grid.map((row) => headers.map((h) => csvCell(row[h])).join(',')));
                }
                if (section.problems.length > 0) {
                    lines.push('', 'LIST PROBLEM');
                    lines.push(...section.problems.map((p) => `${p.ROW} ${p.COLUMN} ${csvCell(p.NOTE)}`));
                }
            }
            saveCsv(`torque_check_${sheet?.check_date.slice(0, 10) ?? id}.csv`, lines.join('\n'));
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const removeSheet = async () => {
        try {
            await torqueCheckApi.deleteSheet(id);
            onChanged();
            onClose();
        } catch (e) {
            setError((e as Error).message);
            setConfirmDelete(false);
        }
    };

    return (
        <>
            <Dialog open onOpenChange={(o) => !o && onClose()}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>{sheet ? day(sheet.check_date) : 'Torque check'}</DialogTitle>
                        <DialogDescription>{sheet ? `${sheet.session_id ? `Session ${sheet.session_id} · ` : ''}Machine ${sheet.machine_number} · ${sheet.operator_name}${sheet.creel_type ? ` · ${sheet.creel_type.name}` : ''}` : 'Loading…'}</DialogDescription>
                    </DialogHeader>
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    {recordedSides.length > 1 && side && (
                        <ToggleGroup type="single" variant="outline" value={side} onValueChange={(v) => v && setSide(v as TorqueSide)} className="w-full">
                            {recordedSides.map((s) => (
                                <ToggleGroupItem key={s} value={s} className="flex-1">
                                    {s}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                    )}
                    {sheet && lastRow > 0 && (
                        <div className="overflow-x-auto">
                            <table className="border-separate border-spacing-1 text-sm">
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
                                    {Array.from({ length: lastRow }, (_, i) => i + 1).map((row) => (
                                        <tr key={row}>
                                            <td className="text-xs text-muted-foreground">{row}</td>
                                            {TORQUE_COLUMNS.map((col) => {
                                                const r = byPosition.get(`${row}${col}`);
                                                return (
                                                    <td key={col} title={r?.note ?? undefined} className={r?.note ? 'font-semibold text-destructive' : ''}>
                                                        {r ? r.value : '–'}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {sheet && recordedSides.length === 0 && <p className="text-sm text-muted-foreground">No readings recorded on this sheet yet.</p>}
                    <DialogFooter className="gap-2 sm:justify-between">
                        {can('torque-checks.delete') ? (
                            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
                                <Trash2Icon /> Delete sheet
                            </Button>
                        ) : (
                            <span />
                        )}
                        <Button variant="outline" onClick={() => void download()} disabled={recordedSides.length === 0}>
                            <DownloadIcon /> Download CSV
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this sheet?</AlertDialogTitle>
                        <AlertDialogDescription>This permanently deletes the sheet and everything on it.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void removeSheet()}>Delete sheet</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
