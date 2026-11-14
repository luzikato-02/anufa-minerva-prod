<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A message in a data-chat conversation. Assistant messages that asked for tools carry `tool_calls`;
 * each tool result is stored as its own `tool` message so the conversation can be replayed to the model.
 */
class AiMessage extends Model
{
    protected $fillable = [
        'ai_conversation_id', 'role', 'content', 'tool_calls', 'tool_call_id', 'tool_name',
        'prompt_tokens', 'completion_tokens', 'latency_ms',
    ];

    protected $casts = [
        'tool_calls' => 'array',
        'prompt_tokens' => 'integer',
        'completion_tokens' => 'integer',
        'latency_ms' => 'integer',
    ];

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(AiConversation::class, 'ai_conversation_id');
    }

    public function toolRuns(): HasMany
    {
        return $this->hasMany(AiToolRun::class);
    }

    /** The message in the shape Mistral's chat API takes. */
    public function toMistral(): array
    {
        return match ($this->role) {
            'assistant' => array_filter([
                'role' => 'assistant',
                'content' => $this->content ?? '',
                'tool_calls' => $this->tool_calls ?: null,
            ], fn ($v) => $v !== null),
            'tool' => [
                'role' => 'tool',
                'name' => $this->tool_name,
                'tool_call_id' => $this->tool_call_id,
                'content' => $this->content ?? '',
            ],
            default => ['role' => $this->role, 'content' => $this->content ?? ''],
        };
    }
}
