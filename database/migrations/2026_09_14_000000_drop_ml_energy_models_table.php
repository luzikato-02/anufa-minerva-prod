<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('ml_energy_models');
    }

    public function down(): void
    {
        // ML energy models feature removed; no restore path.
    }
};
