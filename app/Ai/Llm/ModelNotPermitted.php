<?php

namespace App\Ai\Llm;

use Illuminate\Http\JsonResponse;

/**
 * The user asked an AI feature for a model an admin hasn't allowed them. Every feature answers the same
 * 403, which the frontend shows as the "ask your admin" dialog.
 */
class ModelNotPermitted extends \RuntimeException
{
    public function __construct(public readonly ?string $model)
    {
        parent::__construct($model === null
            ? 'Your account has no AI models enabled. Ask an administrator to give you access.'
            : "You're not allowed to use {$model}. Ask an administrator to give you access.");
    }

    public function render(): JsonResponse
    {
        return response()->json([
            'code' => 'model_not_permitted',
            'model' => $this->model,
            'message' => $this->getMessage(),
        ], 403);
    }
}
