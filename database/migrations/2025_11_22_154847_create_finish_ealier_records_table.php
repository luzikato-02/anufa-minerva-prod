<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        Schema::create('finish_earlier_records', function (Blueprint $table) {
            $table->id();
            $table->json('metadata'); // session metadata (machine_no, style, PO, totals)
            $table->json('entries');  // JSON array of entries
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('finish_earlier_records');
    }
};
