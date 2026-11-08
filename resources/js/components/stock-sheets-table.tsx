import { DataGrid } from '@/components/data-grid';
import { CodeCell, NumberCell, TextCell } from '@/components/data-grid-cells';
import {
    type RowDraft,
    RowFieldsForm,
    draftFrom,
    readDraft,
} from '@/components/stock-sheet-row-fields';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useServerTable } from '@/hooks/use-server-table';
import { usePermissions } from '@/lib/permissions';
import {
    type SheetRow,
    type StockSheetDetail,
    type StockSheetSummary,
    formatNumber,
    rowsToCsv,
    saveCsv,
    stockSheetApi,
} from '@/lib/stock-sheets';
import {
    type ColumnDef,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { DownloadIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const day = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    });
const shortDay = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
    });

const columns: ColumnDef<StockSheetSummary>[] = [
    {
        id: 'sheet_date',
        accessorKey: 'sheet_date',
        header: 'Date',
        meta: { label: 'Date', className: 'whitespace-nowrap' },
        cell: ({ row }) => (
            <time
                dateTime={row.original.sheet_date.slice(0, 10)}
                title={day(row.original.sheet_date)}
                className="tabular-nums"
            >
                {shortDay(row.original.sheet_date)}
            </time>
        ),
    },
    {
        id: 'leader',
        accessorKey: 'leader',
        header: 'Recorded by',
        meta: { label: 'Recorded by' },
        cell: ({ getValue }) => <TextCell value={getValue()} />,
    },
    {
        id: 'session',
        accessorKey: 'session_id',
        header: 'Session',
        meta: { label: 'Session' },
        cell: ({ getValue }) => <CodeCell value={getValue()} muted />,
    },
    {
        id: 'rows',
        accessorKey: 'rows_count',
        header: 'Rows',
        meta: { label: 'Rows', align: 'right' },
        cell: ({ getValue }) => <NumberCell value={getValue()} />,
    },
    {
        id: 'bobbins',
        accessorKey: 'total_chs',
        header: 'Bobbins',
        meta: { label: 'Bobbins', align: 'right' },
        cell: ({ getValue }) => <NumberCell value={getValue() ?? 0} />,
    },
    {
        id: 'weight',
        accessorKey: 'total_weight',
        header: 'Weight',
        meta: { label: 'Weight (kg)', align: 'right' },
        cell: ({ getValue }) => (
            <NumberCell value={getValue() ?? 0} suffix="kg" />
        ),
    },
];

export function StockSheetsTable() {
    const { can } = usePermissions();
    const [openId, setOpenId] = useState<number | null>(null);
    const grid = useServerTable<StockSheetSummary>({
        endpoint: '/stock-sheets',
        storageKey: 'stock-sheets',
    });

    const table = useReactTable({
        data: grid.data,
        columns,
        getRowId: (row) => String(row.id),
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        enableSortingRemoval: true,
        pageCount: grid.pageCount,
        state: grid.state,
        ...grid.handlers,
    });

    return (
        <>
            <DataGrid
                table={table}
                label="Stock sheets"
                loading={grid.loading}
                error={grid.error}
                total={grid.total}
                onRetry={grid.refetch}
                search={grid.search}
                onSearchChange={grid.setSearch}
                searchPlaceholder="Search leader, batch, material or colour"
                emptyMessage="No stock sheets yet."
                onRowClick={(id) => setOpenId(Number(id))}
                activeRowId={openId === null ? null : String(openId)}
            />
            {openId !== null && (
                <SheetDialog
                    id={openId}
                    canEdit={can('stock-take.edit')}
                    canDelete={can('stock-take.delete')}
                    onClose={() => setOpenId(null)}
                    onChanged={grid.refetch}
                />
            )}
        </>
    );
}

function SheetDialog({
    id,
    canEdit,
    canDelete,
    onClose,
    onChanged,
}: {
    id: number;
    canEdit: boolean;
    canDelete: boolean;
    onClose: () => void;
    onChanged: () => void;
}) {
    const [sheet, setSheet] = useState<StockSheetDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editing, setEditing] = useState<SheetRow | null>(null);
    const [confirm, setConfirm] = useState<'sheet' | null>(null);

    const load = useCallback(async () => {
        try {
            setSheet(await stockSheetApi.show(id));
        } catch (e) {
            setError((e as Error).message);
        }
    }, [id]);

    useEffect(() => {
        void load();
    }, [load]);

    const download = async () => {
        try {
            const { summary } = await stockSheetApi.download(id);
            saveCsv(
                `stock_sheet_${sheet?.sheet_date.slice(0, 10) ?? id}.csv`,
                rowsToCsv(summary),
            );
        } catch (e) {
            setError((e as Error).message);
        }
    };

    const removeSheet = async () => {
        try {
            await stockSheetApi.deleteSheet(id);
            onChanged();
            onClose();
        } catch (e) {
            setError((e as Error).message);
            setConfirm(null);
        }
    };

    const rows = sheet?.rows ?? [];
    const chs = rows.reduce((a, r) => a + (r.chs ?? 0), 0);
    const kg = rows.reduce((a, r) => a + (r.actual_weight ?? 0), 0);

    return (
        <>
            <Dialog open onOpenChange={(o) => !o && onClose()}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>
                            {sheet ? day(sheet.sheet_date) : 'Stock sheet'}
                        </DialogTitle>
                        <DialogDescription>
                            {sheet
                                ? `${sheet.session_id ? `Session ${sheet.session_id} · ` : ''}Recorded by ${sheet.leader} · ${rows.length} ${rows.length === 1 ? 'row' : 'rows'} · ${formatNumber(chs)} bobbins · ${formatNumber(kg)} kg`
                                : 'Loading…'}
                        </DialogDescription>
                    </DialogHeader>
                    {error && (
                        <Alert variant="destructive" role="alert">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">No</TableHead>
                                <TableHead>Colour</TableHead>
                                <TableHead>Material</TableHead>
                                <TableHead>Batch</TableHead>
                                <TableHead>Prod date</TableHead>
                                <TableHead className="text-right">
                                    Original (kg)
                                </TableHead>
                                <TableHead className="text-right">
                                    Total bobbins
                                </TableHead>
                                <TableHead className="text-right">
                                    Actual bobbins
                                </TableHead>
                                <TableHead className="text-right">
                                    Actual (kg)
                                </TableHead>
                                <TableHead className="text-right">
                                    Position
                                </TableHead>
                                <TableHead>Remark</TableHead>
                                {canEdit && (
                                    <TableHead className="w-12">
                                        <span className="sr-only">Edit</span>
                                    </TableHead>
                                )}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {rows.map((r) => (
                                <TableRow key={r.id}>
                                    <TableCell>{r.line_no}</TableCell>
                                    <TableCell>{r.color ?? '—'}</TableCell>
                                    <TableCell>{r.material_code}</TableCell>
                                    <TableCell>{r.batch}</TableCell>
                                    <TableCell>
                                        {r.prod_date
                                            ? r.prod_date.slice(0, 10)
                                            : '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatNumber(r.original_weight)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatNumber(r.total_bobbins)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatNumber(r.chs)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {formatNumber(r.actual_weight)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {r.position ?? '—'}
                                    </TableCell>
                                    <TableCell>{r.remark ?? '—'}</TableCell>
                                    {canEdit && (
                                        <TableCell>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Edit row ${r.line_no}`}
                                                onClick={() => setEditing(r)}
                                            >
                                                <PencilIcon />
                                            </Button>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <DialogFooter className="gap-2 sm:justify-between">
                        {canDelete ? (
                            <Button
                                variant="destructive"
                                onClick={() => setConfirm('sheet')}
                            >
                                <Trash2Icon /> Delete sheet
                            </Button>
                        ) : (
                            <span />
                        )}
                        <Button
                            variant="outline"
                            onClick={() => void download()}
                            disabled={rows.length === 0}
                        >
                            <DownloadIcon /> Download CSV
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {editing && (
                <EditRowDialog
                    row={editing}
                    canDelete={canDelete}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        void load();
                        onChanged();
                    }}
                />
            )}

            <AlertDialog
                open={confirm === 'sheet'}
                onOpenChange={(o) => !o && setConfirm(null)}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this sheet?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently deletes the sheet and its{' '}
                            {rows.length} rows.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => void removeSheet()}>
                            Delete sheet
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function EditRowDialog({
    row,
    canDelete,
    onClose,
    onSaved,
}: {
    row: SheetRow;
    canDelete: boolean;
    onClose: () => void;
    onSaved: () => void;
}) {
    const [draft, setDraft] = useState<RowDraft>(
        draftFrom({
            ...row,
            prod_date: row.prod_date ? row.prod_date.slice(0, 10) : null,
        }),
    );
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    // Rows are addressed by their numeric id here; the server accepts that as well as the client uuid.
    const handle = String(row.id);

    const run = async (fn: () => Promise<unknown>) => {
        setBusy(true);
        setError(null);
        try {
            await fn();
            onSaved();
        } catch (e) {
            setError((e as Error).message);
            setBusy(false);
        }
    };

    const save = () => {
        const read = readDraft(draft);
        if ('error' in read) return setError(read.error);
        void run(() => stockSheetApi.updateRow(handle, read.fields));
    };

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Edit row {row.line_no}</DialogTitle>
                    <DialogDescription>{row.batch}</DialogDescription>
                </DialogHeader>
                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <RowFieldsForm
                    draft={draft}
                    onChange={setDraft}
                    idPrefix="edit"
                />
                <DialogFooter className="gap-2 sm:justify-between">
                    {canDelete ? (
                        <Button
                            variant="destructive"
                            disabled={busy}
                            onClick={() =>
                                void run(() => stockSheetApi.deleteRow(handle))
                            }
                        >
                            <Trash2Icon /> Delete row
                        </Button>
                    ) : (
                        <span />
                    )}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            disabled={busy}
                        >
                            Cancel
                        </Button>
                        <Button onClick={save} disabled={busy}>
                            {busy ? 'Saving…' : 'Save changes'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
