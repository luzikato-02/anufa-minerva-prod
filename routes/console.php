<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('ai:models', function (App\Ai\Llm\LlmClient $llm) {
    foreach ($llm->models() as $id) {
        $this->line($id);
    }
})->purpose('List the model ids the data chat provider (AI_BASE_URL / AI_API_KEY) accepts');
