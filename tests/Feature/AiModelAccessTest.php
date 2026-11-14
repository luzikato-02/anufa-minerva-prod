<?php

namespace Tests\Feature;

use App\Models\AiConversation;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Sleep;
use Inertia\Testing\AssertableInertia;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/** Per-user AI model access (set by an admin) and the OCR features that now run on the AI provider. */
class AiModelAccessTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['ai.provider.key' => 'test-key', 'ai.chat.model' => 'test-model']);
        Cache::put('ai-chat:models', ['test-model', 'other-model', 'third-model'], 600);
        Sleep::fake();
    }

    private function user(array $perms, array $attributes = []): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create($attributes)->givePermissionTo($perms);
    }

    private static function reply(string $content): array
    {
        return ['choices' => [['message' => ['role' => 'assistant', 'content' => $content]]], 'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 5]];
    }

    public function test_the_chat_refuses_a_model_the_user_is_not_allowed_with_the_admin_message(): void
    {
        Http::fake();
        $user = $this->user(['ai-chat.use'], ['ai_allowed_models' => ['test-model']]);

        $this->actingAs($user)->postJson('/ai-chat/messages', ['message' => 'Hi', 'model' => 'other-model'])
            ->assertForbidden()
            ->assertJson(['code' => 'model_not_permitted', 'model' => 'other-model']);

        Http::assertNothingSent();
        $this->assertSame(0, AiConversation::count());
    }

    public function test_a_user_with_no_models_enabled_is_refused(): void
    {
        Http::fake();
        $user = $this->user(['ai-chat.use'], ['ai_allowed_models' => []]);

        $this->actingAs($user)->postJson('/ai-chat/messages', ['message' => 'Hi'])
            ->assertForbidden()
            ->assertJson(['code' => 'model_not_permitted', 'model' => null]);
    }

    public function test_without_a_choice_the_chat_runs_on_the_users_default_model(): void
    {
        Http::fake(['*/chat/completions' => Http::response(self::reply('Hello'))]);
        $user = $this->user(['ai-chat.use'], ['ai_default_model' => 'third-model']);

        $this->actingAs($user)->postJson('/ai-chat/messages', ['message' => 'Hi'])->assertOk();

        Http::assertSent(fn (Request $r) => $r['model'] === 'third-model');
    }

    public function test_the_page_lists_every_model_and_marks_which_the_user_may_use(): void
    {
        $user = $this->user(['ai-chat.use'], ['ai_allowed_models' => ['other-model', 'third-model'], 'ai_default_model' => 'third-model']);

        $this->withoutVite()->actingAs($user)->get('/ai-chat')->assertInertia(fn (AssertableInertia $page) => $page
            ->where('models', ['test-model', 'other-model', 'third-model'])
            ->where('allowedModels', ['other-model', 'third-model'])
            ->where('defaultModel', 'third-model'));

        $this->actingAs($user)->getJson('/ai/models')->assertOk()->assertJson([
            'allowedModels' => ['other-model', 'third-model'],
            'defaultModel' => 'third-model',
        ]);
    }

    public function test_a_default_the_user_may_not_use_falls_back_to_their_first_allowed_model(): void
    {
        $user = $this->user([], ['ai_allowed_models' => ['third-model'], 'ai_default_model' => 'test-model']);

        $this->actingAs($user)->getJson('/ai/models')->assertJson(['defaultModel' => 'third-model']);
    }

    public function test_an_admin_sets_a_users_models_and_default(): void
    {
        $admin = $this->user(['users.view', 'users.manage']);
        $user = $this->user([]);

        $this->actingAs($admin)->getJson('/api/ai-models')
            ->assertOk()->assertJson(['models' => ['test-model', 'other-model', 'third-model'], 'systemDefault' => 'test-model']);

        $this->actingAs($admin)->putJson("/api/users/{$user->id}/ai-models", [
            'allowed_models' => ['other-model', 'third-model'],
            'default_model' => 'other-model',
        ])->assertOk()->assertJson(['ai_allowed_models' => ['other-model', 'third-model'], 'ai_default_model' => 'other-model']);

        $user->refresh();
        $this->assertTrue($user->canUseAiModel('other-model'));
        $this->assertFalse($user->canUseAiModel('test-model'));

        // Back to every model.
        $this->actingAs($admin)->putJson("/api/users/{$user->id}/ai-models", ['allowed_models' => null, 'default_model' => null])
            ->assertOk();
        $this->assertTrue($user->fresh()->canUseAiModel('test-model'));
    }

    public function test_the_admin_endpoint_rejects_bad_settings_and_non_admins(): void
    {
        $admin = $this->user(['users.view', 'users.manage']);
        $user = $this->user([]);

        $this->actingAs($admin)->putJson("/api/users/{$user->id}/ai-models", [
            'allowed_models' => ['other-model'], 'default_model' => 'test-model',
        ])->assertUnprocessable()->assertJsonValidationErrors('default_model');

        $this->actingAs($admin)->putJson("/api/users/{$user->id}/ai-models", [
            'allowed_models' => ['made-up-model'], 'default_model' => null,
        ])->assertUnprocessable()->assertJsonValidationErrors('allowed_models.0');

        $this->actingAs($this->user(['users.view']))->putJson("/api/users/{$user->id}/ai-models", [
            'allowed_models' => null, 'default_model' => null,
        ])->assertForbidden();
    }

    public function test_document_intelligence_reads_the_file_with_the_users_model_page_by_page(): void
    {
        Http::fake(['*/chat/completions' => Http::response(self::reply("```markdown\n# Page one\n<<<PAGE BREAK>>>\nPage two\n```"))]);
        $user = $this->user([], ['ai_default_model' => 'other-model']);

        $this->actingAs($user)->post('/document-intelligence/process', [
            'file' => UploadedFile::fake()->image('scan.png'),
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJson(['model' => 'other-model', 'pages' => [
                ['index' => 0, 'markdown' => '# Page one'],
                ['index' => 1, 'markdown' => 'Page two'],
            ]]);

        Http::assertSent(fn (Request $r) => $r['model'] === 'other-model'
            && $r['messages'][0]['content'][1]['type'] === 'image_url'
            && str_starts_with($r['messages'][0]['content'][1]['image_url']['url'], 'data:image/png;base64,'));
    }

    public function test_a_pdf_goes_to_the_model_as_a_file_part(): void
    {
        Http::fake(['*/chat/completions' => Http::response(self::reply('Invoice'))]);

        $this->actingAs($this->user([]))->post('/document-intelligence/process', [
            'file' => UploadedFile::fake()->createWithContent('doc.pdf', "%PDF-1.4\n%%EOF"),
        ], ['Accept' => 'application/json'])->assertOk();

        Http::assertSent(fn (Request $r) => $r['messages'][0]['content'][1]['type'] === 'file'
            && str_starts_with($r['messages'][0]['content'][1]['file']['file_data'], 'data:application/pdf;base64,'));
    }

    public function test_document_intelligence_refuses_a_model_the_user_is_not_allowed(): void
    {
        Http::fake();
        $user = $this->user([], ['ai_allowed_models' => ['test-model']]);

        $this->actingAs($user)->post('/document-intelligence/process', [
            'file' => UploadedFile::fake()->image('scan.png'),
            'model' => 'third-model',
        ], ['Accept' => 'application/json'])
            ->assertForbidden()
            ->assertJson(['code' => 'model_not_permitted', 'model' => 'third-model']);

        Http::assertNothingSent();
    }

    public function test_the_finish_earlier_scan_transcribes_then_extracts_entries(): void
    {
        Http::fakeSequence('*/chat/completions')
            ->push(self::reply('MC 2704 | AO A 12 1500'))
            ->push(self::reply("Here it is:\n```json\n{\"metadata\":{\"machine_number\":\"2704\"},\"entries\":[{\"creel_side\":\"AO\",\"row_number\":\"A\",\"column_number\":\"12\",\"meters_finish\":1500}]}\n```"));
        $user = $this->user(['finish-earlier.create']);

        $this->actingAs($user)->post('/finish-earlier-scan/extract', [
            'file' => UploadedFile::fake()->image('form.jpg'),
            'model' => 'other-model',
        ], ['Accept' => 'application/json'])
            ->assertOk()
            ->assertJson([
                'metadata' => ['machine_number' => '2704'],
                'entries' => [['creel_side' => 'AO', 'meters_finish' => 1500]],
                '_ocr_text' => 'MC 2704 | AO A 12 1500',
                '_model' => 'other-model',
            ]);

        Http::assertSentCount(2);
        // The extraction looks at the form again, with the transcription as a hint.
        Http::assertSent(fn (Request $r) => str_contains($r['messages'][0]['content'][0]['text'], 'MC 2704 | AO A 12 1500')
            && $r['messages'][0]['content'][1]['type'] === 'image_url');
    }
}
