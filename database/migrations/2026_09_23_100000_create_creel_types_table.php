<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('creel_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->decimal('torque_min', 4, 1);
            $table->decimal('torque_max', 4, 1);
            $table->timestamps();
            $table->softDeletes(); // keeps a retired type's name on historical sheets readable
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('creel_types');
    }
};
