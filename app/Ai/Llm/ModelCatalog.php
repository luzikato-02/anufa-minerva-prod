<?php

namespace App\Ai\Llm;

use App\Models\User;
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

    /** @return array<int, string> the offered models this user may use */
    public function allowedFor(User $user): array
    {
        return array_values(array_filter($this->models(), fn (string $id) => $user->canUseAiModel($id)));
    }

    /** The model a user's AI features start with: their own default, else the app's, else their first allowed. */
    public function defaultFor(User $user): ?string
    {
        $allowed = $this->allowedFor($user);
        foreach ([$user->ai_default_model, config('ai.chat.model')] as $candidate) {
            if ($candidate && in_array($candidate, $allowed, true)) {
                return $candidate;
            }
        }

        return $allowed[0] ?? null;
    }

    /**
     * The model to run a request on: the one asked for, or the user's default.
     *
     * @throws ModelNotPermitted when the user may not use it, or may use no model at all
     * @throws ModelUnavailable when the provider no longer offers it
     */
    public function resolve(User $user, ?string $requested): string
    {
        if ($requested === null) {
            return $this->defaultFor($user) ?? throw new ModelNotPermitted(null);
        }
        if (! $this->allows($requested)) {
            throw new ModelUnavailable($requested);
        }
        if (! $user->canUseAiModel($requested)) {
            throw new ModelNotPermitted($requested);
        }

        return $requested;
    }

    /** What the frontend's model pickers need: every offered model, which this user may use, and their default. */
    public function accessFor(User $user): array
    {
        return [
            'models' => $this->models(),
            'allowedModels' => $this->allowedFor($user),
            'defaultModel' => $this->defaultFor($user),
        ];
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
