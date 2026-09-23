<?php

namespace Tests\Feature\Api;

use App\Models\CreelType;
use App\Models\TorqueCheckReading;
use App\Models\TorqueCheckSheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class CreelTypeApiTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $perms): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    public function test_a_manager_can_create_edit_and_delete_a_creel_type(): void
    {
        $u = $this->user(['creel-types.view', 'creel-types.manage']);

        $created = $this->actingAs($u, 'sanctum')->postJson('/api/v1/creel-types', ['name' => 'Standard', 'torque_min' => 6.0, 'torque_max' => 8.0])->assertCreated();
        $id = $created->json('data.id');

        $this->actingAs($u, 'sanctum')->getJson('/api/v1/creel-types')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.name', 'Standard');

        $this->actingAs($u, 'sanctum')->patchJson("/api/v1/creel-types/{$id}", ['name' => 'Standard', 'torque_min' => 6.5, 'torque_max' => 8.0])
            ->assertOk()->assertJsonPath('data.torque_min', 6.5);

        $this->actingAs($u, 'sanctum')->deleteJson("/api/v1/creel-types/{$id}")->assertOk();
        $this->assertSame(0, CreelType::count());
    }

    public function test_max_must_not_be_below_min_and_the_name_must_be_unique(): void
    {
        $u = $this->user(['creel-types.view', 'creel-types.manage']);
        CreelType::create(['name' => 'Standard', 'torque_min' => 6.0, 'torque_max' => 8.0]);

        $this->actingAs($u, 'sanctum')->postJson('/api/v1/creel-types', ['name' => 'Bad', 'torque_min' => 8.0, 'torque_max' => 6.0])
            ->assertUnprocessable()->assertJsonValidationErrors('torque_max');
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/creel-types', ['name' => 'Standard', 'torque_min' => 6.0, 'torque_max' => 8.0])
            ->assertUnprocessable()->assertJsonValidationErrors('name');
    }

    public function test_a_creel_type_in_use_cannot_be_deleted(): void
    {
        $u = $this->user(['creel-types.view', 'creel-types.manage', 'torque-checks.create']);
        $type = CreelType::create(['name' => 'Standard', 'torque_min' => 6.0, 'torque_max' => 8.0]);
        $sheet = TorqueCheckSheet::create(['check_date' => '2026-09-22', 'operator_name' => 'Ana', 'machine_number' => '12', 'side' => 'Ai', 'creel_type_id' => $type->id]);
        TorqueCheckReading::create(['torque_check_sheet_id' => $sheet->id, 'row_no' => 1, 'column_letter' => 'A', 'value' => 7]);

        $this->actingAs($u, 'sanctum')->deleteJson("/api/v1/creel-types/{$type->id}")->assertUnprocessable();
        $this->assertSame(1, CreelType::count());
    }

    public function test_viewer_cannot_manage_creel_types(): void
    {
        $viewer = $this->user(['creel-types.view']);
        $this->actingAs($viewer, 'sanctum')->postJson('/api/v1/creel-types', ['name' => 'X', 'torque_min' => 1, 'torque_max' => 2])->assertForbidden();
    }
}
