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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    databaseService,
    verifyPersistedRecord,
} from '@/lib/databaseConnector';
import {
    type FormValue,
    type ProblemLike,
    type StoredReading,
} from '@/lib/tension-heatmap';
import {
    ColumnDef,
    getCoreRowModel,
    useReactTable,
} from '@tanstack/react-table';
import {
    DownloadIcon,
    EyeIcon,
    MoreHorizontal,
    PanelRightOpen,
    PencilIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { SaveStatusDialog, type SaveStep } from './save-status-dialog';

import { DataGrid } from '@/components/data-grid';
import {
    CodeCell,
    DateTimeCell,
    NumberCell,
    ProblemsCell,
    ProgressCell,
    TextCell,
} from '@/components/data-grid-cells';
import {
    type DetailRecord,
    RecordDetailPanel,
} from '@/components/record-detail-panel';
import { useTensionCompare } from '@/components/tension-compare';
import { useServerTable } from '@/hooks/use-server-table';
import { problemCounts, progressOf } from '@/lib/tension-record-summary';

interface TensionRecord {
    id: string;
    record_type: 'twisting' | 'weaving';
    timestamp: string;
    csv_data: string;
    form_data: Record<string, FormValue>;
    measurement_data: Record<
        string,
        Record<string, Record<string, StoredReading>>
    >;
    problems: ProblemLike[];
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

/**
 * Row menu as its own component, so its open state is a real hook call
 * rather than a useState inside a column `cell` renderer.
 */
function WeavingRowActions({
    record,
    onSaved,
    onOpenDetails,
}: {
    record: TensionRecord;
    onSaved?: () => void;
    onOpenDetails?: (id: string) => void;
}) {
    const [menuOpen, setMenuOpen] = useState(false);

    const handleDownload = () => {
        const a = document.createElement('a');
        a.href = `${window.location.origin}/tension-records/${record.id}/download`;
        a.click();
    };

    return (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Actions for ${record.metadata?.machine_number ?? record.form_data?.machineNumber ?? 'record'}`}
                >
                    <MoreHorizontal />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                {onOpenDetails && (
                    <DropdownMenuItem
                        onClick={() => onOpenDetails(String(record.id))}
                    >
                        <PanelRightOpen />
                        Open details
                    </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleDownload}>
                    <DownloadIcon />
                    Download
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <ViewWeavingRecordDialog
                    record={record}
                    onCloseMenu={() => setMenuOpen(false)}
                />
                <EditWeavingRecordDialog
                    record={record}
                    onSaved={onSaved}
                    onCloseMenu={() => setMenuOpen(false)}
                />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

/** Column ids double as the server `sort_by` values (see TensionRecordController@index). */
export const columns: ColumnDef<TensionRecord>[] = [
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
        enableSorting: false,
        enableHiding: false,
        meta: { className: 'w-8 pr-0' },
    },
    {
        id: 'recorded_at',
        accessorFn: (row) => row.created_at,
        header: 'Recorded',
        cell: ({ getValue }) => <DateTimeCell value={getValue()} />,
        meta: { label: 'Recorded' },
    },
    {
        id: 'machine',
        accessorFn: (row) =>
            row.metadata?.machine_number ?? row.form_data?.machineNumber,
        header: 'Loom',
        cell: ({ getValue }) => <CodeCell value={getValue()} strong />,
        meta: { label: 'Loom (machine number)' },
    },
    {
        id: 'production_order',
        accessorFn: (row) => row.form_data?.productionOrder,
        header: 'Prod. order',
        enableSorting: false,
        cell: ({ getValue }) => <CodeCell value={getValue()} />,
        meta: { label: 'Production order' },
    },
    {
        id: 'item_number',
        accessorFn: (row) => row.metadata?.item_number,
        header: 'Item no.',
        cell: ({ getValue }) => <CodeCell value={getValue()} />,
        meta: { label: 'Item number' },
    },
    {
        id: 'item_description',
        accessorFn: (row) => row.metadata?.item_description,
        header: 'Description',
        enableSorting: false,
        cell: ({ getValue }) => {
            const value = getValue() as string | undefined;
            return value ? (
                <span
                    className="block max-w-56 truncate text-xs text-muted-foreground"
                    title={value}
                >
                    {value}
                </span>
            ) : (
                <TextCell value={null} />
            );
        },
        meta: { label: 'Item description' },
    },
    {
        id: 'bale',
        accessorFn: (row) => row.form_data?.baleNumber,
        header: 'Bale',
        enableSorting: false,
        cell: ({ getValue }) => <CodeCell value={getValue()} muted />,
        meta: { label: 'Bale number' },
    },
    {
        id: 'color',
        accessorFn: (row) => row.form_data?.colorCode,
        header: 'Colour',
        enableSorting: false,
        cell: ({ getValue }) => <CodeCell value={getValue()} muted />,
        meta: { label: 'Colour code' },
    },
    {
        id: 'operator',
        accessorFn: (row) => row.metadata?.operator,
        header: 'Operator',
        cell: ({ getValue }) => <TextCell value={getValue()} />,
        meta: { label: 'Operator' },
    },
    {
        id: 'spec',
        accessorFn: (row) => row.form_data?.specTens,
        header: 'Spec (cN)',
        enableSorting: false,
        cell: ({ row, getValue }) => (
            <NumberCell
                value={getValue()}
                suffix={
                    row.original.form_data?.tensPlus
                        ? `±${row.original.form_data.tensPlus}`
                        : undefined
                }
            />
        ),
        meta: { label: 'Spec. tension ± deviation (cN)', align: 'right' },
    },
    {
        id: 'meters',
        accessorFn: (row) => row.form_data?.metersCheck,
        header: 'Meters',
        enableSorting: false,
        cell: ({ getValue }) => <NumberCell value={getValue()} />,
        meta: { label: 'Meters check (m)', align: 'right' },
    },
    {
        id: 'progress',
        accessorFn: (row) => progressOf(row),
        header: 'Progress',
        enableSorting: false,
        cell: ({ getValue }) => (
            <ProgressCell percent={getValue() as number | null} />
        ),
        meta: { label: 'Progress' },
    },
    {
        id: 'problems',
        accessorFn: (row) => problemCounts(row).open,
        header: 'Problems',
        enableSorting: false,
        cell: ({ row }) => <ProblemsCell {...problemCounts(row.original)} />,
        meta: { label: 'Problems (open / total)' },
    },
    {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row, table }) => (
            <WeavingRowActions
                record={row.original}
                onSaved={table.options.meta?.refetch}
                onOpenDetails={table.options.meta?.openDetails}
            />
        ),
        meta: { className: 'w-10 px-1' },
    },
];

function ViewWeavingRecordDialog({
    record,
    onCloseMenu,
}: {
    record: TensionRecord;
    onCloseMenu?: () => void;
}) {
    const [open, setOpen] = useState(false);

    // Close the parent row-actions dropdown once this dialog finishes closing,
    // so it doesn't reappear behind the now-closed dialog.
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (wasOpenRef.current && !open) {
            onCloseMenu?.();
        }
        wasOpenRef.current = open;
    }, [open, onCloseMenu]);

    const handleDownload = () => {
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/tension-records/${record.id}/download`;
        const a = document.createElement('a');
        a.href = url;
        a.click();
    };

    const measurements: {
        position: string;
        side: string;
        row: string;
        col: string;
        max: FormValue;
        min: FormValue;
    }[] = [];
    const measurementData = record.measurement_data ?? {};
    for (const side of Object.keys(measurementData)) {
        const rows = measurementData[side];
        if (!rows || Array.isArray(rows)) continue;
        for (const rowKey of Object.keys(rows)) {
            const cols = rows[rowKey];
            for (const colKey of Object.keys(cols ?? {})) {
                const values = cols[colKey];
                measurements.push({
                    position: `${side}-${rowKey}-Col${colKey}`,
                    side,
                    row: rowKey,
                    col: colKey,
                    max: values?.max,
                    min: values?.min,
                });
            }
        }
    }

    // Build a lookup of problems by position for cross-referencing in Measurement Data table
    const problemsByPosition = new Map<string, ProblemLike>();
    (record.problems ?? []).forEach((p: ProblemLike) => {
        if (p?.position) {
            problemsByPosition.set(p.position, p);
        }
    });

    const formatDate = (date?: string) =>
        date
            ? new Date(date).toLocaleString('en-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : 'N/A';

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
                    <DialogTitle>Weaving Tension Record</DialogTitle>
                    <DialogDescription>
                        Item Number: {record.metadata?.item_number ?? 'N/A'}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 pb-6">
                    <div className="rounded-lg bg-gray-50 p-4">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Operator
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.metadata?.operator ?? 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Machine Number
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.form_data?.machineNumber ?? 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Item Description
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.metadata?.item_description ?? 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Production Order
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.form_data?.productionOrder ?? 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Bale Number
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.form_data?.baleNumber ?? 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Color Code
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.form_data?.colorCode ?? 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Spec. Tension (cN)
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.form_data?.specTens ?? 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Tens. Deviation (cN)
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.form_data?.tensPlus ?? 'N/A'}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Meters Check (m)
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.form_data?.metersCheck ?? 'N/A'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t pt-4">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Record Date
                                </p>
                                <p className="mt-1 text-sm">
                                    {formatDate(record.created_at)}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-medium text-gray-500 uppercase">
                                    Progress
                                </p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.metadata?.completed_measurements ??
                                        0}{' '}
                                    / {record.metadata?.total_measurements ?? 0}{' '}
                                    ({record.metadata?.progress_percentage ?? 0}
                                    %)
                                </p>
                            </div>
                        </div>
                    </div>

                    {measurements.length > 0 && (
                        <div>
                            <p className="mb-2 text-sm font-semibold">
                                Tension Chart (Max/Min per Position)
                            </p>
                            <div className="rounded-md border p-2">
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={measurements}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="position"
                                            angle={-45}
                                            textAnchor="end"
                                            height={60}
                                            interval="preserveStartEnd"
                                            tick={{ fontSize: 10 }}
                                        />
                                        <YAxis
                                            label={{
                                                value: 'Tension (cN)',
                                                angle: -90,
                                                position: 'insideLeft',
                                            }}
                                        />
                                        <Tooltip />
                                        <Legend />
                                        <Line
                                            type="monotone"
                                            dataKey="max"
                                            name="Max"
                                            stroke="#3b82f6"
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="min"
                                            name="Min"
                                            stroke="#93c5fd"
                                            strokeWidth={2}
                                            dot={{ r: 3 }}
                                        />
                                        {record.form_data?.specTens != null && (
                                            <ReferenceLine
                                                y={Number(
                                                    record.form_data.specTens,
                                                )}
                                                stroke="#16a34a"
                                                strokeDasharray="4 4"
                                                label={{
                                                    value: 'Spec',
                                                    position: 'right',
                                                    fill: '#16a34a',
                                                    fontSize: 11,
                                                }}
                                            />
                                        )}
                                        {record.form_data?.specTens != null &&
                                            record.form_data?.tensPlus !=
                                                null && (
                                                <>
                                                    <ReferenceLine
                                                        y={
                                                            Number(
                                                                record.form_data
                                                                    .specTens,
                                                            ) +
                                                            Number(
                                                                record.form_data
                                                                    .tensPlus,
                                                            )
                                                        }
                                                        stroke="#f97316"
                                                        strokeDasharray="2 2"
                                                    />
                                                    <ReferenceLine
                                                        y={
                                                            Number(
                                                                record.form_data
                                                                    .specTens,
                                                            ) -
                                                            Number(
                                                                record.form_data
                                                                    .tensPlus,
                                                            )
                                                        }
                                                        stroke="#f97316"
                                                        strokeDasharray="2 2"
                                                    />
                                                </>
                                            )}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    <div>
                        <p className="mb-2 text-sm font-semibold">
                            Measurement Data
                        </p>
                        <div className="overflow-hidden rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Position</TableHead>
                                        <TableHead>Creel Side</TableHead>
                                        <TableHead>Row</TableHead>
                                        <TableHead>Column</TableHead>
                                        <TableHead>Max Value</TableHead>
                                        <TableHead>Min Value</TableHead>
                                        <TableHead>Issue Status</TableHead>
                                        <TableHead>After-Repair Max</TableHead>
                                        <TableHead>After-Repair Min</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {measurements.length ? (
                                        measurements.map((m) => {
                                            const problem =
                                                problemsByPosition.get(
                                                    m.position,
                                                );
                                            const status =
                                                problem?.status ??
                                                (problem ? 'open' : null);
                                            const resolution =
                                                problem?.resolution;
                                            return (
                                                <TableRow key={m.position}>
                                                    <TableCell>
                                                        {m.position}
                                                    </TableCell>
                                                    <TableCell>
                                                        {m.side}
                                                    </TableCell>
                                                    <TableCell>
                                                        {m.row}
                                                    </TableCell>
                                                    <TableCell>
                                                        {m.col}
                                                    </TableCell>
                                                    <TableCell>
                                                        {m.max ?? 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {m.min ?? 'N/A'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {status ===
                                                        'resolved' ? (
                                                            <Badge variant="secondary">
                                                                Resolved
                                                            </Badge>
                                                        ) : status ===
                                                          'open' ? (
                                                            <Badge variant="destructive">
                                                                Open
                                                            </Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">
                                                                —
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {resolution?.after_repair_max ??
                                                            '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {resolution?.after_repair_min ??
                                                            '—'}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell
                                                colSpan={9}
                                                className="h-16 text-center text-sm text-muted-foreground"
                                            >
                                                No measurements recorded.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-semibold">
                            Problem Reports
                        </p>
                        {record.problems && record.problems.length > 0 ? (
                            <div className="space-y-2">
                                {record.problems.map(
                                    (problem: ProblemLike, idx: number) => {
                                        const status = problem.status ?? 'open';
                                        return (
                                            <div
                                                key={problem.id ?? idx}
                                                className="rounded-md border p-3"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="destructive">
                                                            {problem.position}
                                                        </Badge>
                                                        <Badge
                                                            variant={
                                                                status ===
                                                                'resolved'
                                                                    ? 'secondary'
                                                                    : 'outline'
                                                            }
                                                        >
                                                            {status ===
                                                            'resolved'
                                                                ? 'Resolved'
                                                                : 'Open'}
                                                        </Badge>
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">
                                                        {formatDate(
                                                            problem.timestamp,
                                                        )}
                                                    </span>
                                                </div>
                                                <p className="mt-2 text-sm">
                                                    {problem.description}
                                                </p>
                                                {status === 'resolved' &&
                                                    problem.resolution && (
                                                        <div className="mt-2 rounded-md bg-gray-50 p-2 text-xs">
                                                            <p>
                                                                <span className="font-medium">
                                                                    Action:
                                                                </span>{' '}
                                                                {
                                                                    problem
                                                                        .resolution
                                                                        ?.action
                                                                }
                                                            </p>
                                                            <p>
                                                                <span className="font-medium">
                                                                    After-Repair
                                                                    Max:
                                                                </span>{' '}
                                                                {problem
                                                                    .resolution
                                                                    ?.after_repair_max ??
                                                                    'N/A'}
                                                            </p>
                                                            <p>
                                                                <span className="font-medium">
                                                                    After-Repair
                                                                    Min:
                                                                </span>{' '}
                                                                {problem
                                                                    .resolution
                                                                    ?.after_repair_min ??
                                                                    'N/A'}
                                                            </p>
                                                            <p>
                                                                <span className="font-medium">
                                                                    Resolved By:
                                                                </span>{' '}
                                                                {
                                                                    problem
                                                                        .resolution
                                                                        ?.resolved_by
                                                                }{' '}
                                                                on{' '}
                                                                {formatDate(
                                                                    problem
                                                                        .resolution
                                                                        ?.resolved_at,
                                                                )}
                                                            </p>
                                                        </div>
                                                    )}
                                            </div>
                                        );
                                    },
                                )}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                No problems reported.
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={handleDownload}>
                        <DownloadIcon className="mr-2 h-4 w-4" />
                        Download CSV
                    </Button>
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

function EditWeavingRecordDialog({
    record,
    onSaved,
    onCloseMenu,
}: {
    record: TensionRecord;
    onSaved?: () => void;
    onCloseMenu?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState<
        'saving' | 'success' | 'error'
    >('saving');
    const [saveSteps, setSaveSteps] = useState<SaveStep[]>([]);
    const [saveError, setSaveError] = useState<{
        message: string;
        details: string;
    } | null>(null);

    // Close the parent row-actions dropdown once this dialog finishes closing,
    // so it doesn't reappear behind the now-closed dialog.
    const wasOpenRef = useRef(false);
    useEffect(() => {
        if (wasOpenRef.current && !open) {
            onCloseMenu?.();
        }
        wasOpenRef.current = open;
    }, [open, onCloseMenu]);

    const [operator, setOperator] = useState(record.metadata?.operator ?? '');
    const [itemNumber, setItemNumber] = useState(
        record.metadata?.item_number ?? '',
    );
    const [itemDescription, setItemDescription] = useState(
        record.metadata?.item_description ?? '',
    );
    const [machineNumber, setMachineNumber] = useState(
        record.form_data?.machineNumber ?? '',
    );
    const [productionOrder, setProductionOrder] = useState(
        record.form_data?.productionOrder ?? '',
    );
    const [baleNumber, setBaleNumber] = useState(
        record.form_data?.baleNumber ?? '',
    );
    const [colorCode, setColorCode] = useState(
        record.form_data?.colorCode ?? '',
    );
    const [specTens, setSpecTens] = useState(record.form_data?.specTens ?? '');
    const [tensPlus, setTensPlus] = useState(record.form_data?.tensPlus ?? '');
    const [metersCheck, setMetersCheck] = useState(
        record.form_data?.metersCheck ?? '',
    );

    const [measurements, setMeasurements] = useState(() => {
        const result: {
            position: string;
            side: string;
            row: string;
            col: string;
            max: FormValue;
            min: FormValue;
        }[] = [];
        const measurementData = record.measurement_data ?? {};
        for (const side of Object.keys(measurementData)) {
            const rows = measurementData[side];
            if (!rows || Array.isArray(rows)) continue;
            for (const rowKey of Object.keys(rows)) {
                const cols = rows[rowKey];
                for (const colKey of Object.keys(cols ?? {})) {
                    const values = cols[colKey];
                    result.push({
                        position: `${side}-${rowKey}-Col${colKey}`,
                        side,
                        row: rowKey,
                        col: colKey,
                        max: values?.max ?? '',
                        min: values?.min ?? '',
                    });
                }
            }
        }
        return result;
    });

    const updateMeasurement = (
        position: string,
        field: 'max' | 'min',
        value: string,
    ) => {
        setMeasurements((prev) =>
            prev.map((m) =>
                m.position === position ? { ...m, [field]: value } : m,
            ),
        );
    };

    const [problems, setProblems] = useState(() =>
        (record.problems ?? []).map((p: ProblemLike) => ({
            ...p,
            resolution: p.resolution ? { ...p.resolution } : null,
        })),
    );

    const updateProblem = (
        idx: number,
        field: string,
        value: string | number | null,
    ) => {
        setProblems((prev) =>
            prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)),
        );
    };

    const updateProblemResolution = (
        idx: number,
        field: string,
        value: string | number | null,
    ) => {
        setProblems((prev) =>
            prev.map((p, i) =>
                i === idx
                    ? { ...p, resolution: { ...p.resolution, [field]: value } }
                    : p,
            ),
        );
    };

    const formatDate = (date?: string) =>
        date
            ? new Date(date).toLocaleString('en-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
              })
            : 'N/A';

    const handleSubmit = async () => {
        setSaveError(null);
        setSaveStatus('saving');
        setSaveSteps([
            {
                key: 'update',
                label: 'Saving changes to database',
                status: 'active',
            },
            {
                key: 'verify',
                label: 'Verifying saved changes',
                status: 'pending',
            },
        ]);
        setSaveDialogOpen(true);

        const measurement_data = JSON.parse(
            JSON.stringify(record.measurement_data ?? {}),
        );
        measurements.forEach((m) => {
            if (
                !measurement_data[m.side] ||
                Array.isArray(measurement_data[m.side])
            ) {
                measurement_data[m.side] = {};
            }
            if (!measurement_data[m.side][m.row]) {
                measurement_data[m.side][m.row] = {};
            }
            measurement_data[m.side][m.row][m.col] = {
                max: Number(m.max),
                min: Number(m.min),
            };
        });
        const metadata = {
            ...record.metadata,
            operator,
            item_number: itemNumber,
            item_description: itemDescription,
        };
        const form_data = {
            ...record.form_data,
            machineNumber,
            itemNumber,
            itemDescription,
            productionOrder,
            baleNumber,
            colorCode,
            specTens,
            tensPlus,
            metersCheck,
        };

        try {
            const baseUrl = window.location.origin;
            await fetch(`${baseUrl}/csrf-token`, { credentials: 'include' });
            const match = document.cookie.match(/XSRF-TOKEN=([^;]+)/);
            const csrfToken = match ? decodeURIComponent(match[1]) : '';

            const res = await fetch(`${baseUrl}/tension-records/${record.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    'X-XSRF-TOKEN': csrfToken,
                },
                credentials: 'include',
                body: JSON.stringify({
                    metadata,
                    form_data,
                    measurement_data,
                    problems,
                }),
            });

            const resultText = await res.text();
            let result: { message?: string } & Record<string, unknown>;
            try {
                result = JSON.parse(resultText);
            } catch {
                result = { message: resultText };
            }

            if (!res.ok) {
                setSaveSteps((prev) =>
                    prev.map((s) =>
                        s.key === 'update' ? { ...s, status: 'error' } : s,
                    ),
                );
                setSaveStatus('error');
                setSaveError({
                    message: result.message || `HTTP ${res.status}`,
                    details: JSON.stringify(
                        {
                            step: 'update',
                            recordType: record.record_type,
                            recordId: record.id,
                            itemNumber,
                            machineNumber,
                            error: result.error ?? resultText,
                            message: result.message,
                            timestamp: new Date().toISOString(),
                        },
                        null,
                        2,
                    ),
                });
                return;
            }

            setSaveSteps((prev) =>
                prev.map((s) =>
                    s.key === 'update'
                        ? { ...s, status: 'done' }
                        : s.key === 'verify'
                          ? { ...s, status: 'active' }
                          : s,
                ),
            );

            const fetched = await databaseService.getTensionRecord(
                String(record.id),
            );
            const verification = verifyPersistedRecord(
                {
                    record_type: record.record_type,
                    timestamp: record.timestamp,
                    csv_data: '',
                    form_data,
                    measurement_data,
                    problems,
                    metadata,
                },
                fetched,
            );

            if (!verification.ok) {
                setSaveSteps((prev) =>
                    prev.map((s) =>
                        s.key === 'verify' ? { ...s, status: 'error' } : s,
                    ),
                );
                setSaveStatus('error');
                setSaveError({
                    message: verification.reason ?? 'Verification failed.',
                    details: JSON.stringify(
                        {
                            step: 'verify',
                            recordType: record.record_type,
                            recordId: record.id,
                            itemNumber,
                            machineNumber,
                            reason: verification.reason,
                            timestamp: new Date().toISOString(),
                        },
                        null,
                        2,
                    ),
                });
                return;
            }

            setSaveSteps((prev) =>
                prev.map((s) =>
                    s.key === 'verify' ? { ...s, status: 'done' } : s,
                ),
            );
            setSaveStatus('success');
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : String(e);
            setSaveSteps((prev) =>
                prev.map((s) =>
                    s.status === 'active' ? { ...s, status: 'error' } : s,
                ),
            );
            setSaveStatus('error');
            setSaveError({
                message: message || 'Error updating record',
                details: JSON.stringify(
                    {
                        step: 'update',
                        recordType: record.record_type,
                        recordId: record.id,
                        itemNumber,
                        machineNumber,
                        error: message,
                        timestamp: new Date().toISOString(),
                    },
                    null,
                    2,
                ),
            });
        }
    };

    const handleSaveDialogClose = () => {
        setSaveDialogOpen(false);
        if (saveStatus === 'success') {
            setOpen(false);
            onSaved?.();
        }
    };

    const handleRetry = () => {
        handleSubmit();
    };

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(next) => {
                    if (!next && saveDialogOpen && saveStatus === 'saving')
                        return;
                    setOpen(next);
                }}
            >
                <DialogTrigger asChild>
                    <DropdownMenuItem
                        onClick={(e) => {
                            e.preventDefault();
                            setOpen(true);
                        }}
                    >
                        <PencilIcon></PencilIcon>Update
                    </DropdownMenuItem>
                </DialogTrigger>
                <DialogContent className="grid-cols-[minmax(0,1fr)] p-0 sm:max-w-[800px]">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>Edit Weaving Tension Record</DialogTitle>
                        <DialogDescription>
                            Item Number: {record.metadata?.item_number ?? 'N/A'}
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs
                        defaultValue="tension"
                        className="w-full min-w-0 gap-0"
                    >
                        <TabsList className="mx-6 grid w-[calc(100%-3rem)] grid-cols-2">
                            <TabsTrigger value="tension">
                                Tension Values
                            </TabsTrigger>
                            <TabsTrigger value="problems">Problems</TabsTrigger>
                        </TabsList>

                        <TabsContent
                            value="tension"
                            className="max-h-[65vh] min-w-0 space-y-4 overflow-y-auto px-6 py-4"
                        >
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                                <div className="space-y-1">
                                    <Label htmlFor="edit-operator">
                                        Operator
                                    </Label>
                                    <Input
                                        id="edit-operator"
                                        value={operator}
                                        onChange={(e) =>
                                            setOperator(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-item-number">
                                        Item Number
                                    </Label>
                                    <Input
                                        id="edit-item-number"
                                        value={itemNumber}
                                        onChange={(e) =>
                                            setItemNumber(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-item-description">
                                        Item Description
                                    </Label>
                                    <Input
                                        id="edit-item-description"
                                        value={itemDescription}
                                        onChange={(e) =>
                                            setItemDescription(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-machine-number">
                                        Machine Number
                                    </Label>
                                    <Input
                                        id="edit-machine-number"
                                        value={machineNumber}
                                        onChange={(e) =>
                                            setMachineNumber(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-production-order">
                                        Production Order
                                    </Label>
                                    <Input
                                        id="edit-production-order"
                                        value={productionOrder}
                                        onChange={(e) =>
                                            setProductionOrder(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-bale-number">
                                        Bale Number
                                    </Label>
                                    <Input
                                        id="edit-bale-number"
                                        value={baleNumber}
                                        onChange={(e) =>
                                            setBaleNumber(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-color-code">
                                        Color Code
                                    </Label>
                                    <Input
                                        id="edit-color-code"
                                        value={colorCode}
                                        onChange={(e) =>
                                            setColorCode(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-spec-tens">
                                        Spec. Tension (cN)
                                    </Label>
                                    <Input
                                        id="edit-spec-tens"
                                        type="number"
                                        step="any"
                                        value={specTens}
                                        onChange={(e) =>
                                            setSpecTens(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-tens-plus">
                                        Tens. Deviation (cN)
                                    </Label>
                                    <Input
                                        id="edit-tens-plus"
                                        type="number"
                                        step="any"
                                        value={tensPlus}
                                        onChange={(e) =>
                                            setTensPlus(e.target.value)
                                        }
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="edit-meters-check">
                                        Meters Check (m)
                                    </Label>
                                    <Input
                                        id="edit-meters-check"
                                        type="number"
                                        step="any"
                                        value={metersCheck}
                                        onChange={(e) =>
                                            setMetersCheck(e.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            <div>
                                <p className="mb-2 text-sm font-semibold">
                                    Measurement Data
                                </p>
                                <div className="overflow-hidden rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Position</TableHead>
                                                <TableHead>Max Value</TableHead>
                                                <TableHead>Min Value</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {measurements.length ? (
                                                measurements.map((m) => (
                                                    <TableRow key={m.position}>
                                                        <TableCell>
                                                            {m.position}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                className="h-8 w-24"
                                                                value={
                                                                    m.max ?? ''
                                                                }
                                                                onChange={(e) =>
                                                                    updateMeasurement(
                                                                        m.position,
                                                                        'max',
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                className="h-8 w-24"
                                                                value={
                                                                    m.min ?? ''
                                                                }
                                                                onChange={(e) =>
                                                                    updateMeasurement(
                                                                        m.position,
                                                                        'min',
                                                                        e.target
                                                                            .value,
                                                                    )
                                                                }
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={3}
                                                        className="h-16 text-center text-sm text-muted-foreground"
                                                    >
                                                        No measurements
                                                        recorded.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent
                            value="problems"
                            className="max-h-[65vh] min-w-0 space-y-4 overflow-y-auto px-6 py-4"
                        >
                            <div>
                                <p className="mb-2 text-sm font-semibold">
                                    Problem Reports
                                </p>
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Position</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>
                                                    Description
                                                </TableHead>
                                                <TableHead>
                                                    Resolution Action
                                                </TableHead>
                                                <TableHead>
                                                    After-Repair Max
                                                </TableHead>
                                                <TableHead>
                                                    After-Repair Min
                                                </TableHead>
                                                <TableHead>Resolved</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {problems.length ? (
                                                problems.map(
                                                    (
                                                        problem: ProblemLike,
                                                        idx: number,
                                                    ) => {
                                                        const status =
                                                            problem.status ??
                                                            'open';
                                                        const resolved =
                                                            status ===
                                                                'resolved' &&
                                                            problem.resolution;
                                                        return (
                                                            <TableRow
                                                                key={
                                                                    problem.id ??
                                                                    idx
                                                                }
                                                            >
                                                                <TableCell>
                                                                    {
                                                                        problem.position
                                                                    }
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge
                                                                        variant={
                                                                            resolved
                                                                                ? 'secondary'
                                                                                : 'destructive'
                                                                        }
                                                                    >
                                                                        {resolved
                                                                            ? 'Resolved'
                                                                            : 'Open'}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Textarea
                                                                        className="min-w-[180px]"
                                                                        rows={2}
                                                                        value={
                                                                            problem.description ??
                                                                            ''
                                                                        }
                                                                        onChange={(
                                                                            e,
                                                                        ) =>
                                                                            updateProblem(
                                                                                idx,
                                                                                'description',
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                            )
                                                                        }
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    {resolved ? (
                                                                        <Textarea
                                                                            className="min-w-[180px]"
                                                                            rows={
                                                                                2
                                                                            }
                                                                            value={
                                                                                problem
                                                                                    .resolution
                                                                                    ?.action ??
                                                                                ''
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                updateProblemResolution(
                                                                                    idx,
                                                                                    'action',
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <span className="text-muted-foreground">
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {resolved ? (
                                                                        <Input
                                                                            type="number"
                                                                            step="any"
                                                                            className="h-8 w-24"
                                                                            value={
                                                                                problem
                                                                                    .resolution
                                                                                    ?.after_repair_max ??
                                                                                ''
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                updateProblemResolution(
                                                                                    idx,
                                                                                    'after_repair_max',
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <span className="text-muted-foreground">
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {resolved ? (
                                                                        <Input
                                                                            type="number"
                                                                            step="any"
                                                                            className="h-8 w-24"
                                                                            value={
                                                                                problem
                                                                                    .resolution
                                                                                    ?.after_repair_min ??
                                                                                ''
                                                                            }
                                                                            onChange={(
                                                                                e,
                                                                            ) =>
                                                                                updateProblemResolution(
                                                                                    idx,
                                                                                    'after_repair_min',
                                                                                    e
                                                                                        .target
                                                                                        .value,
                                                                                )
                                                                            }
                                                                        />
                                                                    ) : (
                                                                        <span className="text-muted-foreground">
                                                                            —
                                                                        </span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="text-xs text-muted-foreground">
                                                                    {resolved
                                                                        ? `${problem.resolution?.resolved_by} on ${formatDate(problem.resolution?.resolved_at)}`
                                                                        : '—'}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    },
                                                )
                                            ) : (
                                                <TableRow>
                                                    <TableCell
                                                        colSpan={7}
                                                        className="h-16 text-center text-sm text-muted-foreground"
                                                    >
                                                        No problems reported.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <DialogFooter className="px-6 pb-6">
                        <Button
                            variant="outline"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={saveDialogOpen && saveStatus === 'saving'}
                        >
                            {saveDialogOpen && saveStatus === 'saving'
                                ? 'Saving...'
                                : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <SaveStatusDialog
                open={saveDialogOpen}
                status={saveStatus}
                steps={saveSteps}
                errorMessage={saveError?.message}
                errorDetails={saveError?.details}
                onRetry={saveStatus === 'error' ? handleRetry : undefined}
                onClose={handleSaveDialogClose}
            />
        </>
    );
}

const WEAVING_PARAMS = { type: 'weaving' };

export function WeavingDataTable() {
    const [activeId, setActiveId] = useState<string | null>(null);
    const grid = useServerTable<TensionRecord>({
        endpoint: '/tension-records',
        params: WEAVING_PARAMS,
        storageKey: 'weaving-tension-records',
        // Ticks survive paging so records on different pages can be compared.
        keepSelection: true,
        defaultColumnVisibility: { bale: false, color: false, meters: false },
    });

    const table = useReactTable({
        data: grid.data,
        columns,
        getRowId: (row) => String(row.id),
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        manualSorting: true,
        manualFiltering: true,
        pageCount: grid.pageCount,
        state: grid.state,
        ...grid.handlers,
        meta: { refetch: grid.refetch, openDetails: setActiveId },
    });

    // Ticked rows (kept across pages) and saved comparisons, on one chart.
    const compare = useTensionCompare({
        type: 'weaving',
        rows: grid.data as unknown as DetailRecord[],
        rowSelection: grid.state.rowSelection as Record<string, boolean>,
        onDeselect: (id) =>
            table.setRowSelection((prev) => {
                const next = { ...(prev as Record<string, boolean>) };
                delete next[id];
                return next;
            }),
    });

    const activeIndex = activeId
        ? grid.data.findIndex((r) => String(r.id) === activeId)
        : -1;
    const activeRecord = activeIndex >= 0 ? grid.data[activeIndex] : null;
    const goTo = (index: number) => {
        const target = grid.data[index];
        if (target) setActiveId(String(target.id));
    };

    return (
        <>
            <DataGrid
                selectedTotal={compare.count}
                selectionActions={compare.selectionActions}
                actions={compare.savedMenu}
                onRowClick={setActiveId}
                activeRowId={activeRecord ? activeId : null}
                table={table}
                label="Weaving tension records"
                loading={grid.loading}
                error={grid.error}
                total={grid.total}
                onRetry={grid.refetch}
                search={grid.search}
                onSearchChange={grid.setSearch}
                searchPlaceholder="Search loom, item, operator…"
                emptyMessage="No weaving tension records yet."
            />
            {compare.dialog}
            <RecordDetailPanel
                record={activeRecord as DetailRecord | null}
                open={activeRecord !== null}
                onOpenChange={(open) => !open && setActiveId(null)}
                onPrevious={
                    activeIndex > 0 ? () => goTo(activeIndex - 1) : undefined
                }
                onNext={
                    activeIndex >= 0 && activeIndex < grid.data.length - 1
                        ? () => goTo(activeIndex + 1)
                        : undefined
                }
            />
        </>
    );
}
