import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Process Parameters', href: '#' },
    { title: 'Shift Summary', href: '/shift-summary-display' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

interface ParsedStyle {
    yarn_type: string | null;
    dtex: number | null;
    tpm: number | null;
    yarn_code: string | null;
    machine_code: string | null;
    counter_length: number | null;
}

interface ShiftSummaryRow {
    id: number;
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
    energy_kwh: string | null;
}

interface Paginated<T> {
    data: T[];
    total: number;
    last_page: number;
    current_page: number;
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

const fmtDate = (d: string) => d.substring(0, 10);

export default function ShiftSummaryDisplay() {
    const [machine, setMachine]             = useState('');
    const [year, setYear]                   = useState('');
    const [month, setMonth]                 = useState('all');
    const [shift, setShift]                 = useState('all');
    const [dateFrom, setDateFrom]           = useState('');
    const [dateTo, setDateTo]               = useState('');
    const [missingEnergy, setMissingEnergy] = useState(false);
    const [multiStyle, setMultiStyle]       = useState(false);
    const [speedOutlier, setSpeedOutlier]   = useState(false);
    const [runtimeOutlier, setRuntimeOutlier] = useState(false);
    const [page, setPage]                   = useState(1);
    const [result, setResult]               = useState<Paginated<ShiftSummaryRow> | null>(null);
    const [loading, setLoading]             = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = { page: String(page) };
            if (machine)             params.machine         = machine;
            if (year)                params.year            = year;
            if (month !== 'all')     params.month           = month;
            if (shift !== 'all')     params.shift           = shift;
            if (dateFrom)            params.date_from       = dateFrom;
            if (dateTo)              params.date_to         = dateTo;
            if (missingEnergy)       params.missing_energy  = '1';
            if (multiStyle)          params.multi_style     = '1';
            if (speedOutlier)        params.speed_outlier   = '1';
            if (runtimeOutlier)      params.runtime_outlier = '1';
            const res = await axios.get<Paginated<ShiftSummaryRow>>('/energy-shift-summary', { params });
            setResult(res.data);
        } finally {
            setLoading(false);
        }
    }, [machine, year, month, shift, dateFrom, dateTo, missingEnergy, multiStyle, speedOutlier, runtimeOutlier, page]);

    useEffect(() => { load(); }, [load]);

    const resetPage = () => setPage(1);

    const clearFilters = () => {
        setMachine(''); setYear(''); setMonth('all'); setShift('all');
        setDateFrom(''); setDateTo('');
        setMissingEnergy(false); setMultiStyle(false); setSpeedOutlier(false); setRuntimeOutlier(false);
        setPage(1);
    };

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
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Shift Summary" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
                <div>
                    <h1 className="text-xl font-semibold">Shift Summary</h1>
                    <p className="text-sm text-muted-foreground">Daily runtime aggregates with energy consumption per machine and shift</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Input placeholder="Machine…" value={machine} onChange={(e) => { setMachine(e.target.value); resetPage(); }} className="h-8 w-32" />
                    <Select value={shift} onValueChange={(v) => { setShift(v); resetPage(); }}>
                        <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Shift" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All shifts</SelectItem>
                            <SelectItem value="1">Shift 1</SelectItem>
                            <SelectItem value="2">Shift 2</SelectItem>
                            <SelectItem value="3">Shift 3</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={month} onValueChange={(v) => { setMonth(v); resetPage(); }}>
                        <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Month" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All months</SelectItem>
                            {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Input placeholder="Year" value={year} onChange={(e) => { setYear(e.target.value); resetPage(); }} className="h-8 w-20" type="number" />
                    <Input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); resetPage(); }} className="h-8 w-36" />
                    <Input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); resetPage(); }} className="h-8 w-36" />
                    <Button variant={missingEnergy  ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => { setMissingEnergy((v) => !v); resetPage(); }}>Missing energy</Button>
                    <Button variant={multiStyle     ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => { setMultiStyle((v) => !v); resetPage(); }}>Multi-style</Button>
                    <Button variant={speedOutlier   ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => { setSpeedOutlier((v) => !v); resetPage(); }}>Speed outlier</Button>
                    <Button variant={runtimeOutlier ? 'default' : 'outline'} size="sm" className="h-8" onClick={() => { setRuntimeOutlier((v) => !v); resetPage(); }}>Runtime outlier</Button>
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
                                        <TableHead>Yarn Type</TableHead>
                                        <TableHead className="text-right">dtex</TableHead>
                                        <TableHead className="text-right">TPM</TableHead>
                                        <TableHead>Yarn Code</TableHead>
                                        <TableHead>Machine Type</TableHead>
                                        <TableHead className="text-right">Counter Length</TableHead>
                                        <TableHead className="text-right">Total Runtime (h)</TableHead>
                                        <TableHead className="text-right">Actual/Spindle (h)</TableHead>
                                        <TableHead className="text-right">Avg RPM</TableHead>
                                        <TableHead className="text-right">Energy (kWh)</TableHead>
                                        <TableHead className="text-right">Energy/Spindle (kWh)</TableHead>
                                        <TableHead>Flags</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {result?.data.length === 0 && (
                                        <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-8">No data found.</TableCell></TableRow>
                                    )}
                                    {result?.data.map((r) => {
                                        const sp = r.styles_parsed ?? [];
                                        return (
                                            <TableRow key={r.id} className={r.energy_kwh == null ? 'bg-yellow-500/5' : ''}>
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
                                                <TableCell className="text-right tabular-nums">
                                                    {r.energy_kwh != null
                                                        ? parseFloat(r.energy_kwh).toLocaleString(undefined, { maximumFractionDigits: 3 })
                                                        : <span className="text-yellow-600 dark:text-yellow-400 text-xs">no data</span>
                                                    }
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {r.energy_kwh != null && r.actual_machine_runtime != null
                                                        ? (parseFloat(r.energy_kwh) * parseFloat(r.actual_machine_runtime) / parseFloat(r.total_runtime_hours)).toFixed(3)
                                                        : <span className="text-muted-foreground">—</span>
                                                    }
                                                </TableCell>
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
                                <p className="text-xs text-muted-foreground">{result.total.toLocaleString()} rows total</p>
                                <Pagination page={result.current_page} lastPage={result.last_page} onChange={setPage} />
                            </>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
