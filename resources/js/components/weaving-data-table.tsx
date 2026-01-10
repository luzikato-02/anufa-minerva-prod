'use client';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
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
import { TensionRecordViewDialog } from '@/components/tension-record-view-dialog';
import {
    ColumnDef,
    ColumnFiltersState,
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    SortingState,
    useReactTable,
    VisibilityState,
} from '@tanstack/react-table';
import {
    ChevronDown,
    DownloadIcon,
    EyeIcon,
    MoreHorizontal,
} from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';

interface TensionRecord {
    id: string;
    record_type: 'twisting' | 'weaving';
    timestamp: string;
    csv_data: string;
    form_data: any;
    measurement_data: any;
    problems: any[];
    metadata: {
        total_measurements: number;
        completed_measurements: number;
        progress_percentage: number;
        operator: string;
        machine_number: string;
        item_number: string;
        item_description?: string;
    };
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

const createColumns = (onViewRecord: (record: TensionRecord) => void): ColumnDef<TensionRecord>[] => [
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
            const date = new Date(getValue() as string);
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
        accessorKey: 'Item Number',
        header: 'Item Number',
        accessorFn: (row) => row.metadata?.item_number,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Item Description',
        header: 'Item Description',
        accessorFn: (row) => row.metadata?.item_description,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Operator',
        header: 'Operator',
        accessorFn: (row) => row.metadata?.operator,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Machine Number',
        header: 'Machine Number',
        accessorFn: (row) => row.form_data?.machineNumber,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },

    {
        accessorKey: 'Color Code',
        header: 'Color Code',
        accessorFn: (row) => row.form_data?.colorCode,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Production Order',
        header: 'Production Order',
        accessorFn: (row) => row.form_data?.productionOrder,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Bale Number',
        header: 'Bale Number',
        accessorFn: (row) => row.form_data?.baleNumber,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Spec. Tension (cN)',
        header: 'Spec. Tension (cN)',
        accessorFn: (row) => row.form_data?.specTens,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Tens. Deviation (cN)',
        header: 'Tens. Deviation (cN)',
        accessorFn: (row) => row.form_data?.tensPlus,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Meters Check (m)',
        header: 'Meters Check (m)',
        accessorFn: (row) => row.form_data?.metersCheck,
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
            const handleDownload = () => {
                const baseUrl = window.location.origin;
                const url = `${baseUrl}/tension-records/${record.id}/download`;

                const a = document.createElement('a');
                a.href = url;
                a.click();
                URL.revokeObjectURL(url);
            };
            return (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onViewRecord(record)}>
                            <EyeIcon className="mr-2 h-4 w-4" />View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleDownload}>
                            <DownloadIcon className="mr-2 h-4 w-4" />Download CSV
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

export function WeavingDataTable() {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] =
        React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [data, setData] = useState<TensionRecord[]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');

    // View dialog state
    const [selectedRecord, setSelectedRecord] = useState<TensionRecord | null>(null);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);

    const handleViewRecord = (record: TensionRecord) => {
        setSelectedRecord(record);
        setViewDialogOpen(true);
    };

    const columns = React.useMemo(() => createColumns(handleViewRecord), []);

    const [pagination, setPagination] = useState({
        pageIndex: 0, // TanStack starts from 0
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

        params.append('type', 'weaving'); // 🧠 Filter by weaving type

        // 🧠 Add global filter (search box)
        if (globalFilter) {
            params.append('search', globalFilter);
        }

        // 🧠 Add column filters
        columnFilters.forEach((filter) => {
            if (filter.value) {
                params.append(filter.id, String(filter.value));
            }
        });

        // 🧠 Add sorting (from TanStack Table sorting state)
        if (sorting.length > 0) {
            const sort = sorting[0]; // single-column sort
            params.append('sort_by', sort.id);
            params.append('sort_dir', sort.desc ? 'desc' : 'asc');
        }

        try {
            const response = await fetch(
                `${baseUrl}/tension-records/?${params.toString()}`,
                {
                    credentials: 'include', // keep session if needed
                    signal: controller.signal,
                },
            );

            const json: LaravelPaginatedResponse<TensionRecord> =
                await response.json();

            setData(json.data);
            setTotalRows(json.total);
            setPageCount(json.last_page);
        } catch (error) {
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
            <div className="flex items-center py-4">
                <Input
                    placeholder="Search value"
                    value={globalFilter ?? ""}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="max-w-sm"
                />
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="ml-auto">
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

            {/* View Dialog */}
            {selectedRecord && (
                <TensionRecordViewDialog
                    record={selectedRecord}
                    open={viewDialogOpen}
                    onOpenChange={setViewDialogOpen}
                />
            )}
        </div>
    );
}
