<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_sheets', function (Blueprint $table) {
            $table->id();
            $table->uuid('client_uuid')->nullable()->unique();
            $table->date('sheet_date');
            $table->string('leader');
            $table->string('note')->nullable();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index('sheet_date');
        });

        Schema::create('stock_sheet_rows', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_sheet_id')->constrained('stock_sheets')->cascadeOnDelete();
            $table->unsignedInteger('line_no');
            $table->string('color')->nullable();
            $table->string('material_code');
            $table->string('batch');
            $table->date('prod_date')->nullable();
            $table->unsignedInteger('chs')->nullable();
            $table->decimal('actual_weight', 10, 2)->nullable();
            $table->unsignedSmallInteger('position')->nullable();
            $table->string('remark')->nullable();
            $table->uuid('client_uuid')->nullable()->unique();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['stock_sheet_id', 'line_no']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_sheet_rows');
        Schema::dropIfExists('stock_sheets');
    }
};
