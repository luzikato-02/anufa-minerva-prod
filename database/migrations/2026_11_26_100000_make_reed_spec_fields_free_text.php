<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Reed spec attributes are typed in however the reed maker writes them ("90", "90/10cm", "1600 mm", "Profile 2"),
 * so every descriptive field is free text and only the code is required. min_stock stays an integer because the
 * below-min-stock alert compares against it.
 */
return new class extends Migration
{
    private const FIELDS = ['dents_per_10cm', 'width_mm', 'working_width_mm', 'height_mm', 'reed_type', 'wire_thickness_mm'];

    private const WAS_DECIMAL = ['dents_per_10cm', 'wire_thickness_mm'];

    public function up(): void
    {
        Schema::table('reed_specs', function (Blueprint $table) {
            foreach (self::FIELDS as $field) {
                $table->string($field)->nullable()->default(null)->change();
            }
        });

        // Decimals came across as "90.00"; show them the way they were typed.
        foreach (DB::table('reed_specs')->get(['id', ...self::WAS_DECIMAL]) as $row) {
            $tidy = [];
            foreach (self::WAS_DECIMAL as $field) {
                $v = $row->{$field};
                if ($v !== null && str_contains($v, '.')) {
                    $tidy[$field] = rtrim(rtrim($v, '0'), '.');
                }
            }
            if ($tidy) {
                DB::table('reed_specs')->where('id', $row->id)->update($tidy);
            }
        }
    }

    public function down(): void
    {
        // Free text cannot be turned back into numbers safely; anything non-numeric is dropped to null first.
        foreach (['dents_per_10cm', 'width_mm', 'working_width_mm', 'height_mm', 'wire_thickness_mm'] as $field) {
            foreach (DB::table('reed_specs')->whereNotNull($field)->get(['id', $field]) as $row) {
                if (! is_numeric($row->{$field})) {
                    DB::table('reed_specs')->where('id', $row->id)->update([$field => null]);
                }
            }
        }
        DB::table('reed_specs')->whereNull('dents_per_10cm')->update(['dents_per_10cm' => '0']);
        DB::table('reed_specs')->whereNull('width_mm')->update(['width_mm' => '0']);
        DB::table('reed_specs')->whereNull('reed_type')->update(['reed_type' => 'flat']);

        Schema::table('reed_specs', function (Blueprint $table) {
            $table->decimal('dents_per_10cm', 7, 2)->change();
            $table->unsignedInteger('width_mm')->change();
            $table->unsignedInteger('working_width_mm')->nullable()->change();
            $table->unsignedInteger('height_mm')->nullable()->change();
            $table->string('reed_type')->default('flat')->change();
            $table->decimal('wire_thickness_mm', 5, 3)->nullable()->change();
        });
    }
};
