<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Mistral
    |--------------------------------------------------------------------------
    |
    | The key stays in services.mistral.key, shared with OCR. The base URL is
    | here so a self-hosted, OpenAI-compatible server (e.g. vLLM running
    | Mistral's open weights) can replace the hosted API without code changes.
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
        // Runs the tool loop; needs reliable function calling. mistral-large-latest is better at it but is
        // not on every Mistral subscription tier.
        'model' => env('AI_CHAT_MODEL', 'mistral-medium-latest'),
        // Cheap jobs such as naming a conversation.
        'small_model' => env('AI_CHAT_SMALL_MODEL', 'mistral-small-latest'),
        'temperature' => (float) env('AI_CHAT_TEMPERATURE', 0.1),
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
