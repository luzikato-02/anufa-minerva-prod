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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import { usePermissions } from '@/lib/permissions';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Process Parameters', href: '#' },
    { title: 'Runtime Records', href: '/runtime-records-display' },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface RuntimeRecord {
    id: number;
    upload_batch_id: number;
    machine_id: string;
    machine_number: string;
    side: string | null;
    year: number;
    month: number;
    date: string;
    shift: number;
    style_description: string | null;
    yarn_type: string | null;
    dtex: number | null;
    tpm: number | null;
    yarn_code: string | null;
    machine_code: string | null;
    counter_length: number | null;
    runtime_hours: string;
    actual_runtime_hours: string | null;
    rpm: number;
    machine_definition_id: number | null;
}

interface ParsedStyle {
    yarn_type: string | null;
    dtex: number | null;
    tpm: number | null;
    yarn_code: string | null;
    machine_code: string | null;
    counter_length: number | null;
}

interface ShiftAggregate {
    id: number;
    upload_batch_id: number;
    machine_number: string;
    year: number;
    month: number;
    date: string;
    shift: number;
    total_runtime_hours: string;
    actual_machine_runtime: string | null;
    avg_rpm: string;
    styles: string[];
    styles_parsed: ParsedStyle[];
    has_multi_style: boolean;
    has_speed_outlier: boolean;
    has_runtime_outlier: boolean;
    machine_definition_id: number | null;
}

interface UploadBatch {
    id: number;
    file_name: string;
    year: number;
    month: number;
    row_count: number;
    skipped_count: number;
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

// ── Upload Dialog ─────────────────────────────────────────────────────────────

function UploadDialog({ onUploaded }: { onUploaded: () => void }) {
    const [open, setOpen]       = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError]     = useState<string | null>(null);
    const [result, setResult]   = useState<{ imported: number; skipped: number; undefined_machines: string[] } | null>(null);
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
            const res  = await axios.post<{ imported: number; skipped: number; undefined_machines: string[] }>(
                '/runtime-records/import',
                fd,
                { headers: { 'X-CSRF-TOKEN': csrf, 'Content-Type': 'multipart/form-data' } },
            );
            setResult(res.data);
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
                        <DialogTitle>Import Runtime Data</DialogTitle>
                        <DialogDescription>Upload a monthly ERP runtime XLSX export.</DialogDescription>
                    </DialogHeader>

                    {result ? (
                        <div className="space-y-3 py-2">
                            <div className="flex items-center gap-2 rounded-md bg-green-500/10 p-3 text-sm text-green-700 dark:text-green-400">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                Imported {result.imported} rows · {result.skipped} summary rows skipped
                            </div>
                            {result.undefined_machines.length > 0 && (
                                <div className="rounded-md bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-400">
                                    <div className="flex items-center gap-2 font-medium">
                                        <AlertTriangle className="h-4 w-4 shrink-0" />
                                        {result.undefined_machines.length} machine(s) not in definitions — actual runtime not computed:
                                    </div>
                                    <p className="mt-1 font-mono text-xs">{result.undefined_machines.join(', ')}</p>
                                    <p className="mt-1 text-xs">Add these machines in Machine Maintenance to enable runtime computation.</p>
                                </div>
                            )}
                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={close}>Close</Button>
                                <Button onClick={() => { close(); onUploaded(); }}>View Records</Button>
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

// ── Filters bar ───────────────────────────────────────────────────────────────

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface CommonFilters { machine: string; shift: string; month: string; year: string; date_from: string; date_to: string; }

function FiltersBar({ filters, onChange }: { filters: CommonFilters; onChange: (f: Partial<CommonFilters>) => void }) {
    return (
        <div className="flex flex-wrap gap-2">
            <Input
                placeholder="Machine…"
                value={filters.machine}
                onChange={(e) => onChange({ machine: e.target.value })}
                className="h-8 w-32"
            />
            <Select value={filters.shift} onValueChange={(v) => onChange({ shift: v })}>
                <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Shift" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All shifts</SelectItem>
                    <SelectItem value="1">Shift 1</SelectItem>
                    <SelectItem value="2">Shift 2</SelectItem>
                    <SelectItem value="3">Shift 3</SelectItem>
                </SelectContent>
            </Select>
            <Select value={filters.month} onValueChange={(v) => onChange({ month: v })}>
                <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Month" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All months</SelectItem>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
            </Select>
            <Input
                placeholder="Year"
                value={filters.year}
                onChange={(e) => onChange({ year: e.target.value })}
                className="h-8 w-20"
                type="number"
            />
            <Input
                type="date"
                value={filters.date_from}
                onChange={(e) => onChange({ date_from: e.target.value })}
                className="h-8 w-36"
            />
            <Input
                type="date"
                value={filters.date_to}
                onChange={(e) => onChange({ date_to: e.target.value })}
                className="h-8 w-36"
            />
            <Button variant="ghost" size="sm" className="h-8" onClick={() => onChange({ machine: '', shift: 'all', month: 'all', year: '', date_from: '', date_to: '' })}>
                Clear
            </Button>
        </div>
    );
}

const fmtDate = (d: string) => d.substring(0, 10);

// ── Pagination ────────────────────────────────────────────────────────────────

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

// ── Raw Records Tab ───────────────────────────────────────────────────────────

function RawRecordsTab({ refresh }: { refresh: number }) {
    const [filters, setFilters] = useState<CommonFilters>({ machine: '', shift: 'all', month: 'all', year: '', date_from: '', date_to: '' });
    const [page, setPage]       = useState(1);
    const [result, setResult]   = useState<Paginated<RuntimeRecord> | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page) };
            if (filters.machine)   params.machine   = filters.machine;
            if (filters.shift !== 'all')  params.shift = filters.shift;
            if (filters.month !== 'all')  params.month = filters.month;
            if (filters.year)      params.year      = filters.year;
            if (filters.date_from) params.date_from = filters.date_from;
            if (filters.date_to)   params.date_to   = filters.date_to;
            const res = await axios.get<Paginated<RuntimeRecord>>('/runtime-records', { params });
            setResult(res.data);
        } finally {
            setLoading(false);
        }
    }, [filters, page, refresh]);

    useEffect(() => { load(); }, [load]);

    const updateFilters = (f: Partial<CommonFilters>) => { setFilters((p) => ({ ...p, ...f })); setPage(1); };

    return (
        <div className="space-y-3">
            <FiltersBar filters={filters} onChange={updateFilters} />
            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
                <>
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Machine</TableHead>
                                    <TableHead>Side</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead className="text-right">Shift</TableHead>
                                    <TableHead>Yarn Type</TableHead>
                                    <TableHead className="text-right">dtex</TableHead>
                                    <TableHead className="text-right">TPM</TableHead>
                                    <TableHead>Yarn Code</TableHead>
                                    <TableHead>Machine Type</TableHead>
                                    <TableHead className="text-right">Counter Length</TableHead>
                                    <TableHead className="text-right">Runtime (h)</TableHead>
                                    <TableHead className="text-right">Actual/Spindle (h)</TableHead>
                                    <TableHead className="text-right">RPM</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result?.data.length === 0 && (
                                    <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">No records found.</TableCell></TableRow>
                                )}
                                {result?.data.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell className="font-mono font-medium">{r.machine_number}</TableCell>
                                        <TableCell>{r.side ?? '—'}</TableCell>
                                        <TableCell className="tabular-nums">{fmtDate(r.date)}</TableCell>
                                        <TableCell className="text-right">{r.shift}</TableCell>
                                        <TableCell className="font-mono text-xs">{r.yarn_type ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                        <TableCell className="text-right tabular-nums">{r.dtex ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                        <TableCell className="text-right tabular-nums">{r.tpm ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                        <TableCell className="font-mono text-xs">{r.yarn_code ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                        <TableCell className="font-mono text-xs">{r.machine_code ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                        <TableCell className="text-right tabular-nums">{r.counter_length?.toLocaleString() ?? <span className="text-muted-foreground">—</span>}</TableCell>
                                        <TableCell className="text-right tabular-nums">{parseFloat(r.runtime_hours).toFixed(3)}</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {r.actual_runtime_hours != null ? parseFloat(r.actual_runtime_hours).toFixed(5) : <span className="text-muted-foreground">—</span>}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">{r.rpm.toLocaleString()}</TableCell>
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

// ── Shift Aggregates Tab ──────────────────────────────────────────────────────

function ShiftAggregatesTab({ refresh }: { refresh: number }) {
    const [filters, setFilters] = useState<CommonFilters & { multi_style: boolean; speed_outlier: boolean; runtime_outlier: boolean }>({
        machine: '', shift: 'all', month: 'all', year: '', date_from: '', date_to: '',
        multi_style: false, speed_outlier: false, runtime_outlier: false,
    });
    const [page, setPage]       = useState(1);
    const [result, setResult]   = useState<Paginated<ShiftAggregate> | null>(null);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page) };
            if (filters.machine)          params.machine        = filters.machine;
            if (filters.shift !== 'all')  params.shift          = filters.shift;
            if (filters.month !== 'all')  params.month          = filters.month;
            if (filters.year)             params.year           = filters.year;
            if (filters.date_from)        params.date_from      = filters.date_from;
            if (filters.date_to)          params.date_to        = filters.date_to;
            if (filters.multi_style)      params.multi_style    = '1';
            if (filters.speed_outlier)    params.speed_outlier  = '1';
            if (filters.runtime_outlier)  params.runtime_outlier = '1';
            const res = await axios.get<Paginated<ShiftAggregate>>('/runtime-aggregates', { params });
            setResult(res.data);
        } finally {
            setLoading(false);
        }
    }, [filters, page, refresh]);

    useEffect(() => { load(); }, [load]);

    const update = (f: Partial<typeof filters>) => { setFilters((p) => ({ ...p, ...f })); setPage(1); };

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <FiltersBar
                    filters={filters}
                    onChange={(f) => update(f)}
                />
                <Button
                    variant={filters.multi_style ? 'default' : 'outline'}
                    size="sm" className="h-8"
                    onClick={() => update({ multi_style: !filters.multi_style })}
                >
                    Multi-style
                </Button>
                <Button
                    variant={filters.speed_outlier ? 'default' : 'outline'}
                    size="sm" className="h-8"
                    onClick={() => update({ speed_outlier: !filters.speed_outlier })}
                >
                    Speed outlier
                </Button>
                <Button
                    variant={filters.runtime_outlier ? 'default' : 'outline'}
                    size="sm" className="h-8"
                    onClick={() => update({ runtime_outlier: !filters.runtime_outlier })}
                >
                    Runtime outlier
                </Button>
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
                                    <TableHead>Yarn Type</TableHead>
                                    <TableHead className="text-right">dtex</TableHead>
                                    <TableHead className="text-right">TPM</TableHead>
                                    <TableHead>Yarn Code</TableHead>
                                    <TableHead>Machine Type</TableHead>
                                    <TableHead className="text-right">Counter Length</TableHead>
                                    <TableHead className="text-right">Total Runtime (h)</TableHead>
                                    <TableHead className="text-right">Actual/Spindle (h)</TableHead>
                                    <TableHead className="text-right">Avg RPM</TableHead>
                                    <TableHead>Flags</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result?.data.length === 0 && (
                                    <TableRow><TableCell colSpan={13} className="text-center text-muted-foreground py-8">No aggregates found.</TableCell></TableRow>
                                )}
                                {result?.data.map((r) => {
                                    const sp = r.styles_parsed ?? [];
                                    const cell = (vals: (string | number | null)[]) => {
                                        const filled = vals.filter(Boolean);
                                        if (filled.length === 0) return <span className="text-muted-foreground">—</span>;
                                        return (
                                            <div className="flex flex-col gap-0.5">
                                                {filled.map((v, i) => <span key={i} className="font-mono text-xs">{String(v)}</span>)}
                                            </div>
                                        );
                                    };
                                    return (
                                        <TableRow key={r.id}>
                                            <TableCell className="font-mono font-medium">{r.machine_number}</TableCell>
                                            <TableCell className="tabular-nums">{fmtDate(r.date)}</TableCell>
                                            <TableCell className="text-right">{r.shift}</TableCell>
                                            <TableCell>{cell(sp.map(s => s.yarn_type))}</TableCell>
                                            <TableCell className="text-right">{cell(sp.map(s => s.dtex))}</TableCell>
                                            <TableCell className="text-right">{cell(sp.map(s => s.tpm))}</TableCell>
                                            <TableCell>{cell(sp.map(s => s.yarn_code))}</TableCell>
                                            <TableCell>{cell(sp.map(s => s.machine_code))}</TableCell>
                                            <TableCell className="text-right">{cell(sp.map(s => s.counter_length?.toLocaleString() ?? null))}</TableCell>
                                            <TableCell className="text-right tabular-nums">{parseFloat(r.total_runtime_hours).toFixed(3)}</TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {r.actual_machine_runtime != null ? parseFloat(r.actual_machine_runtime).toFixed(5) : <span className="text-muted-foreground">—</span>}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">{parseFloat(r.avg_rpm).toFixed(0)}</TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {r.has_multi_style     && <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">Multi-style</Badge>}
                                                    {r.has_speed_outlier   && <Badge variant="outline" className="text-xs border-red-500 text-red-600">Speed</Badge>}
                                                    {r.has_runtime_outlier && <Badge variant="outline" className="text-xs border-orange-500 text-orange-600">Runtime</Badge>}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                    {result && (
                        <>
                            <p className="text-xs text-muted-foreground">{result.total.toLocaleString()} aggregates total</p>
                            <Pagination page={result.current_page} lastPage={result.last_page} onChange={setPage} />
                        </>
                    )}
                </>
            )}
        </div>
    );
}

// ── Upload Batches Tab ────────────────────────────────────────────────────────

function UploadBatchesTab({ refresh }: { refresh: number }) {
    const { can } = usePermissions();
    const canDelete   = can('runtime.delete');
    const canRecalc   = can('runtime.create');

    const [result, setResult]   = useState<Paginated<UploadBatch> | null>(null);
    const [page, setPage]       = useState(1);
    const [loading, setLoading] = useState(false);
    const [toDelete, setToDelete] = useState<UploadBatch | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [recalcingId, setRecalcingId] = useState<number | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axios.get<Paginated<UploadBatch>>('/runtime-batches', { params: { page } });
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
            await axios.delete(`/runtime-batches/${toDelete.id}`, { headers: { 'X-CSRF-TOKEN': csrf } });
            setToDelete(null);
            load();
        } finally {
            setDeleting(false);
        }
    };

    const handleRecalculate = async (batch: UploadBatch) => {
        setRecalcingId(batch.id);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            await axios.post(`/runtime-batches/${batch.id}/recalculate`, {}, { headers: { 'X-CSRF-TOKEN': csrf } });
        } finally {
            setRecalcingId(null);
        }
    };

    const fmt = (s: string) => new Date(s).toLocaleString();

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
                                    <TableHead className="text-right">Month</TableHead>
                                    <TableHead className="text-right">Rows</TableHead>
                                    <TableHead className="text-right">Skipped</TableHead>
                                    <TableHead>Uploaded by</TableHead>
                                    <TableHead>Date</TableHead>
                                    {(canRecalc || canDelete) && <TableHead className="w-20" />}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {result?.data.length === 0 && (
                                    <TableRow><TableCell colSpan={(canRecalc || canDelete) ? 8 : 7} className="text-center text-muted-foreground py-8">No uploads yet.</TableCell></TableRow>
                                )}
                                {result?.data.map((b) => (
                                    <TableRow key={b.id}>
                                        <TableCell className="max-w-[200px] truncate font-mono text-xs" title={b.file_name}>{b.file_name}</TableCell>
                                        <TableCell className="text-right tabular-nums">{b.year}</TableCell>
                                        <TableCell className="text-right">{MONTHS[b.month - 1]}</TableCell>
                                        <TableCell className="text-right tabular-nums">{b.row_count.toLocaleString()}</TableCell>
                                        <TableCell className="text-right tabular-nums text-muted-foreground">{b.skipped_count.toLocaleString()}</TableCell>
                                        <TableCell className="text-sm">{b.user?.name ?? '—'}</TableCell>
                                        <TableCell className="text-sm tabular-nums">{fmt(b.created_at)}</TableCell>
                                        {(canRecalc || canDelete) && (
                                            <TableCell>
                                                <div className="flex items-center gap-1">
                                                    {canRecalc && (
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                                            disabled={recalcingId === b.id}
                                                            title="Recalculate this batch"
                                                            onClick={() => handleRecalculate(b)}
                                                        >
                                                            <RefreshCw className={`h-3.5 w-3.5 ${recalcingId === b.id ? 'animate-spin' : ''}`} />
                                                        </Button>
                                                    )}
                                                    {canDelete && (
                                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setToDelete(b)}>
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
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
                            "{toDelete?.file_name}" and all its runtime records and shift aggregates will be permanently deleted.
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

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RuntimeRecordsDisplay() {
    const { can } = usePermissions();
    const canImport = can('runtime.create');
    // bump to trigger tab reloads after an upload or a recalculate
    const [dataTick, setDataTick] = useState(0);

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Runtime Records" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold">Cable Twisting Machine Runtime</h1>
                        <p className="text-sm text-muted-foreground">Per-shift runtime and RPM data from ERP monthly exports</p>
                    </div>
                    {canImport && <UploadDialog onUploaded={() => setDataTick((t) => t + 1)} />}
                </div>
                <Tabs defaultValue="aggregates">
                    <TabsList>
                        <TabsTrigger value="aggregates">Shift Aggregates</TabsTrigger>
                        <TabsTrigger value="records">Raw Records</TabsTrigger>
                        <TabsTrigger value="batches">Upload Batches</TabsTrigger>
                    </TabsList>
                    <TabsContent value="aggregates" className="mt-4">
                        <ShiftAggregatesTab refresh={dataTick} />
                    </TabsContent>
                    <TabsContent value="records" className="mt-4">
                        <RawRecordsTab refresh={dataTick} />
                    </TabsContent>
                    <TabsContent value="batches" className="mt-4">
                        <UploadBatchesTab refresh={dataTick} />
                    </TabsContent>
                </Tabs>
            </div>
        </AppLayout>
    );
}
