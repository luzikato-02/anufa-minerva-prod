<?php

namespace Tests\Feature\Api;

use App\Models\TensionRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class TensionIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    private function payload(array $extra = []): array
    {
        return $extra + [
            'record_type' => 'twisting',
            'csv_data' => 'a,b',
            'form_data' => ['machineNumber' => 'T-1'],
            'measurement_data' => ['1' => ['max' => 40, 'min' => 38]],
            'problems' => [],
            'metadata' => ['total_measurements' => 1, 'completed_measurements' => 1, 'progress_percentage' => 100],
        ];
    }

    private function operator(): User
    {
        Permission::findOrCreate('tension-records.create', 'web');

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo('tension-records.create');
    }

    public function test_replaying_the_same_client_uuid_does_not_create_a_duplicate(): void
    {
        $user = $this->operator();
        $uuid = 'b3c1d7a4-6f0e-4a55-9a4e-0d9d3c1f2a11';

        $first = $this->actingAs($user, 'sanctum')->postJson('/api/v1/tension-records', $this->payload(['client_uuid' => $uuid]))->assertCreated();
        $second = $this->actingAs($user, 'sanctum')->postJson('/api/v1/tension-records', $this->payload(['client_uuid' => $uuid]))->assertOk();

        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame(1, TensionRecord::count());
    }

    public function test_records_without_a_client_uuid_still_save_normally(): void
    {
        $user = $this->operator();

        $this->actingAs($user, 'sanctum')->postJson('/api/v1/tension-records', $this->payload())->assertCreated();
        $this->actingAs($user, 'sanctum')->postJson('/api/v1/tension-records', $this->payload())->assertCreated();

        $this->assertSame(2, TensionRecord::count());
    }

    public function test_client_uuid_must_be_a_uuid(): void
    {
        $this->actingAs($this->operator(), 'sanctum')
            ->postJson('/api/v1/tension-records', $this->payload(['client_uuid' => 'not-a-uuid']))
            ->assertStatus(422)->assertJsonValidationErrors('client_uuid');
    }
}
