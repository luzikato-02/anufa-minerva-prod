<?php

namespace Tests\Feature\Api;

use App\Models\TensionComparison;
use App\Models\TensionRecord;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

/** Saving, reopening and changing tension record comparisons. */
class TensionComparisonTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        Permission::findOrCreate('tension-records.view', 'web');

        return User::factory()->withoutTwoFactor()->create()->givePermissionTo('tension-records.view');
    }

    private function record(string $type, string $machine): int
    {
        return TensionRecord::create([
            'record_type' => $type, 'csv_data' => '', 'form_data' => ['specTens' => '180', 'tensPlus' => '15'],
            'measurement_data' => [], 'metadata' => ['machine_number' => $machine], 'problems' => [],
        ])->id;
    }

    private function save(User $user, array $overrides = []): array
    {
        $ids = $overrides['record_ids'] ?? [$this->record('twisting', 'TW-01'), $this->record('twisting', 'TW-02')];

        return $this->actingAs($user)->postJson('/tension-comparisons', $overrides + [
            'name' => 'Before and after spring change',
            'record_type' => 'twisting',
            'record_ids' => $ids,
            'metric' => 'max',
            'hidden_ids' => [$ids[1]],
        ])->assertCreated()->json('data');
    }

    public function test_requires_tension_records_view(): void
    {
        $this->actingAs(User::factory()->withoutTwoFactor()->create())
            ->getJson('/tension-comparisons')->assertForbidden();
    }

    public function test_saves_and_reopens_a_comparison_with_records_in_legend_order(): void
    {
        $user = $this->user();
        $a = $this->record('twisting', 'TW-07');
        $b = $this->record('twisting', 'TW-03');
        $c = $this->record('twisting', 'TW-11');
        $saved = $this->save($user, ['record_ids' => [$c, $a, $b], 'hidden_ids' => [$a, 999]]);

        $this->assertSame([$c, $a, $b], $saved['record_ids']);
        $this->assertSame([$a], $saved['hidden_ids'], 'hidden ids outside the comparison are dropped');

        $shown = $this->getJson("/tension-comparisons/{$saved['id']}")->assertOk()->json('data');
        $this->assertSame('max', $shown['metric']);
        $this->assertSame(['TW-11', 'TW-07', 'TW-03'], array_column(array_column($shown['records'], 'metadata'), 'machine_number'));
        $this->assertSame([], $shown['missing_ids']);

        $list = $this->getJson('/tension-comparisons?type=twisting')->assertOk()->json('data');
        $this->assertSame(['Before and after spring change'], array_column($list, 'name'));
        $this->assertSame(3, $list[0]['available']);
        $this->assertSame([], $this->getJson('/tension-comparisons?type=weaving')->json('data'));
    }

    public function test_other_users_cannot_see_or_change_a_comparison(): void
    {
        $saved = $this->save($this->user());
        $other = $this->user();

        $this->actingAs($other);
        $this->assertSame([], $this->getJson('/tension-comparisons')->json('data'));
        $this->getJson("/tension-comparisons/{$saved['id']}")->assertNotFound();
        $this->patchJson("/tension-comparisons/{$saved['id']}", ['name' => 'Mine now'])->assertNotFound();
        $this->deleteJson("/tension-comparisons/{$saved['id']}")->assertNotFound();
        $this->assertDatabaseHas('tension_comparisons', ['id' => $saved['id'], 'name' => 'Before and after spring change']);
    }

    public function test_validates_count_type_and_name(): void
    {
        $user = $this->user();
        $tw = $this->record('twisting', 'TW-01');
        $wv = $this->record('weaving', 'WV-01');
        $many = array_map(fn ($i) => $this->record('twisting', "TW-1{$i}"), range(0, 8));

        $post = fn (array $body) => $this->actingAs($user)->postJson('/tension-comparisons', $body + ['name' => 'X', 'record_type' => 'twisting']);

        $post(['record_ids' => [$tw]])->assertUnprocessable()->assertJsonValidationErrors('record_ids');
        $post(['record_ids' => $many])->assertUnprocessable()->assertJsonValidationErrors('record_ids');
        $post(['record_ids' => [$tw, $wv]])->assertUnprocessable()->assertJsonValidationErrors('record_ids');
        $post(['record_ids' => [$tw, 999999]])->assertUnprocessable()->assertJsonValidationErrors('record_ids');
        $post(['record_ids' => [$tw, $many[0]], 'name' => '   '])->assertUnprocessable()->assertJsonValidationErrors('name');
        $post(['record_ids' => [$tw, $many[0]], 'metric' => 'median'])->assertUnprocessable()->assertJsonValidationErrors('metric');
    }

    public function test_updates_records_settings_and_name(): void
    {
        $user = $this->user();
        $saved = $this->save($user);
        $extra = $this->record('twisting', 'TW-09');
        $wv = $this->record('weaving', 'WV-02');

        $updated = $this->patchJson("/tension-comparisons/{$saved['id']}", [
            'name' => 'Renamed', 'metric' => 'spread', 'record_ids' => [$saved['record_ids'][0], $extra],
        ])->assertOk()->json('data');

        $this->assertSame('Renamed', $updated['name']);
        $this->assertSame('spread', $updated['metric']);
        $this->assertSame([$saved['record_ids'][0], $extra], $updated['record_ids']);
        $this->assertSame([], $updated['hidden_ids'], 'a hidden record that left the comparison is forgotten');

        $this->patchJson("/tension-comparisons/{$saved['id']}", ['record_ids' => [$extra, $wv]])
            ->assertUnprocessable()->assertJsonValidationErrors('record_ids');
        $this->patchJson("/tension-comparisons/{$saved['id']}", ['record_type' => 'weaving'])
            ->assertUnprocessable()->assertJsonValidationErrors('record_type');
    }

    public function test_reports_records_deleted_since_saving_and_can_be_deleted(): void
    {
        $user = $this->user();
        $saved = $this->save($user);
        TensionRecord::destroy($saved['record_ids'][1]);

        $shown = $this->actingAs($user)->getJson("/tension-comparisons/{$saved['id']}")->json('data');
        $this->assertCount(1, $shown['records']);
        $this->assertSame([$saved['record_ids'][1]], $shown['missing_ids']);
        $this->assertSame(1, $this->getJson('/tension-comparisons')->json('data.0.available'));

        $this->deleteJson("/tension-comparisons/{$saved['id']}")->assertNoContent();
        $this->assertSame(0, TensionComparison::count());
    }
}
