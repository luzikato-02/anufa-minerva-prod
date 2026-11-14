<?php

namespace App\Ai\Llm;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

/**
 * The models and effort levels users may pick in the data chat. Models come from the provider's live list
 * (cached for a few minutes, since an OCTA key's allowed models can change at any time), narrowed by
 * AI_CHAT_MODELS when set, with non-chat models such as image generators left out.
 */
class ModelCatalog
{
    private const CACHE_KEY = 'ai-chat:models';

    public function __construct(private readonly LlmClient $llm) {}

    /** @return array<int, string> */
    public function models(): array
    {
        $listed = Cache::remember(self::CACHE_KEY, now()->addMinutes(10), function () {
            try {
                return $this->llm->models();
            } catch (LlmException $e) {
                Log::warning('AI chat: could not list provider models', ['error' => $e->getMessage()]);

                return null; // not cached as a list; falls back below
            }
        });
        if ($listed === null) {
            Cache::forget(self::CACHE_KEY);
        }

        $allowed = config('ai.chat.models');
        $exclude = config('ai.chat.exclude_models');
        $models = array_values(array_filter(
            $listed ?? $allowed ?: [],
            fn (string $id) => (! $allowed || in_array($id, $allowed, true))
                && (! $exclude || ! preg_match($exclude, $id)),
        ));

        // The default is always offered while the provider can't be asked, so the chat keeps working.
        $default = config('ai.chat.model');
        if ($listed === null && $default && ! in_array($default, $models, true)) {
            array_unshift($models, $default);
        }

        return $models;
    }

    public function defaultModel(): ?string
    {
        $models = $this->models();
        $default = config('ai.chat.model');

        return in_array($default, $models, true) ? $default : ($models[0] ?? null);
    }

    public function allows(?string $model): bool
    {
        return $model !== null && in_array($model, $this->models(), true);
    }

    /** @return array<int, string> */
    public function efforts(): array
    {
        return config('ai.chat.efforts');
    }

    public function defaultEffort(): ?string
    {
        $effort = config('ai.chat.effort');

        return in_array($effort, $this->efforts(), true) ? $effort : null;
    }

    /** Forget the cached list, e.g. after the provider refused a model it used to allow. */
    public function refresh(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
