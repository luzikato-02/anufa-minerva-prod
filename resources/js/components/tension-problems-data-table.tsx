'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    CheckCircle,
    ChevronDown,
    MoreHorizontal,
} from 'lucide-react';
import * as React from 'react';
import { useEffect, useState } from 'react';

interface TensionProblem {
    id: number;
    tension_record_id: number;
    position_identifier: string;
    problem_type: string;
    description: string;
    measured_value: number | null;
    expected_min: number | null;
    expected_max: number | null;
    severity: 'low' | 'medium' | 'high' | 'critical';
    resolution_status: 'open' | 'acknowledged' | 'in_progress' | 'resolved' | 'ignored';
    resolution_notes: string | null;
    resolved_at: string | null;
    reported_at: string;
    created_at: string;
    tension_record?: {
        id: number;
        record_type: 'twisting' | 'weaving';
        machine_number: string;
        operator: string;
    };
    resolver?: {
        id: number;
        name: string;
    };
}

interface LaravelPaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    per_page: number;
    total: number;
}

const severityColors: Record<string, string> = {
    low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const statusColors: Record<string, string> = {
    open: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    acknowledged: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    in_progress: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    resolved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    ignored: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};

const problemTypeLabels: Record<string, string> = {
    tension_high: 'Tension High',
    tension_low: 'Tension Low',
    equipment_malfunction: 'Equipment Malfunction',
    yarn_break: 'Yarn Break',
    quality_issue: 'Quality Issue',
    other: 'Other',
};

export const columns: ColumnDef<TensionProblem>[] = [
    {
        accessorKey: 'reported_at',
        header: 'Reported Date',
        cell: ({ getValue }) => {
            const date = new Date(getValue() as string);
            return (
                <div className="whitespace-nowrap">
                    {date.toLocaleString('en-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                    })}
                </div>
            );
        },
    },
    {
        accessorKey: 'record_type',
        header: 'Type',
        accessorFn: (row) => row.tension_record?.record_type,
        cell: ({ getValue }) => (
            <Badge variant="outline" className="capitalize">
                {(getValue() as string) ?? 'N/A'}
            </Badge>
        ),
    },
    {
        accessorKey: 'machine_number',
        header: 'Machine',
        accessorFn: (row) => row.tension_record?.machine_number,
        cell: ({ getValue }) => (
            <div className="font-medium">{(getValue() as string) ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'position_identifier',
        header: 'Position',
        cell: ({ getValue }) => (
            <div className="font-mono text-sm">{getValue() as string}</div>
        ),
    },
    {
        accessorKey: 'problem_type',
        header: 'Problem Type',
        cell: ({ getValue }) => (
            <div className="capitalize">
                {problemTypeLabels[getValue() as string] ?? getValue()}
            </div>
        ),
    },
    {
        accessorKey: 'description',
        header: 'Description',
        cell: ({ getValue }) => (
            <div className="max-w-[200px] truncate" title={getValue() as string}>
                {getValue() as string}
            </div>
        ),
    },
    {
        accessorKey: 'severity',
        header: 'Severity',
        cell: ({ getValue }) => {
            const severity = getValue() as string;
            return (
                <Badge className={severityColors[severity]}>
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'resolution_status',
        header: 'Status',
        cell: ({ getValue }) => {
            const status = getValue() as string;
            return (
                <Badge className={statusColors[status]}>
                    {status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </Badge>
            );
        },
    },
    {
        accessorKey: 'operator',
        header: 'Operator',
        accessorFn: (row) => row.tension_record?.operator,
        cell: ({ getValue }) => (
            <div className="capitalize">{(getValue() as string) ?? 'N/A'}</div>
        ),
    },
    {
        id: 'actions',
        header: 'Actions',
        enableHiding: false,
        cell: ({ row }) => {
            const problem = row.original;
            const baseUrl = window.location.origin;

            const handleResolve = async () => {
                try {
                    const response = await fetch(
                        `${baseUrl}/tension-problems/${problem.id}/resolve`,
                        {
                            method: 'PATCH',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json',
                            },
                            credentials: 'include',
                        }
                    );
                    if (response.ok) {
                        window.location.reload();
                    }
                } catch (error) {
                    console.error('Failed to resolve problem:', error);
                }
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
                        {problem.resolution_status !== 'resolved' && (
                            <>
                                <DropdownMenuItem onClick={handleResolve}>
                                    <CheckCircle className="mr-2 h-4 w-4" />
                                    Mark as Resolved
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                            </>
                        )}
                        <DropdownMenuItem
                            onClick={() => {
                                window.location.href = `${baseUrl}/tension-records/${problem.tension_record_id}`;
                            }}
                        >
                            View Record
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

export function TensionProblemsDataTable() {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState({});
    const [data, setData] = useState<TensionProblem[]>([]);
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

            try {
                const response = await fetch(
                    `${baseUrl}/tension-problems?${params.toString()}`,
                    {
                        credentials: 'include',
                        signal: controller.signal,
                    }
                );

                const json: LaravelPaginatedResponse<TensionProblem> = await response.json();

                setData(json.data);
                setPageCount(json.last_page);
            } catch (error: unknown) {
                if (error instanceof Error && error.name !== 'AbortError') {
                    console.error('Fetch error:', error);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        return () => controller.abort();
    }, [baseUrl, pagination.pageIndex, pagination.pageSize, sorting, globalFilter, columnFilters]);

    return (
        <div className="w-full">
            <div className="flex items-center py-4">
                <Input
                    placeholder="Search problems..."
                    value={globalFilter ?? ''}
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
                            .map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    className="capitalize"
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) =>
                                        column.toggleVisibility(!!value)
                                    }
                                >
                                    {column.id.replace('_', ' ')}
                                </DropdownMenuCheckboxItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <div className="overflow-hidden rounded-md border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext()
                                              )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell
                                    colSpan={columns.length}
                                    className="h-24 text-center"
                                >
                                    Loading problems...
                                </TableCell>
                            </TableRow>
                        ) : table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && 'selected'}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
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
                                    No problems found.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                    Showing {data.length} problem(s)
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
