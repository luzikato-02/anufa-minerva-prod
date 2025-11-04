'use client';
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
    DropdownMenuCheckboxItem,
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
    CircleAlertIcon,
    DownloadIcon,
    EyeIcon,
    MoreHorizontal,
    PlusIcon,
    UploadIcon,
    VerifiedIcon,
} from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';

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

interface LaravelPaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    per_page: number;
    total: number;
}

export const columns: ColumnDef<StockTakeRecord>[] = [
    {
        id: 'select',
        header: ({ table }) => (
            <Checkbox
                checked={
                    table.getIsAllPageRowsSelected() ||
                    (table.getIsSomePageRowsSelected() && 'indeterminate')
                }
                onCheckedChange={(value) =>
                    table.toggleAllPageRowsSelected(!!value)
                }
                aria-label="Select all"
            />
        ),
        cell: ({ row }) => (
            <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={(value) => row.toggleSelected(!!value)}
                aria-label="Select row"
            />
        ),
        enableSorting: false,
        enableHiding: false,
    },
    {
        accessorKey: 'Date',
        header: 'Record Date',
        accessorFn: (row) => row.created_at,
        cell: ({ getValue }) => {
            const date = new Date(getValue());
            return (
                <div>
                    {date.toLocaleString('en-ID', {
                        day: '2-digit',
                        month: 'numeric',
                        year: 'numeric',
                    })}
                </div>
            );
        },
    },
    {
        accessorKey: 'Session ID',
        header: 'Session ID',
        accessorFn: (row) => row.session_id,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Session Leader',
        header: 'Session Leader',
        accessorFn: (row) => row.metadata?.session_leader,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Session Status',
        header: 'Session Status',
        accessorFn: (row) => row.metadata?.session_status,
        cell: ({ getValue }) => {
            if (getValue() === 'In Progress') {
                return <Badge variant="secondary">{getValue()}</Badge>;
            } else if (getValue() === 'Completed') {
                return (
                    <Badge
                        variant="secondary"
                        className="bg-blue-500 text-white dark:bg-blue-600"
                    >
                        <VerifiedIcon></VerifiedIcon>
                        {getValue()}
                    </Badge>
                );
            } else {
                return (
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-sm font-medium text-gray-800">
                        {getValue() ?? 'N/A'}
                    </span>
                );
            }
        },
    },
    {
        accessorKey: 'Total Materials',
        header: 'Total Materials',
        accessorFn: (row) => row.metadata?.total_materials,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Total Batches',
        header: 'Total Batches',
        accessorFn: (row) => row.metadata?.total_batches,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Total Found Batches',
        header: 'Total Found Batches',
        accessorFn: (row) => row.metadata?.total_checked_batches,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        id: 'actions',
        header: 'Actions',
        enableHiding: false,
        cell: ({ row }) => {
            const record = row.original;
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <ViewSessionDialog record={record} />
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

function ViewSessionDialog({ record }: { record: StockTakeRecord }) {
    const [open, setOpen] = useState(false);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);
    const [newStatus, setNewStatus] = useState(record.metadata.session_status);

    const similitudeRatio =
        record.metadata.total_batches > 0
            ? Math.round(
                  (record.metadata.total_checked_batches /
                      record.metadata.total_batches) *
                      100,
              )
            : 0;

    const handleDownloadCSV = async () => {
        try {
            const baseUrl = window.location.origin;
            const url = `${baseUrl}/stock-take-records/${record.id}/download`;

            // Fetch JSON from backend
            const response = await fetch(url);
            const data = await response.json();

            if (!data.success || !data.summary || data.summary.length === 0) {
                alert(data.message || 'No data available for download.');
                return;
            }

            const summary = data.summary;

            // Convert JSON array to CSV
            const headers = Object.keys(summary[0]);
            const csvRows = [
                headers.join(','), // header row
                ...summary.map((row) =>
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
            alert('Failed to download CSV.');
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

            console.log('Extracted CSRF Token from cookie:', csrfToken);
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

            alert('Session status updated successfully!');
            setStatusDialogOpen(false);
        } catch (error) {
            console.error(error);
            alert('Error updating session status.');
        }
    };

    return (
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
                                        <Badge className="bg-blue-500 text-white">
                                            <VerifiedIcon className="mr-1 h-3 w-3" />
                                            Completed
                                        </Badge>
                                    ) : (
                                        <Badge
                                            variant="secondary"
                                            className="bg-blue-500 text-white dark:bg-blue-600"
                                        >
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
                                        {record.metadata.total_checked_batches}
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

                    {/* Progress Bar */}
                    {/* <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-600">Completion</span>
              <span className="text-xs font-semibold">{similitudeRatio}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${similitudeRatio}%` }}></div>
            </div>
          </div> */}

                    {/* Batches Preview */}
                    {record.stock_take_summary &&
                        record.stock_take_summary.length > 0 && (
                            <div className="space-y-3">
                                <p className="text-sm font-semibold">
                                    Summary Preview
                                </p>
                                <div className="max-h-40 overflow-y-auto rounded-md border">
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
                                                .map((batch, idx) => (
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
                                                ))}
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
                                <DialogTitle>Change Session Status</DialogTitle>
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
                                    onClick={() => setStatusDialogOpen(false)}
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
    );
}

export function StockTakeDataTable() {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [data, setData] = useState<StockTakeRecord[]>([]);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');

    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

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
        state: {
            sorting,
            columnFilters,
            columnVisibility,
            rowSelection,
            pagination,
        },
    });

    const baseUrl = window.location.origin;
    useEffect(() => {
        const controller = new AbortController();

        const fetchData = async () => {
            setLoading(true);

            const params = new URLSearchParams({
                page: (pagination.pageIndex + 1).toString(),
                per_page: pagination.pageSize.toString(),
            });

            if (globalFilter) {
                params.append('search', globalFilter);
            }

            columnFilters.forEach((filter) => {
                if (filter.value) {
                    params.append(filter.id, String(filter.value));
                }
            });

            if (sorting.length > 0) {
                const sort = sorting[0];
                params.append('sort_by', sort.id);
                params.append('sort_dir', sort.desc ? 'desc' : 'asc');
            }

            try {
                const response = await fetch(
                    `${baseUrl}/stock-take-records?${params.toString()}`,
                    {
                        credentials: 'include',
                        signal: controller.signal,
                    },
                );

                const json: LaravelPaginatedResponse<StockTakeRecord> =
                    await response.json();
                console.log(json);

                setData(json.data);
            } catch (error: any) {
                if (error.name !== 'AbortError') {
                    console.error('Fetch error:', error);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => controller.abort();
    }, [
        pagination.pageIndex,
        pagination.pageSize,
        sorting,
        globalFilter,
        columnFilters,
    ]);

    const [sessionLeader, setSessionLeader] = useState('');
    const [jsonData, setJsonData] = useState<any[]>([]);
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
    const getUniqueMaterialCount = () => {
        const uniqueCodes = new Set(
            jsonData.map((row) => row['material_code']?.trim()),
        );
        return uniqueCodes.size;
    };

    // Action when submitting new session
    const handleSubmit = async () => {
        if (!sessionLeader || jsonData.length === 0) {
            alert('Please provide a session leader and upload a CSV file.');
            return;
        }

        const payload = {
            indv_batch_data: jsonData,
            metadata: {
                total_batches: jsonData.length,
                total_materials: getUniqueMaterialCount(),
                total_checked_batches: 0,
                session_leader: sessionLeader,
                session_status: 'In Progress',
            },
        };

        console.log('Submitting:', payload);
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

            alert('Session created successfully!');
            setSessionLeader('');
            setJsonData([]);
        } catch (error) {
            console.error(error);
            alert('Error creating session.');
        }
    };

    return (
        <div className="w-full">
            <div className="flex items-center justify-between py-4">
                <Input
                    placeholder="Search value"
                    value={globalFilter ?? ''}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="max-w-sm"
                />
                <div className="ml-auto flex items-center gap-2">
                    <Dialog
                        open={open}
                        onOpenChange={(isOpen) => {
                            setOpen(isOpen);
                            if (!isOpen) resetSessionForm();
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button className="bg-primary text-white hover:bg-primary/90">
                                <PlusIcon></PlusIcon>Create New Session
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full max-w-[90vw] sm:max-w-4xl">
                            <DialogHeader>
                                <DialogTitle>Create New Session</DialogTitle>
                                <DialogDescription>
                                    Fill out the details below to start a new
                                    stock take session.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4 py-2">
                                <div>
                                    <label className="text-sm font-medium">
                                        Session Leader
                                    </label>
                                    <Input
                                        placeholder="Enter leader name"
                                        value={sessionLeader}
                                        onChange={(e) =>
                                            setSessionLeader(e.target.value)
                                        }
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-medium">
                                        Upload Stock Data
                                    </label>
                                    <Button
                                        variant="outline"
                                        type="button"
                                        onClick={() =>
                                            document
                                                .getElementById('stock-file')
                                                ?.click()
                                        }
                                    >
                                        <UploadIcon></UploadIcon>Upload File
                                    </Button>
                                    <input
                                        id="stock-file"
                                        type="file"
                                        accept=".csv"
                                        className="hidden"
                                        onChange={handleFileUpload}
                                    />
                                </div>
                                {jsonData.length > 0 && (
                                    <div className="max-h-[60vh] overflow-auto rounded-md border p-3 text-sm">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    {Object.keys(
                                                        jsonData[0],
                                                    ).map((key) => (
                                                        <TableHead key={key}>
                                                            {key}
                                                        </TableHead>
                                                    ))}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {jsonData.map((row, i) => (
                                                    <TableRow key={i}>
                                                        {Object.values(row).map(
                                                            (val, j) => (
                                                                <TableCell
                                                                    key={j}
                                                                >
                                                                    {val}
                                                                </TableCell>
                                                            ),
                                                        )}
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
                                    disabled={
                                        !sessionLeader || jsonData.length === 0
                                    }
                                >
                                    Create Session
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                className="ml-auto bg-transparent"
                            >
                                Columns <ChevronDown />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide())
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) =>
                                                column.toggleVisibility(!!value)
                                            }
                                        >
                                            {column.id}
                                        </DropdownMenuCheckboxItem>
                                    );
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef
                                                          .header,
                                                      header.getContext(),
                                                  )}
                                        </TableHead>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={
                                        row.getIsSelected() && 'selected'
                                    }
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    Contacting server for information...
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length} of{' '}
                    {table.getFilteredRowModel().rows.length} row(s) selected.
                </div>
                <div className="space-x-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </div>
        </div>
    );
}
