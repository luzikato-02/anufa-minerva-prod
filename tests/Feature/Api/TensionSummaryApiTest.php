<?php

namespace Tests\Feature\Api;

use App\Models\TensionRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Key figures for the records page: each one with the previous 7 days to compare against,
 * computed only from stored records.
 */
class TensionSummaryApiTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-07 10:00:00'); // Saturday, UTC
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(): User
    {
        Permission::findOrCreate('tension-records.view', 'web');

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo('tension-records.view');
    }

    private function record(string $type, string $createdAt, string $machine, float $progress, array $problems = []): void
    {
        $record = TensionRecord::create([
            'record_type' => $type,
            'csv_data' => '',
            'form_data' => [],
            'measurement_data' => [],
            'metadata' => ['machine_number' => $machine, 'progress_percentage' => $progress],
            'problems' => $problems,
        ]);
        $record->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();
    }

    private function openProblem(string $at): array
    {
        return ['id' => uniqid(), 'description' => 'x', 'status' => 'open', 'timestamp' => $at];
    }

    private function resolvedProblem(string $at, string $resolvedAt): array
    {
        return ['id' => uniqid(), 'description' => 'x', 'status' => 'resolved', 'timestamp' => $at,
            'resolution' => ['action' => 'fixed', 'resolved_by' => 'Fixer', 'resolved_at' => $resolvedAt]];
    }

    private function summary(array $query = [])
    {
        return $this->actingAs($this->user())->getJson('/tension-summary?'.http_build_query($query))->assertOk();
    }

    public function test_compares_the_last_seven_days_with_the_seven_before(): void
    {
        // Current window: 2026-11-01 .. 2026-11-07 (UTC, offset 0)
        $this->record('twisting', '2026-11-07 08:00:00', 'TW-01', 100);
        $this->record('twisting', '2026-11-05 08:00:00', 'TW-02', 90);
        $this->record('weaving', '2026-11-01 00:30:00', 'WV-01', 80);
        // Previous window: 2026-10-25 .. 2026-10-31
        $this->record('twisting', '2026-10-31 23:00:00', 'TW-03', 50);
        // Older than both windows: ignored for counts
        $this->record('twisting', '2026-10-20 08:00:00', 'TW-04', 10);

        $data = $this->summary()->json('data');

        $this->assertSame(3, $data['records']['current']);
        $this->assertSame(1, $data['records']['previous']);
        $this->assertSame([1, 0, 0, 0, 1, 0, 1], $data['records']['daily']);
        $this->assertEquals(90.0, $data['completion']['current_avg']);
        $this->assertEquals(50.0, $data['completion']['previous_avg']);
    }

    public function test_counts_open_problems_new_today_and_older_than_a_day(): void
    {
        $this->record('twisting', '2026-11-07 08:00:00', 'TW-01', 100, [
            $this->openProblem('2026-11-07 08:05:00'),            // new today
            $this->openProblem('2026-11-05 09:00:00'),            // open, older than 24h
            $this->resolvedProblem('2026-11-06 08:00:00', '2026-11-06 10:00:00'), // 2h
        ]);
        $this->record('twisting', '2026-10-28 08:00:00', 'TW-02', 100, [
            $this->resolvedProblem('2026-10-28 08:00:00', '2026-10-28 14:00:00'), // previous window, 6h
        ]);
        $this->record('twisting', '2026-11-03 08:00:00', 'TW-03', 100, [
            $this->resolvedProblem('2026-11-03 08:00:00', '2026-11-03 12:00:00'), // 4h
            $this->resolvedProblem('2026-11-03 08:00:00', '2026-11-03 09:00:00'), // 1h
        ]);

        $data = $this->summary()->json('data');

        $this->assertSame(2, $data['open_problems']['open']);
        $this->assertSame(1, $data['open_problems']['new_today']);
        $this->assertSame(1, $data['open_problems']['older_than_24h']);
        // Current-window resolutions: 2h, 4h, 1h -> median 2h. Previous: 6h.
        $this->assertEquals(2.0, $data['resolve_hours']['current_median']);
        $this->assertEquals(6.0, $data['resolve_hours']['previous_median']);
        $this->assertSame(3, $data['resolve_hours']['resolved_current']);
    }

    public function test_reports_machines_checked_today_and_overdue(): void
    {
        $this->record('twisting', '2026-11-07 07:00:00', 'TW-01', 100); // today
        $this->record('twisting', '2026-11-06 07:00:00', 'TW-02', 100); // yesterday: not overdue
        $this->record('twisting', '2026-11-03 07:00:00', 'TW-03', 100); // 4 days ago: overdue
        $this->record('twisting', '2026-11-02 07:00:00', 'TW-01', 100); // older check of TW-01

        $machines = $this->summary()->json('data.machines');

        $this->assertSame(['checked_today' => 1, 'active_30d' => 3, 'overdue' => 1], $machines);
    }

    public function test_filters_by_type(): void
    {
        $this->record('twisting', '2026-11-07 08:00:00', 'TW-01', 100);
        $this->record('weaving', '2026-11-07 08:00:00', 'WV-01', 100, [$this->openProblem('2026-11-07 08:00:00')]);

        $weaving = $this->summary(['type' => 'weaving'])->json('data');

        $this->assertSame(1, $weaving['records']['current']);
        $this->assertSame(1, $weaving['open_problems']['open']);
        $this->assertSame(0, $this->summary(['type' => 'twisting'])->json('data.open_problems.open'));
    }

    public function test_days_follow_the_callers_time_zone(): void
    {
        // 2026-11-06 20:00 UTC is already 2026-11-07 03:00 in UTC+7.
        $this->record('twisting', '2026-11-06 20:00:00', 'TW-01', 100, [$this->openProblem('2026-11-06 20:00:00')]);

        $utc = $this->summary()->json('data');
        $bangkok = $this->summary(['tz_offset' => 420])->json('data');

        $this->assertSame(0, $utc['open_problems']['new_today']);
        $this->assertSame(1, $bangkok['open_problems']['new_today']);
        $this->assertSame('2026-11-07', $bangkok['today']);
        $this->assertSame(1, end($bangkok['records']['daily']));
        $this->assertSame(1, $bangkok['machines']['checked_today']);
    }

    public function test_counts_out_of_spec_positions_for_twisting_and_weaving(): void
    {
        $twisting = TensionRecord::create([
            'record_type' => 'twisting', 'csv_data' => '',
            'form_data' => ['specTens' => '180', 'tensPlus' => '15'],          // limits 165–195
            'measurement_data' => [
                '1' => ['max' => 190, 'min' => 170],   // in spec
                '2' => ['max' => 204, 'min' => 171],   // above
                '3' => ['max' => 180, 'min' => 160],   // below
                '4' => ['max' => null, 'min' => null], // not measured
            ],
            'metadata' => ['machine_number' => 'TW-01'], 'problems' => [],
        ]);
        $twisting->forceFill(['created_at' => '2026-11-06 08:00:00'])->save();

        $weaving = TensionRecord::create([
            'record_type' => 'weaving', 'csv_data' => '',
            'form_data' => ['specTens' => 55, 'tensPlus' => 5],                // limits 50–60
            'measurement_data' => [
                'AO' => ['1' => ['1' => ['max' => 58, 'min' => 52], '2' => ['max' => 63, 'min' => 55]]],
                'BI' => ['3' => ['4' => ['max' => 57, 'min' => 51]]],
            ],
            'metadata' => ['machine_number' => 'WV-01'], 'problems' => [],
        ]);
        $weaving->forceFill(['created_at' => '2026-11-06 09:00:00'])->save();

        // Previous window: one record, half out of spec.
        $older = TensionRecord::create([
            'record_type' => 'twisting', 'csv_data' => '',
            'form_data' => ['specTens' => '180', 'tensPlus' => '15'],
            'measurement_data' => ['1' => ['max' => 200, 'min' => 170], '2' => ['max' => 190, 'min' => 170]],
            'metadata' => ['machine_number' => 'TW-02'], 'problems' => [],
        ]);
        $older->forceFill(['created_at' => '2026-10-29 08:00:00'])->save();

        $spec = $this->summary()->json('data.out_of_spec');

        // Current: twisting 3 measured / 2 out, weaving 3 measured / 1 out → 3 of 6.
        $this->assertSame(6, $spec['current_positions']);
        $this->assertSame(3, $spec['current_out']);
        $this->assertEquals(50.0, $spec['current_pct']);
        $this->assertEquals(50.0, $spec['previous_pct']);

        $this->assertSame(1, $this->summary(['type' => 'weaving'])->json('data.out_of_spec.current_out'));
    }

    public function test_records_without_a_spec_flag_nothing(): void
    {
        $record = TensionRecord::create([
            'record_type' => 'twisting', 'csv_data' => '', 'form_data' => [],
            'measurement_data' => ['1' => ['max' => 999, 'min' => 1]],
            'metadata' => ['machine_number' => 'TW-01'], 'problems' => [],
        ]);
        $record->forceFill(['created_at' => '2026-11-06 08:00:00'])->save();

        $spec = $this->summary()->json('data.out_of_spec');

        $this->assertSame(1, $spec['current_positions']);
        $this->assertSame(0, $spec['current_out']);
        $this->assertNull($spec['previous_pct']);
    }

    public function test_requires_the_view_permission_and_validates_input(): void
    {
        $this->actingAs(User::factory()->withoutTwoFactor()->create())->getJson('/tension-summary')->assertForbidden();
        $this->actingAs($this->user())->getJson('/tension-summary?type=spinning')->assertUnprocessable();
    }
}
