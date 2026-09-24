<?php

namespace Tests\Feature;

use App\Models\StockSheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class StockSheetWebTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $perms): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    public function test_pages_follow_the_stock_take_permissions(): void
    {
        $viewer = $this->user(['stock-take.view']);
        $this->actingAs($viewer)->get('/stock-sheets-main')->assertOk();
        $this->actingAs($viewer)->get('/stock-sheet-main')->assertForbidden();
        $this->actingAs($viewer)->get('/stock-sheet-session')->assertForbidden();

        $recorder = $this->user(['stock-take.create']);
        $this->actingAs($recorder)->get('/stock-sheet-main')->assertOk();
        $this->actingAs($recorder)->get('/stock-sheet-session')->assertOk();
        $this->actingAs($recorder)->get('/stock-sheets-main')->assertForbidden();
    }

    public function test_the_web_session_can_record_list_edit_and_delete_rows(): void
    {
        $u = $this->user(['stock-take.view', 'stock-take.create', 'stock-take.edit', 'stock-take.delete']);
        $uuid = '2b1f6f3e-8f57-4d0a-9c1e-6a2d7f0b9c11';
        $row = ['sheet_client_uuid' => '6f1d2b7e-3c53-4c0e-9f0a-1b7c2d3e4f50', 'sheet_date' => '2026-09-19', 'leader' => 'Ana', 'material_code' => 'TY022002756', 'batch' => 'TA0092565', 'chs' => 28, 'actual_weight' => 146.8, 'position' => 30, 'client_uuid' => $uuid];

        $this->actingAs($u)->postJson('/stock-sheets/rows', $row)->assertCreated();
        $this->actingAs($u)->getJson('/stock-sheets')->assertOk()->assertJsonPath('data.0.rows_count', 1);
        $this->actingAs($u)->patchJson("/stock-sheets/rows/{$uuid}", ['chs' => 30])->assertOk()->assertJsonPath('data.chs', 30);
        $id = StockSheet::first()->id;
        $this->actingAs($u)->getJson("/stock-sheets/{$id}/download")->assertOk()->assertJsonPath('summary.0.CHS', 30);
        $this->actingAs($u)->deleteJson("/stock-sheets/rows/{$uuid}")->assertOk();
        $this->actingAs($u)->deleteJson("/stock-sheets/{$id}")->assertOk();
        $this->assertSame(0, StockSheet::count());
    }

    public function test_a_viewer_cannot_record_or_delete(): void
    {
        $viewer = $this->user(['stock-take.view']);
        $this->actingAs($viewer)->postJson('/stock-sheets/rows', [])->assertForbidden();
        $sheet = StockSheet::create(['sheet_date' => '2026-09-19', 'leader' => 'Ana']);
        $this->actingAs($viewer)->deleteJson("/stock-sheets/{$sheet->id}")->assertForbidden();
        $this->assertSame(1, StockSheet::count());
    }
}
