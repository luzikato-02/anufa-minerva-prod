<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('torque_check_readings', function (Blueprint $table) {
            $table->enum('side', ['Ai', 'Ao', 'Bi', 'Bo'])->nullable()->after('torque_check_sheet_id');
        });

        // Side used to be one value per sheet; carry each sheet's side down onto its own readings before the
        // column is removed from torque_check_sheets. A plain per-sheet loop, rather than an UPDATE ... JOIN,
        // since sqlite (tests) has no portable equivalent of one.
        DB::table('torque_check_sheets')->whereNotNull('side')->orderBy('id')->each(function ($sheet) {
            DB::table('torque_check_readings')->where('torque_check_sheet_id', $sheet->id)->update(['side' => $sheet->side]);
        });

        Schema::table('torque_check_sheets', function (Blueprint $table) {
            $table->dropColumn('side');
        });

        Schema::table('torque_check_readings', function (Blueprint $table) {
            $table->dropIndex(['torque_check_sheet_id', 'row_no', 'column_letter']);
            $table->index(['torque_check_sheet_id', 'side', 'row_no', 'column_letter']);
        });
    }

    public function down(): void
    {
        Schema::table('torque_check_sheets', function (Blueprint $table) {
            $table->enum('side', ['Ai', 'Ao', 'Bi', 'Bo'])->nullable()->after('session_id');
        });

        DB::table('torque_check_sheets')->orderBy('id')->each(function ($sheet) {
            $side = DB::table('torque_check_readings')->where('torque_check_sheet_id', $sheet->id)->value('side');
            if ($side) {
                DB::table('torque_check_sheets')->where('id', $sheet->id)->update(['side' => $side]);
            }
        });

        Schema::table('torque_check_readings', function (Blueprint $table) {
            $table->dropIndex(['torque_check_sheet_id', 'side', 'row_no', 'column_letter']);
            $table->index(['torque_check_sheet_id', 'row_no', 'column_letter']);
            $table->dropColumn('side');
        });
    }
};
