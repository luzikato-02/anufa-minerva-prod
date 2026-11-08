import { DataGrid } from '@/components/data-grid';
import {
    CodeCell,
    DateTimeCell,
    Empty,
    NumberCell,
    TextCell,
} from '@/components/data-grid-cells';
import { PageHeader } from '@/components/page-header';
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
    DialogHeader,
    DialogTitle,
    DialogTrigger,
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
import { useServerTable } from '@/hooks/use-server-table';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import {
    type ColumnDef,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import axios from 'axios';
import {
    AlertCircle,
    CheckCircle2,
    Eye,
    Loader2,
    Pencil,
    Trash2,
    Upload,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Creel Visualization', href: '/creel-visualization' },
];

// ── types ─────────────────────────────────────────────────────────────────────

interface CreelRecordSummary {
    id: number;
    order_number: string;
    machine: string | null;
    date_string: string | null;
    operator: string | null;
    metadata: {
        batch_count: number;
        file_name: string;
        upload_date: string;
        total_weight: number;
    } | null;
    created_at: string;
}

interface RawBatch {
    batch: string;
    net_weight: number;
    creel_side: string;
    creel_from: string;
    creel_to: string;
    count: number;
    material: string | null;
    shift_load?: string;
    user_name?: string | null;
}

interface FullCreelRecord {
    id: number;
    order_number: string;
    machine: string | null;
    date_string: string | null;
    operator: string | null;
    material: string | null;
    metadata: CreelRecordSummary['metadata'];
    raw_batches: RawBatch[] | null;
}

// ── Edit dialog (raw XLSX metadata only) ─────────────────────────────────────

const PAGE_SIZE = 30;

function EditDialog({
    recordId,
    onDone,
    onClose,
}: {
    recordId: number;
    onDone: () => void;
    onClose: () => void;
}) {
    const [record, setRecord] = useState<FullCreelRecord | null>(null);
    const [rows, setRows] = useState<RawBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(0);

    useEffect(() => {
        setLoading(true);
        axios
            .get<FullCreelRecord>(`/creel-records/${recordId}`)
            .then((res) => {
                setRecord(res.data);
                setRows((res.data.raw_batches ?? []).map((b) => ({ ...b })));
            })
            .catch(() => setError('Failed to load record.'))
            .finally(() => setLoading(false));
    }, [recordId]);

    const filtered = rows.filter(
        (b) => !search || b.batch.toLowerCase().includes(search.toLowerCase()),
    );
    const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
    const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const updateRow = (
        batchId: string,
        field: keyof RawBatch,
        value: string | number,
    ) => {
        setRows((prev) =>
            prev.map((b) =>
                b.batch === batchId ? { ...b, [field]: value } : b,
            ),
        );
    };

    const handleSave = async () => {
        setSaving(true);
        setError(null);
        try {
            const csrfRes = await axios.get('/csrf-token');
            await axios.patch(
                `/creel-records/${recordId}/raw`,
                { raw_batches: rows },
                { headers: { 'X-CSRF-TOKEN': csrfRes.data.csrfToken } },
            );
            onDone();
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
        <Dialog
            open
            onOpenChange={(v) => {
                if (!v) onClose();
            }}
        >
            <DialogContent className="flex max-h-[92vh] flex-col sm:max-w-[1100px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="size-4" />
                        Edit Raw Batch Data
                        {record && (
                            <span className="ml-1 font-mono text-sm font-normal text-muted-foreground">
                                — {record.order_number} ·{' '}
                                {record.machine ?? '—'} ·{' '}
                                {record.date_string ?? '—'}
                            </span>
                        )}
                    </DialogTitle>
                    <DialogDescription>
                        Edit ERP import metadata. Assigned bobbin positions are
                        not affected.
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex flex-1 items-center justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-3 border-b pb-3">
                            <Input
                                placeholder="Search batch…"
                                value={search}
                                onChange={(e) => {
                                    setSearch(e.target.value);
                                    setPage(0);
                                }}
                                className="max-w-xs"
                            />
                            <span className="text-sm text-muted-foreground">
                                {filtered.length} of {rows.length} batches
                            </span>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto">
                            <Table>
                                <TableHeader className="sticky top-0 z-10 bg-background">
                                    <TableRow>
                                        <TableHead className="w-[140px]">
                                            Batch
                                        </TableHead>
                                        <TableHead className="w-[130px]">
                                            Material
                                        </TableHead>
                                        <TableHead className="w-[80px] text-right">
                                            Wt (kg)
                                        </TableHead>
                                        <TableHead className="w-[120px]">
                                            Side
                                        </TableHead>
                                        <TableHead className="w-[100px]">
                                            From
                                        </TableHead>
                                        <TableHead className="w-[100px]">
                                            To
                                        </TableHead>
                                        <TableHead className="w-[70px] text-right">
                                            Quota
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {visible.map((b) => (
                                        <TableRow key={b.batch}>
                                            <TableCell className="font-mono text-xs">
                                                {b.batch}
                                            </TableCell>
                                            <TableCell className="font-mono text-xs text-muted-foreground">
                                                {b.material ?? '—'}
                                            </TableCell>
                                            <TableCell className="text-right text-xs">
                                                {b.net_weight.toFixed(1)}
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={b.creel_side}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            b.batch,
                                                            'creel_side',
                                                            e.target.value.toUpperCase(),
                                                        )
                                                    }
                                                    className="h-7 px-2 font-mono text-xs uppercase"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={b.creel_from}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            b.batch,
                                                            'creel_from',
                                                            e.target.value.toUpperCase(),
                                                        )
                                                    }
                                                    className="h-7 px-2 font-mono text-xs uppercase"
                                                    placeholder="e.g. 1A"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    value={b.creel_to}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            b.batch,
                                                            'creel_to',
                                                            e.target.value.toUpperCase(),
                                                        )
                                                    }
                                                    className="h-7 px-2 font-mono text-xs uppercase"
                                                    placeholder="e.g. 12E"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    value={b.count}
                                                    onChange={(e) =>
                                                        updateRow(
                                                            b.batch,
                                                            'count',
                                                            parseInt(
                                                                e.target.value,
                                                            ) || 0,
                                                        )
                                                    }
                                                    className="h-7 px-2 text-right text-xs"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {pageCount > 1 && (
                            <div className="flex items-center justify-end gap-2 border-t pt-3">
                                <span className="text-xs text-muted-foreground">
                                    Page {page + 1} of {pageCount}
                                </span>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setPage((p) => Math.max(0, p - 1))
                                    }
                                    disabled={page === 0}
                                >
                                    Previous
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setPage((p) => p + 1)}
                                    disabled={page + 1 >= pageCount}
                                >
                                    Next
                                </Button>
                            </div>
                        )}

                        {error && (
                            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="flex justify-end gap-2 border-t pt-4">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Upload dialog ─────────────────────────────────────────────────────────────

function UploadDialog({ onUploaded }: { onUploaded: () => void }) {
    const [open, setOpen] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const close = () => {
        setOpen(false);
        setError(null);
    };

    const uploadFile = async (file: File) => {
        if (!file.name.match(/\.(xlsx|xls)$/i)) {
            setError('Only .xlsx or .xls files are accepted.');
            return;
        }
        setUploading(true);
        setError(null);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const csrfRes = await axios.get('/csrf-token');
            await axios.post('/creel-records', formData, {
                headers: {
                    'X-CSRF-TOKEN': csrfRes.data.csrfToken,
                    'Content-Type': 'multipart/form-data',
                },
            });
            close();
            onUploaded();
        } catch (err: unknown) {
            setError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : 'Upload failed. Please try again.',
            );
        } finally {
            setUploading(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                if (!v) close();
                else setOpen(true);
            }}
        >
            <DialogTrigger asChild>
                <Button size="xs">
                    <Upload />
                    Upload creel export
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Upload Creel Export</DialogTitle>
                    <DialogDescription>
                        Select or drag an XLSX export from the manufacturing
                        system.
                    </DialogDescription>
                </DialogHeader>

                <div
                    className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
                        dragActive
                            ? 'border-primary bg-primary/10'
                            : 'border-muted-foreground/40 hover:border-primary/60 hover:bg-muted/20'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                        e.preventDefault();
                        setDragActive(true);
                    }}
                    onDragLeave={() => setDragActive(false)}
                    onDrop={(e) => {
                        e.preventDefault();
                        setDragActive(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) uploadFile(file);
                    }}
                >
                    {uploading ? (
                        <Loader2 className="mb-2 h-8 w-8 animate-spin text-primary" />
                    ) : (
                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                    )}
                    <p className="text-sm text-muted-foreground">
                        {uploading
                            ? 'Uploading…'
                            : 'Drop file here, or click to select'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/60">
                        .xlsx / .xls · max 10 MB
                    </p>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadFile(file);
                        e.target.value = '';
                    }}
                />

                {error && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const roundWeight = (w: number | null) =>
    w == null ? null : Math.round(w * 10) / 10;

const openViewer = (id: number | string) =>
    window.open(`/creel-viewer/${id}`, '_blank', 'noopener');

const buildColumns = (
    edit: (id: number) => void,
    remove: (id: number) => void,
): ColumnDef<CreelRecordSummary>[] => [
    {
        id: 'order',
        accessorKey: 'order_number',
        header: 'Order no.',
        meta: { label: 'Order no.' },
        cell: ({ getValue }) => <CodeCell value={getValue()} strong />,
    },
    {
        id: 'machine',
        accessorKey: 'machine',
        header: 'Machine',
        meta: { label: 'Machine' },
        cell: ({ getValue }) => <CodeCell value={getValue()} />,
    },
    {
        id: 'date',
        accessorKey: 'date_string',
        header: 'Date',
        enableSorting: false,
        meta: { label: 'Date', className: 'whitespace-nowrap' },
        cell: ({ getValue }) => <TextCell value={getValue()} />,
    },
    {
        id: 'operator',
        accessorKey: 'operator',
        header: 'Operator',
        meta: { label: 'Operator' },
        cell: ({ getValue }) => <TextCell value={getValue()} />,
    },
    {
        id: 'batches',
        accessorFn: (r) => r.metadata?.batch_count ?? 0,
        header: 'Batches',
        meta: { label: 'Batches', align: 'right' },
        cell: ({ getValue }) => <NumberCell value={getValue<number>()} />,
    },
    {
        id: 'weight',
        accessorFn: (r) => r.metadata?.total_weight ?? null,
        header: 'Total weight',
        meta: { label: 'Total weight', align: 'right' },
        cell: ({ getValue }) => (
            <NumberCell
                value={roundWeight(getValue<number | null>())}
                suffix="kg"
            />
        ),
    },
    {
        id: 'file',
        accessorFn: (r) => r.metadata?.file_name ?? null,
        header: 'File',
        enableSorting: false,
        meta: { label: 'File', className: 'max-w-48' },
        cell: ({ getValue }) => {
            const name = getValue<string | null>();
            return name ? (
                <span
                    className="block truncate text-xs text-muted-foreground"
                    title={name}
                >
                    {name}
                </span>
            ) : (
                <Empty />
            );
        },
    },
    {
        id: 'uploaded',
        accessorKey: 'created_at',
        header: 'Uploaded',
        meta: { label: 'Uploaded', className: 'whitespace-nowrap' },
        cell: ({ getValue }) => <DateTimeCell value={getValue<string>()} />,
    },
    {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        meta: { label: 'Actions', align: 'right' },
        cell: ({ row }) => {
            return (
                <span className="inline-flex items-center gap-0.5">
                    <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => openViewer(row.original.id)}
                    >
                        <Eye />
                        View
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Edit batches for ${row.original.order_number}`}
                        onClick={() => edit(row.original.id)}
                    >
                        <Pencil />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Delete ${row.original.order_number}`}
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(row.original.id)}
                    >
                        <Trash2 />
                    </Button>
                </span>
            );
        },
    },
];

export default function CreelVisualization() {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const grid = useServerTable<CreelRecordSummary>({
        endpoint: '/creel-records',
        storageKey: 'creel-records',
    });

    const columns = useMemo(
        () => buildColumns(setEditingId, setDeletingId),
        [],
    );

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

    const handleDelete = async () => {
        if (deletingId === null) return;
        try {
            const csrfRes = await axios.get('/csrf-token');
            await axios.delete(`/creel-records/${deletingId}`, {
                headers: { 'X-CSRF-TOKEN': csrfRes.data.csrfToken },
            });
            grid.refetch();
        } catch {
            // The row stays in the list, which shows the delete didn't happen.
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Creel Visualization" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <PageHeader
                    title="Creel Visualization"
                    meta="Production orders imported from creel exports; open one to see it in 3D"
                    actions={<UploadDialog onUploaded={grid.refetch} />}
                />
                <DataGrid
                    table={table}
                    label="Creel records"
                    loading={grid.loading}
                    error={grid.error}
                    total={grid.total}
                    onRetry={grid.refetch}
                    search={grid.search}
                    onSearchChange={grid.setSearch}
                    searchPlaceholder="Order, machine or operator"
                    emptyMessage="No creel records yet. Upload an XLSX export to get started."
                    onRowClick={openViewer}
                />
            </div>

            {editingId !== null && (
                <EditDialog
                    recordId={editingId}
                    onDone={() => {
                        setEditingId(null);
                        grid.refetch();
                    }}
                    onClose={() => setEditingId(null)}
                />
            )}

            <AlertDialog
                open={deletingId !== null}
                onOpenChange={(open) => {
                    if (!open) setDeletingId(null);
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Delete creel record?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. The record and all its
                            bobbin assignments will be permanently deleted.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </AppLayout>
    );
}
