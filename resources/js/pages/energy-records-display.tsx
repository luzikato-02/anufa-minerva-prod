import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { usePermissions } from '@/lib/permissions';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { AlertCircle, CheckCircle2, Loader2, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Process Parameters', href: '#' },
    { title: 'Energy Records', href: '/energy-records-display' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Daily energy row — same granularity as runtime_shift_aggregates
interface EnergyDailyRow {
    id: number;
    machine_number: string;
    year: number;
    month: number;
    date: string;
    shift: number;
    total_runtime_hours: string;
    actual_machine_runtime: string | null;
    avg_rpm: string;
    energy_kwh: string;
}

interface UploadBatch {
    id: number;
    file_name: string;
    year: number;
    month: number;
    machine_count: number;
    created_at: string;
    user: { id: number; name: string } | null;
}

interface Paginated<T> {
    data: T[];
    total: number;
    last_page: number;
    current_page: number;
    per_page: number;
}

function Pagination({ page, lastPage, onChange }: { page: number; lastPage: number; onChange: (p: number) => void }) {
    if (lastPage <= 1) return null;
    return (
        <div className="flex items-center justify-end gap-2 border-t pt-3">
            <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
            <Button variant="outline" size="sm" onClick={() => onChange(page - 1)} disabled={page <= 1}>Previous</Button>
            <Button variant="outline" size="sm" onClick={() => onChange(page + 1)} disabled={page >= lastPage}>Next</Button>
        </div>
    );
}

function UploadDialog({ onUploaded }: { onUploaded: () => void }) {
    const [open, setOpen]           = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError]         = useState<string | null>(null);
    const [result, setResult]       = useState<{ imported: number; distributed_rows: number; batch: { year: number; month: number } } | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const close = () => { setOpen(false); setError(null); setResult(null); };

    const uploadFile = async (file: File) => {
        if (!file.name.match(/\.(xlsx|xls)$/i)) { setError('Only .xlsx or .xls files are accepted.'); return; }
        setUploading(true);
        setError(null);
        setResult(null);
        const fd = new FormData();
        fd.append('file', file);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            const res  = await axios.post('/energy-records/import', fd, {
                headers: { 'X-CSRF-TOKEN': csrf, 'Content-Type': 'multipart/form-data' },
            });
            setResult(res.data);
            onUploaded();
        } catch (err: unknown) {
            setError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : 'Upload failed. Please try again.',
            );
        } finally {
            setUploading(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file) uploadFile(file);
    };

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Import XLSX
            </Button>
            <Dialog open={open} onOpenChange={(v) => { if (!v) close(); }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Import Energy Data</DialogTitle>
                        <DialogDescription>Upload a monthly energy meter XLSX report.</DialogDescription>
                    </DialogHeader>

                    {result ? (
                        <div className="space-y-3 py-2">
                            <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                Imported {result.imported} machines for {MONTHS[result.batch.month - 1]} {result.batch.year} · distributed across {result.distributed_rows} daily shift rows
                            </div>
                            <div className="flex justify-end">
                                <Button onClick={close}>Done</Button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 py-2">
                            <div
                                className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}`}
                                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                                onDragLeave={() => setDragActive(false)}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {uploading ? (
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                ) : (
                                    <>
                                        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                                        <p className="text-sm font-medium">Drop XLSX here or click to browse</p>
                                        <p className="text-xs text-muted-foreground">.xlsx or .xls · max 20 MB</p>
                                    </>
                                )}
                            </div>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadFile(f); }}
                            />
                            {error && (
                                <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2 text-sm text-destructive">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function EnergyRecordsTab({ refresh }: { refresh: number }) {
    const [machine, setMachine]   = useState('');
    const [year, setYear]         = useState('');
    const [month, setMonth]       = useState('all');
    const [shift, setShift]       = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo]     = useState('');
    const [page, setPage]         = useState(1);
    const [result, setResult]     = useState<Paginated<EnergyDailyRow> | null>(null);
    const [loading, setLoading]   = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page) };
            if (machine)           params.machine    = machine;
            if (year)              params.year       = year;
            if (month !== 'all')   params.month      = month;
            if (shift !== 'all')   params.shift      = shift;
            if (dateFrom)          params.date_from  = dateFrom;
            if (dateTo)            params.date_to    = dateTo;
            const res = await axios.get<Paginated<EnergyDailyRow>>('/energy-records', { params });
            setResult(res.data);
        } finally {
            setLoading(false);
        }
    }, [machine, year, month, shift, dateFrom, dateTo, page, refresh]);

    useEffect(() => { load(); }, [load]);

    const clearFilters = () => { setMachine(''); setYear(''); setMonth('all'); setShift('all'); setDateFrom(''); setDateTo(''); setPage(1); };
    const fmtDate = (d: string) => d.substring(0, 10);

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
                <Input placeholder="Machine…" value={machine} onChange={(e) => { setMachine(e.target.value); setPage(1); }} className="h-8 w-32" />
                <Select value={shift} onValueChange={(v) => { setShift(v); setPage(1); }}>
                    <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Shift" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All shifts</SelectItem>
                        <SelectItem value="1">Shift 1</SelectItem>
                        <SelectItem value="2">Shift 2</SelectItem>
                        <SelectItem value="3">Shift 3</SelectItem>
                    </SelectContent>
                </Select>
                <Select value={month} onValueChange={(v) => { setMonth(v); setPage(1); }}>
                    <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Month" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All months</SelectItem>
                        {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                </Select>
                <Input placeholder="Year" value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }} className="h-8 w-20" type="number" />
                <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1); }} className="h-8 w-36" />
                <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1); }} className="h-8 w-36" />
                <Button variant="ghost" size="sm" className="h-8" onClick={clearFilters}>Clear</Button>
            </div>
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Machine</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Shift</TableHead>
                                    <TableHead className="text-right">Runtime (h)</TableHead>
                                    <TableHead className="text-right">Actual/Spindle (h)</TableHead>
                                    <TableHead className="text-right">Avg RPM</TableHead>
                                    <TableHead className="text-right">Energy (kWh)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result?.data.length === 0 && (
                                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No records found.</TableCell></TableRow>
                                )}
                                {result?.data.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-mono font-medium">{r.machine_number}</TableCell>
                                        <TableCell className="tabular-nums">{fmtDate(r.date)}</TableCell>
                                        <TableCell className="text-right">{r.shift}</TableCell>
                                        <TableCell className="text-right tabular-nums">{parseFloat(r.total_runtime_hours).toFixed(3)}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {r.actual_machine_runtime != null ? parseFloat(r.actual_machine_runtime).toFixed(5) : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{parseFloat(r.avg_rpm).toFixed(0)}</TableCell>
                                        <TableCell className="text-right tabular-nums">{parseFloat(r.energy_kwh).toLocaleString(undefined, { maximumFractionDigits: 3 })}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {result && (
                        <>
                            <p className="text-xs text-muted-foreground">{result.total.toLocaleString()} records total</p>
                            <Pagination page={result.current_page} lastPage={result.last_page} onChange={setPage} />
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function BatchesTab({ refresh }: { refresh: number }) {
    const { can } = usePermissions();
    const canDelete = can('energy.delete');

    const [result, setResult]     = useState<Paginated<UploadBatch> | null>(null);
    const [page, setPage]         = useState(1);
    const [loading, setLoading]   = useState(false);
    const [toDelete, setToDelete] = useState<UploadBatch | null>(null);
    const [deleting, setDeleting] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get<Paginated<UploadBatch>>('/energy-batches', { params: { page } });
            setResult(res.data);
        } finally {
            setLoading(false);
        }
    }, [page, refresh]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            await axios.delete(`/energy-batches/${toDelete.id}`, { headers: { 'X-CSRF-TOKEN': csrf } });
            setToDelete(null);
            load();
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-3">
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>File</TableHead>
                                    <TableHead className="text-right">Year</TableHead>
                                    <TableHead>Month</TableHead>
                                    <TableHead className="text-right">Machines</TableHead>
                                    <TableHead>Uploaded by</TableHead>
                                    <TableHead>Date</TableHead>
                                    {canDelete && <TableHead className="w-12" />}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result?.data.length === 0 && (
                                    <TableRow><TableCell colSpan={canDelete ? 7 : 6} className="text-center text-muted-foreground py-8">No uploads yet.</TableCell></TableRow>
                                )}
                                {result?.data.map((b) => (
                                    <TableRow key={b.id}>
                                        <TableCell className="max-w-[200px] truncate font-mono text-xs" title={b.file_name}>{b.file_name}</TableCell>
                                        <TableCell className="text-right tabular-nums">{b.year}</TableCell>
                                        <TableCell>{MONTHS[b.month - 1]}</TableCell>
                                        <TableCell className="text-right tabular-nums">{b.machine_count}</TableCell>
                                        <TableCell className="text-sm">{b.user?.name ?? '—'}</TableCell>
                                        <TableCell className="text-sm tabular-nums">{new Date(b.created_at).toLocaleString()}</TableCell>
                                        {canDelete && (
                                            <TableCell>
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setToDelete(b)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </TableCell>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    {result && <Pagination page={result.current_page} lastPage={result.last_page} onChange={setPage} />}
                </>
            )}

            <AlertDialog open={!!toDelete} onOpenChange={(v) => { if (!v) setToDelete(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this batch?</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{toDelete?.file_name}" will be deleted and energy_kwh cleared from all its daily shift rows.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive hover:bg-destructive/90">
                            {deleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

export default function EnergyRecordsDisplay() {
    const { can } = usePermissions();
    const canImport = can('energy.create');
    const [dataTick, setDataTick] = useState(0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Energy Records" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Energy Records</h1>
                        <p className="text-sm text-muted-foreground">Daily per-shift energy consumption distributed from monthly meter reports</p>
                    </div>
                    {canImport && <UploadDialog onUploaded={() => setDataTick((t) => t + 1)} />}
                </div>
                <Tabs defaultValue="records">
                    <TabsList>
                        <TabsTrigger value="records">Daily Records</TabsTrigger>
                        <TabsTrigger value="batches">Upload Batches</TabsTrigger>
                    </TabsList>
                    <TabsContent value="records" className="mt-4">
                        <EnergyRecordsTab refresh={dataTick} />
                    </TabsContent>
                    <TabsContent value="batches" className="mt-4">
                        <BatchesTab refresh={dataTick} />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
