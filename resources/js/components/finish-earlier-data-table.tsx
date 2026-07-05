import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    type ColumnDef,
    type ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    type SortingState,
    useReactTable,
    type VisibilityState,
} from '@tanstack/react-table';
import {
    ChevronDown,
    DownloadIcon,
    EyeIcon,
    LayoutGrid,
    ListIcon,
    MoreHorizontal,
    PencilIcon,
    PlusIcon,
    TrashIcon,
} from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Entry {
    creel_side: string;
    row_number: string;
    column_number: string;
    meters_finish: number;
}

interface FinishEarlierRecord {
    id: string;
    metadata: {
        machine_number: string;
        style: string;
        production_order: string;
        shift_group: string;
        roll_construction?: string;
        total_finish_earlier: number;
        average_meters_finish: number;
    };
    entries: Entry[];
    created_at?: string;
    updated_at?: string;
}

interface LaravelPaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    per_page: number;
    total: number;
}

function getCsrfToken(): string {
    const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : '';
}

async function patchRecord(id: string, body: object): Promise<FinishEarlierRecord> {
    const res = await fetch(`/finish-earlier/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': getCsrfToken() },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Request failed');
    return (await res.json()).data;
}

// ── View Dialog ───────────────────────────────────────────────────────────────

function ViewDialog({
    record,
    open,
    onOpenChange,
}: {
    record: FinishEarlierRecord;
    open: boolean;
    onOpenChange: (v: boolean) => void;
}) {
    const handleDownloadCSV = async () => {
        try {
            const res = await fetch(
                `/finish-earlier/${record.metadata.production_order}/download`,
                { credentials: 'include' },
            );
            const data = await res.json();
            if (!data.metadata) { alert('Session not found'); return; }

            let csv = 'Machine,Style,Production Order,Total Finish Earlier,Average Meters Finish\n';
            csv += `${data.metadata.machine_number},${data.metadata.style},${data.metadata.production_order},${data.metadata.total_finish_earlier},${data.metadata.average_meters_finish}\n\n`;
            csv += 'No,Side,Row,Col,Meters\n';
            for (let i = 0; i < 80; i++) {
                const e = data.entries[i] || {};
                csv += `${i + 1},${e.creel_side || ''},${e.row_number || ''},${e.column_number || ''},${e.meters_finish || ''}\n`;
            }

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = `FinishEarlier_${record.metadata.production_order}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch {
            alert('Failed to download CSV.');
        }
    };

    const handleViewCreel = async () => {
        const po = record.metadata.production_order;
        try {
            const res = await fetch(`/creel-records/by-order/${encodeURIComponent(po)}`);
            if (!res.ok) { alert(`No creel record found for "${po}".`); return; }
            const { id } = await res.json();
            if (!id) { alert(`No creel record found for "${po}".`); return; }
            window.open(`/creel-viewer/${id}`, '_blank');
        } catch {
            alert('Failed to look up creel record.');
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-0 sm:max-w-[750px]">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Cable Finish Earlier Summary</DialogTitle>
                    <DialogDescription>
                        Production Order: {record.metadata.production_order}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 pb-2">
                    <div className="rounded-lg bg-muted/50 p-4">
                        <div className="flex gap-8">
                            <div className="flex-1 space-y-2">
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">Material Description</p>
                                    <p className="text-sm font-semibold">{record.metadata.style}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">Machine Number</p>
                                    <p className="text-sm font-semibold">{record.metadata.machine_number}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">Shift Group</p>
                                    <p className="text-sm font-semibold">{record.metadata.shift_group}</p>
                                </div>
                            </div>
                            <div className="flex-1 space-y-2">
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">Total Finish Earlier Bobbins</p>
                                    <p className="text-sm font-semibold">{record.metadata.total_finish_earlier}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">Average Meters Finish</p>
                                    <p className="text-sm font-semibold text-green-600">{record.metadata.average_meters_finish}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase text-muted-foreground">Record Date</p>
                                    <p className="text-sm">
                                        {new Date(record.created_at || '').toLocaleString('en-ID', {
                                            day: '2-digit', month: 'long', year: 'numeric',
                                            hour: '2-digit', minute: '2-digit',
                                        })}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {record.entries?.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">
                                Entries ({record.entries.length})
                            </p>
                            <div className="overflow-hidden rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-10">#</TableHead>
                                            <TableHead>Side</TableHead>
                                            <TableHead>Row</TableHead>
                                            <TableHead>Column</TableHead>
                                            <TableHead>Meters Finish</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {record.entries.map((e, i) => (
                                            <TableRow key={i}>
                                                <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                                                <TableCell>{e.creel_side}</TableCell>
                                                <TableCell>{e.row_number}</TableCell>
                                                <TableCell>{e.column_number}</TableCell>
                                                <TableCell>{e.meters_finish}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={handleDownloadCSV}>
                        <DownloadIcon className="mr-2 h-4 w-4" /> Download CSV
                    </Button>
                    <Button variant="outline" onClick={handleViewCreel}>
                        <LayoutGrid className="mr-2 h-4 w-4" /> View Creel
                    </Button>
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="ml-auto">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Edit Metadata Dialog ──────────────────────────────────────────────────────

function EditRecordDialog({
    record,
    open,
    onOpenChange,
    onSaved,
}: {
    record: FinishEarlierRecord;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onSaved: (updated: FinishEarlierRecord) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ ...record.metadata });

    useEffect(() => {
        if (open) setForm({ ...record.metadata });
    }, [open, record]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await patchRecord(record.id, {
                machine_number: form.machine_number,
                style: form.style,
                production_order: form.production_order,
                shift_group: form.shift_group,
                roll_construction: form.roll_construction ?? '',
            });
            onSaved(updated);
            onOpenChange(false);
        } catch {
            alert('Failed to save changes.');
        } finally {
            setSaving(false);
        }
    };

    const field = (label: string, key: keyof typeof form) => (
        <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right text-sm">{label}</Label>
            <Input
                className="col-span-3"
                value={(form[key] as string) ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
            />
        </div>
    );

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Edit Record</DialogTitle>
                    <DialogDescription>
                        Update metadata for production order {record.metadata.production_order}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    {field('Machine No.', 'machine_number')}
                    {field('Style', 'style')}
                    {field('Production Order', 'production_order')}
                    {field('Shift Group', 'shift_group')}
                    {field('Roll Construction', 'roll_construction')}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Edit Entries Dialog ───────────────────────────────────────────────────────

function EditEntriesDialog({
    record,
    open,
    onOpenChange,
    onSaved,
}: {
    record: FinishEarlierRecord;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onSaved: (updated: FinishEarlierRecord) => void;
}) {
    const [saving, setSaving] = useState(false);
    const [entries, setEntries] = useState<Entry[]>([]);

    useEffect(() => {
        if (open) setEntries((record.entries ?? []).map((e) => ({ ...e })));
    }, [open, record]);

    const update = (i: number, key: keyof Entry, value: string) =>
        setEntries((prev) =>
            prev.map((e, idx) =>
                idx === i ? { ...e, [key]: key === 'meters_finish' ? parseFloat(value) || 0 : value } : e,
            ),
        );

    const addRow = () =>
        setEntries((prev) => [...prev, { creel_side: '', row_number: '', column_number: '', meters_finish: 0 }]);

    const removeRow = (i: number) =>
        setEntries((prev) => prev.filter((_, idx) => idx !== i));

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await patchRecord(record.id, { entries });
            onSaved(updated);
            onOpenChange(false);
        } catch {
            alert('Failed to save entries.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="p-0 sm:max-w-[760px]">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Edit Entries</DialogTitle>
                    <DialogDescription>
                        {record.metadata.production_order} — {entries.length} entries
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[60vh] overflow-y-auto px-6">
                    <div className="overflow-hidden rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8">#</TableHead>
                                    <TableHead>Side</TableHead>
                                    <TableHead>Row</TableHead>
                                    <TableHead>Column</TableHead>
                                    <TableHead>Meters</TableHead>
                                    <TableHead className="w-8" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {entries.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-16 text-center text-sm text-muted-foreground">
                                            No entries. Add one below.
                                        </TableCell>
                                    </TableRow>
                                )}
                                {entries.map((e, i) => (
                                    <TableRow key={i}>
                                        <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                                        <TableCell className="p-1">
                                            <Input
                                                className="h-8 w-16 text-sm"
                                                value={e.creel_side}
                                                placeholder="AI"
                                                onChange={(ev) => update(i, 'creel_side', ev.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell className="p-1">
                                            <Input
                                                className="h-8 w-16 text-sm"
                                                value={e.row_number}
                                                placeholder="A"
                                                onChange={(ev) => update(i, 'row_number', ev.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell className="p-1">
                                            <Input
                                                className="h-8 w-16 text-sm"
                                                value={e.column_number}
                                                placeholder="1"
                                                onChange={(ev) => update(i, 'column_number', ev.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell className="p-1">
                                            <Input
                                                className="h-8 w-20 text-sm"
                                                type="number"
                                                value={e.meters_finish}
                                                onChange={(ev) => update(i, 'meters_finish', ev.target.value)}
                                            />
                                        </TableCell>
                                        <TableCell className="p-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive"
                                                onClick={() => removeRow(i)}
                                            >
                                                <TrashIcon className="size-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <Button variant="outline" size="sm" className="my-3 w-full" onClick={addRow}>
                        <PlusIcon className="mr-2 size-4" /> Add Entry
                    </Button>
                </div>

                <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save Entries'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Delete Dialog ─────────────────────────────────────────────────────────────

function DeleteDialog({
    record,
    open,
    onOpenChange,
    onDeleted,
}: {
    record: FinishEarlierRecord;
    open: boolean;
    onOpenChange: (v: boolean) => void;
    onDeleted: (id: string) => void;
}) {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        setDeleting(true);
        try {
            const res = await fetch(`/finish-earlier/${record.id}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: { 'X-XSRF-TOKEN': getCsrfToken() },
            });
            if (!res.ok) { alert('Failed to delete record.'); return; }
            onDeleted(record.id);
            onOpenChange(false);
        } catch {
            alert('Failed to delete record.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[380px]">
                <DialogHeader>
                    <DialogTitle>Delete Record</DialogTitle>
                    <DialogDescription>
                        Permanently delete the record for production order{' '}
                        <strong>{record.metadata.production_order}</strong>? This cannot be undone.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
                        {deleting ? 'Deleting…' : 'Delete'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Actions Dropdown ──────────────────────────────────────────────────────────

function RecordActions({
    record,
    onSaved,
    onDeleted,
}: {
    record: FinishEarlierRecord;
    onSaved: (updated: FinishEarlierRecord) => void;
    onDeleted: (id: string) => void;
}) {
    const [viewOpen, setViewOpen] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editEntriesOpen, setEditEntriesOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <MoreHorizontal className="size-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewOpen(true)}>
                        <EyeIcon className="mr-2 size-4" /> View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditOpen(true)}>
                        <PencilIcon className="mr-2 size-4" /> Edit Record
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setEditEntriesOpen(true)}>
                        <ListIcon className="mr-2 size-4" /> Edit Entries
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setDeleteOpen(true)}
                    >
                        <TrashIcon className="mr-2 size-4" /> Delete
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ViewDialog record={record} open={viewOpen} onOpenChange={setViewOpen} />
            <EditRecordDialog record={record} open={editOpen} onOpenChange={setEditOpen} onSaved={onSaved} />
            <EditEntriesDialog record={record} open={editEntriesOpen} onOpenChange={setEditEntriesOpen} onSaved={onSaved} />
            <DeleteDialog record={record} open={deleteOpen} onOpenChange={onOpenChange => { setDeleteOpen(onOpenChange); }} onDeleted={onDeleted} />
        </>
    );
}

// ── Table ─────────────────────────────────────────────────────────────────────

export function FinishEarlierDataTable() {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [data, setData] = useState<FinishEarlierRecord[]>([]);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

    const columns: ColumnDef<FinishEarlierRecord>[] = [
        {
            id: 'select',
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
                    onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(v) => row.toggleSelected(!!v)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            id: 'Date',
            header: 'Record Date',
            accessorFn: (row) => row.created_at,
            cell: ({ getValue }) => (
                <div>
                    {new Date(getValue() as string).toLocaleString('en-ID', {
                        day: '2-digit', month: 'numeric', year: 'numeric',
                    })}
                </div>
            ),
        },
        {
            id: 'Shift Group',
            header: 'Shift Group',
            accessorFn: (row) => row.metadata?.shift_group,
            cell: ({ getValue }) => <div className="capitalize">{String(getValue() ?? 'N/A')}</div>,
        },
        {
            id: 'Machine Number',
            header: 'Machine Number',
            accessorFn: (row) => row.metadata?.machine_number,
            cell: ({ getValue }) => <div className="capitalize">{String(getValue() ?? 'N/A')}</div>,
        },
        {
            id: 'Production Order',
            header: 'Production Order',
            accessorFn: (row) => row.metadata?.production_order,
            cell: ({ getValue }) => <div>{String(getValue() ?? 'N/A')}</div>,
        },
        {
            id: 'Material Description',
            header: 'Material Description',
            accessorFn: (row) => row.metadata?.style,
            cell: ({ getValue }) => <div>{String(getValue() ?? 'N/A')}</div>,
        },
        {
            id: 'Total Finish Earlier Bobbins',
            header: 'Total FE Bobbins',
            accessorFn: (row) => row.metadata?.total_finish_earlier,
            cell: ({ getValue }) => <div>{String(getValue() ?? 'N/A')}</div>,
        },
        {
            id: 'Average Meters Finish',
            header: 'Avg Meters Finish',
            accessorFn: (row) => row.metadata?.average_meters_finish,
            cell: ({ getValue }) => <div>{String(getValue() ?? 'N/A')}</div>,
        },
        {
            id: 'actions',
            header: 'Actions',
            enableHiding: false,
            cell: ({ row }) => (
                <RecordActions
                    record={row.original}
                    onSaved={(updated) =>
                        setData((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
                    }
                    onDeleted={(id) =>
                        setData((prev) => prev.filter((r) => r.id !== id))
                    }
                />
            ),
        },
    ];

    const table = useReactTable({
        data,
        columns,
        onSortingChange: setSorting,
        onColumnFiltersChange: setColumnFilters,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        manualPagination: true,
        manualFiltering: true,
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        onGlobalFilterChange: setGlobalFilter,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        onPaginationChange: setPagination,
        pageCount,
        state: { sorting, columnFilters, columnVisibility, rowSelection, pagination },
    });

    useEffect(() => {
        const controller = new AbortController();
        const fetchData = async () => {
            setLoading(true);
            const params = new URLSearchParams({
                page: (pagination.pageIndex + 1).toString(),
                per_page: pagination.pageSize.toString(),
            });
            if (globalFilter) params.append('search', globalFilter);
            columnFilters.forEach((f) => { if (f.value) params.append(f.id, String(f.value)); });
            if (sorting.length > 0) {
                params.append('sort_by', sorting[0].id);
                params.append('sort_dir', sorting[0].desc ? 'desc' : 'asc');
            }
            try {
                const res = await fetch(
                    `${window.location.origin}/finish-earlier?${params}`,
                    { credentials: 'include', signal: controller.signal },
                );
                const json: LaravelPaginatedResponse<FinishEarlierRecord> = await res.json();
                setData(json.data);
                setPageCount(json.last_page);
            } catch (e: any) {
                if (e.name !== 'AbortError') console.error('Fetch error:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        return () => controller.abort();
    }, [pagination.pageIndex, pagination.pageSize, sorting, globalFilter, columnFilters]);

    return (
        <div className="w-full">
            <div className="flex items-center justify-between py-4">
                <Input
                    placeholder="Search value"
                    value={globalFilter ?? ''}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="max-w-sm"
                />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto bg-transparent">
                            Columns <ChevronDown />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {table.getAllColumns().filter((c) => c.getCanHide()).map((column) => (
                            <DropdownMenuCheckboxItem
                                key={column.id}
                                className="capitalize"
                                checked={column.getIsVisible()}
                                onCheckedChange={(v) => column.toggleVisibility(!!v)}
                            >
                                {column.id}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((hg) => (
                            <TableRow key={hg.id}>
                                {hg.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    {loading ? 'Loading…' : 'No records found.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end gap-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{' '}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
                        Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
