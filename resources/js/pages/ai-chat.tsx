import {
    ModelNotPermittedDialog,
    ModelPicker,
} from '@/components/ai-model-picker';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import AppLayout from '@/layouts/app-layout';
import {
    chatApi,
    type ChatMessage,
    type ChatSource,
    type ConversationListItem,
    type Effort,
    EFFORT_OPTIONS,
    loadSettings,
    modelLabel,
    saveSettings,
    STARTERS,
    TOOL_LABELS,
} from '@/lib/ai-chat';
import { AiRequestError, type ModelAccess } from '@/lib/ai-models';
import { cn } from '@/lib/utils';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';
import {
    ArrowUp,
    Database,
    History,
    LoaderCircle,
    MessageSquarePlus,
    Trash2,
} from 'lucide-react';
import {
    type FormEvent,
    type KeyboardEvent,
    useEffect,
    useRef,
    useState,
} from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Ask the Data', href: '/ai-chat' },
];

interface Props extends ModelAccess {
    tools: string[];
    efforts: Effort[];
    defaultEffort: Effort | null;
}

export default function AiChat({
    tools,
    models,
    allowedModels,
    defaultModel,
    efforts,
    defaultEffort,
}: Props) {
    const access: ModelAccess = { models, allowedModels, defaultModel };
    const [conversations, setConversations] = useState<ConversationListItem[]>(
        [],
    );
    const [activeId, setActiveId] = useState<number | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [draft, setDraft] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [historyOpen, setHistoryOpen] = useState(false);
    // The model the user isn't allowed, while the "contact your admin" dialog is open.
    const [refused, setRefused] = useState<string | null | undefined>(
        undefined,
    );
    // The browser's last choice while the user may still use it and their default (set by an admin) hasn't
    // changed since; else that default.
    const [model, setModel] = useState<string | null>(() => {
        const saved = loadSettings();
        return saved.model &&
            allowedModels.includes(saved.model) &&
            saved.defaultModel === defaultModel
            ? saved.model
            : defaultModel;
    });
    const [effort, setEffort] = useState<Effort | null>(() => {
        const saved = loadSettings();
        return 'effort' in saved &&
            (saved.effort === null || efforts.includes(saved.effort!))
            ? (saved.effort ?? null)
            : defaultEffort;
    });
    const choose = (next: {
        model?: string | null;
        effort?: Effort | null;
    }) => {
        const settings = {
            model: next.model !== undefined ? next.model : model,
            effort: next.effort !== undefined ? next.effort : effort,
        };
        setModel(settings.model);
        setEffort(settings.effort);
        saveSettings({ ...settings, defaultModel });
    };
    const bottomRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        chatApi
            .list()
            .then(setConversations)
            .catch(() => {});
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: 'end' });
    }, [messages, sending]);

    const open = async (id: number) => {
        setHistoryOpen(false);
        if (id === activeId) return;
        setActiveId(id);
        setError(null);
        setLoading(true);
        try {
            const conversation = await chatApi.get(id);
            setMessages(conversation.messages);
            // Carry on with the conversation's own settings, when the user may still use its model.
            if (
                conversation.model &&
                allowedModels.includes(conversation.model)
            ) {
                setModel(conversation.model);
            }
            setEffort(conversation.effort);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    };

    const startNew = () => {
        setHistoryOpen(false);
        setActiveId(null);
        setMessages([]);
        setError(null);
        inputRef.current?.focus();
    };

    const remove = async (id: number) => {
        await chatApi.remove(id).catch(() => {});
        setConversations((cs) => cs.filter((c) => c.id !== id));
        if (id === activeId) startNew();
    };

    const send = async (text: string) => {
        const question = text.trim();
        if (!question || sending) return;
        setError(null);
        setDraft('');
        setSending(true);
        const pendingId = -Date.now();
        setMessages((ms) => [
            ...ms,
            {
                id: pendingId,
                role: 'user',
                content: question,
                created_at: new Date().toISOString(),
            },
        ]);
        try {
            const { conversation, messages: turn } = await chatApi.send(
                question,
                activeId,
                model,
                effort,
            );
            setActiveId(conversation.id);
            setMessages((ms) => [
                ...ms.filter((m) => m.id !== pendingId),
                ...turn,
            ]);
            setConversations((cs) => [
                conversation,
                ...cs.filter((c) => c.id !== conversation.id),
            ]);
        } catch (e) {
            setMessages((ms) => ms.filter((m) => m.id !== pendingId));
            setDraft(question);
            if (e instanceof AiRequestError && e.notPermitted) {
                setRefused(e.model ?? null);
            } else {
                setError((e as Error).message);
            }
        } finally {
            setSending(false);
            inputRef.current?.focus();
        }
    };

    const onSubmit = (e: FormEvent) => {
        e.preventDefault();
        send(draft);
    };

    const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send(draft);
        }
    };

    const starters = STARTERS.filter((s) => tools.includes(s.tool));

    const history = (
        <ConversationList
            conversations={conversations}
            activeId={activeId}
            onOpen={open}
            onNew={startNew}
            onDelete={remove}
        />
    );

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Ask the Data" />
            <div className="flex min-h-0 min-w-0 flex-1 gap-4 p-4">
                <aside className="hidden w-60 shrink-0 flex-col md:flex">
                    {history}
                </aside>

                <section className="flex min-h-[calc(100svh-8rem)] min-w-0 flex-1 flex-col rounded-lg border bg-card">
                    <header className="flex items-center gap-2 border-b px-4 py-2">
                        <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                            <SheetTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="md:hidden"
                                    aria-label="Conversations"
                                >
                                    <History />
                                </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="w-72 p-4">
                                <SheetHeader className="p-0">
                                    <SheetTitle>Conversations</SheetTitle>
                                </SheetHeader>
                                {history}
                            </SheetContent>
                        </Sheet>
                        <h1 className="truncate text-base font-semibold tracking-tight">
                            {conversations.find((c) => c.id === activeId)
                                ?.title ?? 'Ask the Data'}
                        </h1>
                    </header>

                    <div
                        className="flex-1 overflow-y-auto px-4 py-6"
                        aria-live="polite"
                    >
                        <div className="mx-auto flex max-w-3xl flex-col gap-6">
                            {loading && (
                                <p className="text-sm text-muted-foreground">
                                    Loading conversation…
                                </p>
                            )}

                            {!loading && messages.length === 0 && (
                                <EmptyState
                                    tools={tools}
                                    starters={starters}
                                    onPick={send}
                                />
                            )}

                            {messages.map((m) =>
                                m.role === 'user' ? (
                                    <div
                                        key={m.id}
                                        className="ml-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm whitespace-pre-wrap"
                                    >
                                        {m.content}
                                    </div>
                                ) : (
                                    <AssistantMessage key={m.id} message={m} />
                                ),
                            )}

                            {sending && (
                                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <LoaderCircle className="size-4 animate-spin" />
                                    Looking through the data…
                                </p>
                            )}

                            {error && (
                                <p
                                    role="alert"
                                    className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                                >
                                    {error}
                                </p>
                            )}
                            <div ref={bottomRef} />
                        </div>
                    </div>

                    <form onSubmit={onSubmit} className="border-t p-3">
                        <div className="mx-auto flex max-w-3xl items-end gap-2">
                            <Textarea
                                ref={inputRef}
                                value={draft}
                                onChange={(e) => setDraft(e.target.value)}
                                onKeyDown={onKeyDown}
                                placeholder="Ask about tension, stock or torque data…"
                                aria-label="Question"
                                rows={1}
                                maxLength={4000}
                                className="max-h-40 min-h-10 resize-none"
                                disabled={tools.length === 0}
                            />
                            <Button
                                type="submit"
                                size="icon"
                                disabled={sending || !draft.trim()}
                                aria-label="Send"
                            >
                                <ArrowUp />
                            </Button>
                        </div>
                        <div className="mx-auto mt-1.5 flex max-w-3xl flex-wrap items-center gap-x-3 gap-y-1">
                            <ChatSettings
                                access={access}
                                model={model}
                                efforts={efforts}
                                effort={effort}
                                onChange={choose}
                                disabled={sending}
                            />
                            <p className="text-xs text-muted-foreground">
                                Answers come from Minerva's records via
                                Telkomsel OCTA. Check the sources before acting
                                on a number.
                            </p>
                        </div>
                    </form>
                </section>
            </div>
            <ModelNotPermittedDialog
                model={refused}
                onClose={() => setRefused(undefined)}
            />
        </AppLayout>
    );
}

function ConversationList({
    conversations,
    activeId,
    onOpen,
    onNew,
    onDelete,
}: {
    conversations: ConversationListItem[];
    activeId: number | null;
    onOpen: (id: number) => void;
    onNew: () => void;
    onDelete: (id: number) => void;
}) {
    return (
        <div className="flex min-h-0 flex-col gap-2">
            <Button
                variant="outline"
                size="sm"
                onClick={onNew}
                className="justify-start"
            >
                <MessageSquarePlus />
                New conversation
            </Button>
            <ul className="flex flex-col gap-0.5 overflow-y-auto">
                {conversations.map((c) => (
                    <li key={c.id} className="group relative">
                        <button
                            type="button"
                            onClick={() => onOpen(c.id)}
                            aria-current={
                                c.id === activeId ? 'true' : undefined
                            }
                            className={cn(
                                'w-full truncate rounded-md py-1.5 pr-8 pl-2 text-left text-sm hover:bg-muted',
                                c.id === activeId && 'bg-muted font-medium',
                            )}
                        >
                            {c.title || 'Untitled'}
                        </button>
                        <button
                            type="button"
                            onClick={() => onDelete(c.id)}
                            aria-label={`Delete “${c.title || 'Untitled'}”`}
                            className="absolute top-1/2 right-1 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                        >
                            <Trash2 className="size-3.5" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function EmptyState({
    tools,
    starters,
    onPick,
}: {
    tools: string[];
    starters: { text: string }[];
    onPick: (text: string) => void;
}) {
    if (tools.length === 0) {
        return (
            <p className="text-sm text-muted-foreground">
                Your account can't view any of the data the assistant reads yet
                (tension, stock or torque records). Ask an admin for access.
            </p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div>
                <h2 className="text-lg font-semibold tracking-tight">
                    Ask about your plant data
                </h2>
                <p className="text-sm text-muted-foreground">
                    The assistant reads{' '}
                    {tools
                        .map((t) => TOOL_LABELS[t] ?? t)
                        .join(', ')
                        .toLowerCase()}{' '}
                    and answers from what's recorded.
                </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
                {starters.map((s) => (
                    <button
                        key={s.text}
                        type="button"
                        onClick={() => onPick(s.text)}
                        className="rounded-lg border px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                        {s.text}
                    </button>
                ))}
            </div>
        </div>
    );
}

function AssistantMessage({ message }: { message: ChatMessage }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="prose prose-sm max-w-none dark:prose-invert prose-table:text-xs prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {message.content}
                </ReactMarkdown>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {message.sources && message.sources.length > 0 && (
                    <Sources sources={message.sources} />
                )}
                {message.model && (
                    <span className="text-xs text-muted-foreground">
                        {modelLabel(message.model)}
                        {message.effort &&
                            ` · ${effortLabel(message.effort)} effort`}
                    </span>
                )}
            </div>
        </div>
    );
}

function effortLabel(effort: Effort | 'auto'): string {
    return EFFORT_OPTIONS.find((o) => o.value === effort)?.label ?? effort;
}

/** Model and effort pickers, like the ones under a Claude chat box. */
function ChatSettings({
    access,
    model,
    efforts,
    effort,
    onChange,
    disabled,
}: {
    access: ModelAccess;
    model: string | null;
    efforts: Effort[];
    effort: Effort | null;
    onChange: (next: { model?: string | null; effort?: Effort | null }) => void;
    disabled: boolean;
}) {
    const effortOptions = EFFORT_OPTIONS.filter(
        (o) => o.value === 'auto' || efforts.includes(o.value),
    );

    return (
        <div className="flex items-center gap-1">
            <ModelPicker
                access={access}
                value={model}
                onChange={(value) => onChange({ model: value })}
                disabled={disabled}
            />
            <Select
                value={effort ?? 'auto'}
                onValueChange={(value) =>
                    onChange({
                        effort: value === 'auto' ? null : (value as Effort),
                    })
                }
                disabled={disabled}
            >
                <SelectTrigger
                    aria-label="Effort"
                    className="h-7 w-auto gap-1 border-none px-2 text-xs shadow-none hover:bg-muted"
                >
                    <SelectValue>
                        {effortLabel(effort ?? 'auto')} effort
                    </SelectValue>
                </SelectTrigger>
                <SelectContent>
                    {effortOptions.map((o) => (
                        <SelectItem
                            key={o.value}
                            value={o.value}
                            className="text-xs"
                        >
                            <span className="flex flex-col">
                                <span>{o.label}</span>
                                <span className="text-muted-foreground">
                                    {o.hint}
                                </span>
                            </span>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function Sources({ sources }: { sources: ChatSource[] }) {
    return (
        <details className="text-xs text-muted-foreground">
            <summary className="flex cursor-pointer items-center gap-1.5 select-none">
                <Database className="size-3.5" />
                {sources.length} {sources.length === 1 ? 'source' : 'sources'}
            </summary>
            <ul className="mt-1.5 flex flex-col gap-1 border-l pl-3">
                {sources.map((s, i) => (
                    <li key={i}>
                        <span className="font-medium text-foreground">
                            {TOOL_LABELS[s.tool] ?? s.tool}
                        </span>
                        {s.error ? (
                            <span className="text-destructive"> · failed</span>
                        ) : (
                            <span> · {s.rows ?? 0} rows</span>
                        )}
                        {s.arguments && Object.keys(s.arguments).length > 0 && (
                            <span className="font-mono">
                                {' '}
                                · {formatArgs(s.arguments)}
                            </span>
                        )}
                    </li>
                ))}
            </ul>
        </details>
    );
}

function formatArgs(args: Record<string, unknown>): string {
    return Object.entries(args)
        .map(
            ([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`,
        )
        .join(' ');
}
