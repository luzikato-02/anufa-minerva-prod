<?php

namespace Tests\Feature\Api;

use App\Models\StockTakingRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class StockTakeApiTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $perms = ['stock-take.view', 'stock-take.create']): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    private function makeSession(string $status = 'In Progress'): StockTakingRecord
    {
        return StockTakingRecord::create([
            'session_id' => '123456',
            'indv_batch_data' => [
                ['batch_number' => 'B1', 'material_code' => 'M1', 'material_description' => 'Yarn', 'weight' => '12.5', 'bobbin_qty' => '4'],
                ['Batch Number' => 'B2', 'Material Code' => 'M2', 'Material Desciption' => 'Tape'],
            ],
            'metadata' => ['total_batches' => 2, 'total_checked_batches' => 0, 'total_materials' => 2, 'session_leader' => 'Ana', 'session_status' => $status],
        ]);
    }

    private function batch(array $extra = []): array
    {
        return $extra + [
            'session_id' => '123456', 'batch_number' => 'B1', 'material_code' => 'M1', 'material_description' => 'Yarn',
            'actual_weight' => 12.5, 'total_bobbins' => 4, 'line_position' => 3, 'row_position' => 'A',
            'found_by' => 'Ana', 'found_at' => '2026-09-19T03:00:00Z',
        ];
    }

    public function test_session_lookup_returns_the_batch_list_for_offline_caching(): void
    {
        $this->makeSession();

        $this->actingAs($this->user(), 'sanctum')->getJson('/api/v1/stock-take-records/session/123456')
            ->assertOk()->assertJsonPath('success', true)->assertJsonCount(2, 'data.indv_batch_data');
        $this->actingAs($this->user(), 'sanctum')->getJson('/api/v1/stock-take-records/session/nope')->assertNotFound();
    }

    public function test_replaying_a_recorded_batch_with_the_same_client_uuid_counts_once(): void
    {
        $rec = $this->makeSession();
        $uuid = '2b1f6f3e-8f57-4d0a-9c1e-6a2d7f0b9c11';

        $this->actingAs($this->user(), 'sanctum')->postJson('/api/v1/stock-take-records/record-batch', $this->batch(['client_uuid' => $uuid]))->assertCreated();
        $this->actingAs($this->user(), 'sanctum')->postJson('/api/v1/stock-take-records/record-batch', $this->batch(['client_uuid' => $uuid]))->assertOk();

        $rec->refresh();
        $this->assertCount(1, $rec->recorded_batches);
        $this->assertSame(1, $rec->total_checked_batches);
    }

    public function test_check_batch_handles_both_csv_key_styles_and_already_recorded(): void
    {
        $this->makeSession();
        $u = $this->user();

        $this->actingAs($u, 'sanctum')->getJson('/api/v1/stock-take-records/check-batch?record_key=123456&batch=B2')
            ->assertOk()->assertJsonPath('exists', true)->assertJsonPath('already_recorded', false);
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-take-records/record-batch', $this->batch())->assertCreated();
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/stock-take-records/check-batch?record_key=123456&batch=B1')
            ->assertJsonPath('already_recorded', true);
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/stock-take-records/check-batch?record_key=123456&batch=ZZ')
            ->assertJsonPath('exists', false);
    }

    public function test_dashboard_counts_sessions_regardless_of_status_casing(): void
    {
        $this->makeSession('In Progress');
        StockTakingRecord::create(['session_id' => '999999', 'indv_batch_data' => [], 'metadata' => ['total_batches' => 0, 'session_status' => 'Completed']]);

        $this->actingAs($this->user(['stock-take.view']), 'sanctum')->getJson('/api/v1/dashboard')
            ->assertJsonPath('stockTake.total', 2)
            ->assertJsonPath('stockTake.in_progress', 1)
            ->assertJsonPath('stockTake.completed', 1);
    }
}
