<?php

namespace App\Ai\Llm;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/**
 * Chat completions against any OpenAI-compatible API. The data chat uses Telkomsel OCTA by default
 * (https://octa.telkomsel.com/v1), which routes to Claude, GPT, Gemini, DeepSeek or Kimi by model id;
 * switching provider is a matter of AI_BASE_URL, AI_API_KEY and AI_CHAT_MODEL.
 */
class LlmClient
{
    private function http(?int $timeout = null): PendingRequest
    {
        $key = config('ai.provider.key');
        if (! $key) {
            throw new LlmException('AI_API_KEY is not set.');
        }

        return Http::baseUrl(rtrim((string) config('ai.provider.base_url'), '/'))
            ->withToken($key)
            ->acceptJson()
            ->asJson()
            ->timeout($timeout ?? (int) config('ai.provider.timeout'))
            // Retry rate limits, server errors and OCTA's gateway errors (it reports a failed upstream call
            // as a 400 UPSTREAM_ERROR_*, and they pass on retry). Any other 4xx is our fault and won't improve.
            ->retry([1000, 2000, 4000], fn ($e) => $e instanceof RequestException && self::retryable($e->response), throw: false);
    }

    private static function retryable(\Illuminate\Http\Client\Response $response): bool
    {
        return $response->status() === 429
            || $response->serverError()
            || str_starts_with((string) $response->json('error'), 'UPSTREAM_ERROR');
    }

    /**
     * POST /chat/completions. Returns the decoded response body.
     *
     * @param  array<int, array<string, mixed>>  $messages
     * @param  array<int, array<string, mixed>>  $tools  in the {type: function, function: {...}} shape
     * @param  array<string, mixed>  $options  extra body fields, e.g. temperature
     * @param  int|null  $timeout  seconds; defaults to AI_TIMEOUT
     */
    public function chat(string $model, array $messages, array $tools = [], array $options = [], ?int $timeout = null): array
    {
        $body = ['model' => $model, 'messages' => $messages] + $options;
        if ($tools) {
            $body['tools'] = $tools;
            $body['tool_choice'] = $body['tool_choice'] ?? 'auto';
        }

        return $this->send('post', '/chat/completions', $body, $timeout);
    }

    /** GET /models: the model ids the key can use. */
    public function models(): array
    {
        return array_values(array_filter(array_map(
            fn ($m) => is_array($m) ? ($m['id'] ?? null) : null,
            $this->send('get', '/models', timeout: 10)['data'] ?? [],
        )));
    }

    private function send(string $method, string $path, array $body = [], ?int $timeout = null): array
    {
        try {
            $http = $this->http($timeout);
            $response = $method === 'get' ? $http->get($path) : $http->post($path, $body);
        } catch (ConnectionException $e) {
            throw new LlmException('Could not reach the AI provider: '.$e->getMessage(), previous: $e);
        }

        if ($response->failed()) {
            throw new LlmException(
                "The AI provider returned HTTP {$response->status()}: ".mb_substr($response->body(), 0, 500),
                $response->status(),
                providerCode: is_string($response->json('error')) ? $response->json('error') : null,
            );
        }

        return $response->json() ?? [];
    }
}
