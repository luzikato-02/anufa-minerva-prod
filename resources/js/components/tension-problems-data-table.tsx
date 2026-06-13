'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    useReactTable,
} from '@tanstack/react-table';
import * as React from 'react';
import { useEffect, useState } from 'react';

interface TensionProblemResolution {
    action: string;
    after_repair_max: number | null;
    after_repair_min: number | null;
    resolved_by: string;
    resolved_at: string;
}

interface TensionProblem {
    record_id: string;
    record_type: 'twisting' | 'weaving';
    item_number: string | null;
    operator: string | null;
    machine_number: string | null;
    record_created_at: string | null;
    problem_id: number | string | null;
    spindle_number: number | null;
    position: string | null;
    description: string | null;
    timestamp: string | null;
    status: 'open' | 'resolved';
    resolution: TensionProblemResolution | null;
}

interface LaravelPaginatedResponse<T> {
    current_page: number;
    data: T[];
    last_page: number;
    per_page: number;
    total: number;
}

type TensionProblemsTableMeta = {
    refetch: () => void;
};

const formatDate = (date?: string | null) =>
    date
        ? new Date(date).toLocaleString('en-ID', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
          })
        : 'N/A';

function ResolveProblemDialog({
    problem,
    onResolved,
}: {
    problem: TensionProblem;
    onResolved: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [action, setAction] = useState('');
    const [afterMax, setAfterMax] = useState('');
    const [afterMin, setAfterMin] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        setSubmitting(true);
        setError(null);
        try {
            const baseUrl = window.location.origin;
            await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' });
            const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
            const csrfToken = match ? decodeURIComponent(match[1]) : '';

            const res = await fetch(
                `${baseUrl}/tension-records/${problem.record_id}/problems/${problem.problem_id}/resolve`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'X-XSRF-TOKEN': csrfToken,
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                        action,
                        after_repair_max: afterMax === '' ? null : Number(afterMax),
                        after_repair_min: afterMin === '' ? null : Number(afterMin),
                    }),
                },
            );

            if (!res.ok) throw new Error('Failed to resolve problem');

            setOpen(false);
            setAction('');
            setAfterMax('');
            setAfterMin('');
            onResolved();
        } catch (e: any) {
            setError(e.message ?? 'Error resolving problem');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm">Resolve</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Resolve Issue</DialogTitle>
                    <DialogDescription>
                        {problem.spindle_number != null ? `Spindle ${problem.spindle_number}` : problem.position}
                        {' — '}
                        {problem.item_number ?? 'N/A'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="resolution-action">Resolution Action</Label>
                        <Textarea
                            id="resolution-action"
                            value={action}
                            onChange={(e) => setAction(e.target.value)}
                            placeholder="Describe the action taken to resolve this issue..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="after-repair-max">After-Repair Max</Label>
                            <Input
                                id="after-repair-max"
                                type="number"
                                step="any"
                                value={afterMax}
                                onChange={(e) => setAfterMax(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="after-repair-min">After-Repair Min</Label>
                            <Input
                                id="after-repair-min"
                                type="number"
                                step="any"
                                value={afterMin}
                                onChange={(e) => setAfterMin(e.target.value)}
                            />
                        </div>
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting || !action.trim()}>
                        {submitting ? 'Saving...' : 'Mark Resolved'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ViewResolutionDialog({ problem }: { problem: TensionProblem }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                    View Resolution
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Resolution Details</DialogTitle>
                    <DialogDescription>
                        {problem.spindle_number != null ? `Spindle ${problem.spindle_number}` : problem.position}
                        {' — '}
                        {problem.item_number ?? 'N/A'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Action Taken</p>
                        <p className="mt-1">{problem.resolution?.action ?? 'N/A'}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">After-Repair Max</p>
                            <p className="mt-1 font-semibold">{problem.resolution?.after_repair_max ?? 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">After-Repair Min</p>
                            <p className="mt-1 font-semibold">{problem.resolution?.after_repair_min ?? 'N/A'}</p>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">Resolved By</p>
                        <p className="mt-1">
                            {problem.resolution?.resolved_by ?? 'N/A'} on {formatDate(problem.resolution?.resolved_at)}
                        </p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export const columns: ColumnDef<TensionProblem>[] = [
    {
        accessorKey: 'Record Date',
        header: 'Record Date',
        accessorFn: (row) => row.record_created_at,
        cell: ({ getValue }) => {
            const value = getValue<string | null>();
            if (!value) return <div>N/A</div>;
            return (
                <div>
                    {new Date(value).toLocaleString('en-ID', {
                        day: '2-digit',
                        month: 'numeric',
                        year: 'numeric',
                    })}
                </div>
            );
        },
    },
    {
        accessorKey: 'Type',
        header: 'Type',
        accessorFn: (row) => row.record_type,
        cell: ({ getValue }) => (
            <Badge variant="outline" className="capitalize">
                {getValue<string>()}
            </Badge>
        ),
    },
    {
        accessorKey: 'Item Number',
        header: 'Item Number',
        accessorFn: (row) => row.item_number,
        cell: ({ getValue }) => <div className="capitalize">{getValue() ?? 'N/A'}</div>,
    },
    {
        accessorKey: 'Operator',
        header: 'Operator',
        accessorFn: (row) => row.operator,
        cell: ({ getValue }) => <div className="capitalize">{getValue() ?? 'N/A'}</div>,
    },
    {
        accessorKey: 'Machine Number',
        header: 'Machine Number',
        accessorFn: (row) => row.machine_number,
        cell: ({ getValue }) => <div className="capitalize">{getValue() ?? 'N/A'}</div>,
    },
    {
        accessorKey: 'Position',
        header: 'Position/Spindle',
        accessorFn: (row) => (row.spindle_number != null ? `Spindle ${row.spindle_number}` : row.position ?? 'N/A'),
        cell: ({ getValue }) => <div>{getValue() ?? 'N/A'}</div>,
    },
    {
        accessorKey: 'Description',
        header: 'Description',
        accessorFn: (row) => row.description,
        cell: ({ getValue }) => {
            const value = getValue<string | null>();
            return (
                <div className="max-w-[240px] truncate" title={value ?? ''}>
                    {value ?? 'N/A'}
                </div>
            );
        },
    },
    {
        accessorKey: 'Status',
        header: 'Status',
        accessorFn: (row) => row.status,
        cell: ({ getValue }) => {
            const status = getValue<string>();
            return (
                <Badge variant={status === 'resolved' ? 'secondary' : 'destructive'} className="capitalize">
                    {status}
                </Badge>
            );
        },
    },
    {
        id: 'actions',
        header: 'Actions',
        enableHiding: false,
        cell: ({ row, table }) => {
            const problem = row.original;
            const meta = table.options.meta as TensionProblemsTableMeta;
            return problem.status === 'resolved' ? (
                <ViewResolutionDialog problem={problem} />
            ) : (
                <ResolveProblemDialog problem={problem} onResolved={meta.refetch} />
            );
        },
    },
];

export function TensionProblemsDataTable() {
    const [data, setData] = useState<TensionProblem[]>([]);
    const [pageCount, setPageCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [globalFilter, setGlobalFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'open' | 'resolved'>('all');
    const [typeFilter, setTypeFilter] = useState<'all' | 'twisting' | 'weaving'>('all');
    const [refreshKey, setRefreshKey] = useState(0);

    const [pagination, setPagination] = useState({
        pageIndex: 0,
        pageSize: 10,
    });

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        manualPagination: true,
        pageCount,
        onPaginationChange: setPagination,
        state: {
            pagination,
        },
        meta: {
            refetch: () => setRefreshKey((k) => k + 1),
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
            if (statusFilter !== 'all') {
                params.append('status', statusFilter);
            }
            if (typeFilter !== 'all') {
                params.append('type', typeFilter);
            }

            try {
                const response = await fetch(`${baseUrl}/tension-problems?${params.toString()}`, {
                    credentials: 'include',
                    signal: controller.signal,
                });

                const json: LaravelPaginatedResponse<TensionProblem> = await response.json();

                setData(json.data);
                setPageCount(json.last_page);
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
    }, [pagination.pageIndex, pagination.pageSize, globalFilter, statusFilter, typeFilter, refreshKey]);

    return (
        <div className="w-full">
            <div className="flex items-center gap-2 py-4">
                <Input
                    placeholder="Search value"
                    value={globalFilter ?? ''}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="max-w-sm"
                />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | 'open' | 'resolved')}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as 'all' | 'twisting' | 'weaving')}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="twisting">Twisting</SelectItem>
                        <SelectItem value="weaving">Weaving</SelectItem>
                    </SelectContent>
                </Select>
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
                                            : flexRender(header.column.columnDef.header, header.getContext())}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                                <TableRow key={row.id}>
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
                                    {loading ? 'Loading...' : 'No reported problems found.'}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
            <div className="flex items-center justify-end space-x-2 py-4">
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
