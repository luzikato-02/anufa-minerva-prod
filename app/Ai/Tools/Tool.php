<?php

namespace App\Ai\Tools;

use App\Models\User;

/**
 * Something the data chat can call to read the app's data. Each tool declares the permission a user needs
 * for the model to be offered it at all, so the model never sees data the user couldn't open in the app.
 */
abstract class Tool
{
    /** Snake-case name the model calls the tool by. */
    abstract public function name(): string;

    /** What the tool returns and when to use it; the model reads this to pick tools. */
    abstract public function description(): string;

    /** JSON schema of the arguments. */
    abstract public function parameters(): array;

    /** Permission the user needs, or null if every chat user may use it. */
    abstract public function permission(): ?string;

    /** Runs the tool. Arguments come from the model, so validate them as untrusted input. */
    abstract public function run(array $args, User $user): ToolResult;

    /** The tool in the shape Mistral's chat API takes. */
    public function definition(): array
    {
        return [
            'type' => 'function',
            'function' => [
                'name' => $this->name(),
                'description' => $this->description(),
                'parameters' => $this->parameters(),
            ],
        ];
    }

    protected function maxRows(): int
    {
        return max(1, (int) config('ai.chat.max_tool_rows'));
    }

    /** A positive int limit from the arguments, capped at the configured row limit. */
    protected function limit(array $args, int $default = 50): int
    {
        $limit = is_numeric($args['limit'] ?? null) ? (int) $args['limit'] : $default;

        return max(1, min($limit, $this->maxRows()));
    }

    /** A string argument, trimmed, or null when missing or blank. */
    protected function str(array $args, string $key): ?string
    {
        $value = $args[$key] ?? null;
        if (! is_scalar($value)) {
            return null;
        }
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    /** An argument that must be one of $allowed, else $default. */
    protected function oneOf(array $args, string $key, array $allowed, string $default): string
    {
        $value = $this->str($args, $key);

        return in_array($value, $allowed, true) ? $value : $default;
    }

    /** Shared JSON-schema fragments for date filters. */
    protected static function dateParams(): array
    {
        return [
            'date_from' => ['type' => 'string', 'description' => 'First day to include, YYYY-MM-DD in plant time. Defaults to 30 days ago.'],
            'date_to' => ['type' => 'string', 'description' => 'Last day to include, YYYY-MM-DD in plant time. Defaults to today.'],
        ];
    }
}
