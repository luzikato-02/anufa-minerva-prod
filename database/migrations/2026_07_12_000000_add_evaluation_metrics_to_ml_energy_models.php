<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ml_energy_models', function (Blueprint $table) {
            $table->decimal('test_r2', 6, 4)->nullable()->after('cv_r2_score');
            $table->decimal('test_rmse', 8, 4)->nullable()->after('test_r2');
            $table->decimal('test_mae', 8, 4)->nullable()->after('test_rmse');
            $table->decimal('cv_r2_std', 6, 4)->nullable()->after('cv_r2_score');
            $table->decimal('overfit_gap', 6, 4)->nullable()->after('mae');
            $table->boolean('auto_tuned')->default(false)->after('hyperparams');
        });
    }

    public function down(): void
    {
        Schema::table('ml_energy_models', function (Blueprint $table) {
            $table->dropColumn(['test_r2', 'test_rmse', 'test_mae', 'cv_r2_std', 'overfit_gap', 'auto_tuned']);
        });
    }
};
