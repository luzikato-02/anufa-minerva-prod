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
import { AlertCircle, BrainCircuit, CheckCircle2, Info, Loader2, Star, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Twisting Energy & Runtime', href: '#' },
    { title: 'ML Energy Models', href: '/ml-energy-models-display' },
];

interface MlModel {
    id: number;
    name: string;
    model_type: string;
    hyperparams: Record<string, string> | null;
    r2_score: number | null;
    cv_r2_score: number | null;
    cv_r2_std: number | null;
    test_r2: number | null;
    test_rmse: number | null;
    test_mae: number | null;
    rmse: number | null;
    mae: number | null;
    overfit_gap: number | null;
    auto_tuned: boolean;
    training_samples: number | null;
    is_active: boolean;
    created_at: string;
    trained_by?: { name: string } | null;
}

// Above this gap between Train R² and CV R², the UI flags the model as likely overfit.
const OVERFIT_GAP_THRESHOLD = 0.15;

const MODEL_TYPE_LABELS: Record<string, string> = {
    ridge: 'Ridge Regression',
    rf:    'Random Forest',
    gbm:   'Gradient Boosting',
    svr:   'SVR (RBF kernel)',
    mlp:   'Neural Network',
};

// Per-model hyperparameter definitions
type ParamDef = {
    key: string;
    label: string;
    type: 'number' | 'text';
    default: string;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    tooltip: string;
};

const MODEL_PARAMS: Record<string, ParamDef[]> = {
    ridge: [
        {
            key: 'alpha', label: 'Alpha', type: 'number', default: '1.0',
            min: 0.0001, max: 100000, step: 0.1,
            tooltip: 'Regularisation strength. Higher values penalise model complexity more — reducing overfitting but increasing bias. Try 0.01 for minimal regularisation, 100 for very strong.',
        },
    ],
    rf: [
        {
            key: 'n_estimators', label: 'Trees', type: 'number', default: '100',
            min: 10, max: 1000,
            tooltip: 'Number of decision trees in the forest. More trees → better accuracy and stability, but slower training. 50–200 is typical.',
        },
        {
            key: 'max_depth', label: 'Max depth', type: 'number', default: '', placeholder: 'unlimited',
            min: 1, max: 50,
            tooltip: 'Maximum depth per tree. Leave blank for unlimited depth (may overfit on small datasets). 5–15 reduces overfitting.',
        },
        {
            key: 'min_samples_split', label: 'Min split', type: 'number', default: '2',
            min: 2, max: 50,
            tooltip: 'Minimum samples needed to split a tree node. Higher values create simpler trees and reduce overfitting. 2–10 is a typical range.',
        },
    ],
    gbm: [
        {
            key: 'n_estimators', label: 'Stages', type: 'number', default: '100',
            min: 10, max: 1000,
            tooltip: 'Number of boosting stages (sequential trees). More stages fit the training data more closely — pair with a small learning rate to avoid overfitting.',
        },
        {
            key: 'learning_rate', label: 'Learning rate', type: 'number', default: '0.1',
            min: 0.0001, max: 1.0, step: 0.01,
            tooltip: 'Shrinks each tree\'s contribution. Lower values (0.01–0.05) need more stages but generalise better. A gap between Train R² and CV R² means this is too high.',
        },
        {
            key: 'max_depth', label: 'Max depth', type: 'number', default: '3',
            min: 1, max: 10,
            tooltip: 'Depth of each boosting tree. 3–5 is typical. Deeper trees capture more interactions but overfit quickly.',
        },
    ],
    svr: [
        {
            key: 'svr_c', label: 'C', type: 'number', default: '1.0',
            min: 0.001, max: 100000, step: 0.1,
            tooltip: 'Regularisation parameter. Smaller C = wider margin, smoother model. Larger C = fits training points more tightly. Start at 1, try 0.1–100.',
        },
        {
            key: 'epsilon', label: 'Epsilon', type: 'number', default: '0.1',
            min: 0.0001, max: 10, step: 0.01,
            tooltip: 'Width of the epsilon-insensitive tube. Points within this distance of the regression are not penalised. Larger = smoother, more robust to noise.',
        },
        {
            key: 'gamma', label: 'Gamma', type: 'text', default: 'scale', placeholder: 'scale',
            tooltip: 'RBF kernel coefficient. "scale" = 1/(n_features × var(X)), "auto" = 1/n_features. Enter a float (e.g. 0.01) for an explicit value — smaller means wider, smoother boundaries.',
        },
    ],
    mlp: [
        {
            key: 'hidden_layers', label: 'Layer sizes', type: 'text', default: '64,32', placeholder: '64,32',
            tooltip: 'Comma-separated neuron counts per hidden layer. "64,32" = two layers. Add more layers (e.g. "128,64,32") for more capacity, but risk overfitting on small datasets.',
        },
        {
            key: 'lr_init', label: 'Learning rate', type: 'number', default: '0.001',
            min: 0.00001, max: 1.0, step: 0.0001,
            tooltip: 'Initial learning rate for the Adam optimiser. 0.001 is a safe default. Lower = slower but more stable. Higher = faster but may overshoot the minimum.',
        },
        {
            key: 'max_iter', label: 'Max iterations', type: 'number', default: '500',
            min: 50, max: 5000,
            tooltip: 'Maximum training epochs. Increase if Train R² is still rising at termination. More iterations = longer training time; the network stops early if already converged.',
        },
    ],
};

const defaultHyperparams = (): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const params of Object.values(MODEL_PARAMS)) {
        for (const p of params) out[p.key] = p.default;
    }
    return out;
};

const fmt = (n: number | null | undefined, decimals = 4) =>
    n != null ? n.toFixed(decimals) : '—';

const fmtDate = (s: string) =>
    new Date(s).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });

const hypLabel = (hp: Record<string, string> | null, modelType: string): string => {
    if (!hp) return '';
    const params = MODEL_PARAMS[modelType] ?? [];
    return params
        .filter((p) => hp[p.key] !== undefined && hp[p.key] !== '' && hp[p.key] !== p.default)
        .map((p) => `${p.label}=${hp[p.key]}`)
        .join(', ');
};

export default function MlEnergyModels() {
    const [models, setModels]         = useState<MlModel[]>([]);
    const [loading, setLoading]       = useState(true);
    const [training, setTraining]     = useState(false);
    const [trainError, setTrainError] = useState<string | null>(null);
    const [name, setName]             = useState('');
    const [modelType, setModelType]   = useState('ridge');
    const [autoTune, setAutoTune]     = useState(false);
    const [hyperparams, setHyperparams] = useState<Record<string, string>>(defaultHyperparams);
    const [tab, setTab]               = useState<'models' | 'benchmark'>('models');
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [trainLog, setTrainLog]     = useState<string[]>([]);

    const log = (line: string) => {
        console.log('[ml-train]', line);
        setTrainLog((prev) => [...prev, `${new Date().toLocaleTimeString()}  ${line}`]);
    };

    const load = async () => {
        setLoading(true);
        try {
            const res = await axios.get<MlModel[]>('/ml-energy-models');
            setModels(res.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const setHp = (key: string, value: string) =>
        setHyperparams((prev) => ({ ...prev, [key]: value }));

    const resetHp = () => setHyperparams(defaultHyperparams());

    const train = async () => {
        if (!name.trim()) { setTrainError('Model name is required.'); return; }
        setTrainError(null);
        setTraining(true);
        setTrainLog([]);
        try {
            log(`Training "${name.trim()}" (${MODEL_TYPE_LABELS[modelType] ?? modelType})${autoTune ? ' — auto-tuning hyperparameters' : ''}…`);
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            // Only send params relevant to the selected model type (ignored server-side when auto-tuning)
            const relevantKeys = MODEL_PARAMS[modelType]?.map((p) => p.key) ?? [];
            const filteredHp: Record<string, string> = {};
            for (const k of relevantKeys) {
                if (hyperparams[k] !== undefined && hyperparams[k] !== '') filteredHp[k] = hyperparams[k];
            }
            if (!autoTune) log(`Params: ${JSON.stringify(filteredHp)}`);

            // Kicks off training in the background; poll for live progress below.
            const start = await axios.post('/ml-energy-models/train', {
                name: name.trim(),
                model_type: modelType,
                auto_tune: autoTune,
                hyperparams: filteredHp,
            }, { headers: { 'X-CSRF-TOKEN': csrf } });
            const id = start.data.id;

            let seen = 0;
            // eslint-disable-next-line no-constant-condition
            while (true) {
                await new Promise((r) => setTimeout(r, 1000));
                const res = await axios.get(`/ml-energy-models/${id}/progress`);
                const lines: string[] = res.data.lines ?? [];
                for (const line of lines.slice(seen)) log(line);
                seen = lines.length;

                if (res.data.done) {
                    if (res.data.error) {
                        log(`Error — ${res.data.error}`);
                        setTrainError(res.data.error);
                    } else {
                        log('Training complete.');
                        setName('');
                        await load();
                    }
                    break;
                }
            }
        } catch (err: unknown) {
            const message = axios.isAxiosError(err) && err.response?.data?.message
                ? err.response.data.message
                : 'Training failed. Check the server logs.';
            log(`Error — ${message}`);
            setTrainError(message);
        } finally {
            setTraining(false);
        }
    };

    const setDefault = async (id: number) => {
        const csrf = (await axios.get('/csrf-token')).data.csrfToken;
        await axios.patch(`/ml-energy-models/${id}/set-default`, {}, { headers: { 'X-CSRF-TOKEN': csrf } });
        setModels((prev) => prev.map((m) => ({ ...m, is_active: m.id === id })));
    };

    const del = async (id: number) => {
        setDeletingId(id);
        try {
            const csrf = (await axios.get('/csrf-token')).data.csrfToken;
            await axios.delete(`/ml-energy-models/${id}`, { headers: { 'X-CSRF-TOKEN': csrf } });
            setModels((prev) => prev.filter((m) => m.id !== id));
        } finally {
            setDeletingId(null);
        }
    };

    const benchmarkModels = [...models].sort((a, b) => (b.cv_r2_score ?? -1) - (a.cv_r2_score ?? -1));
    const maxCvR2 = Math.max(...benchmarkModels.map((m) => m.cv_r2_score ?? 0), 0.01);

    const currentParams = MODEL_PARAMS[modelType] ?? [];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="ML Energy Models" />
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div>
                    <h1 className="text-xl font-semibold">ML Energy Models</h1>
                    <p className="text-sm text-muted-foreground">
                        Train machine-learning models on historical energy data. When the GA optimiser encounters a material
                        without real energy records, it uses the active model to estimate energy consumption.
                    </p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 border-b">
                    {(['models', 'benchmark'] as const).map((t) => (
                        <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`px-4 py-2 text-sm font-medium capitalize transition-colors
                                ${tab === t
                                    ? 'border-b-2 border-primary text-primary'
                                    : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {tab === 'models' && (
                    <div className="space-y-6">
                        {/* Train form */}
                        <div className="rounded-lg border p-4 space-y-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Train New Model</p>

                            {/* Name + type + train button */}
                            <div className="flex flex-wrap items-end gap-3">
                                <div className="space-y-1">
                                    <Label className="text-xs">Model name</Label>
                                    <Input
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        placeholder="e.g. Ridge v1 — July 2026"
                                        className="h-8 w-64"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Algorithm</Label>
                                    <select
                                        value={modelType}
                                        onChange={(e) => setModelType(e.target.value)}
                                        className="h-8 rounded-md border border-input bg-background px-3 text-sm"
                                    >
                                        {Object.entries(MODEL_TYPE_LABELS).map(([k, v]) => (
                                            <option key={k} value={k}>{v}</option>
                                        ))}
                                    </select>
                                </div>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button onClick={train} disabled={training} className="h-8">
                                                {training
                                                    ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Training…</>
                                                    : <><BrainCircuit className="mr-2 h-3.5 w-3.5" />Train</>
                                                }
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-56 text-xs">
                                            Fits the selected algorithm on all historical per-shift energy records (dtex, tpm, yarn type,
                                            machine type, continuous speed). Takes a few seconds, longer with auto-tune on.
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                                <button
                                    onClick={resetHp}
                                    className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Reset params
                                </button>
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <label className="flex h-8 items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={autoTune}
                                                    onChange={(e) => setAutoTune(e.target.checked)}
                                                    className="h-3.5 w-3.5"
                                                />
                                                Auto-tune hyperparameters
                                            </label>
                                        </TooltipTrigger>
                                        <TooltipContent side="right" className="max-w-64 text-xs">
                                            Runs a randomised hyperparameter search (cross-validated) instead of
                                            using the values below, and uses whatever it finds. Ignores the manual
                                            parameter fields.
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            </div>

                            {/* Hyperparameter controls — change with model type, hidden while auto-tuning */}
                            {currentParams.length > 0 && !autoTune && (
                                <div className="border-t pt-3 space-y-2">
                                    <p className="text-xs text-muted-foreground font-medium">
                                        {MODEL_TYPE_LABELS[modelType]} parameters
                                    </p>
                                    <TooltipProvider>
                                        <div className="flex flex-wrap gap-x-6 gap-y-3">
                                            {currentParams.map((p) => (
                                                <div key={p.key} className="space-y-1 min-w-[110px]">
                                                    <div className="flex items-center gap-1">
                                                        <Label className="text-xs text-muted-foreground">{p.label}</Label>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Info className="h-3 w-3 text-muted-foreground/50 cursor-help shrink-0" />
                                                            </TooltipTrigger>
                                                            <TooltipContent side="top" className="max-w-64 text-xs">
                                                                {p.tooltip}
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </div>
                                                    <Input
                                                        value={hyperparams[p.key] ?? p.default}
                                                        onChange={(e) => setHp(p.key, e.target.value)}
                                                        type={p.type}
                                                        min={p.min}
                                                        max={p.max}
                                                        step={p.step}
                                                        placeholder={p.placeholder ?? p.default}
                                                        className="h-8 w-full"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </TooltipProvider>
                                </div>
                            )}

                            {trainError && (
                                <div className="flex items-center gap-2 text-sm text-destructive">
                                    <AlertCircle className="h-4 w-4 shrink-0" />
                                    {trainError}
                                </div>
                            )}

                            {trainLog.length > 0 && (
                                <pre className="max-h-40 overflow-y-auto rounded-md bg-muted/50 border p-2 text-xs font-mono whitespace-pre-wrap">
                                    {trainLog.join('\n')}
                                </pre>
                            )}
                        </div>

                        {/* Models table */}
                        {loading ? (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                            </div>
                        ) : models.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No models trained yet. Use the form above to train your first model.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead className="text-right">CV R²</TableHead>
                                            <TableHead className="text-right">Test R²</TableHead>
                                            <TableHead className="text-right">Train R²</TableHead>
                                            <TableHead className="text-right">RMSE</TableHead>
                                            <TableHead className="text-right">MAE</TableHead>
                                            <TableHead className="text-right">Samples</TableHead>
                                            <TableHead>Trained</TableHead>
                                            <TableHead className="text-center w-20">Default</TableHead>
                                            <TableHead className="w-10" />
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {models.map((m) => {
                                            const customLabel = hypLabel(m.hyperparams, m.model_type);
                                            const isOverfit = (m.overfit_gap ?? 0) > OVERFIT_GAP_THRESHOLD;
                                            return (
                                                <TableRow key={m.id} className={m.is_active ? 'bg-blue-500/5' : ''}>
                                                    <TableCell className="font-medium">{m.name}</TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        <TooltipProvider>
                                                            <div className="flex items-center gap-1.5">
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span className={customLabel ? 'underline decoration-dotted cursor-help' : ''}>
                                                                            {MODEL_TYPE_LABELS[m.model_type] ?? m.model_type}
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    {customLabel && (
                                                                        <TooltipContent side="right" className="text-xs">
                                                                            Custom params: {customLabel}
                                                                        </TooltipContent>
                                                                    )}
                                                                </Tooltip>
                                                                {m.auto_tuned && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary cursor-help">
                                                                                auto
                                                                            </span>
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="right" className="text-xs">
                                                                            Hyperparameters were selected by an automated search.
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                                {isOverfit && (
                                                                    <Tooltip>
                                                                        <TooltipTrigger asChild>
                                                                            <AlertCircle className="h-3.5 w-3.5 text-amber-500 cursor-help shrink-0" />
                                                                        </TooltipTrigger>
                                                                        <TooltipContent side="right" className="text-xs">
                                                                            Possible overfitting — Train R² is {fmt(m.overfit_gap, 2)} higher than CV R².
                                                                        </TooltipContent>
                                                                    </Tooltip>
                                                                )}
                                                            </div>
                                                        </TooltipProvider>
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums font-medium">
                                                        {fmt(m.cv_r2_score)}
                                                        {m.cv_r2_std != null && (
                                                            <span className="text-muted-foreground font-normal"> ±{fmt(m.cv_r2_std, 2)}</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                                        {fmt(m.test_r2)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                                        {fmt(m.r2_score)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                                        {fmt(m.rmse)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                                        {fmt(m.mae)}
                                                    </TableCell>
                                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                                        {m.training_samples?.toLocaleString() ?? '—'}
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {fmtDate(m.created_at)}
                                                        {m.trained_by && (
                                                            <span className="ml-1 text-xs opacity-60">by {m.trained_by.name}</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-center">
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <button
                                                                        onClick={() => setDefault(m.id)}
                                                                        className={`transition-colors ${m.is_active
                                                                            ? 'text-yellow-500'
                                                                            : 'text-muted-foreground/30 hover:text-yellow-400'}`}
                                                                    >
                                                                        <Star className={`h-4 w-4 ${m.is_active ? 'fill-yellow-500' : ''}`} />
                                                                    </button>
                                                                </TooltipTrigger>
                                                                <TooltipContent side="left" className="text-xs">
                                                                    {m.is_active ? 'Active default model' : 'Set as default fallback model'}
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            variant="ghost" size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                            onClick={() => del(m.id)}
                                                            disabled={deletingId === m.id}
                                                        >
                                                            {deletingId === m.id
                                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                : <Trash2 className="h-3.5 w-3.5" />
                                                            }
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                            CV R² = mean repeated cross-validation R² (± std dev), the primary generalisation estimate. Test R² is a
                            genuine held-out score (only computed with enough training data). Higher is better (max 1.0). RMSE / MAE in
                            kWh/machine-hour. Dotted underline on type = custom hyperparameters used, "auto" badge = hyperparameters were
                            auto-tuned, ⚠ = possible overfitting. Star (★) = default fallback for the GA.
                        </p>
                    </div>
                )}

                {tab === 'benchmark' && (
                    <div className="space-y-6">
                        {benchmarkModels.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No models trained yet.</p>
                        ) : (
                            <>
                                {/* Bar chart */}
                                <div className="rounded-lg border p-4 space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                                        CV R² comparison (higher = better generalisation)
                                    </p>
                                    {benchmarkModels.map((m) => {
                                        const pct = Math.max(0, ((m.cv_r2_score ?? 0) / maxCvR2) * 100);
                                        return (
                                            <div key={m.id} className="flex items-center gap-3">
                                                <span className="w-44 truncate text-sm text-right">{m.name}</span>
                                                <div className="flex-1 h-5 rounded bg-muted overflow-hidden">
                                                    <div
                                                        className={`h-full rounded transition-all ${m.is_active ? 'bg-blue-500' : 'bg-primary/70'}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="w-14 text-right tabular-nums text-sm font-medium">
                                                    {fmt(m.cv_r2_score)}
                                                </span>
                                                {m.is_active && (
                                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium w-14">★ active</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Full metrics table */}
                                <div className="overflow-x-auto rounded-lg border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Rank</TableHead>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Type</TableHead>
                                                <TableHead className="text-right">CV R² ↓</TableHead>
                                                <TableHead className="text-right">Test R²</TableHead>
                                                <TableHead className="text-right">Train R²</TableHead>
                                                <TableHead className="text-right">RMSE</TableHead>
                                                <TableHead className="text-right">MAE</TableHead>
                                                <TableHead className="text-right">Samples</TableHead>
                                                <TableHead className="text-center">Default</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {benchmarkModels.map((m, i) => {
                                                const isOverfit = (m.overfit_gap ?? 0) > OVERFIT_GAP_THRESHOLD;
                                                return (
                                                    <TableRow key={m.id} className={m.is_active ? 'bg-blue-500/5' : ''}>
                                                        <TableCell className="tabular-nums text-muted-foreground text-sm">#{i + 1}</TableCell>
                                                        <TableCell className="font-medium">{m.name}</TableCell>
                                                        <TableCell className="text-sm text-muted-foreground">
                                                            <TooltipProvider>
                                                                <div className="flex items-center gap-1.5">
                                                                    <span>{MODEL_TYPE_LABELS[m.model_type] ?? m.model_type}</span>
                                                                    {m.auto_tuned && (
                                                                        <span className="rounded bg-primary/10 px-1 py-0.5 text-[10px] font-medium text-primary">
                                                                            auto
                                                                        </span>
                                                                    )}
                                                                    {isOverfit && (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <AlertCircle className="h-3.5 w-3.5 text-amber-500 cursor-help shrink-0" />
                                                                            </TooltipTrigger>
                                                                            <TooltipContent side="right" className="text-xs">
                                                                                Possible overfitting — Train R² is {fmt(m.overfit_gap, 2)} higher than CV R².
                                                                            </TooltipContent>
                                                                        </Tooltip>
                                                                    )}
                                                                </div>
                                                            </TooltipProvider>
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums font-semibold">
                                                            {fmt(m.cv_r2_score)}
                                                            {m.cv_r2_std != null && (
                                                                <span className="text-muted-foreground font-normal"> ±{fmt(m.cv_r2_std, 2)}</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-muted-foreground">
                                                            {fmt(m.test_r2)}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-muted-foreground">
                                                            {fmt(m.r2_score)}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-muted-foreground">
                                                            {fmt(m.rmse)}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-muted-foreground">
                                                            {fmt(m.mae)}
                                                        </TableCell>
                                                        <TableCell className="text-right tabular-nums text-muted-foreground">
                                                            {m.training_samples?.toLocaleString() ?? '—'}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {m.is_active && <CheckCircle2 className="mx-auto h-4 w-4 text-blue-500" />}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                        <p className="text-xs text-muted-foreground">
                            ↓ sorted by mean CV R² descending · Test R² is a genuine held-out score (blank when there wasn't enough data
                            for a held-out split) · ⚠ flags a large gap between Train R² and CV R² (possible overfitting)
                        </p>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
