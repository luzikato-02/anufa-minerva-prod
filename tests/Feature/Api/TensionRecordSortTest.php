<?php

namespace Tests\Feature\Api;

use App\Models\TensionRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/**
 * Server-side sorting for the tension records index (used by the DataGrid on
 * the records page and by the mobile API). Only whitelisted sort ids apply.
 */
class TensionRecordSortTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        Permission::findOrCreate('tension-records.view', 'web');

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo('tension-records.view');
    }

    private function record(string $machine, string $operator, string $createdAt, array $form = []): void
    {
        $record = TensionRecord::create([
            'record_type' => 'twisting',
            'csv_data' => '',
            'form_data' => $form,
            'measurement_data' => [],
            'metadata' => ['machine_number' => $machine, 'operator' => $operator],
            'problems' => [],
        ]);
        $record->forceFill(['created_at' => $createdAt, 'updated_at' => $createdAt])->save();
    }

    private function machines(array $query): array
    {
        $response = $this->actingAs($this->user())
            ->getJson('/tension-records?'.http_build_query(['type' => 'twisting'] + $query))
            ->assertOk();

        return array_map(fn ($r) => $r['metadata']['machine_number'], $response->json('data'));
    }

    protected function setUp(): void
    {
        parent::setUp();
        // Process parameters arrive as text from the form; 9000 must sort above 850.
        $this->record('TW-02', 'Rina', '2026-11-05 08:00:00', ['dtexNumber' => '1400', 'tpm' => '470', 'rpm' => '9000']);
        $this->record('TW-03', 'Asep', '2026-11-07 08:00:00', ['dtexNumber' => '940', 'tpm' => '520', 'rpm' => '850']);
        $this->record('TW-01', 'Dedi', '2026-11-06 08:00:00', ['dtexNumber' => '1880', 'tpm' => '390', 'rpm' => '8500']);
    }

    public function test_defaults_to_newest_first(): void
    {
        $this->assertSame(['TW-03', 'TW-01', 'TW-02'], $this->machines([]));
    }

    public function test_sorts_by_a_metadata_field_in_either_direction(): void
    {
        $this->assertSame(['TW-01', 'TW-02', 'TW-03'], $this->machines(['sort_by' => 'machine', 'sort_dir' => 'asc']));
        $this->assertSame(['TW-03', 'TW-02', 'TW-01'], $this->machines(['sort_by' => 'machine', 'sort_dir' => 'desc']));
        $this->assertSame(['TW-03', 'TW-01', 'TW-02'], $this->machines(['sort_by' => 'operator', 'sort_dir' => 'asc']));
    }

    public function test_sorts_by_recorded_time_ascending(): void
    {
        $this->assertSame(['TW-02', 'TW-01', 'TW-03'], $this->machines(['sort_by' => 'recorded_at', 'sort_dir' => 'asc']));
    }

    public function test_ignores_unknown_sort_columns_and_directions(): void
    {
        $this->assertSame(['TW-03', 'TW-01', 'TW-02'], $this->machines(['sort_by' => 'csv_data; drop table users', 'sort_dir' => 'asc']));
        $this->assertSame(['TW-03', 'TW-02', 'TW-01'], $this->machines(['sort_by' => 'machine', 'sort_dir' => 'sideways']));
    }

    public function test_sorts_process_parameters_as_numbers(): void
    {
        $this->assertSame(['TW-03', 'TW-02', 'TW-01'], $this->machines(['sort_by' => 'dtex', 'sort_dir' => 'asc']));
        $this->assertSame(['TW-03', 'TW-02', 'TW-01'], $this->machines(['sort_by' => 'tpm', 'sort_dir' => 'desc']));
        $this->assertSame(['TW-03', 'TW-01', 'TW-02'], $this->machines(['sort_by' => 'rpm', 'sort_dir' => 'asc']));
    }
}
