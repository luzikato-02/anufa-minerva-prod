<?php

namespace Tests\Feature\Api;

use App\Models\StockSheet;
use App\Models\StockSheetRow;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class StockSheetApiTest extends TestCase
{
    use RefreshDatabase;

    private const SHEET = '6f1d2b7e-3c53-4c0e-9f0a-1b7c2d3e4f50';

    private function user(array $perms = ['stock-take.view', 'stock-take.create', 'stock-take.edit', 'stock-take.delete']): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    private function row(array $extra = []): array
    {
        return $extra + [
            'sheet_client_uuid' => self::SHEET, 'sheet_date' => '2026-09-19', 'leader' => 'Ana',
            'color' => 'White orange green', 'material_code' => 'TY022002756', 'batch' => 'TA0092565',
            'prod_date' => '2026-09-06', 'chs' => 28, 'actual_weight' => 146.8, 'position' => 30, 'remark' => 'ex WV',
        ];
    }

    public function test_the_first_row_creates_the_sheet_and_later_rows_join_it_in_order(): void
    {
        $u = $this->user();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row())->assertCreated()->assertJsonPath('data.line_no', 1);
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['batch' => 'kupasan']))->assertCreated()->assertJsonPath('data.line_no', 2);

        $this->assertSame(1, StockSheet::count());
        $this->assertSame([1, 2], StockSheetRow::orderBy('line_no')->pluck('line_no')->all());
    }

    public function test_a_retried_upload_with_the_same_client_uuid_records_one_row(): void
    {
        $u = $this->user();
        $uuid = '2b1f6f3e-8f57-4d0a-9c1e-6a2d7f0b9c11';
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['client_uuid' => $uuid]))->assertCreated();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['client_uuid' => $uuid]))->assertOk();

        $this->assertSame(1, StockSheetRow::count());
    }

    public function test_free_text_batch_is_accepted_but_material_and_batch_are_required(): void
    {
        $u = $this->user();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['batch' => '']))->assertUnprocessable()->assertJsonValidationErrors('batch');
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['material_code' => '']))->assertUnprocessable()->assertJsonValidationErrors('material_code');
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['actual_weight' => -1, 'chs' => -3]))->assertUnprocessable()->assertJsonValidationErrors(['actual_weight', 'chs']);
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['batch' => 'kupasan', 'color' => null, 'prod_date' => null, 'position' => null]))->assertCreated();
    }

    public function test_deleting_a_row_renumbers_the_rest(): void
    {
        $u = $this->user();
        foreach (['A', 'B', 'C'] as $b) {
            $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['batch' => $b]))->assertCreated();
        }
        $second = StockSheetRow::where('batch', 'B')->first();

        $this->actingAs($u, 'sanctum')->deleteJson("/api/v1/stock-sheets/rows/{$second->id}")->assertOk();

        $this->assertSame(['A' => 1, 'C' => 2], StockSheetRow::pluck('line_no', 'batch')->all());

        // The next row continues after the last number instead of reusing a deleted one.
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['batch' => 'D']))->assertCreated()->assertJsonPath('data.line_no', 3);
    }

    public function test_rows_can_be_edited_and_the_sheet_lists_with_totals_and_search(): void
    {
        $u = $this->user();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row())->assertCreated();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['batch' => 'TA0092566', 'chs' => 2, 'actual_weight' => 3.2]))->assertCreated();
        $id = StockSheetRow::where('batch', 'TA0092566')->value('id');

        $this->actingAs($u, 'sanctum')->patchJson("/api/v1/stock-sheets/rows/{$id}", ['actual_weight' => 5.5, 'remark' => 'limit'])->assertOk()->assertJsonPath('data.remark', 'limit');

        $list = $this->actingAs($u, 'sanctum')->getJson('/api/v1/stock-sheets')->assertOk();
        $list->assertJsonPath('data.0.rows_count', 2);
        $this->assertEquals(152.3, $list->json('data.0.total_weight'));
        $this->assertEquals(30, $list->json('data.0.total_chs'));

        $this->actingAs($u, 'sanctum')->getJson('/api/v1/stock-sheets?search=ta0092566')->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/stock-sheets?search=nothing-like-this')->assertOk()->assertJsonCount(0, 'data');

        $sheet = StockSheet::first();
        $this->actingAs($u, 'sanctum')->getJson("/api/v1/stock-sheets/{$sheet->id}")->assertOk()->assertJsonCount(2, 'data.rows');
    }

    public function test_csv_export_uses_the_paper_column_order_and_404s_when_empty(): void
    {
        $u = $this->user();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row())->assertCreated();
        $sheet = StockSheet::first();

        $res = $this->actingAs($u, 'sanctum')->getJson("/api/v1/stock-sheets/{$sheet->id}/download")->assertOk();
        $this->assertSame(['NO', 'WARNA', 'KODE MATERIAL', 'BATCH', 'PROD DATE', 'CHS', 'BERAT ACTUAL', 'POSITION', 'REMARK'], array_keys($res->json('summary.0')));

        $empty = StockSheet::create(['sheet_date' => '2026-09-19', 'leader' => 'Ana']);
        $this->actingAs($u, 'sanctum')->getJson("/api/v1/stock-sheets/{$empty->id}/download")->assertNotFound();
    }

    public function test_deleting_a_sheet_needs_the_delete_permission(): void
    {
        $owner = $this->user();
        $this->actingAs($owner, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row())->assertCreated();
        $sheet = StockSheet::first();

        $viewer = $this->user(['stock-take.view']);
        $this->actingAs($viewer, 'sanctum')->deleteJson("/api/v1/stock-sheets/{$sheet->id}")->assertForbidden();
        $this->actingAs($viewer, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row())->assertForbidden();

        $this->actingAs($owner, 'sanctum')->deleteJson("/api/v1/stock-sheets/{$sheet->id}")->assertOk();
        $this->assertSame(0, StockSheet::count());
        $this->assertSame(0, StockSheetRow::count());
    }

    public function test_a_row_can_be_edited_and_deleted_by_the_uuid_the_app_generated(): void
    {
        $u = $this->user();
        $uuid = '2b1f6f3e-8f57-4d0a-9c1e-6a2d7f0b9c11';
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/stock-sheets/rows', $this->row(['client_uuid' => $uuid]))->assertCreated();

        $this->actingAs($u, 'sanctum')->patchJson("/api/v1/stock-sheets/rows/{$uuid}", ['chs' => 30])->assertOk()->assertJsonPath('data.chs', 30);
        $this->actingAs($u, 'sanctum')->deleteJson("/api/v1/stock-sheets/rows/{$uuid}")->assertOk();
        $this->assertSame(0, StockSheetRow::count());
        $this->actingAs($u, 'sanctum')->deleteJson("/api/v1/stock-sheets/rows/{$uuid}")->assertNotFound();
    }
}
