<?php

namespace App\Http\Controllers\Api;

use App\Ai\Mistral\MistralClient;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class FinishEarlierScanController extends Controller
{
    public function extract(Request $request, MistralClient $mistral)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,png,jpg,jpeg,webp|max:20480',
        ]);

        $file    = $request->file('file');
        $mime    = $file->getMimeType();
        $base64  = base64_encode(file_get_contents($file->getPathname()));
        $dataUrl = "data:{$mime};base64,{$base64}";

        // Step 1: OCR
        $ocrData = $mistral->ocr($dataUrl, $mime);
        $ocrText = collect($ocrData['pages'] ?? [])->pluck('markdown')->implode("\n\n");

        // Step 2: structured extraction
        $prompt = <<<PROMPT
You are extracting data from a scanned handwritten form titled "CATATAN CABLE FINISH EARLIER" (a manufacturing cable finish-earlier record form written in Bahasa Indonesia).

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

OCR text from the form:
{$ocrText}
PROMPT;

        $chatData = $mistral->chat('mistral-small-latest', [
            ['role' => 'user', 'content' => $prompt],
        ], options: ['response_format' => ['type' => 'json_object']]);

        $extracted = json_decode($chatData['choices'][0]['message']['content'], true);

        $extracted['_ocr_text'] = $ocrText;

        return response()->json($extracted);
    }
}
