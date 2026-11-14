<?php

namespace App\Http\Controllers\Api;

use App\Ai\Documents\DocumentReader;
use App\Ai\Llm\LlmException;
use App\Ai\Llm\ModelCatalog;
use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/** Reads a scanned "Catatan Cable Finish Earlier" form into entries, with a vision model on OCTA. */
class FinishEarlierScanController extends Controller
{
    public function extract(Request $request, DocumentReader $reader, ModelCatalog $catalog): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,png,jpg,jpeg,webp|max:20480',
            'model' => 'nullable|string|max:100',
        ]);
        if (! config('ai.provider.key')) {
            return response()->json(['message' => 'Scanning is not set up yet: AI_API_KEY is missing.'], 503);
        }
        $model = $catalog->resolve($request->user(), $request->input('model'));
        $file = $request->file('file');
        set_time_limit(300);

        try {
            // Step 1: transcribe, so the user can check what was read.
            $ocrText = collect($reader->transcribe($file, $model)['pages'])->pluck('markdown')->implode("\n\n");

            // Step 2: structured extraction, looking at the form again with the transcription as a hint.
            $prompt = <<<PROMPT
You are extracting data from the attached scanned handwritten form titled "CATATAN CABLE FINISH EARLIER" (a manufacturing cable finish-earlier record form written in Bahasa Indonesia).

Extract all data and return ONLY a valid JSON object with this exact structure — no markdown, no explanation, just the JSON:

{
  "metadata": {
    "machine_number": "value from MC field",
    "style": "value from STYLE field",
    "production_order": "value from PO field",
    "shift_group": "value from SHIFT / GRP field"
  },
  "entries": [
    {
      "creel_side": "SECT value — must be one of: AO, AI, BO, BI",
      "row_number": "ROW value — single letter A-E",
      "column_number": "COLOM value — numeric string 1-73",
      "meters_finish": <numeric value from FINISH MTR KE column>
    }
  ]
}

Rules:
- The form body has two side-by-side tables (rows 1-40 on the left, rows 41-80 on the right) — extract entries from both.
- CARRY-FORWARD: If any of creel_side, row_number (letter A-E), column_number (number 1-73), or meters_finish is blank in a row, inherit the last non-empty value seen above it in that column. Never emit an empty value for any field.
- Skip a row only if it is entirely blank (all four fields empty with no carry-forward value available).
- meters_finish must be a number (not a string).
- If a header field is illegible or missing, use an empty string.
- Read the handwriting from the image itself. The transcription below is a machine reading of the same form, given as a hint only; where they disagree, trust the image.

Transcription:
{$ocrText}
PROMPT;

            $extracted = $reader->extractJson($file, $model, $prompt);
        } catch (LlmException $e) {
            Log::error('Finish-earlier scan failed', ['model' => $model, 'error' => $e->getMessage()]);
            if ($e->providerCode === 'MODEL_NOT_ALLOWED') {
                $catalog->refresh();

                return response()->json(['message' => "The model \"{$model}\" is no longer available. Pick another one."], 422);
            }

            return response()->json(['message' => 'The form could not be read. Try again in a moment.'], 502);
        }

        $extracted['metadata'] = (array) ($extracted['metadata'] ?? []);
        $extracted['entries'] = array_values((array) ($extracted['entries'] ?? []));
        $extracted['_ocr_text'] = $ocrText;
        $extracted['_model'] = $model;

        return response()->json($extracted);
    }
}
