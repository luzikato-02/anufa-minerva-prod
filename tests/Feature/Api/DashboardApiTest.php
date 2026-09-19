<?php

namespace Tests\Feature\Api;

use App\Models\FinishEarlierRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class DashboardApiTest extends TestCase
{
    use RefreshDatabase;

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

    private function record(string $createdAt): void
    {
        $record = FinishEarlierRecord::create(['metadata' => ['production_order' => 'PO-1'], 'entries' => []]);
        $record->forceFill(['created_at' => $createdAt])->save();
    }

    public function test_finish_earlier_counts_total_and_this_week_starting_monday(): void
    {
        Carbon::setTestNow('2026-09-16 10:00:00'); // a Wednesday; this week began Monday 14 Sep
        $this->record('2026-09-14 00:30:00'); // Monday, this week
        $this->record('2026-09-15 09:00:00'); // Tuesday, this week
        $this->record('2026-09-13 23:30:00'); // Sunday, last week
        $this->record('2026-08-20 09:00:00'); // older

        $this->actingAs($this->user(['finish-earlier.view']), 'sanctum')->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('finishEarlier.total', 4)
            ->assertJsonPath('finishEarlier.this_week', 2);
    }

    public function test_finish_earlier_is_null_without_permission_and_other_sections_are_unchanged(): void
    {
        $this->record(now()->toDateTimeString());

        $this->actingAs($this->user(['tension-records.view']), 'sanctum')->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('finishEarlier', null)
            ->assertJsonPath('tension.total', 0)
            ->assertJsonPath('stockTake', null)
            ->assertJsonPath('users', null);
    }

    public function test_the_web_dashboard_props_do_not_include_the_mobile_only_block(): void
    {
        $this->actingAs($this->user(['finish-earlier.view']));

        $this->get(route('dashboard'))->assertOk()->assertInertia(fn ($page) => $page->missing('finishEarlier'));
    }
}
