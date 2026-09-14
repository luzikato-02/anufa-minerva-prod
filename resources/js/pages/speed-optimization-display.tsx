import { Button } from '@/components/ui/button';
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
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { AlertCircle, CheckCircle2, HelpCircle, Info, Loader2, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Twisting Energy & Runtime', href: '#' },
    { title: 'Speed Optimisation (GA)', href: '/speed-optimization-display' },
];

interface InputRow {
    yarn_type: string;
    dtex: string;
    tpm: string;
    initial_speed: string;
    target_tonnes: string;
}

interface OptimizationResult {
    yarn_type: string;
    dtex: number;
    tpm: number;
    initial_speed: number;
    optimal_speed: number;
    initial_energy_kwh: number | null;
    optimal_energy_kwh: number;
    savings_kwh: number | null;
    savings_pct: number | null;
    machine_hours_needed: number | null;
    convergence_gen: number;
    speed_range: { min: number; max: number };
    error?: string;
}

interface GaParams {
    population_size: string;
    generations: string;
    mutation_rate: string;
    crossover_rate: string;
    early_stop: string;
}

const DEFAULT_GA: GaParams = {
    population_size: '50',
    generations:     '150',
    mutation_rate:   '8',
    crossover_rate:  '70',
    early_stop:      '20',
};

const emptyRow = (): InputRow => ({ yarn_type: '', dtex: '', tpm: '', initial_speed: '', target_tonnes: '' });

const fmt = (n: number | null | undefined, decimals = 1) =>
    n != null ? n.toLocaleString(undefined, { maximumFractionDigits: decimals }) : '—';

type DataStatus = { status: 'idle' | 'checking' | 'ok' | 'missing'; buckets: number[] };

const matKey = (yarn_type: string, dtex: string, tpm: string) =>
    `${yarn_type.trim().toUpperCase()}|${dtex}|${tpm}`;

export default function SpeedOptimizationDisplay() {
    const [inputRows, setInputRows]       = useState<InputRow[]>([emptyRow()]);
    const [gaParams, setGaParams]         = useState<GaParams>(DEFAULT_GA);
    const [dataAvailability, setDataAvail] = useState<Record<string, DataStatus>>({});
    const [results, setResults]           = useState<OptimizationResult[] | null>(null);
    const [loading, setLoading]           = useState(false);
    const [error, setError]               = useState<string | null>(null);
    const debounceRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateGa = (field: keyof GaParams, value: string) =>
        setGaParams((p) => ({ ...p, [field]: value }));

    const updateRow = (i: number, field: keyof InputRow, value: string) => {
        setInputRows((rows) => rows.map((r, j) => j === i ? { ...r, [field]: value } : r));
    };

    const addRow = () => setInputRows((rows) => [...rows, emptyRow()]);

    const removeRow = (i: number) =>
        setInputRows((rows) => rows.length > 1 ? rows.filter((_, j) => j !== i) : rows);

    // Debounced availability check: fires 600ms after the last material field edit.
    const checkAvailability = useCallback((rows: InputRow[]) => {
        const toCheck = rows.filter((r) => r.yarn_type.trim() && r.dtex && r.tpm);
        if (toCheck.length === 0) return;

        const unknownKeys = toCheck
            .map((r) => matKey(r.yarn_type, r.dtex, r.tpm))
            .filter((k) => !dataAvailability[k] || dataAvailability[k].status === 'idle');

        if (unknownKeys.length === 0) return;

        // Mark as checking
        setDataAvail((prev) => {
            const next = { ...prev };
            for (const k of unknownKeys) next[k] = { status: 'checking', buckets: [] };
            return next;
        });

        const materials = toCheck
            .filter((r) => unknownKeys.includes(matKey(r.yarn_type, r.dtex, r.tpm)))
            .map((r) => ({ yarn_type: r.yarn_type.trim(), dtex: parseInt(r.dtex), tpm: parseInt(r.tpm) }));

        axios.post<{ yarn_type: string; dtex: number; tpm: number; has_data: boolean; speed_buckets: number[] }[]>(
            '/speed-optimization/check-materials',
            { materials },
        ).then((res) => {
            setDataAvail((prev) => {
                const next = { ...prev };
                for (const item of res.data) {
                    const k = matKey(item.yarn_type, String(item.dtex), String(item.tpm));
                    next[k] = { status: item.has_data ? 'ok' : 'missing', buckets: item.speed_buckets };
                }
                return next;
            });
        }).catch(() => {
            setDataAvail((prev) => {
                const next = { ...prev };
                for (const k of unknownKeys) next[k] = { status: 'idle', buckets: [] };
                return next;
            });
        });
    }, [dataAvailability]);

    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => checkAvailability(inputRows), 600);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [inputRows]); // eslint-disable-line react-hooks/exhaustive-deps

    const run = async () => {
        setError(null);
        setResults(null);
        setLoading(true);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            const payload = {
                ga: {
                    population_size: parseInt(gaParams.population_size),
                    generations:     parseInt(gaParams.generations),
                    mutation_rate:   parseFloat(gaParams.mutation_rate) / 100,
                    crossover_rate:  parseFloat(gaParams.crossover_rate) / 100,
                    early_stop:      parseInt(gaParams.early_stop),
                },
                rows: inputRows.map((r) => ({
                    yarn_type:     r.yarn_type.trim(),
                    dtex:          parseInt(r.dtex),
                    tpm:           parseInt(r.tpm),
                    initial_speed: parseFloat(r.initial_speed),
                    target_tonnes: parseFloat(r.target_tonnes),
                })),
            };
            const res = await axios.post<OptimizationResult[]>('/speed-optimization/run', payload, {
                headers: { 'X-CSRF-TOKEN': csrf },
            });
            setResults(res.data);
        } catch (err: unknown) {
            setError(
                axios.isAxiosError(err) && err.response?.data?.message
                    ? err.response.data.message
                    : 'Optimisation failed. Check inputs and try again.',
            );
        } finally {
            setLoading(false);
        }
    };

    const canRun = inputRows.every(
        (r) => r.yarn_type.trim() && r.dtex && r.tpm && r.initial_speed && r.target_tonnes,
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Speed Optimisation" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-xl font-semibold">Speed Optimisation (Genetic Algorithm)</h1>
                    <p className="text-sm text-muted-foreground">
                        Enter materials and monthly production targets. The GA finds the speed that minimises total energy
                        consumption (kWh) using historical energy-per-hour data from the database.
                    </p>
                </div>

                {/* GA parameters + run button */}
                <div className="flex items-stretch gap-4 rounded-lg border p-4">
                    <div className="flex-1 space-y-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Algorithm Parameters</p>
                        <TooltipProvider>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
                            <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                    <Label className="text-xs text-muted-foreground">Population size</Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-56 text-xs">
                                            Number of candidate speeds evaluated per generation. Larger populations explore the speed range more thoroughly but take longer. 30–100 is typical; go higher only when the energy curve has many local optima.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <Input value={gaParams.population_size} onChange={(e) => updateGa('population_size', e.target.value)}
                                    className="h-8 w-full" type="number" min={10} max={500} />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                    <Label className="text-xs text-muted-foreground">Generations</Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-56 text-xs">
                                            Maximum number of evolution cycles. Each generation selects, crosses, and mutates the population to improve the best speed found. More generations refine the result but increase run time. Early-stop usually kicks in well before this limit.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <Input value={gaParams.generations} onChange={(e) => updateGa('generations', e.target.value)}
                                    className="h-8 w-full" type="number" min={10} max={1000} />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                    <Label className="text-xs text-muted-foreground">Mutation rate (%)</Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-56 text-xs">
                                            Probability that a candidate speed receives a random Gaussian nudge (σ = 5% of speed range) after crossover. Higher values increase exploration and help escape local minima, but too high makes convergence noisy. 5–15% works well in practice.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <Input value={gaParams.mutation_rate} onChange={(e) => updateGa('mutation_rate', e.target.value)}
                                    className="h-8 w-full" type="number" min={1} max={50} step={0.5} />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                    <Label className="text-xs text-muted-foreground">Crossover rate (%)</Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-56 text-xs">
                                            Probability that two selected parents exchange genetic material (arithmetic blend) to produce a child. Lower values mean children are mostly copies of one parent. 60–80% balances exploitation of good speeds with exploration of new ones.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <Input value={gaParams.crossover_rate} onChange={(e) => updateGa('crossover_rate', e.target.value)}
                                    className="h-8 w-full" type="number" min={10} max={99} step={1} />
                            </div>
                            <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                    <Label className="text-xs text-muted-foreground">Early stop (gen)</Label>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-56 text-xs">
                                            Stops the GA early if the best energy value has not improved by more than 0.1% for this many consecutive generations. Prevents wasted cycles once the solution has converged. Lower values finish faster; higher values allow more time to escape flat regions.
                                        </TooltipContent>
                                    </Tooltip>
                                </div>
                                <Input value={gaParams.early_stop} onChange={(e) => updateGa('early_stop', e.target.value)}
                                    className="h-8 w-full" type="number" min={5} max={200} />
                            </div>
                        </div>
                        </TooltipProvider>
                    </div>

                    <div className="flex shrink-0 flex-col items-end justify-between gap-2 border-l pl-4">
                        <Button onClick={run} disabled={!canRun || loading} className="w-full">
                            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            Execute
                        </Button>
                        <Button variant="ghost" size="sm" className="w-full text-xs"
                            onClick={() => setGaParams(DEFAULT_GA)}>
                            Reset defaults
                        </Button>
                        {results && (
                            <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => setResults(null)}>
                                Clear results
                            </Button>
                        )}
                    </div>
                </div>

                {/* Material rows */}
                <div className="space-y-3">
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-8" />
                                    <TableHead>Yarn Type</TableHead>
                                    <TableHead className="text-right">dtex</TableHead>
                                    <TableHead className="text-right">TPM</TableHead>
                                    <TableHead className="text-right">Initial Speed (RPM)</TableHead>
                                    <TableHead className="text-right">Target (t/month)</TableHead>
                                    <TableHead className="w-8" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {inputRows.map((row, i) => {
                                    const k = matKey(row.yarn_type, row.dtex, row.tpm);
                                    const avail = row.yarn_type.trim() && row.dtex && row.tpm
                                        ? (dataAvailability[k] ?? { status: 'idle', buckets: [] })
                                        : null;
                                    return (
                                    <TableRow key={i}>
                                        <TableCell className="pr-0">
                                            <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <span className="flex h-full items-center justify-center">
                                                        {!avail || avail.status === 'idle'
                                                            ? <HelpCircle className="h-4 w-4 text-muted-foreground/30" />
                                                            : avail.status === 'checking'
                                                            ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50" />
                                                            : avail.status === 'ok'
                                                            ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                            : <AlertCircle className="h-4 w-4 text-amber-500" />
                                                        }
                                                    </span>
                                                </TooltipTrigger>
                                                <TooltipContent side="right" className="max-w-52 text-xs">
                                                    {!avail || avail.status === 'idle'
                                                        ? 'Fill in yarn type, dtex, and TPM to check data availability.'
                                                        : avail.status === 'checking'
                                                        ? 'Checking database…'
                                                        : avail.status === 'ok'
                                                        ? `Energy data found at speed buckets: ${avail.buckets.map(b => b.toLocaleString()).join(', ')} RPM. GA will interpolate between these.`
                                                        : 'No energy records found for this material. Import an energy file that includes shifts running this material first.'
                                                    }
                                                </TooltipContent>
                                            </Tooltip>
                                            </TooltipProvider>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={row.yarn_type}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    updateRow(i, 'yarn_type', v);
                                                    if (row.dtex && row.tpm) setDataAvail((p) => { const n = {...p}; delete n[matKey(v, row.dtex, row.tpm)]; return n; });
                                                }}
                                                placeholder="e.g. NY"
                                                className="h-8 w-24 font-mono"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={row.dtex}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    updateRow(i, 'dtex', v);
                                                    if (row.yarn_type.trim() && row.tpm) setDataAvail((p) => { const n = {...p}; delete n[matKey(row.yarn_type, v, row.tpm)]; return n; });
                                                }}
                                                placeholder="1400"
                                                className="h-8 w-24 text-right"
                                                type="number"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={row.tpm}
                                                onChange={(e) => {
                                                    const v = e.target.value;
                                                    updateRow(i, 'tpm', v);
                                                    if (row.yarn_type.trim() && row.dtex) setDataAvail((p) => { const n = {...p}; delete n[matKey(row.yarn_type, row.dtex, v)]; return n; });
                                                }}
                                                placeholder="365"
                                                className="h-8 w-24 text-right"
                                                type="number"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={row.initial_speed}
                                                onChange={(e) => updateRow(i, 'initial_speed', e.target.value)}
                                                placeholder="1500"
                                                className="h-8 w-28 text-right"
                                                type="number"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                value={row.target_tonnes}
                                                onChange={(e) => updateRow(i, 'target_tonnes', e.target.value)}
                                                placeholder="10.0"
                                                className="h-8 w-28 text-right"
                                                type="number"
                                                step="0.1"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="ghost" size="icon"
                                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                onClick={() => removeRow(i)}
                                                disabled={inputRows.length === 1}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    <Button variant="outline" size="sm" onClick={addRow} disabled={inputRows.length >= 20}>
                        <Plus className="mr-1 h-4 w-4" />
                        Add material
                    </Button>
                </div>

                {error && (
                    <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {error}
                    </div>
                )}

                {/* Results table */}
                {results && (
                    <div className="space-y-3">
                        <h2 className="text-sm font-semibold">Optimisation Results</h2>
                        <p className="text-xs text-muted-foreground">
                            Production model: two-ply cable · kg/h = (speed × 120 × dtex × 1e-7) / TPM
                        </p>
                        <div className="overflow-x-auto rounded-lg border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Material</TableHead>
                                        <TableHead className="text-right">Initial Speed</TableHead>
                                        <TableHead className="text-right">Optimal Speed</TableHead>
                                        <TableHead className="text-right">Initial kWh</TableHead>
                                        <TableHead className="text-right">Optimal kWh</TableHead>
                                        <TableHead className="text-right">Savings (kWh)</TableHead>
                                        <TableHead className="text-right">Savings (%)</TableHead>
                                        <TableHead className="text-right">Machine-h needed</TableHead>
                                        <TableHead className="text-right">Converged (gen)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {results.map((r, i) => {
                                        if (r.error) {
                                            return (
                                                <TableRow key={i}>
                                                    <TableCell className="font-mono">
                                                        {r.yarn_type} {r.dtex} dtex {r.tpm} TPM
                                                    </TableCell>
                                                    <TableCell colSpan={8} className="text-destructive text-sm">
                                                        <div className="flex items-center gap-1">
                                                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                                            {r.error}
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        }
                                        const isGood = (r.savings_pct ?? 0) > 10;
                                        const speedChanged = Math.abs(r.optimal_speed - r.initial_speed) > 10;
                                        const rowClass = isGood ? 'bg-green-500/5' : '';
                                        return (
                                            <TableRow key={i} className={rowClass}>
                                                <TableCell className="font-mono text-sm">
                                                    {r.yarn_type} {r.dtex} dtex {r.tpm} TPM
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {fmt(r.initial_speed, 0)} RPM
                                                </TableCell>
                                                <TableCell className={`text-right tabular-nums font-medium ${speedChanged ? 'text-blue-600 dark:text-blue-400' : ''}`}>
                                                    {fmt(r.optimal_speed, 0)} RPM
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums text-muted-foreground">
                                                    {r.initial_energy_kwh != null ? fmt(r.initial_energy_kwh) : '—'}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {fmt(r.optimal_energy_kwh)}
                                                </TableCell>
                                                <TableCell className={`text-right tabular-nums ${isGood ? 'text-green-700 dark:text-green-400 font-medium' : ''}`}>
                                                    {r.savings_kwh != null ? fmt(r.savings_kwh) : '—'}
                                                </TableCell>
                                                <TableCell className={`text-right tabular-nums ${isGood ? 'text-green-700 dark:text-green-400 font-semibold' : ''}`}>
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {r.savings_pct != null ? `${r.savings_pct}%` : '—'}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums">
                                                    {r.machine_hours_needed != null ? fmt(r.machine_hours_needed, 1) : '—'}
                                                </TableCell>
                                                <TableCell className="text-right tabular-nums text-muted-foreground text-xs">
                                                    {r.convergence_gen}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Green rows = &gt;10% energy savings · Amber rows = ML-estimated (no real data for this material) ·
                            Blue speed = different from initial · "Est." = result based on cross-material regression
                        </p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
