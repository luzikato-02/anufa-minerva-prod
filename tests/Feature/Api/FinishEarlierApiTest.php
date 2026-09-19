<?php

namespace Tests\Feature\Api;

use App\Models\FinishEarlierRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class FinishEarlierApiTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $perms = ['finish-earlier.view', 'finish-earlier.create', 'finish-earlier.edit']): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    private function record(string $po, array $meta = []): FinishEarlierRecord
    {
        return FinishEarlierRecord::create([
            'metadata' => $meta + ['machine_number' => 'M1', 'style' => 'Cable X', 'production_order' => $po, 'shift_group' => 'A'],
            'entries' => [['creel_side' => 'AI', 'row_number' => 'A', 'column_number' => '1', 'meters_finish' => 100]],
        ]);
    }

    public function test_search_filters_by_production_order_style_machine_and_shift(): void
    {
        $this->record('PO-100', ['style' => 'Blue Cable']);
        $this->record('PO-200', ['machine_number' => 'ZED-9']);
        $u = $this->user();

        $ids = fn (string $q) => collect($this->actingAs($u, 'sanctum')->getJson('/api/v1/finish-earlier?search='.urlencode($q))->assertOk()->json('data'))->pluck('metadata.production_order')->all();

        $this->assertSame(['PO-100'], $ids('blue'));
        $this->assertSame(['PO-200'], $ids('zed'));
        $this->assertSame(['PO-100'], $ids('po-100'));
        $this->assertEqualsCanonicalizing(['PO-100', 'PO-200'], $ids(''));
        $this->assertSame([], $ids('nothing-matches'));
    }

    public function test_add_entry_to_a_missing_session_is_a_404_not_a_server_error(): void
    {
        $this->actingAs($this->user(), 'sanctum')
            ->postJson('/api/v1/finish-earlier/NOPE/add-entry', ['creel_side' => 'AI', 'row_number' => 'A', 'column_number' => '1', 'meters_finish' => 5])
            ->assertNotFound();
    }

    public function test_submit_scan_conflicts_then_merges_or_replaces(): void
    {
        $existing = $this->record('PO-7');
        $u = $this->user();
        $payload = fn (array $extra = []) => $extra + [
            'metadata' => ['machine_number' => 'M2', 'style' => 'S', 'production_order' => 'PO-7', 'shift_group' => 'B'],
            'entries' => [['creel_side' => 'BO', 'row_number' => 'C', 'column_number' => '9', 'meters_finish' => 300]],
        ];

        $this->actingAs($u, 'sanctum')->postJson('/api/v1/finish-earlier/submit-scan', $payload())
            ->assertStatus(409)->assertJsonPath('conflict', true)->assertJsonPath('existing.id', $existing->id)->assertJsonPath('existing.entry_count', 1);

        $this->actingAs($u, 'sanctum')->postJson('/api/v1/finish-earlier/submit-scan', $payload(['conflict_resolution' => 'merge']))
            ->assertOk()->assertJsonPath('data.metadata.total_finish_earlier', 2)->assertJsonPath('data.metadata.average_meters_finish', 200);

        $this->actingAs($u, 'sanctum')->postJson('/api/v1/finish-earlier/submit-scan', $payload(['conflict_resolution' => 'replace']))
            ->assertCreated()->assertJsonPath('data.metadata.total_finish_earlier', 1);
        $this->assertSame(1, FinishEarlierRecord::where('metadata->production_order', 'PO-7')->count());
    }

    public function test_viewers_cannot_edit_or_delete(): void
    {
        $r = $this->record('PO-9');
        $viewer = $this->user(['finish-earlier.view']);

        $this->actingAs($viewer, 'sanctum')->patchJson("/api/v1/finish-earlier/{$r->id}", ['style' => 'x'])->assertForbidden();
        $this->actingAs($viewer, 'sanctum')->deleteJson("/api/v1/finish-earlier/{$r->id}")->assertForbidden();
    }
}
