<?php

namespace Tests\Feature\Api;

use App\Models\TensionRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class TensionTrendsApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-09-16 10:00:00'); // Wednesday, UTC
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(array $perms = ['tension-records.view']): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    private function record(string $type, string $createdAt, int $completed, array $problemTimes = []): void
    {
        $record = TensionRecord::create([
            'record_type' => $type,
            'csv_data' => '',
            'form_data' => [],
            'measurement_data' => [],
            'metadata' => ['completed_measurements' => $completed, 'total_measurements' => $completed],
            'problems' => array_map(fn ($t, $i) => ['id' => "p$i", 'description' => 'x', 'status' => 'open', 'timestamp' => $t], $problemTimes, array_keys($problemTimes)),
        ]);
        $record->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();
    }

    private function trends(array $query, ?User $user = null)
    {
        return $this->actingAs($user ?? $this->user(), 'sanctum')->getJson('/api/v1/tension-trends?'.http_build_query($query));
    }

    public function test_returns_one_bucket_per_day_ending_today_with_zeros_filled_in(): void
    {
        $response = $this->trends(['type' => 'twisting', 'days' => 3])->assertOk();

        $response->assertJsonCount(3, 'data.days')
            ->assertJsonPath('data.days.0.date', '2026-09-14')
            ->assertJsonPath('data.days.2.date', '2026-09-16')
            ->assertJsonPath('data.days.1.problems', 0)
            ->assertJsonPath('data.days.1.measurements', 0)
            ->assertJsonPath('data.totals.problems', 0);
    }

    public function test_counts_measurements_by_record_day_and_problems_by_their_own_timestamp(): void
    {
        $this->record('twisting', '2026-09-15 08:00:00', 20, ['2026-09-15T09:00:00Z', '2026-09-16T01:00:00Z']);
        $this->record('twisting', '2026-09-16 07:00:00', 5);
        $this->record('twisting', '2026-08-01 07:00:00', 99, ['2026-08-01T07:00:00Z']); // outside the window

        $this->trends(['type' => 'twisting', 'days' => 3])->assertOk()
            ->assertJsonPath('data.days.1.measurements', 20)
            ->assertJsonPath('data.days.1.problems', 1)
            ->assertJsonPath('data.days.2.measurements', 5)
            ->assertJsonPath('data.days.2.problems', 1)
            ->assertJsonPath('data.totals.measurements', 25)
            ->assertJsonPath('data.totals.problems', 2);
    }

    public function test_only_the_requested_type_is_counted(): void
    {
        $this->record('twisting', '2026-09-16 07:00:00', 5, ['2026-09-16T07:30:00Z']);
        $this->record('weaving', '2026-09-16 08:00:00', 7);

        $this->trends(['type' => 'weaving', 'days' => 1])->assertOk()
            ->assertJsonPath('data.totals.measurements', 7)
            ->assertJsonPath('data.totals.problems', 0);
    }

    public function test_days_are_the_callers_calendar_days_using_tz_offset(): void
    {
        // 18:00 UTC on the 15th is 01:00 on the 16th at UTC+7.
        $this->record('twisting', '2026-09-15 18:00:00', 10, ['2026-09-15T18:30:00Z']);

        $utc = $this->trends(['type' => 'twisting', 'days' => 2])->assertOk();
        $utc->assertJsonPath('data.days.0.measurements', 10); // the 15th

        $jakarta = $this->trends(['type' => 'twisting', 'days' => 2, 'tz_offset' => 420])->assertOk();
        $jakarta->assertJsonPath('data.days.1.date', '2026-09-16')
            ->assertJsonPath('data.days.1.measurements', 10)
            ->assertJsonPath('data.days.1.problems', 1);
    }

    public function test_validates_the_query_and_requires_the_permission(): void
    {
        $this->trends(['type' => 'nope'])->assertUnprocessable();
        $this->trends(['type' => 'twisting', 'days' => 90])->assertUnprocessable();
        $this->trends(['type' => 'twisting'], $this->user(['stock-take.view']))->assertForbidden();
    }
}
