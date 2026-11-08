'use client';

import { DataGrid } from '@/components/data-grid';
import { CodeCell, DateTimeCell, TextCell } from '@/components/data-grid-cells';
import { Segmented } from '@/components/segmented';
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
import { Textarea } from '@/components/ui/textarea';
import { useServerTable } from '@/hooks/use-server-table';
import { cn } from '@/lib/utils';
import {
    type ColumnDef,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';

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
                        after_repair_max:
                            afterMax === '' ? null : Number(afterMax),
                        after_repair_min:
                            afterMin === '' ? null : Number(afterMin),
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
                <Button size="xs" variant="outline">
                    Resolve
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Resolve Issue</DialogTitle>
                    <DialogDescription>
                        {problem.spindle_number != null
                            ? `Spindle ${problem.spindle_number}`
                            : problem.position}
                        {' — '}
                        {problem.item_number ?? 'N/A'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label htmlFor="resolution-action">
                            Resolution Action
                        </Label>
                        <Textarea
                            id="resolution-action"
                            value={action}
                            onChange={(e) => setAction(e.target.value)}
                            placeholder="Describe the action taken to resolve this issue..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label htmlFor="after-repair-max">
                                After-Repair Max
                            </Label>
                            <Input
                                id="after-repair-max"
                                type="number"
                                step="any"
                                value={afterMax}
                                onChange={(e) => setAfterMax(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="after-repair-min">
                                After-Repair Min
                            </Label>
                            <Input
                                id="after-repair-min"
                                type="number"
                                step="any"
                                value={afterMin}
                                onChange={(e) => setAfterMin(e.target.value)}
                            />
                        </div>
                    </div>
                    {error && (
                        <p className="text-sm text-destructive">{error}</p>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={submitting || !action.trim()}
                    >
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
                <Button size="xs" variant="outline">
                    View resolution
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Resolution Details</DialogTitle>
                    <DialogDescription>
                        {problem.spindle_number != null
                            ? `Spindle ${problem.spindle_number}`
                            : problem.position}
                        {' — '}
                        {problem.item_number ?? 'N/A'}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">
                            Action Taken
                        </p>
                        <p className="mt-1">
                            {problem.resolution?.action ?? 'N/A'}
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">
                                After-Repair Max
                            </p>
                            <p className="mt-1 font-semibold">
                                {problem.resolution?.after_repair_max ?? 'N/A'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 uppercase">
                                After-Repair Min
                            </p>
                            <p className="mt-1 font-semibold">
                                {problem.resolution?.after_repair_min ?? 'N/A'}
                            </p>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-medium text-gray-500 uppercase">
                            Resolved By
                        </p>
                        <p className="mt-1">
                            {problem.resolution?.resolved_by ?? 'N/A'} on{' '}
                            {formatDate(problem.resolution?.resolved_at)}
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

function StatusCell({ status }: { status: TensionProblem['status'] }) {
    const open = status !== 'resolved';
    return (
        <span className="inline-flex items-center gap-1.5 text-xs">
            <span
                aria-hidden="true"
                className={cn(
                    'size-1.5 rounded-full',
                    open ? 'bg-orange-500' : 'bg-emerald-600',
                )}
            />
            <span
                className={
                    open
                        ? 'text-orange-700 dark:text-orange-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                }
            >
                {open ? 'Open' : 'Resolved'}
            </span>
        </span>
    );
}

export const columns: ColumnDef<TensionProblem>[] = [
    {
        id: 'recorded_at',
        accessorFn: (row) => row.record_created_at,
        header: 'Recorded',
        cell: ({ getValue }) => <DateTimeCell value={getValue()} />,
        meta: { label: 'Record date' },
    },
    {
        id: 'type',
        accessorFn: (row) => row.record_type,
        header: 'Type',
        cell: ({ getValue }) => (
            <span className="text-xs text-muted-foreground capitalize">
                {String(getValue() ?? '')}
            </span>
        ),
        meta: { label: 'Type' },
    },
    {
        id: 'machine',
        accessorFn: (row) => row.machine_number,
        header: 'Machine',
        cell: ({ getValue }) => <CodeCell value={getValue()} strong />,
        meta: { label: 'Machine' },
    },
    {
        id: 'position',
        accessorFn: (row) =>
            row.spindle_number != null
                ? `Sp ${row.spindle_number}`
                : row.position,
        header: 'Position',
        cell: ({ getValue }) => <CodeCell value={getValue()} />,
        meta: { label: 'Position / spindle' },
    },
    {
        id: 'item_number',
        accessorFn: (row) => row.item_number,
        header: 'Item no.',
        cell: ({ getValue }) => <CodeCell value={getValue()} muted />,
        meta: { label: 'Item number' },
    },
    {
        id: 'operator',
        accessorFn: (row) => row.operator,
        header: 'Operator',
        cell: ({ getValue }) => <TextCell value={getValue()} />,
        meta: { label: 'Operator' },
    },
    {
        id: 'description',
        enableSorting: false,
        accessorFn: (row) => row.description,
        header: 'Description',
        cell: ({ getValue }) => {
            const value = getValue() as string | null;
            return value ? (
                <span className="block max-w-72 truncate" title={value}>
                    {value}
                </span>
            ) : (
                <TextCell value={null} />
            );
        },
        meta: { label: 'Description' },
    },
    {
        id: 'status',
        accessorFn: (row) => row.status,
        header: 'Status',
        cell: ({ row }) => <StatusCell status={row.original.status} />,
        meta: { label: 'Status' },
    },
    {
        id: 'actions',
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        enableHiding: false,
        cell: ({ row, table }) =>
            row.original.status === 'resolved' ? (
                <ViewResolutionDialog problem={row.original} />
            ) : (
                <ResolveProblemDialog
                    problem={row.original}
                    onResolved={() => table.options.meta?.refetch?.()}
                />
            ),
        meta: { className: 'w-32 text-right' },
    },
];

type StatusFilter = 'all' | 'open' | 'resolved';
type TypeFilter = 'all' | 'twisting' | 'weaving';

export function TensionProblemsDataTable() {
    // A problem queue starts on what still needs fixing.
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
    const params = useMemo(
        () => ({ status: statusFilter, type: typeFilter }),
        [statusFilter, typeFilter],
    );

    const grid = useServerTable<TensionProblem>({
        endpoint: '/tension-problems',
        params,
        storageKey: 'tension-problems',
    });

    const table = useReactTable({
        data: grid.data,
        columns,
        getRowId: (row, index) => `${row.record_id}-${row.problem_id ?? index}`,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualFiltering: true,
        manualSorting: true,
        enableSortingRemoval: true,
        enableRowSelection: false,
        pageCount: grid.pageCount,
        state: grid.state,
        ...grid.handlers,
        meta: { refetch: grid.refetch },
    });

    return (
        <DataGrid
            table={table}
            label="Tension problems"
            loading={grid.loading}
            error={grid.error}
            total={grid.total}
            onRetry={grid.refetch}
            search={grid.search}
            onSearchChange={grid.setSearch}
            searchPlaceholder="Search machine, position, description…"
            emptyMessage={
                statusFilter === 'open'
                    ? 'No open problems. Everything reported has been resolved.'
                    : 'No problems recorded.'
            }
            filters={
                <>
                    <Segmented
                        label="Status"
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[
                            { value: 'open', label: 'Open' },
                            { value: 'resolved', label: 'Resolved' },
                            { value: 'all', label: 'All' },
                        ]}
                    />
                    <Segmented
                        label="Record type"
                        value={typeFilter}
                        onChange={setTypeFilter}
                        options={[
                            { value: 'all', label: 'Both types' },
                            { value: 'twisting', label: 'Twisting' },
                            { value: 'weaving', label: 'Weaving' },
                        ]}
                    />
                </>
            }
        />
    );
}
