import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import { Code, Download, FileText, Loader2, RefreshCw, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Document Intelligence', href: '/document-intelligence' },
];

interface OcrPage {
    index: number;
    markdown: string;
}

interface OcrResult {
    pages: OcrPage[];
    model: string;
}

type State = 'idle' | 'processing' | 'done' | 'error';

const PROCESS_LOG = [
    { at: 200,   text: 'Uploading document to OCR engine…' },
    { at: 1200,  text: 'Connected · running mistral-ocr-latest…' },
    { at: 3500,  text: 'Scanning pages for text content…' },
    { at: 7000,  text: 'Extracting markdown from page content…' },
    { at: 10000, text: 'Processing visual elements and tables…' },
    { at: 13000, text: 'Assembling output…' },
];

function PageCard({ page }: { page: OcrPage }) {
    const [raw, setRaw] = useState(false);

    return (
        <div className="overflow-hidden rounded-lg border">
            <div className="bg-muted/50 flex items-center justify-between border-b px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide">
                    Page {page.index + 1}
                </span>
                <button
                    onClick={() => setRaw((v) => !v)}
                    className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors"
                >
                    <Code className="size-3.5" />
                    {raw ? 'Rendered' : 'Raw'}
                </button>
            </div>
            {raw ? (
                <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap">
                    {page.markdown}
                </pre>
            ) : (
                <div className="prose dark:prose-invert max-w-none p-6">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {page.markdown}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
}

export default function DocumentIntelligence() {
    const [state, setState] = useState<State>('idle');
    const [file, setFile] = useState<File | null>(null);
    const [result, setResult] = useState<OcrResult | null>(null);
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);
    const [logLines, setLogLines] = useState<string[]>([]);
    const [typingText, setTypingText] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (state !== 'processing') {
            setLogLines([]);
            setTypingText('');
            return;
        }
        const ids: ReturnType<typeof setTimeout>[] = [];
        PROCESS_LOG.forEach(({ at, text }) => {
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
            setError('Unsupported file type. Please upload a PDF or image (PNG, JPG, WEBP).');
            return;
        }
        setFile(f);
        setError('');
    }, []);

    const process = async () => {
        if (!file) return;
        setState('processing');
        setError('');
        try {
            const csrfRes = await axios.get('/csrf-token');
            const formData = new FormData();
            formData.append('file', file);
            const res = await axios.post('/document-intelligence/process', formData, {
                headers: {
                    'X-CSRF-TOKEN': csrfRes.data.csrfToken,
                    'Content-Type': 'multipart/form-data',
                },
            });
            setResult(res.data);
            setState('done');
        } catch (e: any) {
            const msg = e.response?.data?.error ?? e.response?.data?.message ?? e.message ?? 'Processing failed.';
            setError(msg);
            setState('error');
        }
    };

    const triggerDownload = (content: string, filename: string, type: string) => {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const baseName = file?.name.replace(/\.[^.]+$/, '') ?? 'document';

    const downloadMarkdown = () => {
        if (!result) return;
        triggerDownload(
            result.pages.map((p) => p.markdown).join('\n\n---\n\n'),
            `${baseName}.md`,
            'text/markdown',
        );
    };

    const downloadJson = () => {
        if (!result) return;
        triggerDownload(JSON.stringify(result, null, 2), `${baseName}.json`, 'application/json');
    };

    const downloadExcel = () => {
        if (!result) return;
        const wb = XLSX.utils.book_new();
        result.pages.forEach((page, i) => {
            const rows: string[][] = [];
            for (const line of page.markdown.split('\n')) {
                // Table row: | cell | cell |
                if (line.startsWith('|')) {
                    // Skip separator rows (|---|---|)
                    if (/^\|[\s\-|:]+\|$/.test(line)) continue;
                    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
                    rows.push(cells);
                } else {
                    rows.push([line]);
                }
            }
            const ws = XLSX.utils.aoa_to_sheet(rows);
            XLSX.utils.book_append_sheet(wb, ws, `Page ${i + 1}`);
        });
        XLSX.writeFile(wb, `${baseName}.xlsx`);
    };

    const reset = () => {
        setState('idle');
        setFile(null);
        setResult(null);
        setError('');
        setLogLines([]);
        setTypingText('');
        if (inputRef.current) inputRef.current.value = '';
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Document Intelligence" />
            <div className="flex flex-col gap-6 p-6">
                <div>
                    <h1 className="text-2xl font-semibold">Document Intelligence</h1>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Upload a PDF or image and extract its text with Mistral OCR.
                    </p>
                </div>

                {(state === 'idle' || state === 'error') && (
                    <div className="flex flex-col gap-4">
                        <div
                            role="button"
                            tabIndex={0}
                            className={`flex cursor-pointer flex-col items-center gap-3 rounded-lg border-2 border-dashed p-12 transition-colors ${
                                dragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/30 hover:border-primary/50'
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
                                    <FileText className="size-4" />
                                    {file.name}
                                </div>
                            ) : (
                                <>
                                    <p className="text-sm font-medium">Drop your file here or click to browse</p>
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

                        <Button onClick={process} disabled={!file} className="self-start">
                            Process Document
                        </Button>
                    </div>
                )}

                {state === 'processing' && (
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
                            {!typingText && logLines.length === PROCESS_LOG.length && (
                                <div className="text-muted-foreground mt-1 flex items-center gap-2">
                                    <Loader2 className="size-3 animate-spin" />
                                    <span>Waiting for API response…</span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {state === 'done' && result && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-muted flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3">
                            <span className="text-sm font-medium">
                                {result.pages.length} page{result.pages.length !== 1 ? 's' : ''} &middot; {result.model}
                            </span>
                            <div className="flex flex-wrap gap-2">
                                <Button variant="outline" size="sm" onClick={downloadMarkdown}>
                                    <Download className="mr-1.5 size-4" /> Markdown
                                </Button>
                                <Button variant="outline" size="sm" onClick={downloadJson}>
                                    <Download className="mr-1.5 size-4" /> JSON
                                </Button>
                                <Button variant="outline" size="sm" onClick={downloadExcel}>
                                    <Download className="mr-1.5 size-4" /> Excel
                                </Button>
                                <Button variant="ghost" size="sm" onClick={reset}>
                                    <RefreshCw className="mr-1.5 size-4" /> Process another
                                </Button>
                            </div>
                        </div>

                        {result.pages.map((page) => (
                            <PageCard key={page.index} page={page} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
