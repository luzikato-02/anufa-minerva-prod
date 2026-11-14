<?php

namespace App\Http\Controllers\Api;

use App\Ai\Documents\DocumentReader;
use App\Ai\Llm\LlmException;
use App\Ai\Llm\ModelCatalog;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/** Transcribes a PDF or image to Markdown, page by page, with a vision model on OCTA. */
class DocumentIntelligenceController extends Controller
{
    public function process(Request $request, DocumentReader $reader, ModelCatalog $catalog): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,png,jpg,jpeg,webp|max:20480',
            'model' => 'nullable|string|max:100',
        ]);
        if (! config('ai.provider.key')) {
            return response()->json(['message' => 'Document reading is not set up yet: AI_API_KEY is missing.'], 503);
        }
        $model = $catalog->resolve($request->user(), $request->input('model'));
        set_time_limit(300);

        try {
            return response()->json($reader->transcribe($request->file('file'), $model));
        } catch (LlmException $e) {
            Log::error('Document Intelligence failed', ['model' => $model, 'error' => $e->getMessage()]);
            if ($e->providerCode === 'MODEL_NOT_ALLOWED') {
                $catalog->refresh();

                return response()->json(['message' => "The model \"{$model}\" is no longer available. Pick another one."], 422);
            }

            return response()->json(['message' => 'The document could not be read. Try again in a moment.'], 502);
        }
    }
}
