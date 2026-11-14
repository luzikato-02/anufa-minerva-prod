<?php

namespace Tests\Feature;

use App\Ai\Tools\StockSheetsTool;
use App\Ai\Tools\TensionProblemsTool;
use App\Ai\Tools\TensionRecordsTool;
use App\Ai\Tools\TorqueChecksTool;
use App\Models\AiConversation;
use App\Models\AiToolRun;
use App\Models\CreelType;
use App\Models\StockSheet;
use App\Models\TensionRecord;
use App\Models\TorqueCheckReading;
use App\Models\TorqueCheckSheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Http;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class AiChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['ai.provider.key' => 'test-key', 'ai.chat.model' => 'test-model', 'ai.chat.timezone' => 'Asia/Jakarta']);
        Carbon::setTestNow(Carbon::parse('2026-11-14 03:00:00', 'UTC')); // 10:00 in Jakarta
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(array $perms): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    private function twisting(string $machine, array $readings, array $extra = []): TensionRecord
    {
        return TensionRecord::create(array_replace_recursive([
            'record_type' => 'twisting',
            'csv_data' => '',
            'form_data' => ['specTens' => 100, 'tensPlus' => 10, 'machineNumber' => $machine, 'productionOrder' => 'PO-1'],
            'measurement_data' => $readings,
            'problems' => [],
            'metadata' => ['machine_number' => $machine, 'operator' => 'Ana', 'item_number' => 'IT-9', 'total_measurements' => 4, 'completed_measurements' => 4],
        ], $extra));
    }

    private static function completion(array $message): array
    {
        return ['choices' => [['message' => ['role' => 'assistant'] + $message]], 'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 5]];
    }

    private static function toolCall(string $name, array $args, string $id = 'call1'): array
    {
        return self::completion(['content' => '', 'tool_calls' => [
            ['id' => $id, 'type' => 'function', 'function' => ['name' => $name, 'arguments' => json_encode($args)]],
        ]]);
    }

    public function test_the_chat_needs_its_permission(): void
    {
        $user = $this->user(['tension-records.view']);
        $this->actingAs($user)->get('/ai-chat')->assertForbidden();
        $this->actingAs($user)->postJson('/ai-chat/messages', ['message' => 'hi'])->assertForbidden();

        $this->withoutVite()->actingAs($this->user(['ai-chat.use']))->get('/ai-chat')->assertOk();
    }

    public function test_a_question_runs_the_tool_the_model_asks_for_and_returns_the_answer_with_sources(): void
    {
        $this->twisting('2704', ['1' => ['max' => 105, 'min' => 95], '2' => ['max' => 120, 'min' => 98]]);
        Http::fakeSequence()
            ->push(self::toolCall('tension_records', ['group_by' => 'machine']))
            ->push(self::completion(['content' => 'Machine 2704 had 1 of 2 positions out of spec.']));

        $user = $this->user(['ai-chat.use', 'tension-records.view']);
        $res = $this->actingAs($user)->postJson('/ai-chat/messages', ['message' => 'Which machines were out of spec?'])
            ->assertOk()
            ->assertJsonPath('data.conversation.title', 'Which machines were out of spec?')
            ->assertJsonPath('data.messages.0.role', 'user')
            ->assertJsonPath('data.messages.1.content', 'Machine 2704 had 1 of 2 positions out of spec.')
            ->assertJsonPath('data.messages.1.sources.0.tool', 'tension_records')
            ->assertJsonPath('data.messages.1.sources.0.rows', 1);

        // The second model call carried the tool result, computed from the stored readings.
        $recorded = Http::recorded();
        $this->assertCount(2, $recorded);
        $second = $recorded[1][0]->data()['messages'];
        $toolMessage = collect($second)->firstWhere('role', 'tool');
        $result = json_decode($toolMessage['content'], true);
        $this->assertSame('call1', $toolMessage['tool_call_id']);
        $this->assertSame('2704', $result['groups'][0]['machine']);
        $this->assertSame(1, $result['groups'][0]['positions_out_of_spec']);
        $this->assertEquals(50.0, $result['groups'][0]['out_of_spec_pct']);

        // The conversation reloads with the same visible transcript.
        $id = $res->json('data.conversation.id');
        $this->actingAs($user)->getJson("/ai-chat/conversations/{$id}")
            ->assertOk()
            ->assertJsonCount(2, 'data.messages');
        $this->assertSame(1, AiToolRun::count());
    }

    public function test_the_model_is_only_offered_tools_for_modules_the_user_can_view(): void
    {
        Http::fake(['*' => Http::response(self::completion(['content' => 'ok']))]);
        $user = $this->user(['ai-chat.use', 'stock-take.view']);

        $this->actingAs($user)->postJson('/ai-chat/messages', ['message' => 'hello'])->assertOk();

        Http::assertSent(function (Request $request) {
            $names = array_column(array_column($request->data()['tools'] ?? [], 'function'), 'name');

            return $names === ['stock_sheets'];
        });
    }

    public function test_a_tool_the_user_may_not_use_is_refused_even_if_the_model_calls_it(): void
    {
        $this->twisting('1', ['1' => ['max' => 1, 'min' => 1]]);
        Http::fakeSequence()
            ->push(self::toolCall('tension_records', []))
            ->push(self::completion(['content' => 'I cannot see tension data.']));
        $user = $this->user(['ai-chat.use', 'stock-take.view']);

        $this->actingAs($user)->postJson('/ai-chat/messages', ['message' => 'tension?'])->assertOk();

        $tool = collect(Http::recorded()[1][0]->data()['messages'])->firstWhere('role', 'tool');
        $this->assertStringContainsString('not allowed', $tool['content']);
        $this->assertStringNotContainsString('positions_measured', $tool['content']);
    }

    public function test_requests_go_to_the_configured_openai_compatible_endpoint(): void
    {
        config(['ai.provider.base_url' => 'https://octa.example/v1']);
        Http::fake(['*' => Http::response(self::completion(['content' => 'ok']))]);

        $this->actingAs($this->user(['ai-chat.use']))->postJson('/ai-chat/messages', ['message' => 'hi'])->assertOk();

        Http::assertSent(fn (Request $r) => $r->url() === 'https://octa.example/v1/chat/completions'
            && $r->hasHeader('Authorization', 'Bearer test-key')
            && $r['model'] === 'test-model');
    }

    public function test_the_chat_says_so_when_the_provider_is_not_configured(): void
    {
        config(['ai.provider.key' => null]);
        Http::fake();

        $this->actingAs($this->user(['ai-chat.use']))->postJson('/ai-chat/messages', ['message' => 'hi'])->assertStatus(503);
        Http::assertNothingSent();
        $this->assertSame(0, AiConversation::count());
    }

    public function test_a_failed_provider_call_leaves_no_half_turn_behind(): void
    {
        Http::fake(['*' => Http::response('boom', 500)]);
        $user = $this->user(['ai-chat.use']);

        $this->actingAs($user)->postJson('/ai-chat/messages', ['message' => 'hi'])->assertStatus(502);
        $this->assertSame(0, AiConversation::withTrashed()->count());
    }

    public function test_the_tool_loop_stops_after_the_round_limit(): void
    {
        config(['ai.chat.max_tool_rounds' => 2]);
        Http::fakeSequence()
            ->push(self::toolCall('stock_sheets', [], 'a'))
            ->push(self::toolCall('stock_sheets', [], 'b'))
            ->push(self::completion(['content' => 'Done.']));
        $user = $this->user(['ai-chat.use', 'stock-take.view']);

        $this->actingAs($user)->postJson('/ai-chat/messages', ['message' => 'stock'])
            ->assertOk()->assertJsonPath('data.messages.1.content', 'Done.');
        $this->assertArrayNotHasKey('tools', Http::recorded()[2][0]->data());
    }

    public function test_users_cannot_see_each_others_conversations(): void
    {
        $owner = $this->user(['ai-chat.use']);
        $other = $this->user(['ai-chat.use']);
        $c = AiConversation::create(['user_id' => $owner->id, 'title' => 'mine', 'model' => 'm']);

        $this->actingAs($other)->getJson("/ai-chat/conversations/{$c->id}")->assertNotFound();
        $this->actingAs($other)->postJson('/ai-chat/messages', ['conversation_id' => $c->id, 'message' => 'x'])->assertNotFound();
        $this->actingAs($other)->getJson('/ai-chat/conversations')->assertJsonCount(0, 'data');
    }

    public function test_tension_tool_filters_and_summarises_weaving_and_twisting_readings(): void
    {
        $this->twisting('2704', ['1' => ['max' => 105, 'min' => 95], '2' => ['max' => 112, 'min' => 99]]);
        $this->twisting('2705', ['1' => ['max' => 100, 'min' => 100]]);
        TensionRecord::create([
            'record_type' => 'weaving', 'csv_data' => '',
            'form_data' => ['specTens' => 50, 'tensPlus' => 5],
            'measurement_data' => ['AI' => ['1' => ['A' => ['max' => 54, 'min' => 44]]]],
            'problems' => [['id' => 'p', 'status' => 'open']],
            'metadata' => ['machine_number' => 'L1'],
        ]);
        $old = $this->twisting('2704', ['1' => ['max' => 500, 'min' => 0]]);
        $old->forceFill(['created_at' => now()->subDays(60)])->save();

        $user = $this->user([]);
        $tool = new TensionRecordsTool;

        $one = $tool->run(['machine' => '2704'], $user)->data;
        $this->assertSame(1, $one['totals']['records']);
        $this->assertSame(1, $one['records'][0]['positions_out_of_spec']);
        $this->assertEquals(108.5, $one['records'][0]['mean_max']);

        $weaving = $tool->run(['record_type' => 'weaving'], $user)->data;
        $this->assertSame(1, $weaving['totals']['positions_out_of_spec']); // min 44 < 45
        $this->assertSame(1, $weaving['totals']['open_problems']);

        $all = $tool->run(['group_by' => 'record_type'], $user)->data;
        $this->assertSame(3, $all['totals']['records']); // the 60-day-old record is outside the default window

        $wide = $tool->run(['date_from' => '2026-09-01', 'machine' => '2704'], $user)->data;
        $this->assertSame(2, $wide['totals']['records']);
    }

    public function test_tension_problems_tool_reports_resolution_times(): void
    {
        $this->twisting('2704', [], ['problems' => [
            ['id' => 'a', 'description' => 'Broken yarn', 'timestamp' => '2026-11-13T01:00:00Z', 'status' => 'resolved',
                'resolution' => ['action' => 'Replaced guide', 'resolved_at' => '2026-11-13T04:00:00Z']],
            ['id' => 'b', 'description' => 'Loose spindle', 'timestamp' => '2026-11-14T01:00:00Z', 'status' => 'open'],
        ]]);

        $data = (new TensionProblemsTool)->run(['status' => 'all'], $this->user([]))->data;
        $this->assertSame(2, $data['totals']['problems']);
        $this->assertSame(1, $data['totals']['open']);
        $this->assertEquals(3.0, $data['totals']['median_hours_to_resolve']);
        $this->assertSame('Loose spindle', $data['problems'][0]['description']);
        $this->assertSame('2026-11-14 08:00', $data['problems'][0]['reported_at']); // Jakarta time

        $search = (new TensionProblemsTool)->run(['search' => 'yarn'], $this->user([]))->data;
        $this->assertSame('Replaced guide', $search['problems'][0]['resolution_action']);
    }

    public function test_stock_and_torque_tools_aggregate_their_rows(): void
    {
        $sheet = StockSheet::create(['sheet_date' => '2026-11-10', 'leader' => 'Budi']);
        $sheet->rows()->createMany([
            ['line_no' => 1, 'material_code' => 'MAT-A', 'batch' => 'B1', 'chs' => 10, 'actual_weight' => 25.5],
            ['line_no' => 2, 'material_code' => 'MAT-A', 'batch' => 'B2', 'chs' => 4, 'actual_weight' => 10],
            ['line_no' => 3, 'material_code' => 'MAT-B', 'batch' => 'B3', 'chs' => 1, 'actual_weight' => null],
        ]);
        $stock = (new StockSheetsTool)->run(['group_by' => 'material_code'], $this->user([]))->data;
        $this->assertSame('MAT-A', $stock['groups'][0]['material_code']);
        $this->assertEquals(35.5, $stock['groups'][0]['counted_weight_kg']);
        $this->assertSame(14, $stock['groups'][0]['bobbins_counted']);
        $this->assertSame(1, $stock['totals']['lines_without_weight']);
        $filtered = (new StockSheetsTool)->run(['material_code' => 'mat-b'], $this->user([]))->data;
        $this->assertSame(1, $filtered['totals']['lines']);

        $type = CreelType::create(['name' => 'Standard', 'torque_min' => 6.0, 'torque_max' => 8.0]);
        $check = TorqueCheckSheet::create(['check_date' => '2026-11-12', 'operator_name' => 'Ana', 'machine_number' => '2704', 'creel_type_id' => $type->id]);
        foreach ([['A', 7.0], ['B', 9.5], ['C', 5.0]] as [$col, $value]) {
            TorqueCheckReading::create(['torque_check_sheet_id' => $check->id, 'side' => 'Ai', 'row_no' => 1, 'column_letter' => $col, 'value' => $value]);
        }
        $torque = (new TorqueChecksTool)->run([], $this->user([]))->data;
        $this->assertSame(3, $torque['groups'][0]['readings']);
        $this->assertSame(2, $torque['groups'][0]['out_of_range']);
        $bad = (new TorqueChecksTool)->run(['group_by' => 'none'], $this->user([]))->data;
        $this->assertEqualsCanonicalizing(['1B', '1C'], array_column($bad['out_of_range_readings'], 'position'));
    }
}
