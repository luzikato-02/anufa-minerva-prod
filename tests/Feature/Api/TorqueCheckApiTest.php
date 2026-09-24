<?php

namespace Tests\Feature\Api;

use App\Models\CreelType;
use App\Models\TorqueCheckReading;
use App\Models\TorqueCheckSheet;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class TorqueCheckApiTest extends TestCase
{
    use RefreshDatabase;

    private const SHEET = '6f1d2b7e-3c53-4c0e-9f0a-1b7c2d3e4f50';

    private function user(array $perms = ['torque-checks.view', 'torque-checks.create', 'torque-checks.edit', 'torque-checks.delete']): User
    {
        foreach ($perms as $p) {
            Permission::findOrCreate($p, 'web');
        }

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo($perms);
    }

    private function creelType(float $min = 6.0, float $max = 8.0): CreelType
    {
        return CreelType::create(['name' => 'Standard', 'torque_min' => $min, 'torque_max' => $max]);
    }

    private function reading(int $creelTypeId, array $extra = []): array
    {
        return $extra + [
            'sheet_client_uuid' => self::SHEET, 'check_date' => '2026-09-22', 'operator_name' => 'Supanto',
            'machine_number' => '2704', 'creel_type_id' => $creelTypeId,
            'side' => 'Ai', 'row_no' => 1, 'column_letter' => 'A', 'value' => 7.0,
        ];
    }

    public function test_the_first_reading_creates_the_sheet_and_later_readings_join_it(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id))->assertCreated();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['row_no' => 2, 'column_letter' => 'B', 'value' => 6.5]))->assertCreated();

        $this->assertSame(1, TorqueCheckSheet::count());
        $this->assertSame(2, TorqueCheckReading::count());
    }

    public function test_resubmitting_the_same_position_updates_the_value_in_place(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['value' => 7.0]))->assertCreated();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['value' => 7.5]))->assertCreated();

        $this->assertSame(1, TorqueCheckReading::count());
        $this->assertSame(7.5, TorqueCheckReading::first()->value);
    }

    public function test_the_same_row_and_column_on_a_different_side_is_a_separate_cell(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['side' => 'Ai', 'value' => 7.0]))->assertCreated();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['side' => 'Ao', 'value' => 6.5]))->assertCreated();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['side' => 'Bi', 'value' => 7.5]))->assertCreated();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['side' => 'Bo', 'value' => 8.0]))->assertCreated();

        $this->assertSame(1, TorqueCheckSheet::count());
        $this->assertSame(4, TorqueCheckReading::count()); // same row 1, column A, four different sides
        $this->assertSame(['Ai' => 7.0, 'Ao' => 6.5, 'Bi' => 7.5, 'Bo' => 8.0], TorqueCheckReading::pluck('value', 'side')->all());
    }

    public function test_value_is_not_limited_to_half_steps_but_position_must_be_in_range_and_side_must_be_valid(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['value' => 7.3]))->assertCreated();
        $this->assertSame(7.3, TorqueCheckReading::first()->value);
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['row_no' => 106]))->assertUnprocessable()->assertJsonValidationErrors('row_no');
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['column_letter' => 'F']))->assertUnprocessable()->assertJsonValidationErrors('column_letter');
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['side' => 'Ci']))->assertUnprocessable()->assertJsonValidationErrors('side');
    }

    public function test_an_out_of_range_value_is_still_accepted_with_its_note(): void
    {
        $u = $this->user();
        $type = $this->creelType(6.0, 8.0);
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['row_no' => 14, 'value' => 8.5, 'note' => 'Felt aus kotor (Ganti baru)']))
            ->assertCreated()->assertJsonPath('data.note', 'Felt aus kotor (Ganti baru)');

        $reading = TorqueCheckReading::first();
        $this->assertSame(8.5, $reading->value);
        $this->assertNotNull($reading->note);
    }

    public function test_deleting_a_reading_clears_the_cell_and_it_can_be_recorded_again(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $created = $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id))->assertCreated();
        $id = $created->json('data.id');

        $this->actingAs($u, 'sanctum')->deleteJson("/api/v1/torque-checks/readings/{$id}")->assertOk();
        $this->assertSame(0, TorqueCheckReading::count());

        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['value' => 6.5]))->assertCreated();
        $this->assertSame(1, TorqueCheckReading::count());
    }

    public function test_a_reading_can_be_addressed_by_the_uuid_the_app_generated(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $uuid = '2b1f6f3e-8f57-4d0a-9c1e-6a2d7f0b9c11';
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['client_uuid' => $uuid]))->assertCreated();

        $this->actingAs($u, 'sanctum')->patchJson("/api/v1/torque-checks/readings/{$uuid}", ['value' => 7.5])->assertOk()->assertJsonPath('data.value', 7.5);
        $this->actingAs($u, 'sanctum')->deleteJson("/api/v1/torque-checks/readings/{$uuid}")->assertOk();
        $this->assertSame(0, TorqueCheckReading::count());
    }

    public function test_the_list_shows_totals_and_which_sides_have_been_recorded(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['side' => 'Ai', 'row_no' => 1, 'column_letter' => 'A', 'value' => 7.0]))->assertCreated();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['side' => 'Bo', 'row_no' => 14, 'column_letter' => 'A', 'value' => 8.5, 'note' => 'Felt aus kotor (Ganti baru)']))->assertCreated();

        $list = $this->actingAs($u, 'sanctum')->getJson('/api/v1/torque-checks')->assertOk();
        $list->assertJsonPath('data.0.readings_count', 2);
        $list->assertJsonPath('data.0.out_of_range_count', 1);
        $this->assertSame(['Ai', 'Bo'], $list->json('data.0.sides_recorded'));
        $sessionId = $list->json('data.0.session_id');
        $this->assertNotEmpty($sessionId);

        $this->actingAs($u, 'sanctum')->getJson('/api/v1/torque-checks?search='.$sessionId)->assertOk()->assertJsonCount(1, 'data');
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/torque-checks?search=no-such-session')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_the_sheet_can_be_viewed_and_downloaded_as_one_section_per_side(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['side' => 'Ai', 'row_no' => 1, 'column_letter' => 'A', 'value' => 7.0]))->assertCreated();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['side' => 'Ai', 'row_no' => 14, 'column_letter' => 'A', 'value' => 8.5, 'note' => 'Felt aus kotor (Ganti baru)']))->assertCreated();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['side' => 'Bo', 'row_no' => 1, 'column_letter' => 'A', 'value' => 6.5]))->assertCreated();

        $sheet = TorqueCheckSheet::first();
        $this->actingAs($u, 'sanctum')->getJson("/api/v1/torque-checks/{$sheet->id}")->assertOk()->assertJsonCount(3, 'data.readings');

        $csv = $this->actingAs($u, 'sanctum')->getJson("/api/v1/torque-checks/{$sheet->id}/download")->assertOk();
        $sections = collect($csv->json('sections'))->keyBy('side');
        $this->assertSame(['Ai', 'Bo'], $sections->keys()->all());
        $this->assertSame(14, count($sections['Ai']['grid'])); // rows 1..14, blanks included
        $this->assertNull($sections['Ai']['grid'][1]['A']); // row 2, never recorded on this side
        $this->assertEquals(7.0, $sections['Ai']['grid'][0]['A']);
        $this->assertCount(1, $sections['Ai']['problems']);
        $this->assertSame(['ROW' => 14, 'COLUMN' => 'A', 'NOTE' => 'Felt aus kotor (Ganti baru)'], $sections['Ai']['problems'][0]);
        $this->assertSame(1, count($sections['Bo']['grid'])); // Bo only has row 1
        $this->assertEquals(6.5, $sections['Bo']['grid'][0]['A']);
    }

    public function test_a_session_lookup_never_compares_a_mismatched_id_against_a_typed_column(): void
    {
        // Regression: forSessionOrId used to compare `id`/`client_uuid` unconditionally, which sqlite tolerates
        // for a mismatched string but Postgres (dev/prod) rejects outright as a type error — a numeric session
        // id against the uuid column, or a uuid against the bigint id column, on a bigint/uuid-typed column.
        $u = $this->user();
        $type = $this->creelType();
        $created = $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id))->assertCreated();
        $uuid = $created->json('data.sheet.client_uuid');
        $sessionId = $created->json('data.sheet.session_id');
        $this->assertNotEmpty($uuid);
        $this->assertNotEmpty($sessionId);

        $this->actingAs($u, 'sanctum')->getJson("/api/v1/torque-checks/session/{$uuid}")->assertOk(); // a uuid against client_uuid
        $this->actingAs($u, 'sanctum')->getJson("/api/v1/torque-checks/session/{$sessionId}")->assertOk(); // a numeric id against session_id
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/torque-checks/session/not-a-real-id-or-uuid')->assertNotFound(); // matches nothing typed
    }

    public function test_download_404s_when_the_sheet_has_no_readings(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $sheet = TorqueCheckSheet::create(['check_date' => '2026-09-22', 'operator_name' => 'Ana', 'machine_number' => '1', 'creel_type_id' => $type->id]);
        $this->actingAs($u, 'sanctum')->getJson("/api/v1/torque-checks/{$sheet->id}/download")->assertNotFound();
    }

    public function test_deleting_a_sheet_needs_the_delete_permission(): void
    {
        $owner = $this->user();
        $type = $this->creelType();
        $this->actingAs($owner, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id))->assertCreated();
        $sheet = TorqueCheckSheet::first();

        $viewer = $this->user(['torque-checks.view']);
        $this->actingAs($viewer, 'sanctum')->deleteJson("/api/v1/torque-checks/{$sheet->id}")->assertForbidden();
        $this->actingAs($viewer, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id))->assertForbidden();

        $this->actingAs($owner, 'sanctum')->deleteJson("/api/v1/torque-checks/{$sheet->id}")->assertOk();
        $this->assertSame(0, TorqueCheckSheet::count());
        $this->assertSame(0, TorqueCheckReading::count());
    }

    public function test_the_first_reading_assigns_a_session_id_that_a_second_device_can_resume_with(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $created = $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id))->assertCreated();
        $sessionId = $created->json('data.sheet.session_id');
        $this->assertNotEmpty($sessionId);
        $this->assertSame(6, strlen($sessionId));

        // A second device, with no sheet_client_uuid of its own, resumes by session id alone.
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', ['session_id' => $sessionId, 'side' => 'Ai', 'row_no' => 2, 'column_letter' => 'B', 'value' => 6.5])
            ->assertCreated();

        $this->assertSame(1, TorqueCheckSheet::count());
        $this->assertSame(2, TorqueCheckReading::count());
    }

    public function test_getSession_finds_the_sheet_by_its_session_id_or_numeric_id_and_404s_when_unknown(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $created = $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id))->assertCreated();
        $sessionId = $created->json('data.sheet.session_id');
        $sheetId = TorqueCheckSheet::first()->id;

        $this->actingAs($u, 'sanctum')->getJson("/api/v1/torque-checks/session/{$sessionId}")->assertOk()->assertJsonCount(1, 'data.readings');
        $this->actingAs($u, 'sanctum')->getJson("/api/v1/torque-checks/session/{$sheetId}")->assertOk()->assertJsonCount(1, 'data.readings');
        $this->actingAs($u, 'sanctum')->getJson('/api/v1/torque-checks/session/000000')->assertNotFound();
    }

    public function test_resuming_by_session_id_does_not_require_or_change_the_header_fields(): void
    {
        $u = $this->user();
        $type = $this->creelType();
        $created = $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', $this->reading($type->id, ['operator_name' => 'Supanto']))->assertCreated();
        $sessionId = $created->json('data.sheet.session_id');

        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', ['session_id' => $sessionId, 'side' => 'Bi', 'row_no' => 3, 'column_letter' => 'C', 'value' => 7, 'operator_name' => 'Someone Else'])
            ->assertCreated();

        $this->assertSame('Supanto', TorqueCheckSheet::first()->operator_name);
    }

    public function test_an_unknown_session_id_is_rejected_rather_than_silently_starting_a_new_sheet(): void
    {
        $u = $this->user();
        $this->actingAs($u, 'sanctum')->postJson('/api/v1/torque-checks/readings', ['session_id' => '999999', 'side' => 'Ai', 'row_no' => 1, 'column_letter' => 'A', 'value' => 7])
            ->assertNotFound();
        $this->assertSame(0, TorqueCheckSheet::count());
    }
}
