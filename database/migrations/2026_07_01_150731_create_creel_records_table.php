<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('creel_records', function (Blueprint $table) {
            $table->id();
            $table->string('order_number')->index();
            $table->string('machine')->nullable();
            $table->string('date_string')->nullable();
            $table->string('operator')->nullable();
            $table->string('material')->nullable();
            $table->longText('batches');
            $table->json('metadata')->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('creel_records');
    }
};
