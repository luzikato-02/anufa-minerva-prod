'use client';
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
import { get } from 'http';
import {
    ChevronDown,
    DownloadIcon,
    EyeIcon,
    MoreHorizontal,
    PencilIcon,
    UploadIcon,
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
        accessorFn: (row) => row.id,
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
        accessorKey: 'Total Batches Checked',
        header: 'Total Batches Checked',
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
            const handleDownload = () => {
                // const blob = new Blob([record.csv_data], { type: 'text/csv' });
                const baseUrl = window.location.origin;
                const url = `${baseUrl}/stock-take-records/${record.id}/download`;

                const a = document.createElement('a');
                a.href = url;
                // a.download = `ID${record.id}-${record.created_at}-${record.metadata.machine_number}-${record.metadata.operator}.csv`;
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
                        <DropdownMenuItem onClick={handleDownload}>
                            <DownloadIcon></DownloadIcon>Download
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                            <EyeIcon></EyeIcon>View
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                            <PencilIcon></PencilIcon>Change Status
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

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
                    `${baseUrl}/stock-take-records?${params.toString()}`,
                    {
                        credentials: 'include', // keep session if needed
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
        console.log(setJsonData);
        console.log(setSessionLeader);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.trim().split(/\r?\n/);

            // --- handle headers ---
            const headers = parseCSVLine(lines[0]);

            // --- handle data rows ---
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

    // --- Helper to correctly split CSV rows (supports quotes) ---
    function parseCSVLine(line: string): string[] {
        const result: string[] = [];
        let current = '';
        let insideQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"' && line[i + 1] === '"') {
                // escaped quote ("")
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

    const getUniqueMaterialCount = () => {
    const uniqueCodes = new Set(
        jsonData.map((row) => row['Material code']?.trim())
    );
    return uniqueCodes.size;
};

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
                session_status: 'in_progress',
            },
        };

        console.log('Submitting:', payload);

        try {
            const response = await fetch(`${baseUrl}/stock-take-records`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
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
                                Create New Session
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
                                {/* Preview (optional) */}
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
                                        resetSessionForm(); // ✅ manually reset first
                                        setOpen(false); // ✅ then close dialog
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button>Create Session</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
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
