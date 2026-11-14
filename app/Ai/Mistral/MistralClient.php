<?php

namespace App\Ai\Mistral;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * The one place the app talks to Mistral: chat completions (with tools) and OCR.
 * Uses Laravel's Http client so tests can fake it with Http::fake().
 */
class MistralClient
{
    private function http(): PendingRequest
    {
        $key = config('services.mistral.key');
        if (! $key) {
            throw new MistralException('MISTRAL_API_KEY is not set.');
        }

        return Http::baseUrl(rtrim(config('ai.mistral.base_url'), '/'))
            ->withToken($key)
            ->acceptJson()
            ->asJson()
            ->timeout(config('ai.mistral.timeout'))
            // Retry rate limits and server errors; a 4xx other than 429 is our fault and won't improve.
            ->retry(3, 1000, fn ($e) => $e instanceof RequestException
                && ($e->response->status() === 429 || $e->response->serverError()), throw: false);
    }

    /**
     * POST /chat/completions. Returns the decoded response body.
     *
     * @param  array<int, array<string, mixed>>  $messages
     * @param  array<int, array<string, mixed>>  $tools  in Mistral's {type: function, function: {...}} shape
     * @param  array<string, mixed>  $options  extra body fields, e.g. temperature, response_format
     */
    public function chat(string $model, array $messages, array $tools = [], array $options = []): array
    {
        $body = ['model' => $model, 'messages' => $messages] + $options;
        if ($tools) {
            $body['tools'] = $tools;
            $body['tool_choice'] = $body['tool_choice'] ?? 'auto';
        }

        return $this->send('/chat/completions', $body);
    }

    /**
     * POST /ocr for a PDF or image given as a data URL. Returns the decoded response body.
     */
    public function ocr(string $dataUrl, string $mime, string $model = 'mistral-ocr-4-0'): array
    {
        // Mistral OCR takes "document_url" for PDFs and "image_url" for images.
        $type = str_contains($mime, 'pdf') ? 'document_url' : 'image_url';

        return $this->send('/ocr', [
            'model' => $model,
            'document' => ['type' => $type, $type => $dataUrl],
        ]);
    }

    private function send(string $path, array $body): array
    {
        try {
            $response = $this->http()->post($path, $body);
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            throw new MistralException('Could not reach Mistral: '.$e->getMessage(), previous: $e);
        }

        if ($response->failed()) {
            throw new MistralException(
                "Mistral returned HTTP {$response->status()}: ".mb_substr($response->body(), 0, 500),
                $response->status(),
            );
        }

        return $response->json() ?? [];
    }
}
