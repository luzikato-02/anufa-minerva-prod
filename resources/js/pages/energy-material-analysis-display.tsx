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
import { useCallback, useEffect, useMemo, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Twisting Energy & Runtime', href: '#' },
    { title: 'Material Energy Analysis', href: '/energy-material-analysis-display' },
];

interface MaterialEnergyRow {
    yarn_type: string;
    dtex: number;
    tpm: number;
    speed_bucket: number;
    record_count: number;
    total_runtime_hours: string;
    total_spindle_hours: string | null;
    total_energy_kwh: string;
    energy_per_machine_hour: string;
    energy_per_spindle_hour: string | null;
}

// Two-ply production formula: kg/h = (speed × 120 × dtex × 1e-7) / tpm
const kgPerHour = (speed: number, dtex: number, tpm: number) =>
    (speed * 120 * dtex * 1e-7) / tpm;

const SPEED_BUCKETS = [500, 1000, 1500, 2000, 2500, 3000];

export default function EnergyMaterialAnalysisDisplay() {
    const [yarnType, setYarnType]     = useState('');
    const [dtex, setDtex]             = useState('');
    const [tpm, setTpm]               = useState('');
    const [speedBucket, setSpeedBucket] = useState('all');
    const [rows, setRows]             = useState<MaterialEnergyRow[] | null>(null);
    const [loading, setLoading]       = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string> = {};
            if (yarnType)             params.yarn_type    = yarnType;
            if (dtex)                 params.dtex         = dtex;
            if (tpm)                  params.tpm          = tpm;
            if (speedBucket !== 'all') params.speed_bucket = speedBucket;
            const res = await axios.get<MaterialEnergyRow[]>('/energy-material-analysis', { params });
            setRows(res.data);
        } finally {
            setLoading(false);
        }
    }, [yarnType, dtex, tpm, speedBucket]);

    useEffect(() => { load(); }, [load]);

    // Compute the best (lowest kWh/kg) speed bucket per (yarn_type, dtex, tpm) group
    const bestKeys = useMemo(() => {
        if (!rows) return new Set<string>();
        const byMaterial: Record<string, { key: string; val: number }> = {};
        for (const r of rows) {
            const matKey = `${r.yarn_type}|${r.dtex}|${r.tpm}`;
            const rate   = kgPerHour(r.speed_bucket, r.dtex, r.tpm);
            const kwhKg  = rate > 0 ? parseFloat(r.energy_per_machine_hour) / rate : Infinity;
            const rowKey = `${matKey}|${r.speed_bucket}`;
            if (!byMaterial[matKey] || kwhKg < byMaterial[matKey].val) {
                byMaterial[matKey] = { key: rowKey, val: kwhKg };
            }
        }
        return new Set(Object.values(byMaterial).map((v) => v.key));
    }, [rows]);

    const clearFilters = () => { setYarnType(''); setDtex(''); setTpm(''); setSpeedBucket('all'); };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Material Energy Analysis" />
            <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
                <div>
                    <h1 className="text-xl font-semibold">Energy by Material Description</h1>
                    <p className="text-sm text-muted-foreground">
                        Energy consumption grouped by yarn type, dtex, TPM, and speed bucket (500 RPM intervals).
                        Highlighted rows show the most energy-efficient speed tier per material.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Input placeholder="Yarn type…" value={yarnType} onChange={(e) => setYarnType(e.target.value)} className="h-8 w-32" />
                    <Input placeholder="dtex" value={dtex} onChange={(e) => setDtex(e.target.value)} className="h-8 w-24" type="number" />
                    <Input placeholder="TPM" value={tpm} onChange={(e) => setTpm(e.target.value)} className="h-8 w-24" type="number" />
                    <Select value={speedBucket} onValueChange={setSpeedBucket}>
                        <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Speed bucket" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All speeds</SelectItem>
                            {SPEED_BUCKETS.map((s) => (
                                <SelectItem key={s} value={String(s)}>{s.toLocaleString()} RPM</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
                                        <TableHead>Yarn Type</TableHead>
                                        <TableHead className="text-right">dtex</TableHead>
                                        <TableHead className="text-right">TPM</TableHead>
                                        <TableHead className="text-right">Speed (RPM)</TableHead>
                                        <TableHead className="text-right">Records</TableHead>
                                        <TableHead className="text-right">Runtime (h)</TableHead>
                                        <TableHead className="text-right">Spindle-h</TableHead>
                                        <TableHead className="text-right">Total Energy (kWh)</TableHead>
                                        <TableHead className="text-right">kWh/h</TableHead>
                                        <TableHead className="text-right">Prod. (kg/h)</TableHead>
                                        <TableHead className="text-right">kWh/kg</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {rows?.length === 0 && (
                                        <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground py-8">No data found.</TableCell></TableRow>
                                    )}
                                    {rows?.map((r, i) => {
                                        const rate   = kgPerHour(r.speed_bucket, r.dtex, r.tpm);
                                        const kwhKg  = rate > 0 ? parseFloat(r.energy_per_machine_hour) / rate : null;
                                        const rowKey = `${r.yarn_type}|${r.dtex}|${r.tpm}|${r.speed_bucket}`;
                                        const isBest = bestKeys.has(rowKey);
                                        return (
                                            <TableRow key={i} className={isBest ? 'bg-green-500/10' : ''}>
                                                <TableCell className="font-mono font-medium">{r.yarn_type}</TableCell>
                                                <TableCell className="text-right tabular-nums">{r.dtex.toLocaleString()}</TableCell>
                                                <TableCell className="text-right tabular-nums">{r.tpm.toLocaleString()}</TableCell>
                                                <TableCell className="text-right tabular-nums">{r.speed_bucket.toLocaleString()}</TableCell>
                                                <TableCell className="text-right tabular-nums">{r.record_count.toLocaleString()}</TableCell>
                                                <TableCell className="text-right tabular-nums">{parseFloat(r.total_runtime_hours).toFixed(1)}</TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {r.total_spindle_hours != null ? parseFloat(r.total_spindle_hours).toFixed(2) : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">{parseFloat(r.total_energy_kwh).toLocaleString(undefined, { maximumFractionDigits: 1 })}</TableCell>
                                                <TableCell className="text-right tabular-nums">{parseFloat(r.energy_per_machine_hour).toFixed(3)}</TableCell>
                                                <TableCell className="text-right tabular-nums">{rate.toFixed(3)}</TableCell>
                                                <TableCell className={`text-right tabular-nums font-medium ${isBest ? 'text-green-700 dark:text-green-400' : ''}`}>
                                                    {kwhKg != null ? kwhKg.toFixed(4) : <span className="text-muted-foreground">—</span>}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        {rows && (
                            <p className="text-xs text-muted-foreground">
                                {rows.length} material × speed combinations · green = most efficient speed tier per material
                            </p>
                        )}
                    </>
                )}
            </div>
        </AppLayout>
    );
}
