import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import axios from 'axios';
import { AlertTriangle, CheckCircle, ChevronDown, ChevronRight, ExternalLink, FileText, Loader2, Plus, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const SCAN_LOG = [
    { at: 200,   text: 'Uploading document to OCR engine…' },
    { at: 1200,  text: 'Connected · running mistral-ocr-latest on document…' },
    { at: 3500,  text: 'Scanning pages for text content…' },
    { at: 6500,  text: 'OCR complete · extracting markdown from pages…' },
    { at: 8000,  text: 'Prompting mistral-small-latest for structured extraction…' },
    { at: 10000, text: 'Parsing form: CATATAN CABLE FINISH EARLIER' },
    { at: 12000, text: 'Applying carry-forward rules on empty cells…' },
    { at: 14000, text: 'Assembling JSON output…' },
];

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Finish Earlier', href: '/finish-earlier-display' },
    { title: 'Scan Form', href: '/finish-earlier-scan' },
];

interface Entry {
    creel_side: string;
    row_number: string;
    column_number: string;
    meters_finish: number | string;
}

interface Metadata {
    machine_number: string;
    style: string;
    production_order: string;
    shift_group: string;
}

interface Extracted {
    metadata: Metadata;
    entries: Entry[];
    _ocr_text?: string;
}

type State = 'idle' | 'scanning' | 'review' | 'submitting' | 'done' | 'error';

interface ConflictInfo {
    id: number;
    entry_count: number;
    created_at: string;
}

const emptyMeta = (): Metadata => ({
    machine_number: '',
    style: '',
    production_order: '',
    shift_group: '',
});

const emptyEntry = (): Entry => ({
    creel_side: '',
    row_number: '',
    column_number: '',
    meters_finish: '',
});

export default function FinishEarlierScan() {
    const [state, setState] = useState<State>('idle');
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const [error, setError] = useState('');
    const [metadata, setMetadata] = useState<Metadata>(emptyMeta());
    const [entries, setEntries] = useState<Entry[]>([]);
    const [rawJson, setRawJson] = useState<string>('');
    const [ocrText, setOcrText] = useState<string>('');
    const [rawTab, setRawTab] = useState<'json' | 'ocr'>('json');
    const [showRaw, setShowRaw] = useState(false);
    const [savedId, setSavedId] = useState<number | null>(null);
    const [conflict, setConflict] = useState<ConflictInfo | null>(null);
    const [logLines, setLogLines] = useState<string[]>([]);
    const [typingText, setTypingText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (state !== 'scanning') {
            setLogLines([]);
            setTypingText('');
            return;
        }
        const ids: ReturnType<typeof setTimeout>[] = [];
        SCAN_LOG.forEach(({ at, text }) => {
            const startId = setTimeout(() => {
                let idx = 0;
                const intervalId = setInterval(() => {
                    idx++;
                    setTypingText(text.slice(0, idx));
                    if (idx >= text.length) {
                        clearInterval(intervalId);
                        setLogLines((prev) => [...prev, text]);
                        setTypingText('');
                    }
                }, 18);
                ids.push(intervalId as unknown as ReturnType<typeof setTimeout>);
            }, at);
            ids.push(startId);
        });
        return () => ids.forEach((id) => { clearTimeout(id); clearInterval(id as unknown as ReturnType<typeof setInterval>); });
    }, [state]);

    const handleFile = useCallback((f: File) => {
        if (!f.name.match(/\.(pdf|png|jpe?g|webp)$/i)) {
            setError('Unsupported file type. Upload a PDF or image.');
            return;
        }
        setFile(f);
        setError('');
    }, []);

    const scan = async () => {
        if (!file) return;
        setState('scanning');
        setError('');
        try {
            const csrfRes = await axios.get('/csrf-token');
            const formData = new FormData();
            formData.append('file', file);
            const res = await axios.post<Extracted>('/finish-earlier-scan/extract', formData, {
                headers: {
                    'X-CSRF-TOKEN': csrfRes.data.csrfToken,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setOcrText(res.data._ocr_text ?? '');
            setRawJson(JSON.stringify(res.data, null, 2));
            setMetadata(res.data.metadata ?? emptyMeta());
            setEntries(res.data.entries ?? []);
            setState('review');
        } catch (e: any) {
            setError(e.response?.data?.message ?? e.message ?? 'Extraction failed.');
            setState('error');
        }
    };

    const updateMeta = (key: keyof Metadata, value: string) =>
        setMetadata((m) => ({ ...m, [key]: value }));

    const updateEntry = (i: number, key: keyof Entry, value: string) =>
        setEntries((rows) => rows.map((r, idx) => idx === i ? { ...r, [key]: value } : r));

    const deleteEntry = (i: number) =>
        setEntries((rows) => rows.filter((_, idx) => idx !== i));

    const addEntry = () =>
        setEntries((rows) => [...rows, emptyEntry()]);

    const submit = async (resolution?: 'replace' | 'merge') => {
        setState('submitting');
        setError('');
        setConflict(null);
        try {
            const csrfRes = await axios.get('/csrf-token');
            const payload: Record<string, unknown> = {
                metadata,
                entries: entries.map((e) => ({ ...e, meters_finish: Number(e.meters_finish) })),
            };
            if (resolution) payload.conflict_resolution = resolution;
            const res = await axios.post('/finish-earlier/submit-scan', payload, {
                headers: { 'X-CSRF-TOKEN': csrfRes.data.csrfToken },
            });
            setSavedId(res.data.id);
            setState('done');
        } catch (e: any) {
            if (e.response?.status === 409 && e.response.data?.conflict) {
                setConflict(e.response.data.existing);
                setState('review');
            } else {
                const msg = e.response?.data?.errors
                    ? Object.values(e.response.data.errors).flat().join(' ')
                    : (e.response?.data?.message ?? e.message ?? 'Submission failed.');
                setError(msg);
                setState('review');
            }
        }
    };

    const reset = () => {
        setState('idle');
        setFile(null);
        setMetadata(emptyMeta());
        setEntries([]);
        setRawJson('');
        setOcrText('');
        setRawTab('json');
        setShowRaw(false);
        setError('');
        setSavedId(null);
        setConflict(null);
        setLogLines([]);
        setTypingText('');
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Scan Finish Earlier Form" />
            <div className="flex flex-col gap-6 p-6">
                <div>
                    <h1 className="text-2xl font-semibold">Scan Finish Earlier Form</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Upload a scanned "Catatan Cable Finish Earlier" form to extract and insert its data.
                    </p>
                </div>

                {/* ── UPLOAD ─────────────────────────────────── */}
                {(state === 'idle' || state === 'error') && (
                    <div className="flex flex-col gap-4">
                        <div
                            role="button"
                            tabIndex={0}
                            className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-12 transition-colors ${
                                dragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'
                            }`}
                            onClick={() => inputRef.current?.click()}
                            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragging(false);
                                const f = e.dataTransfer.files[0];
                                if (f) handleFile(f);
                            }}
                        >
                            <Upload className="text-muted-foreground size-10" />
                            {file ? (
                                <div className="flex items-center gap-2 text-sm font-medium">
                                    <FileText className="size-4" /> {file.name}
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm font-medium">Drop the scanned form here or click to browse</p>
                                    <p className="text-muted-foreground text-xs">PDF, PNG, JPG, JPEG, WEBP — up to 20 MB</p>
                                </>
                            )}
                        </div>
                        <input
                            ref={inputRef}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                        />
                        {error && <p className="text-destructive text-sm">{error}</p>}
                        <Button onClick={scan} disabled={!file} className="self-start">
                            Extract Data
                        </Button>
                    </div>
                )}

                {/* ── SCANNING ───────────────────────────────── */}
                {state === 'scanning' && (
                    <div className="overflow-hidden rounded-lg border">
                        <div className="flex items-center gap-2.5 border-b px-4 py-3">
                            <span className="size-2 animate-pulse rounded-full bg-primary" />
                            <span className="text-sm font-medium">Analyzing document</span>
                            <span className="text-muted-foreground ml-auto text-xs">{file?.name}</span>
                        </div>
                        <div className="flex min-h-52 flex-col gap-2 p-5 font-mono text-sm">
                            {logLines.map((line, i) => (
                                <div key={i} className="flex gap-2.5 text-foreground">
                                    <span className="text-primary mt-0.5 select-none">›</span>
                                    <span>{line}</span>
                                </div>
                            ))}
                            {typingText && (
                                <div className="flex gap-2.5 text-foreground">
                                    <span className="text-primary mt-0.5 select-none">›</span>
                                    <span className="inline-flex items-baseline">
                                        {typingText}
                                        <span className="ml-[1px] inline-block h-[1em] w-[10px] animate-pulse bg-primary" />
                                    </span>
                                </div>
                            )}
                            {!typingText && logLines.length === SCAN_LOG.length && (
                                <div className="text-muted-foreground mt-1 flex items-center gap-2">
                                    <Loader2 className="size-3 animate-spin" />
                                    <span>Waiting for API response…</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── REVIEW ─────────────────────────────────── */}
                {(state === 'review' || state === 'submitting') && (
                    <div className="flex flex-col gap-6">
                        {/* Raw output toggle */}
                        <div className="rounded-lg border">
                            <button
                                type="button"
                                className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium"
                                onClick={() => setShowRaw((v) => !v)}
                            >
                                {showRaw ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                                Raw output
                                <span className="text-muted-foreground ml-auto font-normal">
                                    {entries.length} entries extracted
                                </span>
                            </button>
                            {showRaw && (
                                <div className="border-t">
                                    <div className="flex border-b text-xs font-medium">
                                        {(['json', 'ocr'] as const).map((tab) => (
                                            <button
                                                key={tab}
                                                type="button"
                                                onClick={() => setRawTab(tab)}
                                                className={`px-4 py-2 uppercase tracking-wide transition-colors ${
                                                    rawTab === tab
                                                        ? 'border-b-2 border-primary text-primary'
                                                        : 'text-muted-foreground hover:text-foreground'
                                                }`}
                                            >
                                                {tab === 'json' ? 'Extracted JSON' : 'OCR Text'}
                                            </button>
                                        ))}
                                    </div>
                                    <pre className="overflow-x-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                                        {rawTab === 'json' ? rawJson : ocrText}
                                    </pre>
                                </div>
                            )}
                        </div>

                        {/* Metadata */}
                        <div className="rounded-lg border p-5">
                            <h2 className="mb-4 font-semibold">Form Header</h2>
                            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                                {(
                                    [
                                        ['machine_number',   'Machine No.'],
                                        ['production_order', 'Production Order'],
                                        ['style',            'Style'],
                                        ['shift_group',      'Shift / Group'],
                                    ] as [keyof Metadata, string][]
                                ).map(([key, label]) => (
                                    <div key={key} className="flex flex-col gap-1.5">
                                        <Label htmlFor={key} className="text-xs">{label}</Label>
                                        <Input
                                            id={key}
                                            value={metadata[key]}
                                            onChange={(e) => updateMeta(key, e.target.value)}
                                            disabled={state === 'submitting'}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Entries table */}
                        <div className="rounded-lg border">
                            <div className="flex items-center justify-between border-b px-4 py-3">
                                <h2 className="font-semibold">
                                    Entries <span className="text-muted-foreground ml-1 text-sm font-normal">({entries.length})</span>
                                </h2>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={addEntry}
                                    disabled={state === 'submitting'}
                                >
                                    <Plus className="mr-1.5 size-4" /> Add row
                                </Button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-muted/50 border-b text-left text-xs uppercase tracking-wide">
                                            <th className="px-3 py-2">#</th>
                                            <th className="px-3 py-2">Sect</th>
                                            <th className="px-3 py-2">Row</th>
                                            <th className="px-3 py-2">Column</th>
                                            <th className="px-3 py-2">Finish Mtr</th>
                                            <th className="px-3 py-2"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {entries.map((entry, i) => (
                                            <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                                                <td className="text-muted-foreground px-3 py-1.5 tabular-nums">{i + 1}</td>
                                                {(
                                                    [
                                                        ['creel_side',    'text', 'e.g. AO'],
                                                        ['row_number',    'text', 'A–E'],
                                                        ['column_number', 'text', '1–73'],
                                                        ['meters_finish', 'number', '0'],
                                                    ] as [keyof Entry, string, string][]
                                                ).map(([key, type, placeholder]) => (
                                                    <td key={key} className="px-3 py-1.5">
                                                        <Input
                                                            type={type}
                                                            value={entry[key]}
                                                            placeholder={placeholder}
                                                            onChange={(e) => updateEntry(i, key, e.target.value)}
                                                            disabled={state === 'submitting'}
                                                            className="h-8 w-28 text-sm"
                                                        />
                                                    </td>
                                                ))}
                                                <td className="px-3 py-1.5">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-muted-foreground hover:text-destructive size-8"
                                                        onClick={() => deleteEntry(i)}
                                                        disabled={state === 'submitting'}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {entries.length === 0 && (
                                            <tr>
                                                <td colSpan={6} className="text-muted-foreground py-8 text-center text-sm">
                                                    No entries extracted — add rows manually.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {conflict && (
                            <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                                            PO {metadata.production_order} already has a record ({conflict.entry_count} entries,
                                            saved {new Date(conflict.created_at).toLocaleString()})
                                        </p>
                                        <div className="mt-3 flex gap-2">
                                            <Button size="sm" variant="destructive" onClick={() => submit('replace')} disabled={state === 'submitting'}>
                                                {state === 'submitting' ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : null}
                                                Replace existing
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => submit('merge')} disabled={state === 'submitting'}>
                                                {state === 'submitting' ? <Loader2 className="mr-1.5 size-3 animate-spin" /> : null}
                                                Merge (append entries)
                                            </Button>
                                            <Button size="sm" variant="ghost" onClick={() => setConflict(null)} disabled={state === 'submitting'}>
                                                Cancel
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && <p className="text-destructive text-sm">{error}</p>}

                        <div className="flex gap-3">
                            <Button
                                onClick={() => submit()}
                                disabled={state === 'submitting' || entries.length === 0}
                            >
                                {state === 'submitting' && <Loader2 className="mr-2 size-4 animate-spin" />}
                                {state === 'submitting' ? 'Saving…' : `Save ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} to database`}
                            </Button>
                            <Button variant="ghost" onClick={reset} disabled={state === 'submitting'}>
                                Start over
                            </Button>
                        </div>
                    </div>
                )}

                {/* ── DONE ───────────────────────────────────── */}
                {state === 'done' && (
                    <div className="flex flex-col items-center gap-4 py-16">
                        <CheckCircle className="size-12 text-green-500" />
                        <div className="text-center">
                            <p className="font-semibold">Record saved successfully</p>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {entries.length} entries for PO {metadata.production_order}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <Button asChild variant="outline">
                                <Link href="/finish-earlier-display">
                                    <ExternalLink className="mr-1.5 size-4" /> View in Finish Earlier
                                </Link>
                            </Button>
                            <Button variant="ghost" onClick={reset}>
                                Scan another form
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
