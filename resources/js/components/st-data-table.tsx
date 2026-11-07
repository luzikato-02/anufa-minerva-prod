'use client';
import {
    initialNoticeState,
    NoticeDialog,
    type NoticeState,
    type NoticeVariant,
} from '@/components/notice-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { type ColumnDef, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import {
    CircleAlertIcon,
    DownloadIcon,
    EyeIcon,
    MoreHorizontal,
    PlusIcon,
    UploadIcon,
    VerifiedIcon,
} from 'lucide-react';
import { CodeCell, DateTimeCell, NumberCell, TextCell } from '@/components/data-grid-cells';
import { DataGrid } from '@/components/data-grid';
import { useServerTable } from '@/hooks/use-server-table';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { useState } from 'react';


interface StockTakeRecord {
    id: string;
    timestamp: string;
    metadata: {
        total_batches: number;
        session_leader: string;
        total_checked_batches: number;
        session_status: string;
        total_materials: number;
    };
    indv_batch_data: any;
    stock_take_summary: any;
    created_at?: string;
    updated_at?: string;
    session_id?: any;
}

// Percentage of batches that have been checked/found relative to the total.
function calculateSimilitudeRatio(
    totalCheckedBatches: number,
    totalBatches: number,
): number {
    return totalBatches > 0
        ? Math.round((totalCheckedBatches / totalBatches) * 100)
        : 0;
}

function SessionStatusCell({ status }: { status?: string }) {
    if (!status) return <TextCell value={null} />;
    const inProgress = status === 'In Progress';
    const completed = status === 'Completed';
    return (
        <span className="inline-flex items-center gap-1.5 text-xs">
            <span
                aria-hidden="true"
                className={cn(
                    'size-1.5 rounded-full',
                    inProgress ? 'bg-blue-600' : completed ? 'bg-emerald-600' : 'bg-muted-foreground/40',
                )}
            />
            <span className={completed ? 'text-muted-foreground' : undefined}>{status}</span>
        </span>
    );
}

/** Checked vs total batches: thin bar, counts and percentage on one line. */
function BatchProgressCell({ found, total }: { found: number; total: number }) {
    const ratio = calculateSimilitudeRatio(found, total);
    return (
        <span className="inline-flex items-center gap-1.5">
            <span className="h-1 w-12 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <span className="block h-full rounded-full bg-foreground/70" style={{ width: `${ratio}%` }} />
            </span>
            <span className="text-xs tabular-nums">
                {found.toLocaleString('en-US')} / {total.toLocaleString('en-US')}
            </span>
            <span className={cn('text-xs tabular-nums', ratio >= 100 ? 'text-muted-foreground' : 'font-medium')}>
                {ratio}%
            </span>
        </span>
    );
}

/** Sorting stays off: the stock take endpoint returns its own fixed order. */
export const columns: ColumnDef<StockTakeRecord>[] = [
    {
        id: 'select',
        header: ({ table }) => (
            <Checkbox
                checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
                onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                aria-label="Select all rows on this page"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableHiding: false,
        meta: { className: 'w-8 pr-0' },
    },
    {
        id: 'recorded_at',
        accessorFn: (row) => row.created_at,
        header: 'Started',
        cell: ({ getValue }) => <DateTimeCell value={getValue()} />,
        meta: { label: 'Started' },
    },
    {
        id: 'session',
        accessorFn: (row) => row.session_id,
        header: 'Session',
        cell: ({ getValue }) => <CodeCell value={getValue()} strong />,
        meta: { label: 'Session ID' },
    },
    {
        id: 'leader',
        accessorFn: (row) => row.metadata?.session_leader,
        header: 'Leader',
        cell: ({ getValue }) => <TextCell value={getValue()} />,
        meta: { label: 'Session leader' },
    },
    {
        id: 'status',
        accessorFn: (row) => row.metadata?.session_status,
        header: 'Status',
        cell: ({ getValue }) => <SessionStatusCell status={getValue() as string | undefined} />,
        meta: { label: 'Session status' },
    },
    {
        id: 'materials',
        accessorFn: (row) => row.metadata?.total_materials,
        header: 'Materials',
        cell: ({ getValue }) => <NumberCell value={getValue()} />,
        meta: { label: 'Total materials', align: 'right' },
    },
    {
        id: 'progress',
        accessorFn: (row) => row.metadata?.total_checked_batches,
        header: 'Batches checked',
        cell: ({ row }) => (
            <BatchProgressCell
                found={row.original.metadata?.total_checked_batches ?? 0}
                total={row.original.metadata?.total_batches ?? 0}
            />
        ),
        meta: { label: 'Batches checked' },
    },
    {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        cell: ({ row, table }) => (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-xs" aria-label={`Actions for session ${row.original.session_id ?? ''}`}>
                        <MoreHorizontal />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <ViewSessionDialog record={row.original} onStatusChange={table.options.meta?.onStatusChange} />
                </DropdownMenuContent>
            </DropdownMenu>
        ),
        meta: { className: 'w-10 px-1' },
    },
];

function ViewSessionDialog({
    record,
    onStatusChange,
}: {
    record: StockTakeRecord;
    onStatusChange?: (id: string, status: string) => void;
}) {
    const [open, setOpen] = useState(false);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [newStatus, setNewStatus] = useState(record.metadata.session_status);
    const [notice, setNotice] = useState<NoticeState>(initialNoticeState);

    const showNotice = (
        variant: NoticeVariant,
        title: string,
        description: string,
    ) => setNotice({ open: true, variant, title, description });

    const similitudeRatio = calculateSimilitudeRatio(
        record.metadata.total_checked_batches,
        record.metadata.total_batches,
    );

    const handleDownloadCSV = async () => {
        try {
            const baseUrl = window.location.origin;
            const url = `${baseUrl}/stock-take-records/${record.id}/download`;

            // Fetch JSON from backend
            const response = await fetch(url);
            const data = await response.json();

            if (!data.success || !data.summary || data.summary.length === 0) {
                showNotice(
                    'error',
                    'No Data Available',
                    data.message || 'No data available for download.',
                );
                return;
            }

            const summary = data.summary;

            // Convert JSON array to CSV
            const headers = Object.keys(summary[0]);
            const csvRows = [
                headers.join(','), // header row
                ...summary.map((row: Record<string, unknown>) =>
                    headers
                        .map(
                            (field) =>
                                `"${(row[field] ?? '').toString().replace(/"/g, '""')}"`,
                        )
                        .join(','),
                ),
            ];
            const csvString = csvRows.join('\n');

            // Create a Blob and trigger download
            const blob = new Blob([csvString], { type: 'text/csv' });
            const downloadUrl = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `stock_take_summary_${data.session_id}.csv`;
            a.click();

            // Cleanup
            URL.revokeObjectURL(downloadUrl);
        } catch (error) {
            console.error('Failed to download CSV:', error);
            showNotice('error', 'Download Failed', 'Failed to download CSV.');
        }
    };

    const handleChangeStatus = async () => {
        const baseUrl = window.location.origin;
        try {
            // Step 1: Ensure cookie is set
            await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' });

            // Step 2: Extract XSRF-TOKEN value
            const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
            const csrfToken = match ? decodeURIComponent(match[1]) : '';

            const response = await fetch(
                `${baseUrl}/stock-take-records/${record.id}/status`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': csrfToken,
                    },
                    credentials: 'include',
                    body: JSON.stringify({ session_status: newStatus }),
                },
            );

            if (!response.ok) {
                throw new Error('Failed to update status');
            }

            const result = await response.json();
            onStatusChange?.(
                record.id,
                result.data?.session_status ?? newStatus,
            );

            setStatusDialogOpen(false);
            showNotice(
                'success',
                'Status Updated',
                'Session status updated successfully!',
            );
        } catch (error) {
            console.error(error);
            showNotice(
                'error',
                'Update Failed',
                'Error updating session status.',
            );
        }
    };

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <DropdownMenuItem
                        onClick={(e) => {
                            e.preventDefault();
                            setOpen(true);
                        }}
                    >
                        <EyeIcon></EyeIcon>View
                    </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent className="p-0 sm:max-w-[700px]">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>Stock Take Session Summary</DialogTitle>
                        <DialogDescription>
                            Session ID: {record.session_id}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 pb-6">
                        <div className="rounded-lg bg-gray-50 p-4">
                            <div className="flex items-start justify-between gap-4">
                                {/* Left side */}
                                <div className="flex-1 space-y-1">
                                    <p className="text-xs font-medium text-gray-500 uppercase">
                                        Session Leader
                                    </p>
                                    <p className="mt-1 text-sm font-semibold">
                                        {record.metadata.session_leader}
                                    </p>

                                    <p className="mt-3 text-xs font-medium text-gray-500 uppercase">
                                        Status
                                    </p>
                                    <div className="mt-1">
                                        {record.metadata.session_status ===
                                        'Completed' ? (
                                            <Badge className="bg-blue-500 text-white dark:bg-blue-600">
                                                <VerifiedIcon className="mr-1 h-3 w-3" />
                                                Completed
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">
                                                In Progress
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs font-medium text-gray-500 uppercase">
                                        Similitude Ratio
                                    </p>
                                    <p className="mt-1 text-sm font-semibold">
                                        {similitudeRatio}%
                                    </p>
                                </div>

                                {/* Right side - Stats */}
                                <div className="flex-1 space-y-3">
                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase">
                                            Total Batches
                                        </p>
                                        <p className="mt-1 text-sm font-semibold">
                                            {record.metadata.total_batches}
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase">
                                            Found Batches
                                        </p>
                                        <p className="mt-1 text-sm font-semibold text-green-600">
                                            {
                                                record.metadata
                                                    .total_checked_batches
                                            }
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium text-gray-500 uppercase">
                                            Unique Materials
                                        </p>
                                        <p className="mt-1 text-sm font-semibold">
                                            {record.metadata.total_materials}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 border-t pt-4">
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Record Date
                                </p>
                                <p className="mt-1 text-sm">
                                    {new Date(
                                        record.created_at || '',
                                    ).toLocaleString('en-ID', {
                                        day: '2-digit',
                                        month: 'long',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </p>
                            </div>
                        </div>

                        {/* Batches Preview */}
                        {record.stock_take_summary &&
                            record.stock_take_summary.length > 0 && (
                                <div className="space-y-3">
                                    <p className="text-sm font-semibold">
                                        Summary Preview
                                    </p>
                                    <div className="max-h-40 overflow-auto rounded-md border">
                                        <Table className="text-xs">
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="py-2">
                                                        Material
                                                    </TableHead>
                                                    <TableHead className="py-2">
                                                        Material Description
                                                    </TableHead>
                                                    <TableHead className="py-2">
                                                        Batch Number
                                                    </TableHead>
                                                    <TableHead className="py-2">
                                                        Status
                                                    </TableHead>
                                                    <TableHead className="py-2">
                                                        Actual Weight
                                                    </TableHead>
                                                    <TableHead className="py-2">
                                                        Actual Bbn Qty
                                                    </TableHead>
                                                    <TableHead className="py-2">
                                                        Line Position
                                                    </TableHead>
                                                    <TableHead className="py-2">
                                                        Row Position
                                                    </TableHead>
                                                    <TableHead className="py-2">
                                                        Found By
                                                    </TableHead>
                                                    <TableHead className="py-2">
                                                        Explanation
                                                    </TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {record.stock_take_summary
                                                    .slice(0, 10)
                                                    .map(
                                                        (
                                                            batch: Record<
                                                                string,
                                                                any
                                                            >,
                                                            idx: number,
                                                        ) => (
                                                            <TableRow key={idx}>
                                                                <TableCell className="py-1 text-xs">
                                                                    {batch.material_code ||
                                                                        'N/A'}
                                                                </TableCell>
                                                                <TableCell className="py-1 text-xs">
                                                                    {batch.material_description ||
                                                                        'N/A'}
                                                                </TableCell>
                                                                <TableCell className="py-1 text-xs">
                                                                    {batch.batch_number ||
                                                                        'N/A'}
                                                                </TableCell>
                                                                <TableCell className="py-1 text-xs">
                                                                    {batch.is_recorded ===
                                                                    true
                                                                        ? 'F'
                                                                        : batch.is_recorded ===
                                                                            false
                                                                          ? 'N/F'
                                                                          : 'N/A'}
                                                                </TableCell>
                                                                <TableCell className="py-1 text-xs">
                                                                    {batch.actual_weight ||
                                                                        '-'}
                                                                </TableCell>
                                                                <TableCell className="py-1 text-xs">
                                                                    {batch.total_bobbins ||
                                                                        '-'}
                                                                </TableCell>
                                                                <TableCell className="py-1 text-xs">
                                                                    {batch.line_position ||
                                                                        '-'}
                                                                </TableCell>
                                                                <TableCell className="py-1 text-xs">
                                                                    {batch.row_position ||
                                                                        '-'}
                                                                </TableCell>
                                                                <TableCell className="py-1 text-xs">
                                                                    {batch.user_found ||
                                                                        '-'}
                                                                </TableCell>
                                                                <TableCell className="py-1 text-xs">
                                                                    {batch.explanation ||
                                                                        '-'}
                                                                </TableCell>
                                                            </TableRow>
                                                        ),
                                                    )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                    </div>

                    <DialogFooter className="px-6 pb-6">
                        <Button variant="outline" onClick={handleDownloadCSV}>
                            <DownloadIcon className="mr-2 h-4 w-4" />
                            Download CSV
                        </Button>

                        <Dialog
                            open={statusDialogOpen}
                            onOpenChange={setStatusDialogOpen}
                        >
                            <DialogTrigger asChild>
                                <Button variant="destructive" className="ml-2">
                                    <CircleAlertIcon className="mr-2 h-4 w-4" />
                                    Change Status
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-xs">
                                <DialogHeader>
                                    <DialogTitle>
                                        Change Session Status
                                    </DialogTitle>
                                    <DialogDescription>
                                        Select a new status for this session
                                    </DialogDescription>
                                </DialogHeader>

                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        {['In Progress', 'Completed'].map(
                                            (status) => (
                                                <Button
                                                    key={status}
                                                    variant={
                                                        newStatus === status
                                                            ? 'default'
                                                            : 'outline'
                                                    }
                                                    className="w-full justify-start"
                                                    onClick={() =>
                                                        setNewStatus(status)
                                                    }
                                                >
                                                    {status}
                                                </Button>
                                            ),
                                        )}
                                    </div>
                                </div>

                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setStatusDialogOpen(false)
                                        }
                                    >
                                        Cancel
                                    </Button>
                                    <Button onClick={handleChangeStatus}>
                                        Commit
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>

                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                            className="ml-auto"
                        >
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <NoticeDialog
                open={notice.open}
                onOpenChange={(open) => setNotice((n) => ({ ...n, open }))}
                variant={notice.variant}
                title={notice.title}
                description={notice.description}
            />
        </>
    );
}

// Parse a single CSV line into its fields, handling quoted values that may
// contain commas or escaped quotes ("").
function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

// Count unique material codes in the uploaded data
function countUniqueMaterialCodes(data: Record<string, string>[]): number {
    const uniqueCodes = new Set(
        data.map((row) => row['material_code']?.trim()),
    );
    return uniqueCodes.size;
}

export function StockTakeDataTable() {
    const [notice, setNotice] = useState<NoticeState>(initialNoticeState);

    const showNotice = (variant: NoticeVariant, title: string, description: string) =>
        setNotice({ open: true, variant, title, description });

    const grid = useServerTable<StockTakeRecord>({
        endpoint: '/stock-take-records',
        storageKey: 'stock-take-records',
    });

    const table = useReactTable({
        data: grid.data,
        columns,
        getRowId: (row) => String(row.id),
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualFiltering: true,
        enableSorting: false,
        pageCount: grid.pageCount,
        state: grid.state,
        ...grid.handlers,
        // A status change is saved by the dialog; reload so the row shows it.
        meta: { onStatusChange: () => grid.refetch(), refetch: grid.refetch },
    });

    const [sessionLeader, setSessionLeader] = useState('');
    const [jsonData, setJsonData] = useState<Record<string, string>[]>([]);
    const [open, setOpen] = useState(false);

    const resetSessionForm = () => {
        setJsonData([]);
        setSessionLeader('');
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.trim().split(/\r?\n/);

            const headers = parseCSVLine(lines[0]);

            const data = lines.slice(1).map((line) => {
                const values = parseCSVLine(line);
                const obj: Record<string, string> = {};
                headers.forEach((header, i) => {
                    obj[header] = values[i] ?? '';
                });
                return obj;
            });

            setJsonData(data);
        };
        reader.readAsText(file);
    };

    // Action when submitting new session
    const handleSubmit = async () => {
        if (!sessionLeader || jsonData.length === 0) {
            showNotice('error', 'Missing Information', 'Please provide a session leader and upload a CSV file.');
            return;
        }

        const payload = {
            indv_batch_data: jsonData,
            metadata: {
                total_batches: jsonData.length,
                total_materials: countUniqueMaterialCodes(jsonData),
                total_checked_batches: 0,
                session_leader: sessionLeader,
                session_status: 'In Progress',
            },
        };

        const baseUrl = window.location.origin;
        try {
            await fetch(`${baseUrl}/csrf-token`, {
                credentials: 'include',
            });

            const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
            const csrfToken = match ? decodeURIComponent(match[1]) : '';
            const response = await fetch(`${baseUrl}/stock-take-records`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': csrfToken,
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                throw new Error('Failed to create session');
            }

            setSessionLeader('');
            setJsonData([]);
            grid.refetch();
            showNotice('success', 'Session Created', 'Session created successfully!');
        } catch (error) {
            console.error(error);
            showNotice('error', 'Creation Failed', 'Error creating session.');
        }
    };

    const createSessionDialog = (
        <Dialog
            open={open}
            onOpenChange={(isOpen) => {
                setOpen(isOpen);
                if (!isOpen) resetSessionForm();
            }}
        >
            <DialogTrigger asChild>
                <Button size="xs">
                    <PlusIcon />
                    New session
                </Button>
            </DialogTrigger>
            <DialogContent className="w-full max-w-[90vw] sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Create New Session</DialogTitle>
                    <DialogDescription>Fill out the details below to start a new stock take session.</DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div>
                        <label className="text-sm font-medium" htmlFor="stock-session-leader">
                            Session Leader
                        </label>
                        <Input
                            id="stock-session-leader"
                            placeholder="Enter leader name"
                            value={sessionLeader}
                            onChange={(e) => setSessionLeader(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium">Upload Stock Data</label>
                        <Button variant="outline" type="button" onClick={() => document.getElementById('stock-file')?.click()}>
                            <UploadIcon />
                            Upload File
                        </Button>
                        <input id="stock-file" type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                    </div>
                    {jsonData.length > 0 && (
                        <div className="max-h-[60vh] overflow-auto rounded-md border p-3 text-sm">
                            <Table size="dense">
                                <TableHeader>
                                    <TableRow>
                                        {Object.keys(jsonData[0]).map((key) => (
                                            <TableHead key={key}>{key}</TableHead>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jsonData.map((row, i) => (
                                        <TableRow key={i}>
                                            {Object.values(row).map((val, j) => (
                                                <TableCell key={j}>{val}</TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => {
                            resetSessionForm();
                            setOpen(false);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={async () => {
                            await handleSubmit();
                            setOpen(false);
                        }}
                        disabled={!sessionLeader || jsonData.length === 0}
                    >
                        Create Session
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    return (
        <>
            <DataGrid
                table={table}
                label="Stock take sessions"
                loading={grid.loading}
                error={grid.error}
                total={grid.total}
                onRetry={grid.refetch}
                search={grid.search}
                onSearchChange={grid.setSearch}
                searchPlaceholder="Search session, leader, status…"
                emptyMessage="No stock take sessions yet."
                actions={createSessionDialog}
            />

            <NoticeDialog
                open={notice.open}
                onOpenChange={(open) => setNotice((n) => ({ ...n, open }))}
                variant={notice.variant}
                title={notice.title}
                description={notice.description}
            />
        </>
    );
}
