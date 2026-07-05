<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('creel_records', function (Blueprint $table) {
            $table->longText('raw_batches')->nullable()->after('batches');
        });

        // Populate raw_batches from existing batches (strip positions field)
        DB::table('creel_records')->whereNull('raw_batches')->chunkById(100, function ($rows) {
            foreach ($rows as $row) {
                $batches    = json_decode($row->batches, true) ?? [];
                $rawBatches = array_map(fn ($b) => array_diff_key($b, ['positions' => 1]), $batches);
                DB::table('creel_records')
                    ->where('id', $row->id)
                    ->update(['raw_batches' => json_encode($rawBatches)]);
            }
        });
    }

    public function down(): void
    {
        Schema::table('creel_records', function (Blueprint $table) {
            $table->dropColumn('raw_batches');
        });
    }
};
