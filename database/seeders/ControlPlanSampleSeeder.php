<?php

namespace Database\Seeders;

use App\Models\ControlPlan;
use App\Models\ControlPlanReference;
use App\Models\ControlPlanRevision;
use App\Models\ControlPlanSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

/**
 * W-WSD-W-30 (Mill Production TCF1 & TCF2) as sample data until plans are imported from Word: Rev 11 released,
 * and a Rev 12 draft that adds the Unwoven cord check and checks fabric width every shift. Not run by
 * DatabaseSeeder; run it with `php artisan db:seed --class=ControlPlanSampleSeeder`.
 */
class ControlPlanSampleSeeder extends Seeder
{
    public function run(): void
    {
        $settings = ControlPlanSetting::current();
        $settings->update(['mill' => 'Mill Production TCF1 & TCF2', 'org_plant' => 'PT. Indo Kordsa Tbk/TCF', 'org_code' => 'IK']);

        foreach (['QA-IK-14', 'T-WSD-W-3', 'T-WSD-W-21', 'TCF-W014', 'TCF-W022', 'W-WSD-W-26', 'W-W-01'] as $code) {
            ControlPlanReference::firstOrCreate(['code' => $code]);
        }

        if (ControlPlan::where('doc_no', 'W-WSD-W-30')->exists()) {
            return;
        }
        // role() throws for a role that was never seeded, so check it exists first.
        $author = (Role::where('name', 'admin')->exists() ? User::role('admin')->first() : null) ?? User::first();

        $plan = ControlPlan::create(['doc_no' => 'W-WSD-W-30']);
        $header = ['mill' => 'Mill Production TCF1 & TCF2', 'sp_ref' => 'W-W-01', 'sp_date' => '20 Juni 2014', 'issued' => '27 Oktober 2016'];
        $info = array_fill_keys(ControlPlanRevision::INFO_FIELDS, '');
        $info['phase'] = 'production';
        $info['org_plant'] = 'PT. Indo Kordsa Tbk/TCF';
        $info['org_code'] = 'IK';

        $steps = [
            ['id' => 's5', 'no' => '5', 'group' => 'Machine running', 'name' => 'Splice during last creel', 'machine' => 'Splicer'],
            ['id' => 's6a', 'no' => '6', 'group' => 'Doffing process', 'name' => 'Doff Greige Fabric', 'machine' => 'Wind-up table'],
            ['id' => 's6b', 'no' => '6', 'group' => 'Doffing process', 'name' => 'Weigh greige fabric', 'machine' => 'Weighing scale'],
        ];
        $line = fn (string $id, string $step, array $f) => ['id' => $id, 'step_id' => $step] + $f + [
            'process' => '-', 'sc' => '-', 'size' => '1x', 'frequency' => 'Every bale', 'control' => 'ERP system',
            'pic' => 'Weaver', 'reaction' => 'Segregate product', 'reaction_ref' => 'QA-IK-14',
        ];
        $lines = [
            $line('c1', 's5', ['product' => 'Total splice', 'spec' => '< 100 splices (T-WSD-W-21)', 'measurement' => 'Count bobbins with black sticker', 'frequency' => 'Every last bale', 'control' => 'ERP system, TCF-W022']),
            $line('c2', 's6a', ['product' => 'Bad winding', 'spec' => 'T-WSD-W-3', 'measurement' => 'Visual, Measuring tape', 'frequency' => 'Every shift']),
            $line('c3', 's6a', ['product' => 'Fabric width', 'sc' => 'SC', 'spec' => '1,300 – 2,000 mm*', 'measurement' => 'Measuring tape', 'control' => 'TCF-W014, ERP system']),
            $line('c4', 's6a', ['product' => 'Roll diameter', 'spec' => 'Max. 160 cm', 'measurement' => 'Measuring tape', 'control' => 'TCF-W014, ERP system']),
            $line('c5', 's6a', ['product' => 'Winding hardness', 'spec' => 'T-WSD-W-3', 'measurement' => 'Measuring tape', 'control' => 'TCF-W014, ERP system']),
            $line('c7', 's6a', ['product' => 'Length', 'spec' => '100 – 3,000 m*', 'measurement' => 'Check on HMI', 'control' => 'TCF-W014, ERP system']),
            $line('c8', 's6b', ['product' => '-', 'process' => 'Weighing', 'spec' => 'W-WSD-W-26', 'measurement' => 'Weighing scale', 'reaction' => 'Reweigh product', 'reaction_ref' => 'W-WSD-W-26']),
        ];

        $plan->revisions()->create([
            'rev_no' => 11,
            'status' => ControlPlanRevision::RELEASED,
            'header' => $header,
            'info' => $info,
            'content' => ['steps' => $steps, 'lines' => $lines],
            'author_id' => $author?->id,
            'submitted_by' => $author?->id,
            'release_date' => '2026-10-15',
            'next_review_date' => '2028-10-15',
        ]);

        // Rev 12: fabric width every shift, and a new Unwoven cord line after Winding hardness.
        $draft = array_map(fn ($l) => $l['id'] === 'c3' ? ['frequency' => 'Every shift'] + $l : $l, $lines);
        array_splice($draft, 5, 0, [$line('c6', 's6a', ['product' => 'Unwoven cord', 'spec' => 'No unwoven cord', 'measurement' => 'Visual'])]);
        $plan->revisions()->create([
            'rev_no' => 12,
            'status' => ControlPlanRevision::DRAFT,
            'header' => $header,
            'info' => $info,
            'content' => ['steps' => $steps, 'lines' => $draft],
            'author_id' => $author?->id,
        ]);
    }
}
