<?php

namespace App\Http\Controllers\Ai;

use App\Ai\ChatAgent;
use App\Ai\Llm\LlmException;
use App\Ai\Llm\ModelCatalog;
use App\Ai\Tools\ToolRegistry;
use App\Http\Controllers\Controller;
use App\Models\AiConversation;
use App\Models\AiToolRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

/** The data chat: a user's own conversations with the data assistant. */
class AiChatController extends Controller
{
    public function page(Request $request, ToolRegistry $registry, ModelCatalog $catalog): Response
    {
        return Inertia::render('ai-chat', [
            'tools' => array_keys($registry->forUser($request->user())),
            'models' => $catalog->models(),
            'defaultModel' => $catalog->defaultModel(),
            'efforts' => $catalog->efforts(),
            'defaultEffort' => $catalog->defaultEffort(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $conversations = AiConversation::where('user_id', $request->user()->id)
            ->latest('updated_at')
            ->limit(100)
            ->get(['id', 'title', 'updated_at']);

        return response()->json(['data' => $conversations]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $conversation = $this->owned($request, $id);

        return response()->json(['data' => [
            'id' => $conversation->id,
            'title' => $conversation->title,
            'model' => $conversation->model,
            'effort' => $conversation->effort,
            'messages' => $this->transcript($conversation),
        ]]);
    }

    public function store(Request $request, ChatAgent $agent, ModelCatalog $catalog): JsonResponse
    {
        $validated = $request->validate([
            'conversation_id' => 'nullable|integer',
            'message' => 'required|string|max:4000',
            'model' => 'nullable|string|max:60',
            // "auto" (or null) leaves the effort to the model.
            'effort' => ['nullable', 'string', 'in:auto,'.implode(',', $catalog->efforts())],
        ]);
        $user = $request->user();

        if (! config('ai.provider.key')) {
            return response()->json(['message' => 'The assistant is not set up yet: AI_API_KEY is missing.'], 503);
        }

        $model = $validated['model'] ?? null;
        if ($model !== null && ! $catalog->allows($model)) {
            return response()->json(['message' => "The model \"{$model}\" isn't available. Pick another one."], 422);
        }
        $effort = ($validated['effort'] ?? 'auto') === 'auto' ? null : $validated['effort'];

        $limiterKey = 'ai-chat:'.$user->id;
        if (RateLimiter::tooManyAttempts($limiterKey, (int) config('ai.chat.rate_limit_per_hour'))) {
            $minutes = (int) ceil(RateLimiter::availableIn($limiterKey) / 60);

            return response()->json(['message' => "You've reached the hourly question limit. Try again in {$minutes} min."], 429);
        }
        RateLimiter::hit($limiterKey, 3600);

        $conversation = isset($validated['conversation_id'])
            ? $this->owned($request, $validated['conversation_id'])
            : new AiConversation([
                'user_id' => $user->id,
                'title' => Str::limit(preg_replace('/\s+/', ' ', trim($validated['message'])), 80),
            ]);
        // The choice can change partway through a conversation; it applies from this question on.
        $conversation->model = $model ?? $conversation->model ?? $catalog->defaultModel();
        if ($request->has('effort') || ! $conversation->exists) {
            $conversation->effort = $effort;
        }
        if (! $conversation->model) {
            return response()->json(['message' => 'The assistant is not set up yet: no model is available.'], 503);
        }
        $conversation->save();

        // A tool loop can make several model calls; give it room beyond PHP's default 30s.
        set_time_limit(300);
        $lastId = (int) $conversation->messages()->max('id');

        try {
            $agent->ask($conversation, $user, trim($validated['message']));
        } catch (LlmException $e) {
            Log::error('AI chat: provider request failed', ['conversation' => $conversation->id, 'model' => $conversation->model, 'error' => $e->getMessage()]);
            // Drop this half-finished turn so a retry starts clean.
            $conversation->messages()->where('id', '>', $lastId)->delete();
            if ($lastId === 0) {
                $conversation->forceDelete();
            }

            if ($e->providerCode === 'MODEL_NOT_ALLOWED') {
                $catalog->refresh();

                return response()->json(['message' => "The model \"{$conversation->model}\" is no longer available. Pick another one."], 422);
            }

            return response()->json(['message' => 'The assistant could not be reached. Try again in a moment.'], 502);
        }

        $turn = array_values(array_filter(
            $this->transcript($conversation),
            fn ($m) => $m['id'] > $lastId,
        ));

        return response()->json(['data' => [
            'conversation' => [
                'id' => $conversation->id,
                'title' => $conversation->title,
                'model' => $conversation->model,
                'effort' => $conversation->effort,
                'updated_at' => $conversation->fresh()->updated_at,
            ],
            'messages' => $turn,
        ]]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $this->owned($request, $id)->delete();

        return response()->json(null, 204);
    }

    private function owned(Request $request, int $id): AiConversation
    {
        return AiConversation::where('user_id', $request->user()->id)->findOrFail($id);
    }

    /**
     * The conversation as the user sees it: their questions and the assistant's final answers, each answer
     * carrying the tool runs ("sources") made while producing it. Tool traffic itself is not shown.
     */
    private function transcript(AiConversation $conversation): array
    {
        $messages = $conversation->messages()->get(['id', 'role', 'content', 'tool_calls', 'model', 'effort', 'created_at']);
        $runs = AiToolRun::whereIn('ai_message_id', $messages->where('role', 'assistant')->pluck('id'))
            ->orderBy('id')
            ->get(['ai_message_id', 'tool', 'arguments', 'row_count', 'duration_ms', 'error'])
            ->groupBy('ai_message_id');

        $out = [];
        $sources = [];
        foreach ($messages as $m) {
            if ($m->role === 'user') {
                $sources = [];
                $out[] = ['id' => $m->id, 'role' => 'user', 'content' => $m->content, 'created_at' => $m->created_at];
            } elseif ($m->role === 'assistant') {
                foreach ($runs->get($m->id, []) as $run) {
                    $sources[] = [
                        'tool' => $run->tool,
                        'arguments' => $run->arguments,
                        'rows' => $run->row_count,
                        'ms' => $run->duration_ms,
                        'error' => $run->error !== null,
                    ];
                }
                if (! $m->tool_calls) {
                    $out[] = [
                        'id' => $m->id, 'role' => 'assistant', 'content' => $m->content, 'sources' => $sources,
                        'model' => $m->model, 'effort' => $m->effort, 'created_at' => $m->created_at,
                    ];
                    $sources = [];
                }
            }
        }

        return $out;
    }
}
