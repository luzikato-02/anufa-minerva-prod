<?php

namespace Tests\Feature;

use App\Models\Reed;
use App\Models\ReedFabricStyle;
use App\Models\ReedLocation;
use App\Models\ReedSpec;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class ReedInventoryTest extends TestCase
{
    use RefreshDatabase;

    private function user(array $perms): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    private function operator(): User
    {
        return $this->user(['reeds.view', 'reeds.operate']);
    }

    private function manager(): User
    {
        return $this->user(['reeds.view', 'reeds.operate', 'reeds.manage']);
    }

    /** @return array{0: ReedSpec, 1: ReedFabricStyle, 2: ReedLocation} */
    private function masterData(): array
    {
        $spec = ReedSpec::create(['code' => 'RD-90', 'dents_per_10cm' => 90, 'width_mm' => 1600, 'reed_type' => 'flat', 'min_stock' => 3]);
        $style = ReedFabricStyle::create(['code' => 'NY1400', 'reed_spec_id' => $spec->id, 'is_active' => true]);
        $location = ReedLocation::create(['code' => 'R01-S01']);

        return [$spec, $style, $location];
    }

    private function receive(User $user, ReedSpec $spec, ReedLocation $location, int $quantity = 1): array
    {
        return $this->actingAs($user)->postJson('/reed-inventory/receipts', [
            'reed_spec_id' => $spec->id,
            'quantity' => $quantity,
            'location_id' => $location->id,
            'po_no' => 'PO-1',
        ])->assertCreated()->json('data');
    }

    public function test_pages_need_view_and_writes_need_operate_or_manage(): void
    {
        [$spec, , $location] = $this->masterData();

        $this->actingAs($this->user([]))->get('/reeds')->assertForbidden();

        $viewer = $this->user(['reeds.view']);
        $this->actingAs($viewer)->get('/reeds')->assertOk();
        $this->actingAs($viewer)->get('/reed-settings')->assertOk();
        $this->actingAs($viewer)->getJson('/reed-inventory/reeds')->assertOk();
        $this->actingAs($viewer)->postJson('/reed-inventory/receipts', ['reed_spec_id' => $spec->id, 'quantity' => 1])->assertForbidden();

        $operator = $this->operator();
        $reed = $this->receive($operator, $spec, $location)[0];
        $this->actingAs($operator)->postJson("/reed-inventory/reeds/{$reed['id']}/scrap", ['reason' => 'x'])->assertForbidden();
        $this->actingAs($operator)->postJson('/reed-inventory/specs', ['code' => 'X'])->assertForbidden();
    }

    public function test_receive_numbers_reeds_and_logs_a_movement_each(): void
    {
        [$spec, , $location] = $this->masterData();
        $reeds = $this->receive($this->operator(), $spec, $location, 3);

        $this->assertCount(3, $reeds);
        $this->assertSame('R'.str_pad((string) $reeds[0]['id'], 5, '0', STR_PAD_LEFT), $reeds[0]['serial_no']);
        $this->assertDatabaseCount('reed_movements', 3);
        $this->assertSame(3, Reed::where('status', 'in_stock')->where('location_id', $location->id)->count());
    }

    public function test_full_loop_issue_return_inspect_back_to_stock_with_wear(): void
    {
        [$spec, $style, $location] = $this->masterData();
        $user = $this->operator();
        $id = $this->receive($user, $spec, $location)[0]['id'];

        $this->actingAs($user)->getJson("/reed-inventory/match?fabric_style_id={$style->id}")
            ->assertOk()->assertJsonPath('data.candidates.0.id', $id);

        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/reserve", ['fabric_style_id' => $style->id, 'loom_number' => 'L-27'])
            ->assertOk()->assertJsonPath('data.status', 'reserved');
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/issue", ['loom_number' => 'L-27', 'fabric_style_id' => $style->id, 'order_no' => 'PO-9'])
            ->assertOk()->assertJsonPath('data.status', 'on_loom')->assertJsonPath('data.location_id', null);

        $this->travel(3)->days();
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/return", ['meters_woven' => 12500])
            ->assertOk()->assertJsonPath('data.status', 'returned');

        // Grade A without a location is refused, then accepted with one.
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/inspect", ['grade' => 'A'])->assertStatus(409);
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/inspect", [
            'grade' => 'B', 'location_id' => $location->id, 'checklist' => ['worn_wires' => true],
        ])->assertOk()->assertJsonPath('data.status', 'in_stock');

        $reed = Reed::find($id);
        $this->assertSame(12500.0, $reed->meters_woven);
        $this->assertSame(3, $reed->days_mounted);
        $this->assertSame(1, $reed->issue_count);
        $this->assertSame('B', $reed->grade);
        $this->assertSame(
            ['receive', 'reserve', 'issue', 'return', 'inspect'],
            $reed->movements()->orderBy('id')->pluck('type')->all(),
        );

        $history = $this->actingAs($user)->getJson("/reed-inventory/reeds/{$id}")->assertOk();
        $history->assertJsonCount(5, 'data.movements')->assertJsonCount(1, 'data.inspections');
    }

    public function test_illegal_moves_are_refused_with_409(): void
    {
        [$spec, $style, $location] = $this->masterData();
        $user = $this->manager();
        [$a, $b] = $this->receive($user, $spec, $location, 2);

        // Can't return a reed that is not on a loom.
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$a['id']}/return", ['meters_woven' => 1])->assertStatus(409);

        // One reed per loom.
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$a['id']}/issue", ['loom_number' => 'L-1'])->assertOk();
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$b['id']}/issue", ['loom_number' => 'L-1'])
            ->assertStatus(409)->assertJsonPath('message', "Reed {$a['serial_no']} is still on loom L-1. Return it first.");

        // Can't scrap a reed on a loom.
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$a['id']}/scrap", ['reason' => 'worn'])->assertStatus(409);

        // A style for another spec is refused.
        $other = ReedSpec::create(['code' => 'RD-100', 'dents_per_10cm' => 100, 'width_mm' => 1600, 'reed_type' => 'flat', 'min_stock' => 0]);
        $otherStyle = ReedFabricStyle::create(['code' => 'PET', 'reed_spec_id' => $other->id]);
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$b['id']}/reserve", ['fabric_style_id' => $otherStyle->id])->assertStatus(409);
    }

    public function test_grade_c_goes_through_quarantine_and_repair_back_to_inspection(): void
    {
        [$spec, , $location] = $this->masterData();
        $user = $this->manager();
        $id = $this->receive($user, $spec, $location)[0]['id'];

        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/inspect", ['grade' => 'C', 'checklist' => ['bent_dents' => true], 'defect_dents' => '120-135'])
            ->assertOk()->assertJsonPath('data.status', 'quarantine');
        // A grade C reed can't be issued.
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/issue", ['loom_number' => 'L-2'])->assertStatus(409);

        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/repair-out", ['vendor' => 'Reed Service CV', 'defects' => 'bent dents'])
            ->assertOk()->assertJsonPath('data.status', 'in_repair');
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/repair-in", ['cost' => 350000, 'work_done' => 'redented'])
            ->assertOk()->assertJsonPath('data.status', 'returned');
        $this->assertDatabaseHas('reed_repairs', ['reed_id' => $id, 'vendor' => 'Reed Service CV', 'cost' => 350000]);

        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/scrap", ['reason' => 'beyond repair'])
            ->assertOk()->assertJsonPath('data.status', 'scrapped')->assertJsonPath('data.grade', 'X');
        // Scrapped reeds leave the default list.
        $this->actingAs($user)->getJson('/reed-inventory/reeds')->assertJsonPath('total', 0);
    }

    public function test_a_repeated_client_uuid_does_not_log_twice(): void
    {
        [$spec, , $location] = $this->masterData();
        $user = $this->operator();
        $id = $this->receive($user, $spec, $location)[0]['id'];
        $uuid = (string) Str::uuid();

        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/issue", ['loom_number' => 'L-5', 'client_uuid' => $uuid])->assertOk();
        $this->actingAs($user)->postJson("/reed-inventory/reeds/{$id}/issue", ['loom_number' => 'L-5', 'client_uuid' => $uuid])
            ->assertOk()->assertJsonPath('data.status', 'on_loom');

        $this->assertSame(1, Reed::find($id)->movements()->where('type', 'issue')->count());
    }

    public function test_stats_flag_specs_below_min_stock_and_scan_lookup_works(): void
    {
        [$spec, , $location] = $this->masterData();
        $user = $this->operator();
        $reeds = $this->receive($user, $spec, $location, 2);

        $this->actingAs($user)->getJson('/reed-inventory/stats')->assertOk()
            ->assertJsonPath('data.by_status.in_stock', 2)
            ->assertJsonPath('data.short_specs.0.code', 'RD-90');

        $this->actingAs($user)->getJson('/reed-inventory/by-code/'.strtolower($reeds[1]['serial_no']))
            ->assertOk()->assertJsonPath('data.id', $reeds[1]['id']);
        $this->actingAs($user)->getJson('/reed-inventory/by-code/NOPE')->assertNotFound();
    }

    public function test_master_data_crud_and_delete_guards(): void
    {
        $user = $this->manager();
        $spec = $this->actingAs($user)->postJson('/reed-inventory/specs', [
            'code' => 'RD-80', 'dents_per_10cm' => 80, 'width_mm' => 1500, 'reed_type' => 'profile', 'min_stock' => 2,
        ])->assertCreated()->json('data');
        $this->actingAs($user)->postJson('/reed-inventory/specs', [
            'code' => 'RD-80', 'dents_per_10cm' => 80, 'width_mm' => 1500, 'reed_type' => 'flat', 'min_stock' => 2,
        ])->assertUnprocessable();

        $location = $this->actingAs($user)->postJson('/reed-inventory/locations', ['code' => 'R02-S01', 'zone' => 'Rack 2'])->assertCreated()->json('data');
        $this->actingAs($user)->postJson('/reed-inventory/styles', ['code' => 'PET-1', 'reed_spec_id' => $spec['id']])->assertCreated();

        $this->actingAs($user)->postJson('/reed-inventory/receipts', ['reed_spec_id' => $spec['id'], 'serials' => ['K-001'], 'location_id' => $location['id']])
            ->assertCreated()->assertJsonPath('data.0.serial_no', 'K-001');

        $this->actingAs($user)->deleteJson("/reed-inventory/specs/{$spec['id']}")->assertUnprocessable();
        $this->actingAs($user)->deleteJson("/reed-inventory/locations/{$location['id']}")->assertUnprocessable();
    }

    public function test_spec_fields_are_free_text_and_only_code_is_required(): void
    {
        $user = $this->manager();
        $this->actingAs($user)->postJson('/reed-inventory/specs', [
            'code' => 'RD-X', 'dents_per_10cm' => '90/10cm', 'width_mm' => '1600 mm', 'reed_type' => 'Profile 2',
            'wire_thickness_mm' => '0.3 mm', 'height_mm' => 'standard',
        ])->assertCreated()
            ->assertJsonPath('data.dents_per_10cm', '90/10cm')
            ->assertJsonPath('data.width_mm', '1600 mm')
            ->assertJsonPath('data.reed_type', 'Profile 2');

        $this->actingAs($user)->postJson('/reed-inventory/specs', ['code' => 'RD-MIN'])
            ->assertCreated()->assertJsonPath('data.min_stock', 0)->assertJsonPath('data.dents_per_10cm', null);
        $this->actingAs($user)->postJson('/reed-inventory/specs', ['dents_per_10cm' => '90'])->assertUnprocessable();
    }

    private function specCsv(array $rows): UploadedFile
    {
        $lines = array_map(fn ($r) => implode(',', array_map(fn ($c) => '"'.str_replace('"', '""', $c).'"', $r)), $rows);

        return UploadedFile::fake()->createWithContent('specs.csv', implode("\n", $lines)."\n");
    }

    public function test_spec_template_downloads_and_round_trips_through_import(): void
    {
        $user = $this->manager();
        $res = $this->actingAs($user)->get('/reed-inventory/specs/template')->assertOk();
        $path = tempnam(sys_get_temp_dir(), 'tpl').'.xlsx';
        file_put_contents($path, $res->streamedContent());
        $sheet = \PhpOffice\PhpSpreadsheet\IOFactory::load($path)->getSheetByName('Specs');
        $sheet->fromArray(['RD-NEW', '100', '1800 mm', null, null, 'Flat', 'Rapier', null, null, 'Steel', '2', null], null, 'A3');
        (new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($sheet->getParent()))->save($path);

        $file = new UploadedFile($path, 'specs.xlsx', null, null, true);
        $this->actingAs($user)->post('/reed-inventory/specs/import', ['file' => $file], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.created', 1)->assertJsonPath('data.updated', 0);

        // The template's example row is ignored; only the filled-in row lands.
        $this->assertSame(['RD-NEW'], ReedSpec::pluck('code')->all());
        $spec = ReedSpec::firstWhere('code', 'RD-NEW');
        $this->assertSame('100', $spec->dents_per_10cm);
        $this->assertSame('1800 mm', $spec->width_mm);
        $this->assertSame('Rapier', $spec->machine_type);
        $this->assertSame(2, $spec->min_stock);
        @unlink($path);
    }

    public function test_spec_import_upserts_by_code_and_rejects_bad_files_whole(): void
    {
        $user = $this->manager();
        ReedSpec::create(['code' => 'RD-90', 'dents_per_10cm' => '90', 'width_mm' => '1600 mm', 'min_stock' => 3]);

        $ok = $this->specCsv([
            ['Code', 'Dents per 10 cm', 'Overall width', 'Total hole', 'Machine type', 'Min spare stock'],
            ['rd-90', '', '1650 mm', '14850', 'Air-jet', ''],
            ['RD-120', '120', '', '', '', '1'],
        ]);
        $this->actingAs($user)->post('/reed-inventory/specs/import', ['file' => $ok], ['Accept' => 'application/json'])
            ->assertOk()->assertJsonPath('data.created', 1)->assertJsonPath('data.updated', 1);
        $updated = ReedSpec::firstWhere('code', 'RD-90');
        $this->assertSame('90', $updated->dents_per_10cm); // blank cell left it alone
        $this->assertSame('1650 mm', $updated->width_mm);
        $this->assertSame('14850', $updated->total_hole);
        $this->assertSame('Air-jet', $updated->machine_type);
        $this->assertSame(3, $updated->min_stock);

        $bad = $this->specCsv([
            ['Code', 'Min spare stock'],
            ['RD-200', 'lots'],
            ['', '1'],
            ['RD-300', '1'],
            ['rd-300', '2'],
        ]);
        $errors = $this->actingAs($user)->post('/reed-inventory/specs/import', ['file' => $bad], ['Accept' => 'application/json'])
            ->assertUnprocessable()->json('errors');
        $this->assertCount(3, $errors);
        $this->assertStringContainsString('Row 2', $errors[0]);
        $this->assertSame(2, ReedSpec::count()); // nothing saved

        $this->actingAs($this->operator())->post('/reed-inventory/specs/import', ['file' => $ok], ['Accept' => 'application/json'])
            ->assertForbidden();
    }
}
