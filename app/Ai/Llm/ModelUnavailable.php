<?php

namespace App\Ai\Llm;

use Illuminate\Http\JsonResponse;

/** The model asked for isn't offered by the provider (any more). */
class ModelUnavailable extends \RuntimeException
{
    public function __construct(public readonly string $model)
    {
        parent::__construct("The model \"{$model}\" isn't available. Pick another one.");
    }

    public function render(): JsonResponse
    {
        return response()->json(['code' => 'model_unavailable', 'model' => $this->model, 'message' => $this->getMessage()], 422);
    }
}
