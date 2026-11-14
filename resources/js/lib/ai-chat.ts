/** A tool the assistant ran while answering, shown under the answer as a source. */
export interface ChatSource {
    tool: string;
    arguments: Record<string, unknown> | null;
    rows: number | null;
    ms: number | null;
    error: boolean;
}

export interface ChatMessage {
    id: number;
    role: 'user' | 'assistant';
    content: string;
    sources?: ChatSource[];
    created_at: string;
}

export interface ConversationListItem {
    id: number;
    title: string | null;
    updated_at: string;
}

async function csrfToken(): Promise<string> {
    const { csrfToken } = await (
        await fetch('/csrf-token', { credentials: 'include' })
    ).json();
    return csrfToken;
}

async function request<T>(
    url: string,
    method: string,
    body?: unknown,
): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (method !== 'GET') {
        headers['X-CSRF-TOKEN'] = await csrfToken();
        headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, {
        method,
        headers,
        credentials: 'include',
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 204) return undefined as T;
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
        const first = json.errors
            ? (Object.values(json.errors)[0] as string[])[0]
            : undefined;
        throw new Error(
            first ?? json.message ?? 'The request failed. Try again.',
        );
    }
    return json as T;
}

export const chatApi = {
    list: () =>
        request<{ data: ConversationListItem[] }>(
            '/ai-chat/conversations',
            'GET',
        ).then((r) => r.data),

    get: (id: number) =>
        request<{
            data: { id: number; title: string | null; messages: ChatMessage[] };
        }>(`/ai-chat/conversations/${id}`, 'GET').then((r) => r.data),

    send: (message: string, conversationId: number | null) =>
        request<{
            data: {
                conversation: ConversationListItem;
                messages: ChatMessage[];
            };
        }>('/ai-chat/messages', 'POST', {
            message,
            conversation_id: conversationId,
        }).then((r) => r.data),

    remove: (id: number) =>
        request<void>(`/ai-chat/conversations/${id}`, 'DELETE'),
};

/** Plain-language labels for the tools, for the sources list. */
export const TOOL_LABELS: Record<string, string> = {
    tension_records: 'Tension records',
    tension_problems: 'Tension problems',
    stock_sheets: 'Stock sheets',
    torque_checks: 'Torque checks',
};

/** Starter questions, shown when the matching tool is available to the user. */
export const STARTERS: { tool: string; text: string }[] = [
    {
        tool: 'tension_records',
        text: 'Which twisting machines had the highest out-of-spec rate in the last 7 days?',
    },
    {
        tool: 'tension_problems',
        text: 'What tension problems are still open, and on which machines?',
    },
    {
        tool: 'stock_sheets',
        text: 'How many kg of each material did we count this month?',
    },
    {
        tool: 'torque_checks',
        text: 'Which machines had torque readings out of range this week?',
    },
];
