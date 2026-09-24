<?php

namespace Tests\Feature;

use App\Models\CreelType;
use App\Models\TorqueCheckSheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class TorqueCheckWebTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $perms): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    public function test_pages_follow_the_torque_checks_permissions(): void
    {
        $viewer = $this->user(['torque-checks.view']);
        $this->actingAs($viewer)->get('/torque-checks-main')->assertOk();
        $this->actingAs($viewer)->get('/torque-check-main')->assertForbidden();
        $this->actingAs($viewer)->get('/torque-check-session')->assertForbidden();

        $recorder = $this->user(['torque-checks.create']);
        $this->actingAs($recorder)->get('/torque-check-main')->assertOk();
        $this->actingAs($recorder)->get('/torque-check-session')->assertOk();
        $this->actingAs($recorder)->get('/torque-checks-main')->assertForbidden();
    }

    public function test_the_web_session_can_record_list_and_download_a_sheet(): void
    {
        $u = $this->user(['torque-checks.view', 'torque-checks.create', 'torque-checks.edit', 'torque-checks.delete']);
        $type = CreelType::create(['name' => 'Standard', 'torque_min' => 6.0, 'torque_max' => 8.0]);
        $reading = ['sheet_client_uuid' => '6f1d2b7e-3c53-4c0e-9f0a-1b7c2d3e4f50', 'check_date' => '2026-09-22', 'operator_name' => 'Supanto', 'machine_number' => '2704', 'side' => 'Ai', 'creel_type_id' => $type->id, 'row_no' => 1, 'column_letter' => 'A', 'value' => 7];

        $this->actingAs($u)->postJson('/torque-checks/readings', $reading)->assertCreated();
        $this->actingAs($u)->getJson('/torque-checks')->assertOk()->assertJsonPath('data.0.readings_count', 1);

        $sheet = TorqueCheckSheet::first();
        $this->actingAs($u)->getJson("/torque-checks/{$sheet->id}/download")->assertOk()->assertJsonPath('sections.0.grid.0.A', 7);
        $this->actingAs($u)->deleteJson("/torque-checks/{$sheet->id}")->assertOk();
        $this->assertSame(0, TorqueCheckSheet::count());
    }

    public function test_a_viewer_cannot_record_or_delete(): void
    {
        $viewer = $this->user(['torque-checks.view']);
        $this->actingAs($viewer)->postJson('/torque-checks/readings', [])->assertForbidden();
        $type = CreelType::create(['name' => 'Standard', 'torque_min' => 6.0, 'torque_max' => 8.0]);
        $sheet = TorqueCheckSheet::create(['check_date' => '2026-09-22', 'operator_name' => 'Ana', 'machine_number' => '1', 'creel_type_id' => $type->id]);
        $this->actingAs($viewer)->deleteJson("/torque-checks/{$sheet->id}")->assertForbidden();
        $this->assertSame(1, TorqueCheckSheet::count());
    }
}
