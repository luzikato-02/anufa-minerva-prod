<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class DocumentIntelligenceController extends Controller
{
    public function process(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,png,jpg,jpeg,webp|max:20480',
        ]);

        $file    = $request->file('file');
        $mime    = $file->getMimeType();
        $base64  = base64_encode(file_get_contents($file->getPathname()));
        $dataUrl = "data:{$mime};base64,{$base64}";

        // Mistral OCR uses "document_url" for PDFs, "image_url" for images
        $type = str_contains($mime, 'pdf') ? 'document_url' : 'image_url';

        try {
            $client   = new \GuzzleHttp\Client(['timeout' => 120]);
            $response = $client->post('https://api.mistral.ai/v1/ocr', [
                'headers' => [
                    'Authorization' => 'Bearer ' . config('services.mistral.key'),
                    'Content-Type'  => 'application/json',
                ],
                'json' => [
                    'model'    => 'mistral-ocr-latest',
                    'document' => [
                        'type' => $type,
                        $type  => $dataUrl,
                    ],
                ],
            ]);

            return response()->json(json_decode($response->getBody(), true));
        } catch (\GuzzleHttp\Exception\RequestException $e) {
            $body = $e->hasResponse()
                ? (string) $e->getResponse()->getBody()
                : $e->getMessage();

            return response()->json(['error' => $body], 500);
        }
    }
}
