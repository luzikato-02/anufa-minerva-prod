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

interface FinishEarlierRecord {
    id: string;
    timestamp: string;
    metadata: {
        machine_number: any
        style: any
        production_order: any
        roll_construction: any
        shift_group: any
        total_finish_earlier: any
        average_meters_finish: any
    };
    entries: any;
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

export const columns: ColumnDef<FinishEarlierRecord>[] = [
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
        accessorKey: 'Shift Group',
        header: 'Shift Group',
        accessorFn: (row) => row.metadata?.shift_group,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Machine Number',
        header: 'Machine Number',
        accessorFn: (row) => row.metadata?.machine_number,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Production Order',
        header: 'Production Order',
        accessorFn: (row) => row.metadata?.production_order,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Material Description',
        header: 'Material Description',
        accessorFn: (row) => row.metadata?.style,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Roll Construction',
        header: 'Roll Construction',
        accessorFn: (row) => row.metadata?.roll_construction,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Total Finish Ealier Bobbins',
        header: 'Total Finish Ealier Bobbins',
        accessorFn: (row) => row.metadata?.total_finish_earlier,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Average Meters Finish',
        header: 'Average Meters Finish',
        accessorFn: (row) => row.metadata?.average_meters_finish,
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
            return <ViewSessionDialog record={record} />;
        },
    },
];

function ViewSessionDialog({ record }: { record: FinishEarlierRecord }) {
    const [open, setOpen] = useState(false);
    const [statusDialogOpen, setStatusDialogOpen] = useState(false);

    const handleDownloadCSV = async () => {
        try {
            const baseUrl = window.location.origin;
            const url = `${baseUrl}/finish-earlier/${record.metadata.production_order}/download`;

            // Fetch JSON from backend
            const response = await fetch(url);
            const data = await response.json();

            if (!data.metadata) {
                alert("Session not found");
                return;
            }

            let csvContent = "";

            // 1️⃣ Add metadata
            csvContent += "Machine,Style,Production Order,Roll Construction,Total Finish Earlier,Average Meters Finish\n";
            csvContent += `${data.metadata.machine_number},${data.metadata.style},${data.metadata.production_order},${data.metadata.roll_construction},${data.metadata.total_finish_earlier},${data.metadata.average_meters_finish}\n\n`;

            // 2️⃣ Add table headers
            csvContent += "No,Side,Row,Col,Meters\n";

            // 3️⃣ Add entries (pad to 80 rows)
            for (let i = 0; i < 80; i++) {
                const entry = data.entries[i] || {}; // empty object if not enough entries
                csvContent += `${i + 1},${entry.creel_side || ''},${entry.row_number || ''},${entry.column_number || ''},${entry.meters_finish || ''}\n`;
            }

            // 4️⃣ Create a downloadable link
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const downloadUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = downloadUrl;
            a.download = `FinishEarlier_${record.metadata.production_order}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (error) {
            console.error('Failed to download CSV:', error);
            alert('Failed to download CSV.');
        }
    };


    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => setOpen(true)}>
            <EyeIcon className="h-4 w-4" />
        </Button>
            </DialogTrigger>
            <DialogContent className="p-0 sm:max-w-[700px]">
                <DialogHeader className="px-6 pt-6">
                    <DialogTitle>Cable Finish Earlier Summary</DialogTitle>
                    <DialogDescription>
                        Production Order: {record.metadata.production_order}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 pb-6">
                    <div className="rounded-lg bg-gray-50 p-4">
                        <div className="flex items-start justify-between gap-4">
                            {/* Left side */}
                            <div className="flex-1 space-y-1">
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Material Description
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.metadata.style}
                                </p>

                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Machine Number
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.metadata.machine_number}
                                </p>
                            </div>

                            {/* Right side - Stats */}
                            <div className="flex-1 space-y-3">
                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase">
                                        Total Finish Earlier Bobbins
                                    </p>
                                    <p className="mt-1 text-sm font-semibold">
                                        {record.metadata.total_finish_earlier}
                                    </p>
                                </div>

                                <div>
                                    <p className="text-xs font-medium text-gray-500 uppercase">
                                        Average Meters Finish
                                    </p>
                                    <p className="mt-1 text-sm font-semibold text-green-600">
                                        {record.metadata.average_meters_finish}
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
                </div>

                <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={handleDownloadCSV}>
                        <DownloadIcon className="mr-2 h-4 w-4" />
                        Download CSV
                    </Button>

                    {/* <Dialog
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
                    </Dialog> */}

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

export function FinishEarlierDataTable() {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [data, setData] = useState<FinishEarlierRecord[]>([]);
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
                    `${baseUrl}/finish-earlier?${params.toString()}`,
                    {
                        credentials: 'include',
                        signal: controller.signal,
                    },
                );

                const json: LaravelPaginatedResponse<FinishEarlierRecord> =
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
