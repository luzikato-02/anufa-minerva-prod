<?php

namespace App\Ai\Llm;

class LlmException extends \RuntimeException
{
    public function __construct(
        string $message = '',
        int $code = 0,
        ?\Throwable $previous = null,
        /** The provider's own error code, e.g. OCTA's MODEL_NOT_ALLOWED. */
        public readonly ?string $providerCode = null,
    ) {
        parent::__construct($message, $code, $previous);
    }
}
