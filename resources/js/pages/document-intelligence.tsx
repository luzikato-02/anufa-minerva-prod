import { PageHeader } from '@/components/page-header';
import { Panel } from '@/components/panel';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import axios from 'axios';
import {
    Code,
    Download,
    FileText,
    Loader2,
    RefreshCw,
    Upload,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as XLSX from 'xlsx';

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
    { at: 200, text: 'Uploading document to OCR engine…' },
    { at: 1200, text: 'Connected · running mistral-ocr-latest…' },
    { at: 3500, text: 'Scanning pages for text content…' },
    { at: 7000, text: 'Extracting markdown from page content…' },
    { at: 10000, text: 'Processing visual elements and tables…' },
    { at: 13000, text: 'Assembling output…' },
];

function PageCard({ page }: { page: OcrPage }) {
    const [raw, setRaw] = useState(false);

    return (
        <section
            aria-label={`Page ${page.index + 1}`}
            className="overflow-hidden rounded-lg border"
        >
            <div className="flex h-9 items-center gap-2 border-b bg-muted/40 px-3">
                <h2 className="text-xs font-semibold">Page {page.index + 1}</h2>
                <div
                    role="group"
                    aria-label={`Show page ${page.index + 1} as`}
                    className="ml-auto inline-flex gap-0.5 rounded-md bg-muted p-0.5"
                >
                    {(
                        [
                            [false, 'Rendered'],
                            [true, 'Markdown'],
                        ] as const
                    ).map(([value, label]) => (
                        <button
                            key={label}
                            type="button"
                            aria-pressed={raw === value}
                            onClick={() => setRaw(value)}
                            className={cn(
                                'inline-flex h-6 items-center gap-1 rounded px-2 text-xs font-medium',
                                raw === value
                                    ? 'bg-background shadow-xs'
                                    : 'text-muted-on-muted hover:text-foreground',
                            )}
                        >
                            {value && (
                                <Code className="size-3" aria-hidden="true" />
                            )}
                            {label}
                        </button>
                    ))}
                </div>
            </div>
            {raw ? (
                <pre className="overflow-x-auto p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {page.markdown}
                </pre>
            ) : (
                <div className="prose prose-sm max-w-none p-4 dark:prose-invert prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {page.markdown}
                    </ReactMarkdown>
                </div>
            )}
        </section>
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
                ids.push(
                    intervalId as unknown as ReturnType<typeof setTimeout>,
                );
            }, at);
            ids.push(startId);
        });
        return () =>
            ids.forEach((id) => {
                clearTimeout(id);
                clearInterval(id as unknown as ReturnType<typeof setInterval>);
            });
    }, [state]);

    const handleFile = useCallback((f: File) => {
        if (!f.name.match(/\.(pdf|png|jpe?g|webp)$/i)) {
            setError(
                'Unsupported file type. Please upload a PDF or image (PNG, JPG, WEBP).',
            );
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
            const res = await axios.post(
                '/document-intelligence/process',
                formData,
                {
                    headers: {
                        'X-CSRF-TOKEN': csrfRes.data.csrfToken,
                        'Content-Type': 'multipart/form-data',
                    },
                },
            );
            setResult(res.data);
            setState('done');
        } catch (e: unknown) {
            const data = axios.isAxiosError(e)
                ? (e.response?.data as
                      | { error?: string; message?: string }
                      | undefined)
                : undefined;
            const msg =
                data?.error ??
                data?.message ??
                (e instanceof Error ? e.message : 'Processing failed.');
            setError(msg);
            setState('error');
        }
    };

    const triggerDownload = (
        content: string,
        filename: string,
        type: string,
    ) => {
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
        triggerDownload(
            JSON.stringify(result, null, 2),
            `${baseName}.json`,
            'application/json',
        );
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
                    const cells = line
                        .split('|')
                        .slice(1, -1)
                        .map((c) => c.trim());
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

    const pageCount = result?.pages.length ?? 0;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Document Intelligence" />
            <div className="flex min-w-0 flex-1 flex-col gap-(--density-gutter) p-4">
                <PageHeader
                    title="Document Intelligence"
                    meta={
                        state === 'done' && result
                            ? `${file?.name ?? 'Document'} · ${pageCount} ${pageCount === 1 ? 'page' : 'pages'} · ${result.model}`
                            : 'Extract text and tables from a PDF or image with Mistral OCR'
                    }
                    actions={
                        state === 'done' &&
                        result && (
                            <>
                                <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={downloadMarkdown}
                                >
                                    <Download />
                                    Markdown
                                </Button>
                                <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={downloadJson}
                                >
                                    <Download />
                                    JSON
                                </Button>
                                <Button
                                    variant="outline"
                                    size="xs"
                                    onClick={downloadExcel}
                                >
                                    <Download />
                                    Excel
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="xs"
                                    onClick={reset}
                                >
                                    <RefreshCw />
                                    Process another
                                </Button>
                            </>
                        )
                    }
                />

                {(state === 'idle' || state === 'error') && (
                    <div className="flex flex-col gap-2">
                        <div
                            className={cn(
                                'flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-3 transition-colors',
                                dragging
                                    ? 'border-primary bg-primary/5'
                                    : 'border-muted-foreground/30',
                            )}
                            onDragOver={(e) => {
                                e.preventDefault();
                                setDragging(true);
                            }}
                            onDragLeave={() => setDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragging(false);
                                const f = e.dataTransfer.files[0];
                                if (f) handleFile(f);
                            }}
                        >
                            <Upload
                                className="size-5 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                                {file ? (
                                    <div className="flex items-center gap-1.5 text-sm font-medium">
                                        <FileText
                                            className="size-4 shrink-0"
                                            aria-hidden="true"
                                        />
                                        <span className="truncate">
                                            {file.name}
                                        </span>
                                    </div>
                                ) : (
                                    <p className="text-sm font-medium">
                                        Drop a file here, or choose one
                                    </p>
                                )}
                                <p className="text-xs text-muted-foreground">
                                    PDF, PNG, JPG or WEBP, up to 20 MB
                                </p>
                            </div>
                            <Button
                                variant="outline"
                                size="xs"
                                onClick={() => inputRef.current?.click()}
                            >
                                {file ? 'Choose another' : 'Choose file'}
                            </Button>
                            <Button
                                size="xs"
                                onClick={process}
                                disabled={!file}
                            >
                                Process document
                            </Button>
                            <input
                                ref={inputRef}
                                type="file"
                                aria-label="Document to process"
                                accept=".pdf,.png,.jpg,.jpeg,.webp"
                                className="sr-only"
                                tabIndex={-1}
                                onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleFile(f);
                                }}
                            />
                        </div>
                        {error && (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {error}
                            </p>
                        )}
                    </div>
                )}

                {state === 'processing' && (
                    <Panel
                        title="Analyzing document"
                        meta={file?.name}
                        action={
                            <span
                                aria-hidden="true"
                                className="block size-2 animate-pulse rounded-full bg-primary"
                            />
                        }
                    >
                        <div
                            role="status"
                            aria-live="polite"
                            className="flex min-h-40 flex-col gap-1.5 p-3 font-mono text-xs"
                        >
                            {logLines.map((line, i) => (
                                <div key={i} className="flex gap-2">
                                    <span
                                        className="text-muted-foreground select-none"
                                        aria-hidden="true"
                                    >
                                        ›
                                    </span>
                                    <span>{line}</span>
                                </div>
                            ))}
                            {typingText && (
                                <div className="flex gap-2" aria-hidden="true">
                                    <span className="text-muted-foreground select-none">
                                        ›
                                    </span>
                                    <span className="inline-flex items-baseline">
                                        {typingText}
                                        <span className="ml-px inline-block h-[1em] w-2 animate-pulse bg-primary" />
                                    </span>
                                </div>
                            )}
                            {!typingText &&
                                logLines.length === PROCESS_LOG.length && (
                                    <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                                        <Loader2
                                            className="size-3 animate-spin"
                                            aria-hidden="true"
                                        />
                                        <span>
                                            Waiting for the OCR response…
                                        </span>
                                    </div>
                                )}
                        </div>
                    </Panel>
                )}

                {state === 'done' && result && (
                    <div className="grid gap-(--density-gutter) xl:grid-cols-2">
                        {result.pages.map((page) => (
                            <PageCard key={page.index} page={page} />
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
