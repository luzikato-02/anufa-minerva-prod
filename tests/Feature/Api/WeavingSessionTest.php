<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class WeavingSessionTest extends TestCase
{
    use RefreshDatabase;

    private function operator(): User
    {
        foreach (['tension-records.create', 'tension-records.edit'] as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo(['tension-records.create', 'tension-records.edit']);
    }

    public function test_session_can_be_started_resumed_autosaved_and_completed(): void
    {
        $u = $this->operator();
        $form = ['productionOrder' => 'PO-1', 'machineNumber' => 'W-3', 'operator' => 'Budi'];

        $id = $this->actingAs($u, 'sanctum')->postJson('/api/v1/tension-records/start-session', ['form_data' => $form])
            ->assertCreated()->json('data.id');

        // Starting again for the same PO resumes instead of duplicating.
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/tension-records/start-session', ['form_data' => $form])
            ->assertOk()->assertJsonPath('data.id', $id);

        $this->actingAs($u, 'sanctum')->getJson('/api/v1/tension-records/session/PO-1')
            ->assertOk()->assertJsonPath('data.id', $id);

        $grid = ['AI' => ['A' => ['1' => ['max' => 31, 'min' => 29, 'updatedAt' => '2026-09-18T03:00:00Z']]], 'BI' => [], 'AO' => [], 'BO' => []];
        $this->actingAs($u, 'sanctum')->putJson("/api/v1/tension-records/$id", [
            'measurement_data' => $grid,
            'metadata' => ['status' => 'in_progress', 'completed_measurements' => 1],
            'client_uuid' => '11111111-1111-4111-8111-111111111111', // extra key from the queue is ignored
        ])->assertOk();
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/tension-records/session/PO-1')
            ->assertJsonPath('data.measurement_data.AI.A.1.max', 31);

        $this->actingAs($u, 'sanctum')->putJson("/api/v1/tension-records/$id", ['metadata' => ['status' => 'completed']])->assertOk();
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/tension-records/session/PO-1')->assertNotFound();
    }

    public function test_a_one_shot_record_without_status_stays_resumable_so_the_app_sends_completed(): void
    {
        $u = $this->operator();
        $base = [
            'record_type' => 'weaving', 'csv_data' => 'x', 'form_data' => ['productionOrder' => 'PO-2'], 'measurement_data' => ['AI' => ['A' => ['1' => ['max' => 1, 'min' => 1]]]],
            'metadata' => ['total_measurements' => 1, 'completed_measurements' => 1, 'progress_percentage' => 100],
        ];

        // Documents the server behaviour the mobile app works around by always sending `status`.
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/tension-records', $base)->assertCreated();
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/tension-records/session/PO-2')->assertOk();

        $base['form_data']['productionOrder'] = 'PO-3';
        $base['metadata']['status'] = 'completed';
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/tension-records', $base)->assertCreated();
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/tension-records/session/PO-3')->assertNotFound();
    }
}
