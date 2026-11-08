<?php

namespace Tests\Feature\Api;

use App\Models\CreelType;
use App\Models\StockSheet;
use App\Models\TorqueCheckSheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/** Server sorting for the torque check, stock sheet and activity log lists. */
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
}
