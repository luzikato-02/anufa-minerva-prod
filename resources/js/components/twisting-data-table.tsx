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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
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
    ChevronDown,
    DownloadIcon,
    EyeIcon,
    MoreHorizontal,
    PencilIcon,
} from 'lucide-react';
import * as React from 'react';
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
import { databaseService, verifyPersistedRecord } from './utils/databaseConnector';

interface TensionRecord {
    id: string;
    record_type: 'twisting' | 'weaving';
    timestamp: string;
    // csv_data: string;
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
        yarn_code: string;
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

type TwistingTableMeta = {
    refetch: () => void;
};

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
        accessorKey: 'Item Number',
        header: 'Item Number',
        accessorFn: (row) => row.metadata?.item_number,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Yarn Mat Code',
        header: 'Yarn Mat. Code',
        accessorFn: (row) => row.metadata?.yarn_code,
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
        accessorKey: 'Density',
        header: 'Density (Dtex)',
        accessorFn: (row) => row.form_data?.dtexNumber,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Table Twist (TPM)',
        header: 'Table Twist (TPM)',
        accessorFn: (row) => row.form_data?.tpm,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Cycle Speed (RPM)',
        header: 'Cycle Speed (RPM)',
        accessorFn: (row) => row.form_data?.rpm,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Spec Tension (cN)',
        header: 'Spec. Tension (cN)',
        accessorFn: (row) => row.form_data?.specTens,
        cell: ({ getValue }) => (
            <div className="capitalize">{getValue() ?? 'N/A'}</div>
        ),
    },
    {
        accessorKey: 'Tens Deviation (cN)',
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
        cell: ({ row, table }) => {
            const record = row.original;
            const meta = table.options.meta as TwistingTableMeta;
            const [menuOpen, setMenuOpen] = useState(false);
            const handleDownload = () => {
                // const blob = new Blob([record.csv_data], { type: 'text/csv' });
                const baseUrl = window.location.origin;
                const url = `${baseUrl}/tension-records/${record.id}/download`;

                const a = document.createElement('a');
                a.href = url;
                // a.download = `ID${record.id}-${record.created_at}-${record.metadata.machine_number}-${record.metadata.operator}.csv`;
                a.click();
                URL.revokeObjectURL(url);
            };
            return (
                <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onCloseAutoFocus={(e) => e.preventDefault()}>
                        <DropdownMenuItem onClick={handleDownload}>
                            <DownloadIcon></DownloadIcon>Download
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <ViewTwistingRecordDialog record={record} onCloseMenu={() => setMenuOpen(false)} />
                        <EditTwistingRecordDialog record={record} onSaved={meta.refetch} onCloseMenu={() => setMenuOpen(false)} />
                    </DropdownMenuContent>
                </DropdownMenu>
            );
        },
    },
];

function ViewTwistingRecordDialog({ record, onCloseMenu }: { record: TensionRecord; onCloseMenu?: () => void }) {
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

    const measurements = Object.entries(record.measurement_data ?? {})
        .map(([spindle, values]: [string, any]) => ({
            spindle: Number(spindle),
            max: values?.max,
            min: values?.min,
        }))
        .sort((a, b) => a.spindle - b.spindle);

    // Build a lookup of problems by spindle number for cross-referencing in Measurement Data table
    const problemsBySpindle = new Map<number, any>();
    (record.problems ?? []).forEach((p: any) => {
        if (p?.spindleNumber != null) {
            problemsBySpindle.set(Number(p.spindleNumber), p);
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
                    <DialogTitle>Twisting Tension Record</DialogTitle>
                    <DialogDescription>
                        Item Number: {record.metadata?.item_number ?? 'N/A'}
                    </DialogDescription>
                </DialogHeader>

                <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 pb-6">
                    <div className="rounded-lg bg-gray-50 p-4">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Operator</p>
                                <p className="mt-1 text-sm font-semibold">{record.metadata?.operator ?? 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Machine Number</p>
                                <p className="mt-1 text-sm font-semibold">{record.form_data?.machineNumber ?? 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Yarn Code</p>
                                <p className="mt-1 text-sm font-semibold">{record.metadata?.yarn_code ?? 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Density (Dtex)</p>
                                <p className="mt-1 text-sm font-semibold">{record.form_data?.dtexNumber ?? 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Table Twist (TPM)</p>
                                <p className="mt-1 text-sm font-semibold">{record.form_data?.tpm ?? 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Cycle Speed (RPM)</p>
                                <p className="mt-1 text-sm font-semibold">{record.form_data?.rpm ?? 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Spec. Tension (cN)</p>
                                <p className="mt-1 text-sm font-semibold">{record.form_data?.specTens ?? 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Tens. Deviation (cN)</p>
                                <p className="mt-1 text-sm font-semibold">{record.form_data?.tensPlus ?? 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Meters Check (m)</p>
                                <p className="mt-1 text-sm font-semibold">{record.form_data?.metersCheck ?? 'N/A'}</p>
                            </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t pt-4">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Record Date</p>
                                <p className="mt-1 text-sm">{formatDate(record.created_at)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-medium text-gray-500 uppercase">Progress</p>
                                <p className="mt-1 text-sm font-semibold">
                                    {record.metadata?.completed_measurements ?? 0} /{' '}
                                    {record.metadata?.total_measurements ?? 0} (
                                    {record.metadata?.progress_percentage ?? 0}%)
                                </p>
                            </div>
                        </div>
                    </div>

                    {measurements.length > 0 && (
                        <div>
                            <p className="mb-2 text-sm font-semibold">Tension Chart (Max/Min per Spindle)</p>
                            <div className="rounded-md border p-2">
                                <ResponsiveContainer width="100%" height={250}>
                                    <LineChart data={measurements}>
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis
                                            dataKey="spindle"
                                            label={{ value: 'Spindle', position: 'insideBottom', offset: -2 }}
                                        />
                                        <YAxis label={{ value: 'Tension (cN)', angle: -90, position: 'insideLeft' }} />
                                        <Tooltip />
                                        <Legend />
                                        <Line type="monotone" dataKey="max" name="Max" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
                                        <Line type="monotone" dataKey="min" name="Min" stroke="#93c5fd" strokeWidth={2} dot={{ r: 3 }} />
                                        {record.form_data?.specTens != null && (
                                            <ReferenceLine
                                                y={Number(record.form_data.specTens)}
                                                stroke="#16a34a"
                                                strokeDasharray="4 4"
                                                label={{ value: 'Spec', position: 'right', fill: '#16a34a', fontSize: 11 }}
                                            />
                                        )}
                                        {record.form_data?.specTens != null && record.form_data?.tensPlus != null && (
                                            <>
                                                <ReferenceLine
                                                    y={Number(record.form_data.specTens) + Number(record.form_data.tensPlus)}
                                                    stroke="#f97316"
                                                    strokeDasharray="2 2"
                                                />
                                                <ReferenceLine
                                                    y={Number(record.form_data.specTens) - Number(record.form_data.tensPlus)}
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
                        <p className="mb-2 text-sm font-semibold">Measurement Data</p>
                        <div className="overflow-hidden rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Spindle Number</TableHead>
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
                                            const problem = problemsBySpindle.get(m.spindle);
                                            const status = problem?.status ?? (problem ? 'open' : null);
                                            const resolution = problem?.resolution;
                                            return (
                                                <TableRow key={m.spindle}>
                                                    <TableCell>{m.spindle}</TableCell>
                                                    <TableCell>{m.max ?? 'N/A'}</TableCell>
                                                    <TableCell>{m.min ?? 'N/A'}</TableCell>
                                                    <TableCell>
                                                        {status === 'resolved' ? (
                                                            <Badge variant="secondary">Resolved</Badge>
                                                        ) : status === 'open' ? (
                                                            <Badge variant="destructive">Open</Badge>
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{resolution?.after_repair_max ?? '—'}</TableCell>
                                                    <TableCell>{resolution?.after_repair_min ?? '—'}</TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell
                                                colSpan={6}
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
                        <p className="mb-2 text-sm font-semibold">Problem Reports</p>
                        {record.problems && record.problems.length > 0 ? (
                            <div className="space-y-2">
                                {record.problems.map((problem: any, idx: number) => {
                                    const status = problem.status ?? 'open';
                                    return (
                                        <div key={problem.id ?? idx} className="rounded-md border p-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="destructive">
                                                        Spindle {problem.spindleNumber}
                                                    </Badge>
                                                    <Badge variant={status === 'resolved' ? 'secondary' : 'outline'}>
                                                        {status === 'resolved' ? 'Resolved' : 'Open'}
                                                    </Badge>
                                                </div>
                                                <span className="text-xs text-muted-foreground">
                                                    {formatDate(problem.timestamp)}
                                                </span>
                                            </div>
                                            <p className="mt-2 text-sm">{problem.description}</p>
                                            {status === 'resolved' && problem.resolution && (
                                                <div className="mt-2 rounded-md bg-gray-50 p-2 text-xs">
                                                    <p><span className="font-medium">Action:</span> {problem.resolution.action}</p>
                                                    <p><span className="font-medium">After-Repair Max:</span> {problem.resolution.after_repair_max ?? 'N/A'}</p>
                                                    <p><span className="font-medium">After-Repair Min:</span> {problem.resolution.after_repair_min ?? 'N/A'}</p>
                                                    <p><span className="font-medium">Resolved By:</span> {problem.resolution.resolved_by} on {formatDate(problem.resolution.resolved_at)}</p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground">No problems reported.</p>
                        )}
                    </div>
                </div>

                <DialogFooter className="px-6 pb-6">
                    <Button variant="outline" onClick={handleDownload}>
                        <DownloadIcon className="mr-2 h-4 w-4" />
                        Download CSV
                    </Button>
                    <Button variant="outline" onClick={() => setOpen(false)} className="ml-auto">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EditTwistingRecordDialog({ record, onSaved, onCloseMenu }: { record: TensionRecord; onSaved?: () => void; onCloseMenu?: () => void }) {
    const [open, setOpen] = useState(false);
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [saveStatus, setSaveStatus] = useState<'saving' | 'success' | 'error'>('saving');
    const [saveSteps, setSaveSteps] = useState<SaveStep[]>([]);
    const [saveError, setSaveError] = useState<{ message: string; details: string } | null>(null);

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
    const [itemNumber, setItemNumber] = useState(record.metadata?.item_number ?? '');
    const [yarnCode, setYarnCode] = useState(record.metadata?.yarn_code ?? '');
    const [machineNumber, setMachineNumber] = useState(record.form_data?.machineNumber ?? '');
    const [dtexNumber, setDtexNumber] = useState(record.form_data?.dtexNumber ?? '');
    const [tpm, setTpm] = useState(record.form_data?.tpm ?? '');
    const [rpm, setRpm] = useState(record.form_data?.rpm ?? '');
    const [specTens, setSpecTens] = useState(record.form_data?.specTens ?? '');
    const [tensPlus, setTensPlus] = useState(record.form_data?.tensPlus ?? '');
    const [metersCheck, setMetersCheck] = useState(record.form_data?.metersCheck ?? '');

    const [measurements, setMeasurements] = useState(() =>
        Object.entries(record.measurement_data ?? {})
            .map(([spindle, values]: [string, any]) => ({
                spindle: Number(spindle),
                max: values?.max ?? '',
                min: values?.min ?? '',
            }))
            .sort((a, b) => a.spindle - b.spindle),
    );

    const updateMeasurement = (spindle: number, field: 'max' | 'min', value: string) => {
        setMeasurements((prev) => prev.map((m) => (m.spindle === spindle ? { ...m, [field]: value } : m)));
    };

    const [problems, setProblems] = useState(() =>
        (record.problems ?? []).map((p: any) => ({ ...p, resolution: p.resolution ? { ...p.resolution } : null })),
    );

    const updateProblem = (idx: number, field: string, value: any) => {
        setProblems((prev) => prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
    };

    const updateProblemResolution = (idx: number, field: string, value: any) => {
        setProblems((prev) => prev.map((p, i) => (i === idx ? { ...p, resolution: { ...p.resolution, [field]: value } } : p)));
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
            { key: 'update', label: 'Saving changes to database', status: 'active' },
            { key: 'verify', label: 'Verifying saved changes', status: 'pending' },
        ]);
        setSaveDialogOpen(true);

        const measurement_data: Record<string, { max: number; min: number }> = {};
        measurements.forEach((m) => {
            measurement_data[String(m.spindle)] = {
                max: Number(m.max),
                min: Number(m.min),
            };
        });
        const metadata = { ...record.metadata, operator, item_number: itemNumber, yarn_code: yarnCode };
        const form_data = {
            ...record.form_data,
            machineNumber,
            itemNumber,
            yarnCode,
            dtexNumber,
            tpm,
            rpm,
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
                body: JSON.stringify({ metadata, form_data, measurement_data, problems }),
            });

            const resultText = await res.text();
            let result: any;
            try {
                result = JSON.parse(resultText);
            } catch {
                result = { message: resultText };
            }

            if (!res.ok) {
                setSaveSteps((prev) => prev.map((s) => (s.key === 'update' ? { ...s, status: 'error' } : s)));
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
                prev.map((s) => (s.key === 'update' ? { ...s, status: 'done' } : s.key === 'verify' ? { ...s, status: 'active' } : s)),
            );

            const fetched = await databaseService.getTensionRecord(String(record.id));
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
                setSaveSteps((prev) => prev.map((s) => (s.key === 'verify' ? { ...s, status: 'error' } : s)));
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

            setSaveSteps((prev) => prev.map((s) => (s.key === 'verify' ? { ...s, status: 'done' } : s)));
            setSaveStatus('success');
        } catch (e: any) {
            setSaveSteps((prev) => prev.map((s) => (s.status === 'active' ? { ...s, status: 'error' } : s)));
            setSaveStatus('error');
            setSaveError({
                message: e.message ?? 'Error updating record',
                details: JSON.stringify(
                    {
                        step: 'update',
                        recordType: record.record_type,
                        recordId: record.id,
                        itemNumber,
                        machineNumber,
                        error: e.message,
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
                if (!next && saveDialogOpen && saveStatus === 'saving') return;
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
                    <DialogTitle>Edit Twisting Tension Record</DialogTitle>
                    <DialogDescription>Item Number: {record.metadata?.item_number ?? 'N/A'}</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="tension" className="w-full min-w-0 gap-0">
                    <TabsList className="mx-6 grid w-[calc(100%-3rem)] grid-cols-2">
                        <TabsTrigger value="tension">Tension Values</TabsTrigger>
                        <TabsTrigger value="problems">Problems</TabsTrigger>
                    </TabsList>

                <TabsContent value="tension" className="max-h-[65vh] min-w-0 space-y-4 overflow-y-auto px-6 py-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        <div className="space-y-1">
                            <Label htmlFor="edit-operator">Operator</Label>
                            <Input id="edit-operator" value={operator} onChange={(e) => setOperator(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-item-number">Item Number</Label>
                            <Input id="edit-item-number" value={itemNumber} onChange={(e) => setItemNumber(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-yarn-code">Yarn Code</Label>
                            <Input id="edit-yarn-code" value={yarnCode} onChange={(e) => setYarnCode(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-machine-number">Machine Number</Label>
                            <Input id="edit-machine-number" value={machineNumber} onChange={(e) => setMachineNumber(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-dtex">Density (Dtex)</Label>
                            <Input id="edit-dtex" type="number" step="any" value={dtexNumber} onChange={(e) => setDtexNumber(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-tpm">Table Twist (TPM)</Label>
                            <Input id="edit-tpm" type="number" step="any" value={tpm} onChange={(e) => setTpm(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-rpm">Cycle Speed (RPM)</Label>
                            <Input id="edit-rpm" type="number" step="any" value={rpm} onChange={(e) => setRpm(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-spec-tens">Spec. Tension (cN)</Label>
                            <Input id="edit-spec-tens" type="number" step="any" value={specTens} onChange={(e) => setSpecTens(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-tens-plus">Tens. Deviation (cN)</Label>
                            <Input id="edit-tens-plus" type="number" step="any" value={tensPlus} onChange={(e) => setTensPlus(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="edit-meters-check">Meters Check (m)</Label>
                            <Input id="edit-meters-check" type="number" step="any" value={metersCheck} onChange={(e) => setMetersCheck(e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <p className="mb-2 text-sm font-semibold">Measurement Data</p>
                        <div className="overflow-hidden rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Spindle Number</TableHead>
                                        <TableHead>Max Value</TableHead>
                                        <TableHead>Min Value</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {measurements.length ? (
                                        measurements.map((m) => (
                                            <TableRow key={m.spindle}>
                                                <TableCell>{m.spindle}</TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        step="any"
                                                        className="h-8 w-24"
                                                        value={m.max}
                                                        onChange={(e) => updateMeasurement(m.spindle, 'max', e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        step="any"
                                                        className="h-8 w-24"
                                                        value={m.min}
                                                        onChange={(e) => updateMeasurement(m.spindle, 'min', e.target.value)}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="h-16 text-center text-sm text-muted-foreground">
                                                No measurements recorded.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                </TabsContent>

                <TabsContent value="problems" className="max-h-[65vh] min-w-0 space-y-4 overflow-y-auto px-6 py-4">
                    <div>
                        <p className="mb-2 text-sm font-semibold">Problem Reports</p>
                        <div className="overflow-x-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Spindle Number</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Resolution Action</TableHead>
                                        <TableHead>After-Repair Max</TableHead>
                                        <TableHead>After-Repair Min</TableHead>
                                        <TableHead>Resolved</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {problems.length ? (
                                        problems.map((problem: any, idx: number) => {
                                            const status = problem.status ?? 'open';
                                            const resolved = status === 'resolved' && problem.resolution;
                                            return (
                                                <TableRow key={problem.id ?? idx}>
                                                    <TableCell>Spindle {problem.spindleNumber}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={resolved ? 'secondary' : 'destructive'}>
                                                            {resolved ? 'Resolved' : 'Open'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Textarea
                                                            className="min-w-[180px]"
                                                            rows={2}
                                                            value={problem.description ?? ''}
                                                            onChange={(e) => updateProblem(idx, 'description', e.target.value)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {resolved ? (
                                                            <Textarea
                                                                className="min-w-[180px]"
                                                                rows={2}
                                                                value={problem.resolution.action ?? ''}
                                                                onChange={(e) => updateProblemResolution(idx, 'action', e.target.value)}
                                                            />
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {resolved ? (
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                className="h-8 w-24"
                                                                value={problem.resolution.after_repair_max ?? ''}
                                                                onChange={(e) => updateProblemResolution(idx, 'after_repair_max', e.target.value)}
                                                            />
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {resolved ? (
                                                            <Input
                                                                type="number"
                                                                step="any"
                                                                className="h-8 w-24"
                                                                value={problem.resolution.after_repair_min ?? ''}
                                                                onChange={(e) => updateProblemResolution(idx, 'after_repair_min', e.target.value)}
                                                            />
                                                        ) : (
                                                            <span className="text-muted-foreground">—</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {resolved
                                                            ? `${problem.resolution.resolved_by} on ${formatDate(problem.resolution.resolved_at)}`
                                                            : '—'}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} className="h-16 text-center text-sm text-muted-foreground">
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
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={saveDialogOpen && saveStatus === 'saving'}>
                        {saveDialogOpen && saveStatus === 'saving' ? 'Saving...' : 'Save Changes'}
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

export function TwistingDataTable() {
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

    const [pagination, setPagination] = useState({
        pageIndex: 0, // TanStack starts from 0
        pageSize: 10,
    });
    const [refreshKey, setRefreshKey] = useState(0);

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

        params.append('type', 'twisting'); // 🧠 Filter by twisting type

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
                `${baseUrl}/tension-records?${params.toString()}`,
                {
                    credentials: 'include', // keep session if needed
                    signal: controller.signal,
                },
            );

            const json: LaravelPaginatedResponse<TensionRecord> =
                await response.json();
                console.log(json);

            setData(json.data);
            setTotalRows(json.total);
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
}, [
    pagination.pageIndex,
    pagination.pageSize,
    sorting,
    globalFilter,
    columnFilters,
    refreshKey,
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
        </div>
    );
}
