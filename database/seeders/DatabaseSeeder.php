<?php

namespace Database\Seeders;

use App\Models\FinishEarlierRecord;
use App\Models\StockTakingRecord;
use App\Models\TensionRecord;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->seedUsers();
        $this->seedTensionRecords();
        $this->seedStockTakeRecords();
        $this->seedFinishEarlierRecords();
    }

    private function seedUsers(): void
    {
        User::firstOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'username' => 'testuser',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );

        User::firstOrCreate(
            ['email' => 'admin@example.com'],
            [
                'name' => 'Admin User',
                'username' => 'admin',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ]
        );
    }

    private function seedTensionRecords(): void
    {
        // === Twisting ===
        $this->createTwistingRecord(
            createdAt: now()->subDays(6),
            formData: [
                'machineNumber' => 'TM-01',
                'itemNumber' => 'ITEM-2201',
                'metersCheck' => '500',
                'operator' => 'Siti Aminah',
                'dtexNumber' => '167',
                'tpm' => '120',
                'specTens' => '15',
                'tensPlus' => '2',
                'rpm' => '8000',
                'yarnCode' => 'YC-200',
            ],
            measurementData: [
                '1' => ['max' => 16, 'min' => 14],
                '2' => ['max' => 15, 'min' => 13.5],
                '3' => ['max' => 16.5, 'min' => 14.5],
                '4' => ['max' => 15.5, 'min' => 13],
                '5' => ['max' => 16, 'min' => 14],
                '6' => ['max' => 15, 'min' => 13.5],
            ],
            problems: [],
            progress: ['total' => 84, 'completed' => 84, 'percentage' => 100],
        );

        $this->createTwistingRecord(
            createdAt: now()->subDays(3),
            formData: [
                'machineNumber' => 'TM-02',
                'itemNumber' => 'ITEM-2202',
                'metersCheck' => '500',
                'operator' => 'Budi Santoso',
                'dtexNumber' => '150',
                'tpm' => '110',
                'specTens' => '14',
                'tensPlus' => '2',
                'rpm' => '7500',
                'yarnCode' => 'YC-201',
            ],
            measurementData: [
                '1' => ['max' => 14, 'min' => 12.5],
                '2' => ['max' => 20, 'min' => 18],
                '3' => ['max' => 13.5, 'min' => 12],
            ],
            problems: [
                [
                    'id' => now()->subDays(3)->timestamp * 1000,
                    'spindleNumber' => 2,
                    'description' => 'Tension reading too high - check spindle bearing.',
                    'timestamp' => now()->subDays(3)->toIso8601String(),
                ],
            ],
            progress: ['total' => 84, 'completed' => 40, 'percentage' => 48],
        );

        $this->createTwistingRecord(
            createdAt: now()->subHours(4),
            formData: [
                'machineNumber' => 'TM-03',
                'itemNumber' => 'ITEM-2203',
                'metersCheck' => '500',
                'operator' => 'QA Tester',
                'dtexNumber' => '167',
                'tpm' => '120',
                'specTens' => '15',
                'tensPlus' => '2',
                'rpm' => '8000',
                'yarnCode' => 'YC-202',
            ],
            measurementData: [
                '1' => ['max' => 16, 'min' => 14],
                '2' => ['max' => 15.5, 'min' => 13.5],
                '3' => ['max' => 16, 'min' => 14],
                '4' => ['max' => 15, 'min' => 13],
            ],
            problems: [],
            progress: ['total' => 84, 'completed' => 84, 'percentage' => 100],
        );

        // === Weaving ===
        $this->createWeavingRecord(
            createdAt: now()->subDays(5),
            formData: [
                'machineNumber' => 'WM-01',
                'metersCheck' => '500',
                'itemNumber' => 'WV-3001',
                'itemDescription' => 'Plain Weave Fabric',
                'operator' => 'Dewi Lestari',
                'productionOrder' => 'PO-WV-2026-001',
                'baleNumber' => 'BALE-10',
                'colorCode' => 'CC-10',
                'specTens' => '20',
                'tensPlus' => '3',
            ],
            measurementData: [
                'AI' => ['A' => ['1' => ['max' => 21, 'min' => 18], '2' => ['max' => 20, 'min' => 17]]],
                'AO' => ['A' => ['1' => ['max' => 19, 'min' => 17]]],
                'BI' => [],
                'BO' => [],
            ],
            problems: [],
            progress: ['total' => 320, 'completed' => 320, 'percentage' => 100],
        );

        $this->createWeavingRecord(
            createdAt: now()->subDay(),
            formData: [
                'machineNumber' => 'WM-02',
                'metersCheck' => '500',
                'itemNumber' => 'WV-3002',
                'itemDescription' => 'Twill Weave Fabric',
                'operator' => 'Agus Wijaya',
                'productionOrder' => 'PO-WV-2026-002',
                'baleNumber' => 'BALE-11',
                'colorCode' => 'CC-11',
                'specTens' => '22',
                'tensPlus' => '3',
            ],
            measurementData: [
                'AI' => ['A' => ['1' => ['max' => 25, 'min' => 22]]],
                'BI' => ['A' => ['1' => ['max' => 23, 'min' => 20]]],
                'AO' => [],
                'BO' => [],
            ],
            problems: [
                [
                    'id' => now()->subDay()->timestamp * 1000,
                    'position' => 'AI-A-Col1',
                    'description' => 'Excessive tension on inner warp - inspect tensioner.',
                    'timestamp' => now()->subDay()->toIso8601String(),
                ],
            ],
            progress: ['total' => 320, 'completed' => 120, 'percentage' => 37],
        );

        $this->createWeavingRecord(
            createdAt: now()->subHours(2),
            formData: [
                'machineNumber' => 'WM-99',
                'metersCheck' => '500',
                'itemNumber' => 'WV-3003',
                'itemDescription' => 'Satin Weave Fabric',
                'operator' => 'QA Tester',
                'productionOrder' => 'PO-WV-2026-003',
                'baleNumber' => 'BALE-12',
                'colorCode' => 'CC-12',
                'specTens' => '20',
                'tensPlus' => '3',
            ],
            measurementData: [
                'AI' => ['A' => ['1' => ['max' => 21, 'min' => 18]]],
                'AO' => ['A' => ['1' => ['max' => 20, 'min' => 17]]],
                'BI' => [],
                'BO' => [],
            ],
            problems: [],
            progress: ['total' => 320, 'completed' => 320, 'percentage' => 100],
        );
    }

    private function createTwistingRecord(\DateTimeInterface $createdAt, array $formData, array $measurementData, array $problems, array $progress): void
    {
        $exportDate = \Illuminate\Support\Carbon::instance($createdAt)->format('n/j/Y, g:i:s A');

        $rows = '';
        foreach ($measurementData as $spindle => $values) {
            $rows .= "{$spindle},{$values['max']},{$values['min']}\n";
        }

        $problemRows = '';
        foreach ($problems as $problem) {
            $ts = \Illuminate\Support\Carbon::parse($problem['timestamp'])->format('n/j/Y, g:i:s A');
            $problemRows .= "{$problem['spindleNumber']},\"{$problem['description']}\",{$ts}\n";
        }

        $csv = "TWISTING TENSION DATA EXPORT\n"
            . "Export Date: {$exportDate}\n\n"
            . "=== CONFIGURATION PARAMETERS ===\n"
            . "Parameter,Value\n"
            . "Operator,{$formData['operator']}\n"
            . "Item Number,{$formData['itemNumber']}\n"
            . "Meters Check,{$formData['metersCheck']}\n"
            . "Dtex Number,{$formData['dtexNumber']}\n"
            . "TPM,{$formData['tpm']}\n"
            . "Spec Tens,{$formData['specTens']}\n"
            . "Tens \xc2\xb1,{$formData['tensPlus']}\n"
            . "RPM,{$formData['rpm']}\n"
            . "Machine Number,{$formData['machineNumber']}\n"
            . "Yarn Code,{$formData['yarnCode']}\n\n"
            . "=== TENSION MEASUREMENT DATA ===\n"
            . "Spindle Number,Max Value,Min Value\n"
            . $rows . "\n"
            . "=== PROBLEM REPORTS ===\n"
            . "Spindle Number,Description,Timestamp\n"
            . $problemRows;

        $record = TensionRecord::create([
            'record_type' => 'twisting',
            'csv_data' => $csv,
            'form_data' => $formData,
            'measurement_data' => $measurementData,
            'problems' => $problems,
            'metadata' => [
                'total_measurements' => $progress['total'],
                'completed_measurements' => $progress['completed'],
                'progress_percentage' => $progress['percentage'],
                'operator' => $formData['operator'],
                'machine_number' => $formData['machineNumber'],
                'item_number' => $formData['itemNumber'],
                'yarn_code' => $formData['yarnCode'],
            ],
        ]);

        $this->setTimestamps($record, $createdAt);
    }

    private function createWeavingRecord(\DateTimeInterface $createdAt, array $formData, array $measurementData, array $problems, array $progress): void
    {
        $exportDate = \Illuminate\Support\Carbon::instance($createdAt)->format('n/j/Y, g:i:s A');

        $rows = '';
        foreach ($measurementData as $side => $rowsData) {
            foreach ($rowsData as $row => $cols) {
                foreach ($cols as $col => $values) {
                    $rows .= "{$side}-{$row}-Col{$col},{$side},{$row},{$col},{$values['max']},{$values['min']}\n";
                }
            }
        }

        $problemRows = '';
        foreach ($problems as $problem) {
            $ts = \Illuminate\Support\Carbon::parse($problem['timestamp'])->format('n/j/Y, g:i:s A');
            $problemRows .= "{$problem['position']},\"{$problem['description']}\",{$ts}\n";
        }

        $csv = "WEAVING TENSION DATA EXPORT\n"
            . "Export Date: {$exportDate}\n\n"
            . "=== CONFIGURATION PARAMETERS ===\n"
            . "Parameter,Value\n"
            . "Item Number,{$formData['itemNumber']}\n"
            . "Item Description,{$formData['itemDescription']}\n"
            . "Production Order,{$formData['productionOrder']}\n"
            . "Meters Check,{$formData['metersCheck']}\n"
            . "Bale Number,{$formData['baleNumber']}\n"
            . "Color Code,{$formData['colorCode']}\n"
            . "Spec Tens,{$formData['specTens']}\n"
            . "Tens \xc2\xb1,{$formData['tensPlus']}\n"
            . "Machine Number,{$formData['machineNumber']}\n"
            . "Operator,{$formData['operator']}\n\n"
            . "=== TENSION MEASUREMENT DATA ===\n"
            . "Position,Creel Side,Row,Column,Max Value,Min Value\n"
            . $rows . "\n"
            . "=== PROBLEM REPORTS ===\n"
            . "Position,Description,Timestamp\n"
            . $problemRows;

        $record = TensionRecord::create([
            'record_type' => 'weaving',
            'csv_data' => $csv,
            'form_data' => $formData,
            'measurement_data' => $measurementData,
            'problems' => $problems,
            'metadata' => [
                'total_measurements' => $progress['total'],
                'completed_measurements' => $progress['completed'],
                'progress_percentage' => $progress['percentage'],
                'operator' => $formData['operator'],
                'machine_number' => $formData['machineNumber'],
                'item_number' => $formData['itemNumber'],
                'item_description' => $formData['itemDescription'],
            ],
        ]);

        $this->setTimestamps($record, $createdAt);
    }

    private function seedStockTakeRecords(): void
    {
        // Session 1: Completed, fully recorded
        $session1 = StockTakingRecord::create([
            'session_id' => '100234',
            'indv_batch_data' => [
                ['batch_number' => 'BATCH-001', 'material_code' => 'MAT-100', 'material_description' => 'Cotton Yarn 30s', 'weight' => 25.5, 'bobbin_qty' => 10],
                ['batch_number' => 'BATCH-002', 'material_code' => 'MAT-101', 'material_description' => 'Polyester Yarn 40s', 'weight' => 30.0, 'bobbin_qty' => 12],
                ['batch_number' => 'BATCH-003', 'material_code' => 'MAT-102', 'material_description' => 'Cotton/Poly Blend 50s', 'weight' => 22.75, 'bobbin_qty' => 8],
            ],
            'metadata' => [
                'total_batches' => 3,
                'total_materials' => 3,
                'total_checked_batches' => 3,
                'session_leader' => 'Andi Setiawan',
                'session_status' => 'Completed',
            ],
        ]);
        $session1->recorded_batches = [
            ['batch_number' => 'BATCH-001', 'material_code' => 'MAT-100', 'material_description' => 'Cotton Yarn 30s', 'actual_weight' => 25.4, 'total_bobbins' => 10, 'line_position' => 1, 'row_position' => 'A', 'timestamp_found' => now()->subDays(4)->toIso8601String(), 'recorded_at' => now()->subDays(4)->toIso8601String(), 'user_found' => 'Andi Setiawan', 'explanation' => null],
            ['batch_number' => 'BATCH-002', 'material_code' => 'MAT-101', 'material_description' => 'Polyester Yarn 40s', 'actual_weight' => 29.8, 'total_bobbins' => 12, 'line_position' => 1, 'row_position' => 'B', 'timestamp_found' => now()->subDays(4)->toIso8601String(), 'recorded_at' => now()->subDays(4)->toIso8601String(), 'user_found' => 'Andi Setiawan', 'explanation' => null],
            ['batch_number' => 'BATCH-003', 'material_code' => 'MAT-102', 'material_description' => 'Cotton/Poly Blend 50s', 'actual_weight' => 22.0, 'total_bobbins' => 8, 'line_position' => 2, 'row_position' => 'A', 'timestamp_found' => now()->subDays(4)->toIso8601String(), 'recorded_at' => now()->subDays(4)->toIso8601String(), 'user_found' => 'Andi Setiawan', 'explanation' => 'Slight weight loss due to moisture.'],
        ];
        $session1->save();
        $this->setTimestamps($session1, now()->subDays(4));

        // Session 2: In progress, partially recorded
        $session2 = StockTakingRecord::create([
            'session_id' => '100567',
            'indv_batch_data' => [
                ['batch_number' => 'BATCH-101', 'material_code' => 'MAT-200', 'material_description' => 'Nylon Yarn 70D', 'weight' => 18.0, 'bobbin_qty' => 6],
                ['batch_number' => 'BATCH-102', 'material_code' => 'MAT-201', 'material_description' => 'Spandex Core 40D', 'weight' => 12.5, 'bobbin_qty' => 4],
                ['batch_number' => 'BATCH-103', 'material_code' => 'MAT-202', 'material_description' => 'Viscose Yarn 30s', 'weight' => 27.0, 'bobbin_qty' => 9],
                ['batch_number' => 'BATCH-104', 'material_code' => 'MAT-203', 'material_description' => 'Linen Yarn 20s', 'weight' => 33.0, 'bobbin_qty' => 11],
                ['batch_number' => 'BATCH-105', 'material_code' => 'MAT-204', 'material_description' => 'Wool Blend 24s', 'weight' => 28.5, 'bobbin_qty' => 9],
            ],
            'metadata' => [
                'total_batches' => 5,
                'total_materials' => 5,
                'total_checked_batches' => 2,
                'session_leader' => 'Budi Santoso',
                'session_status' => 'In Progress',
            ],
        ]);
        $session2->recorded_batches = [
            ['batch_number' => 'BATCH-101', 'material_code' => 'MAT-200', 'material_description' => 'Nylon Yarn 70D', 'actual_weight' => 17.9, 'total_bobbins' => 6, 'line_position' => 3, 'row_position' => 'A', 'timestamp_found' => now()->subHours(20)->toIso8601String(), 'recorded_at' => now()->subHours(20)->toIso8601String(), 'user_found' => 'Budi Santoso', 'explanation' => null],
            ['batch_number' => 'BATCH-103', 'material_code' => 'MAT-202', 'material_description' => 'Viscose Yarn 30s', 'actual_weight' => 26.8, 'total_bobbins' => 9, 'line_position' => 3, 'row_position' => 'B', 'timestamp_found' => now()->subHours(19)->toIso8601String(), 'recorded_at' => now()->subHours(19)->toIso8601String(), 'user_found' => 'Budi Santoso', 'explanation' => null],
        ];
        $session2->save();
        $this->setTimestamps($session2, now()->subDay());

        // Session 3: In progress, nothing recorded yet
        $session3 = StockTakingRecord::create([
            'session_id' => '100890',
            'indv_batch_data' => [
                ['batch_number' => 'BATCH-201', 'material_code' => 'MAT-300', 'material_description' => 'Cotton Yarn 20s', 'weight' => 24.0, 'bobbin_qty' => 8],
                ['batch_number' => 'BATCH-202', 'material_code' => 'MAT-301', 'material_description' => 'Polyester Yarn 30s', 'weight' => 21.0, 'bobbin_qty' => 7],
                ['batch_number' => 'BATCH-203', 'material_code' => 'MAT-302', 'material_description' => 'Acrylic Yarn 28s', 'weight' => 19.5, 'bobbin_qty' => 6],
                ['batch_number' => 'BATCH-204', 'material_code' => 'MAT-303', 'material_description' => 'Cotton/Lycra 32s', 'weight' => 16.0, 'bobbin_qty' => 5],
            ],
            'metadata' => [
                'total_batches' => 4,
                'total_materials' => 4,
                'total_checked_batches' => 0,
                'session_leader' => 'QA Test Leader',
                'session_status' => 'In Progress',
            ],
        ]);
        $this->setTimestamps($session3, now()->subHours(2));
    }

    private function seedFinishEarlierRecords(): void
    {
        $this->createFinishEarlierRecord(
            createdAt: now()->subDays(3),
            metadata: [
                'machine_number' => 'WM-01',
                'style' => 'Plain Weave - Style A',
                'production_order' => 'PO-FE-2026-0501',
                'roll_construction' => '1/1 Plain',
                'shift_group' => 'A',
            ],
            entries: [
                ['creel_side' => 'AI', 'row_number' => 'A', 'column_number' => '1', 'meters_finish' => 10],
                ['creel_side' => 'AI', 'row_number' => 'A', 'column_number' => '2', 'meters_finish' => 12],
                ['creel_side' => 'BO', 'row_number' => 'B', 'column_number' => '1', 'meters_finish' => 14],
            ],
        );

        $this->createFinishEarlierRecord(
            createdAt: now()->subDay(),
            metadata: [
                'machine_number' => 'WM-02',
                'style' => 'Twill 2/1',
                'production_order' => 'PO-FE-2026-0502',
                'roll_construction' => '2/1 Twill',
                'shift_group' => 'B',
            ],
            entries: [
                ['creel_side' => 'AO', 'row_number' => 'A', 'column_number' => '1', 'meters_finish' => 8],
                ['creel_side' => 'BI', 'row_number' => 'B', 'column_number' => '2', 'meters_finish' => 10],
            ],
        );

        $this->createFinishEarlierRecord(
            createdAt: now()->subHour(),
            metadata: [
                'machine_number' => 'WM-03',
                'style' => 'Satin Weave',
                'production_order' => 'PO-FE-2026-0503',
                'roll_construction' => '5/1 Satin',
                'shift_group' => 'A',
            ],
            entries: [
                ['creel_side' => 'AI', 'row_number' => 'A', 'column_number' => '1', 'meters_finish' => 10],
                ['creel_side' => 'AI', 'row_number' => 'B', 'column_number' => '1', 'meters_finish' => 11],
                ['creel_side' => 'AO', 'row_number' => 'A', 'column_number' => '2', 'meters_finish' => 12],
                ['creel_side' => 'BO', 'row_number' => 'B', 'column_number' => '2', 'meters_finish' => 12],
            ],
        );
    }

    private function createFinishEarlierRecord(\DateTimeInterface $createdAt, array $metadata, array $entries): void
    {
        $total = count($entries);
        $average = $total > 0 ? round(array_sum(array_column($entries, 'meters_finish')) / $total) : 0;

        $metadata['total_finish_earlier'] = $total;
        $metadata['average_meters_finish'] = $average;

        $record = FinishEarlierRecord::create([
            'metadata' => $metadata,
            'entries' => $entries,
        ]);

        $this->setTimestamps($record, $createdAt);
    }

    private function setTimestamps(\Illuminate\Database\Eloquent\Model $model, \DateTimeInterface $createdAt): void
    {
        DB::table($model->getTable())
            ->where('id', $model->id)
            ->update([
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);
    }
}
