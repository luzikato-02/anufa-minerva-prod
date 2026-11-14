<?php

namespace App\Ai\Tools;

/** What a tool hands back: the data for the model, and how many rows it covered (for the audit log). */
final class ToolResult
{
    public function __construct(
        public readonly array $data,
        public readonly ?int $rowCount = null,
    ) {}

    public static function error(string $message): self
    {
        return new self(['error' => $message], 0);
    }

    public function toJson(): string
    {
        return json_encode($this->data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION | JSON_INVALID_UTF8_SUBSTITUTE);
    }
}
