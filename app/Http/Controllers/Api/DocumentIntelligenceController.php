<?php

namespace App\Http\Controllers\Api;

use App\Ai\Mistral\MistralClient;
use App\Ai\Mistral\MistralException;
use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class DocumentIntelligenceController extends Controller
{
    public function process(Request $request, MistralClient $mistral)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,png,jpg,jpeg,webp|max:20480',
        ]);

        $file    = $request->file('file');
        $mime    = $file->getMimeType();
        $base64  = base64_encode(file_get_contents($file->getPathname()));
        $dataUrl = "data:{$mime};base64,{$base64}";

        try {
            return response()->json($mistral->ocr($dataUrl, $mime));
        } catch (MistralException $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }
}
