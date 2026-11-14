<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Data chat provider
    |--------------------------------------------------------------------------
    |
    | Any OpenAI-compatible chat-completions API. Defaults to Telkomsel OCTA,
    | which serves Claude, GPT, Gemini, DeepSeek and Kimi behind one key; the
    | model ids it accepts are listed by `php artisan ai:models`.
    |
    */

    'provider' => [
        'base_url' => env('AI_BASE_URL', 'https://octa.telkomsel.com/v1'),
        'key' => env('AI_API_KEY'),
        'timeout' => (int) env('AI_TIMEOUT', 90),
    ],

    /*
    |--------------------------------------------------------------------------
    | Mistral (OCR only)
    |--------------------------------------------------------------------------
    |
    | Document Intelligence and the finish-earlier scan still use Mistral OCR.
    | The key stays in services.mistral.key.
    |
    */

    'mistral' => [
        'base_url' => env('MISTRAL_BASE_URL', 'https://api.mistral.ai/v1'),
        'timeout' => (int) env('MISTRAL_TIMEOUT', 90),
    ],

    /*
    |--------------------------------------------------------------------------
    | Data chat
    |--------------------------------------------------------------------------
    */

    'chat' => [
        // Runs the tool loop, so it needs reliable function calling. A provider model id, e.g. one listed
        // by `php artisan ai:models`.
        'model' => env('AI_CHAT_MODEL'),
        // Left out of requests unless set: OCTA's Claude models reject a temperature field.
        'temperature' => env('AI_CHAT_TEMPERATURE'),
        // Tool rounds per question before the agent is made to answer with what it has.
        'max_tool_rounds' => (int) env('AI_CHAT_MAX_TOOL_ROUNDS', 6),
        // Earlier messages sent back to the model with each question.
        'history_messages' => (int) env('AI_CHAT_HISTORY_MESSAGES', 20),
        // Rows a tool may return to the model in one call.
        'max_tool_rows' => (int) env('AI_CHAT_MAX_TOOL_ROWS', 200),
        // Questions per user per hour.
        'rate_limit_per_hour' => (int) env('AI_CHAT_RATE_LIMIT', 30),
        // The plant's timezone: "today" and date filters are read in it (the database stores UTC).
        'timezone' => env('AI_TIMEZONE', 'Asia/Jakarta'),
    ],

];
