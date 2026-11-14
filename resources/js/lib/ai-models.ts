import { useEffect, useState } from 'react';

/** The models a user may pick in the AI features. An admin sets this per user in User Management. */
export interface ModelAccess {
    /** Every model the provider offers. */
    models: string[];
    /** The ones this user may use; the rest show locked. */
    allowedModels: string[];
    /** Where this user's AI features start. Null when they may use no model. */
    defaultModel: string | null;
}

/** The server's refusal of a model the user isn't allowed: HTTP 403 with this code. */
export const MODEL_NOT_PERMITTED = 'model_not_permitted';

/** An error from an AI endpoint, keeping the server's code and the model it was about. */
export class AiRequestError extends Error {
    constructor(
        message: string,
        public readonly status: number,
        public readonly code?: string,
        public readonly model?: string | null,
    ) {
        super(message);
    }

    get notPermitted(): boolean {
        return this.code === MODEL_NOT_PERMITTED;
    }
}

/** Read an error body the way every AI endpoint returns it. */
export function aiErrorFrom(
    status: number,
    body: {
        message?: string;
        code?: string;
        model?: string | null;
        errors?: Record<string, string[]>;
    } | null,
): AiRequestError {
    const first = body?.errors ? Object.values(body.errors)[0]?.[0] : undefined;
    return new AiRequestError(
        first ?? body?.message ?? 'The request failed. Try again.',
        status,
        body?.code,
        body?.model,
    );
}

/** The signed-in user's model access, for pages that don't get it as a prop. */
export function useModelAccess(): ModelAccess | null {
    const [access, setAccess] = useState<ModelAccess | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        fetch('/ai/models', {
            credentials: 'include',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        })
            .then((r) => (r.ok ? r.json() : null))
            .then((json: ModelAccess | null) => {
                if (json) setAccess(json);
            })
            .catch(() => {});
        return () => controller.abort();
    }, []);
    return access;
}

const BRANDS: Record<string, string> = {
    claude: 'Claude',
    deepseek: 'DeepSeek',
    gemini: 'Gemini',
    gpt: 'GPT',
    kimi: 'Kimi',
};

/**
 * A readable name for a provider model id: "claude-sonnet-5-5" → "Claude Sonnet 5.5",
 * "deepseek-v4.1-flash" → "DeepSeek V4.1 Flash". Unknown shapes are title-cased.
 */
export function modelLabel(id: string): string {
    const parts = id.split('-');
    const words: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        // Claude-style versions are split across parts: 5-5 → 5.5.
        if (
            /^\d+$/.test(part) &&
            /^\d{1,2}$/.test(parts[i + 1] ?? '') &&
            part.length <= 2
        ) {
            words.push(`${part}.${parts[++i]}`);
        } else if (BRANDS[part]) {
            words.push(BRANDS[part]);
        } else if (/^v\d/.test(part)) {
            words.push(part.toUpperCase());
        } else {
            words.push(part.charAt(0).toUpperCase() + part.slice(1));
        }
    }
    return words.join(' ');
}
