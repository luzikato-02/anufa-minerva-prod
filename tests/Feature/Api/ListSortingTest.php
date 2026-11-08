<?php

namespace Tests\Feature\Api;

use App\Models\CreelType;
use App\Models\FinishEarlierRecord;
use App\Models\StockSheet;
use App\Models\StockTakingRecord;
use App\Models\TensionRecord;
use App\Models\TorqueCheckSheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/** Server sorting for the record lists that page on the server. */
class ListSortingTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $perms): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    public function test_torque_checks_sort_by_a_whitelisted_column_and_ignore_others(): void
    {
        $this->actingAs($this->user(['torque-checks.view']));
        $creel = CreelType::create(['name' => 'Standard', 'torque_min' => 6, 'torque_max' => 8]);
        foreach ([['2026-11-01', 'Budi', '2704'], ['2026-11-03', 'Andi', '2710'], ['2026-11-02', 'Citra', '2601']] as [$date, $op, $m]) {
            TorqueCheckSheet::create(['check_date' => $date, 'operator_name' => $op, 'machine_number' => $m, 'creel_type_id' => $creel->id]);
        }

        $names = fn (string $q) => array_column($this->getJson("/torque-checks?{$q}")->assertOk()->json('data'), 'operator_name');

        $this->assertSame(['Andi', 'Citra', 'Budi'], $names(''));
        $this->assertSame(['Andi', 'Budi', 'Citra'], $names('sort_by=operator&sort_dir=asc'));
        $this->assertSame(['Andi', 'Budi', 'Citra'], $names('sort_by=machine&sort_dir=desc'));
        $this->assertSame(['Andi', 'Citra', 'Budi'], $names('sort_by=operator_name;drop&sort_dir=asc'));
    }

    public function test_stock_sheets_sort_by_leader(): void
    {
        $this->actingAs($this->user(['stock-take.view']));
        foreach ([['2026-11-01', 'Rina'], ['2026-11-02', 'Agus']] as [$date, $leader]) {
            StockSheet::create(['sheet_date' => $date, 'leader' => $leader]);
        }

        $leaders = fn (string $q) => array_column($this->getJson("/stock-sheets?{$q}")->assertOk()->json('data'), 'leader');

        $this->assertSame(['Agus', 'Rina'], $leaders(''));
        $this->assertSame(['Rina', 'Agus'], $leaders('sort_by=leader&sort_dir=desc'));
    }

    public function test_activity_log_searches_descriptions_and_user_names_and_sorts_by_event(): void
    {
        $viewer = $this->user(['activity-log.view']);
        $siti = User::factory()->withoutTwoFactor()->create(['name' => 'Siti Nurhaliza']);
        activity()->causedBy($siti)->event('updated')->log('Changed spec');
        activity()->causedBy($viewer)->event('created')->log('Recorded tension');
        activity()->event('deleted')->log('Removed sheet');

        $this->actingAs($viewer);
        $descriptions = fn (string $q) => array_column($this->getJson("/api/activity-log?{$q}")->assertOk()->json('data'), 'description');

        $this->assertSame(['Changed spec'], $descriptions('search=siti'));
        $this->assertSame(['Removed sheet'], $descriptions('search=SHEET'));
        // Creating users logs entries too; only the order of the three above matters.
        $mine = ['Recorded tension', 'Removed sheet', 'Changed spec'];
        $sorted = array_values(array_intersect($descriptions('sort_by=event&sort_dir=asc'), $mine));
        $this->assertSame($mine, $sorted);
    }

    public function test_finish_earlier_sorts_numbers_as_numbers(): void
    {
        $this->actingAs($this->user(['finish-earlier.view']));
        foreach ([['PO-1', 9], ['PO-2', 100], ['PO-3', 10]] as [$po, $n]) {
            FinishEarlierRecord::create(['metadata' => ['production_order' => $po, 'total_finish_earlier' => $n], 'entries' => []]);
        }

        $orders = fn (string $q) => array_column(array_column($this->getJson("/finish-earlier?{$q}")->assertOk()->json('data'), 'metadata'), 'production_order');

        $this->assertSame(['PO-1', 'PO-3', 'PO-2'], $orders('sort_by=fe_bobbins&sort_dir=asc'));
        $this->assertSame(['PO-2', 'PO-3', 'PO-1'], $orders('sort_by=fe_bobbins&sort_dir=desc'));
    }

    public function test_stock_take_sorts_by_leader(): void
    {
        $this->actingAs($this->user(['stock-take.view']));
        foreach ([['ST-1', 'Rina'], ['ST-2', 'Agus'], ['ST-3', 'Siti']] as [$id, $leader]) {
            StockTakingRecord::create(['session_id' => $id, 'indv_batch_data' => [], 'metadata' => ['session_leader' => $leader]]);
        }

        $ids = array_column($this->getJson('/stock-take-records?sort_by=leader&sort_dir=asc')->assertOk()->json('data'), 'session_id');
        $this->assertSame(['ST-2', 'ST-1', 'ST-3'], $ids);
    }

    public function test_users_sort_by_email_and_default_to_name(): void
    {
        $viewer = $this->user(['users.view']);
        $viewer->update(['name' => 'Mira', 'email' => 'm@example.com']);
        User::factory()->withoutTwoFactor()->create(['name' => 'Zed', 'email' => 'a@example.com']);
        User::factory()->withoutTwoFactor()->create(['name' => 'Ana', 'email' => 'z@example.com']);
        $this->actingAs($viewer);

        $names = fn (string $q) => array_column($this->getJson("/api/users?{$q}")->assertOk()->json('data'), 'name');

        $this->assertSame(['Ana', 'Mira', 'Zed'], $names(''));
        $this->assertSame(['Ana', 'Mira', 'Zed'], $names('sort_by=email&sort_dir=desc'));
        $this->assertSame(['Zed', 'Mira', 'Ana'], $names('sort_by=email&sort_dir=asc'));
    }

    public function test_tension_problems_sort_by_machine_naturally(): void
    {
        $this->actingAs($this->user(['tension-records.view']));
        foreach (['TW-10', 'TW-2', 'TW-1'] as $i => $machine) {
            TensionRecord::create([
                'record_type' => 'twisting', 'csv_data' => '', 'form_data' => [], 'measurement_data' => [],
                'metadata' => ['machine_number' => $machine],
                'problems' => [['id' => "p{$i}", 'spindleNumber' => 1, 'status' => 'open', 'timestamp' => '2026-11-07 08:00:00']],
            ]);
        }

        $machines = fn (string $q) => array_column($this->getJson("/tension-problems?{$q}")->assertOk()->json('data'), 'machine_number');

        $this->assertSame(['TW-1', 'TW-2', 'TW-10'], $machines('sort_by=machine&sort_dir=asc'));
        $this->assertSame(['TW-10', 'TW-2', 'TW-1'], $machines('sort_by=machine&sort_dir=desc'));
    }
}
