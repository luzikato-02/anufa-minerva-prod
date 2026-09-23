<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class CreelTypeSettingsWebTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $perms): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    public function test_the_settings_page_needs_creel_types_view_and_writes_need_manage(): void
    {
        $viewer = $this->user(['creel-types.view']);
        $this->actingAs($viewer)->get('/creel-type-settings')->assertOk();
        $this->actingAs($viewer)->postJson('/creel-types', ['name' => 'X', 'torque_min' => 1, 'torque_max' => 2])->assertForbidden();

        $manager = $this->user(['creel-types.view', 'creel-types.manage']);
        $this->actingAs($manager)->postJson('/creel-types', ['name' => 'X', 'torque_min' => 1, 'torque_max' => 2])->assertCreated();

        $unauthorized = $this->user([]);
        $this->actingAs($unauthorized)->get('/creel-type-settings')->assertForbidden();
    }
}
