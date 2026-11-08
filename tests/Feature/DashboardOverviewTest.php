<?php

namespace Tests\Feature;

use App\Models\StockTakingRecord;
use App\Models\TensionRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/** Dashboard panels: each block only for users who can view that module. */
class DashboardOverviewTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Carbon::setTestNow('2026-11-07 10:00:00');
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    private function user(array $permissions): User
    {
        $user = User::factory()->withoutTwoFactor()->create();
        foreach ($permissions as $permission) {
            Permission::findOrCreate($permission, 'web');
            $user->givePermissionTo($permission);
        }

        return $user;
    }

    private function record(string $type, string $machine, string $createdAt, array $problems = []): TensionRecord
    {
        $record = TensionRecord::create([
            'record_type' => $type, 'csv_data' => '', 'form_data' => [], 'measurement_data' => [],
            'metadata' => ['machine_number' => $machine], 'problems' => $problems,
        ]);
        $record->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();

        return $record;
    }

    public function test_guests_cannot_load_the_overview(): void
    {
        $this->getJson('/dashboard-overview')->assertUnauthorized();
    }

    public function test_blocks_follow_the_users_permissions(): void
    {
        $this->record('twisting', 'TW-01', '2026-11-07 08:00:00', [['id' => 'a', 'spindleNumber' => 4, 'status' => 'open', 'timestamp' => '2026-11-07 08:00:00']]);

        $none = $this->actingAs($this->user([]))->getJson('/dashboard-overview')->assertOk()->json();
        $this->assertSame(['tension' => null, 'stock_take' => null, 'activity' => null], $none);

        $tensionOnly = $this->actingAs($this->user(['tension-records.view']))->getJson('/dashboard-overview')->json();
        $this->assertNotNull($tensionOnly['tension']);
        $this->assertNull($tensionOnly['stock_take']);
        $this->assertNull($tensionOnly['activity']);
    }

    public function test_daily_counts_cover_thirty_local_days_split_by_type(): void
    {
        $this->record('twisting', 'TW-01', '2026-11-07 08:00:00');
        $this->record('twisting', 'TW-02', '2026-11-07 09:00:00');
        $this->record('weaving', 'WV-01', '2026-11-06 20:00:00'); // 07 Nov 03:00 in UTC+7
        $this->record('weaving', 'WV-02', '2026-10-01 08:00:00'); // outside 30 days

        $daily = $this->actingAs($this->user(['tension-records.view']))
            ->getJson('/dashboard-overview?tz_offset=420')->json('tension.daily');

        $this->assertCount(30, $daily);
        $this->assertSame('2026-10-09', $daily[0]['date']);
        $this->assertSame(['date' => '2026-11-07', 'twisting' => 2, 'weaving' => 1], end($daily));
        $this->assertSame(3, array_sum(array_map(fn ($d) => $d['twisting'] + $d['weaving'], $daily)));
    }

    public function test_open_problems_are_listed_oldest_first_with_readable_positions(): void
    {
        $this->record('twisting', 'TW-01', '2026-11-07 08:00:00', [
            ['id' => 'a', 'spindleNumber' => 37, 'description' => 'High tension', 'status' => 'open', 'timestamp' => '2026-11-07 08:00:00'],
            ['id' => 'b', 'spindleNumber' => 12, 'status' => 'resolved', 'timestamp' => '2026-11-01 08:00:00'],
        ]);
        $this->record('weaving', 'WV-06', '2026-11-05 08:00:00', [
            ['id' => 'c', 'position' => 'AO-3-Col12', 'description' => 'Low tension', 'status' => 'open', 'timestamp' => '2026-11-05 10:00:00'],
        ]);

        $tension = $this->actingAs($this->user(['tension-records.view']))->getJson('/dashboard-overview')->json('tension');

        $this->assertSame(2, $tension['open_problems_total']);
        $this->assertSame(['WV-06', 'TW-01'], array_column($tension['open_problems'], 'machine'));
        $this->assertSame(['AO · R3 · C12', 'Sp 37'], array_column($tension['open_problems'], 'position'));
        $this->assertEquals(48.0, $tension['open_problems'][0]['age_hours']);
    }

    public function test_machines_show_last_check_and_open_problem_count(): void
    {
        $this->record('twisting', 'TW-02', '2026-11-01 08:00:00');
        $this->record('twisting', 'TW-02', '2026-11-06 08:00:00', [['id' => 'a', 'spindleNumber' => 1, 'status' => 'open', 'timestamp' => '2026-11-06 08:00:00']]);
        $this->record('twisting', 'TW-10', '2026-11-07 08:00:00');
        $this->record('weaving', 'WV-01', '2026-11-03 08:00:00');

        $machines = $this->actingAs($this->user(['tension-records.view']))->getJson('/dashboard-overview')->json('tension.machines');

        $this->assertSame(['TW-02', 'TW-10', 'WV-01'], array_column($machines, 'machine'));
        $this->assertSame('2026-11-06T08:00:00+00:00', $machines[0]['last_checked']);
        $this->assertSame([1, 0, 0], array_column($machines, 'open_problems'));
    }

    public function test_stock_take_and_activity_blocks(): void
    {
        $user = $this->user(['stock-take.view', 'activity-log.view', 'tension-records.view']);
        $this->actingAs($user);
        StockTakingRecord::create(['session_id' => 'ST-1', 'indv_batch_data' => [], 'metadata' => [
            'session_leader' => 'Siti N.', 'session_status' => 'In Progress', 'total_batches' => 800, 'total_checked_batches' => 488,
        ]]);
        $this->record('twisting', 'TW-14', '2026-11-07 08:00:00');
        activity()->causedBy($user)->event('login')->log('Logged in');

        $data = $this->getJson('/dashboard-overview')->json();

        $this->assertSame(['ST-1'], array_column($data['stock_take'], 'session_id'));
        $this->assertSame(488, $data['stock_take'][0]['checked']);
        $summaries = array_column($data['activity'], 'summary');
        $this->assertContains('recorded twisting tension · TW-14', $summaries);
        $this->assertNotContains('Logged in', $summaries);
    }
}
