import { DataGrid } from '@/components/data-grid';
import { DateTimeCell, Empty } from '@/components/data-grid-cells';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useServerTable } from '@/hooks/use-server-table';
import { cn } from '@/lib/utils';
import {
    type ColumnDef,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import { useMemo, useState } from 'react';

interface ActivityRecord {
    id: number;
    description: string;
    subject_type: string | null;
    subject_id: number | null;
    event: string | null;
    causer: { id: number; name: string; username: string } | null;
    properties: Record<string, unknown> | null;
    created_at: string;
}

const EVENT_OPTIONS = [
    { value: 'all', label: 'All events' },
    { value: 'created', label: 'Created' },
    { value: 'updated', label: 'Updated' },
    { value: 'deleted', label: 'Deleted' },
    { value: 'restored', label: 'Restored' },
    { value: 'login', label: 'Login' },
    { value: 'logout', label: 'Logout' },
    { value: 'role_assignment', label: 'Role assignment' },
];

const SUBJECT_OPTIONS = [
    { value: 'all', label: 'All subjects' },
    { value: 'App\\Models\\TensionRecord', label: 'Tension record' },
    { value: 'App\\Models\\StockTakingRecord', label: 'Stock taking record' },
    {
        value: 'App\\Models\\FinishEarlierRecord',
        label: 'Finish earlier record',
    },
    { value: 'App\\Models\\User', label: 'User' },
    { value: 'Spatie\\Permission\\Models\\Role', label: 'Role' },
];

/** Dot colour per event; the event name is always written next to it. */
const EVENT_DOT: Record<string, string> = {
    created: 'bg-emerald-600',
    updated: 'bg-blue-600',
    deleted: 'bg-red-600',
    restored: 'bg-emerald-600',
    role_assignment: 'bg-violet-600',
};

/** "App\\Models\\TorqueCheckSheet" → "Torque check sheet". */
const shortSubject = (type: string | null) => {
    const name = type?.split('\\').pop();
    if (!name) return null;
    const words = name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    return words.charAt(0).toUpperCase() + words.slice(1);
};

const hasProperties = (a: ActivityRecord) =>
    !!a.properties && Object.keys(a.properties).length > 0;

const columns: ColumnDef<ActivityRecord>[] = [
    {
        id: 'at',
        accessorKey: 'created_at',
        header: 'When',
        meta: { label: 'When', className: 'whitespace-nowrap' },
        cell: ({ getValue }) => <DateTimeCell value={getValue()} />,
    },
    {
        id: 'user',
        header: 'User',
        enableSorting: false,
        meta: { label: 'User' },
        cell: ({ row }) =>
            row.original.causer ? (
                <span title={`@${row.original.causer.username}`}>
                    {row.original.causer.name}
                </span>
            ) : (
                <span className="text-muted-foreground">System</span>
            ),
    },
    {
        id: 'event',
        accessorKey: 'event',
        header: 'Event',
        meta: { label: 'Event' },
        cell: ({ row }) => {
            const event = row.original.event;
            if (!event) return <Empty />;
            return (
                <span className="inline-flex items-center gap-1.5 text-xs capitalize">
                    <span
                        aria-hidden="true"
                        className={cn(
                            'size-1.5 rounded-full',
                            EVENT_DOT[event] ?? 'bg-muted-foreground/50',
                        )}
                    />
                    {event.replace('_', ' ')}
                </span>
            );
        },
    },
    {
        id: 'subject',
        accessorKey: 'subject_type',
        header: 'Subject',
        meta: { label: 'Subject', className: 'whitespace-nowrap' },
        cell: ({ row }) => {
            const subject = shortSubject(row.original.subject_type);
            if (!subject) return <Empty />;
            return (
                <span className="text-xs">
                    {subject}
                    {row.original.subject_id && (
                        <span className="ml-1 font-mono text-muted-foreground">
                            #{row.original.subject_id}
                        </span>
                    )}
                </span>
            );
        },
    },
    {
        id: 'description',
        accessorKey: 'description',
        header: 'Description',
        enableSorting: false,
        meta: { label: 'Description', className: 'w-full max-w-0' },
        cell: ({ row }) => (
            <span className="block truncate" title={row.original.description}>
                {row.original.description}
            </span>
        ),
    },
    {
        id: 'details',
        header: () => <span className="sr-only">Details</span>,
        enableSorting: false,
        enableHiding: false,
        meta: { label: 'Details', align: 'right' },
        cell: ({ row, table }) =>
            hasProperties(row.original) ? (
                <Button
                    variant="ghost"
                    size="xs"
                    className="text-muted-foreground"
                    onClick={() => table.options.meta?.openDetails?.(row.id)}
                >
                    Details
                </Button>
            ) : null,
    },
];

function FilterSelect({
    label,
    value,
    options,
    onChange,
}: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
}) {
    return (
        <Select value={value} onValueChange={onChange}>
            <SelectTrigger
                aria-label={label}
                className={cn(
                    'h-(--density-control-h)! w-auto gap-1.5 px-2 text-xs',
                    value !== 'all' && 'border-foreground/40 font-medium',
                )}
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                {options.map((o) => (
                    <SelectItem
                        key={o.value}
                        value={o.value}
                        className="text-xs"
                    >
                        {o.label}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}

function DateRange({
    from,
    to,
    onFromChange,
    onToChange,
}: {
    from: string;
    to: string;
    onFromChange: (value: string) => void;
    onToChange: (value: string) => void;
}) {
    return (
        <div
            role="group"
            aria-label="Date range"
            className="flex h-(--density-control-h) items-center gap-1 rounded-md border bg-background px-2 text-xs text-muted-foreground focus-within:ring-2 focus-within:ring-ring/50"
        >
            <input
                type="date"
                aria-label="From date"
                value={from}
                max={to || undefined}
                onChange={(e) => onFromChange(e.target.value)}
                className="bg-transparent text-foreground tabular-nums outline-none"
            />
            <span aria-hidden="true">–</span>
            <input
                type="date"
                aria-label="To date"
                value={to}
                min={from || undefined}
                onChange={(e) => onToChange(e.target.value)}
                className="bg-transparent text-foreground tabular-nums outline-none"
            />
        </div>
    );
}

export function ActivityLogTable() {
    const [event, setEvent] = useState('all');
    const [subject, setSubject] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [open, setOpen] = useState<ActivityRecord | null>(null);

    const params = useMemo(() => {
        const p: Record<string, string> = {};
        if (event !== 'all') p.event = event;
        if (subject !== 'all') p.subject_type = subject;
        if (dateFrom) p.date_from = dateFrom;
        if (dateTo) p.date_to = dateTo;
        return p;
    }, [event, subject, dateFrom, dateTo]);

    const grid = useServerTable<ActivityRecord>({
        endpoint: '/api/activity-log',
        params,
        storageKey: 'activity-log',
    });

    const openDetails = (id: string) => {
        const record = grid.data.find((a) => String(a.id) === id);
        if (record && hasProperties(record)) setOpen(record);
    };

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
        meta: { openDetails },
    });

    const filtered = Object.keys(params).length > 0;

    return (
        <>
            <DataGrid
                table={table}
                label="Activity log"
                loading={grid.loading}
                error={grid.error}
                total={grid.total}
                onRetry={grid.refetch}
                search={grid.search}
                onSearchChange={grid.setSearch}
                searchPlaceholder="Search description or user"
                emptyMessage={
                    filtered
                        ? 'No activity matches these filters.'
                        : 'No activity recorded.'
                }
                onRowClick={openDetails}
                activeRowId={open ? String(open.id) : null}
                filters={
                    <>
                        <FilterSelect
                            label="Event"
                            value={event}
                            options={EVENT_OPTIONS}
                            onChange={setEvent}
                        />
                        <FilterSelect
                            label="Subject"
                            value={subject}
                            options={SUBJECT_OPTIONS}
                            onChange={setSubject}
                        />
                        <DateRange
                            from={dateFrom}
                            to={dateTo}
                            onFromChange={setDateFrom}
                            onToChange={setDateTo}
                        />
                        {filtered && (
                            <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                    setEvent('all');
                                    setSubject('all');
                                    setDateFrom('');
                                    setDateTo('');
                                }}
                            >
                                Reset
                            </Button>
                        )}
                    </>
                }
            />

            <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
                <DialogContent className="sm:max-w-[640px]">
                    <DialogHeader>
                        <DialogTitle>Activity details</DialogTitle>
                        <DialogDescription>
                            {open?.description}
                            {open?.causer ? ` · ${open.causer.name}` : ''}
                        </DialogDescription>
                    </DialogHeader>
                    <pre className="max-h-[60vh] overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed">
                        {JSON.stringify(open?.properties ?? {}, null, 2)}
                    </pre>
                </DialogContent>
            </Dialog>
        </>
    );
}
