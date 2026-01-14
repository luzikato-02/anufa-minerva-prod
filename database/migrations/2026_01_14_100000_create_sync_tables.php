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
        // Sync Transport Logs - Records all data sync operations
        Schema::create('sync_transport_logs', function (Blueprint $table) {
            $table->id();
            $table->enum('sync_direction', ['upload', 'download'])->comment('Direction of data sync');
            $table->string('table_name', 100)->comment('Name of the table being synced');
            $table->unsignedBigInteger('local_record_id')->comment('ID of the record on local/client side');
            $table->unsignedBigInteger('remote_record_id')->nullable()->comment('ID of the record on remote/server side');
            $table->enum('action', ['create', 'update', 'delete'])->comment('Type of operation performed');
            $table->enum('status', ['pending', 'success', 'failed', 'conflict'])->default('pending');
            $table->json('payload')->nullable()->comment('The data being synced');
            $table->text('error_message')->nullable()->comment('Error message if sync failed');
            $table->string('client_identifier', 100)->nullable()->comment('Unique identifier for the client device');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            
            $table->index(['table_name', 'status']);
            $table->index(['user_id', 'created_at']);
            $table->index(['client_identifier', 'created_at']);
        });

        // Data Conflicts - Records conflicts during sync that need resolution
        Schema::create('data_conflicts', function (Blueprint $table) {
            $table->id();
            $table->string('table_name', 100)->comment('Name of the table with conflict');
            $table->unsignedBigInteger('local_record_id')->comment('ID of the record on local/client side');
            $table->unsignedBigInteger('remote_record_id')->comment('ID of the record on remote/server side');
            $table->json('local_data')->comment('Data from the local/client database');
            $table->json('remote_data')->comment('Data from the remote/server database');
            $table->json('conflict_fields')->comment('List of fields that have conflicting values');
            $table->enum('resolution_status', ['pending', 'local_wins', 'remote_wins', 'merged', 'dismissed'])->default('pending');
            $table->foreignId('resolved_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->text('resolution_notes')->nullable()->comment('Notes about the resolution decision');
            $table->json('merged_data')->nullable()->comment('Final merged data if merge resolution was used');
            $table->string('client_identifier', 100)->nullable()->comment('Unique identifier for the client device');
            $table->timestamps();
            
            $table->index(['table_name', 'resolution_status']);
            $table->index(['resolved_by_user_id', 'resolved_at']);
        });

        // Client Devices - Tracks registered devices for sync
        Schema::create('sync_client_devices', function (Blueprint $table) {
            $table->id();
            $table->string('client_identifier', 100)->unique()->comment('Unique identifier for the client device');
            $table->string('device_name', 255)->nullable()->comment('User-friendly name for the device');
            $table->string('device_type', 50)->nullable()->comment('Type of device (desktop, mobile, etc.)');
            $table->string('os_info', 100)->nullable()->comment('Operating system information');
            $table->string('app_version', 50)->nullable()->comment('Version of the app on this device');
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('last_sync_at')->nullable()->comment('Last successful sync timestamp');
            $table->json('sync_settings')->nullable()->comment('Device-specific sync settings');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            
            $table->index(['user_id', 'is_active']);
            $table->index('last_sync_at');
        });

        // Sync Checkpoints - Tracks sync progress for incremental syncing
        Schema::create('sync_checkpoints', function (Blueprint $table) {
            $table->id();
            $table->string('client_identifier', 100);
            $table->string('table_name', 100);
            $table->timestamp('last_synced_at')->nullable()->comment('Timestamp of last successfully synced record');
            $table->unsignedBigInteger('last_synced_id')->nullable()->comment('ID of last successfully synced record');
            $table->timestamps();
            
            $table->unique(['client_identifier', 'table_name']);
            $table->index('client_identifier');
        });

        // Add sync tracking columns to existing tables
        $tablesToTrack = [
            'tension_records',
            'twisting_measurements',
            'weaving_measurements',
            'tension_problems',
            'stock_taking_records',
            'finish_earlier_records',
        ];

        foreach ($tablesToTrack as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    // Check if columns already exist before adding
                    if (!Schema::hasColumn($tableName, 'sync_uuid')) {
                        $table->uuid('sync_uuid')->nullable()->unique()->after('id')->comment('UUID for cross-database identification');
                    }
                    if (!Schema::hasColumn($tableName, 'synced_at')) {
                        $table->timestamp('synced_at')->nullable()->comment('Last sync timestamp');
                    }
                    if (!Schema::hasColumn($tableName, 'sync_version')) {
                        $table->unsignedInteger('sync_version')->default(1)->comment('Version number for conflict detection');
                    }
                    if (!Schema::hasColumn($tableName, 'client_identifier')) {
                        $table->string('client_identifier', 100)->nullable()->comment('Origin device identifier');
                    }
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove sync tracking columns from existing tables
        $tablesToTrack = [
            'tension_records',
            'twisting_measurements',
            'weaving_measurements',
            'tension_problems',
            'stock_taking_records',
            'finish_earlier_records',
        ];

        foreach ($tablesToTrack as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName) {
                    $columns = ['sync_uuid', 'synced_at', 'sync_version', 'client_identifier'];
                    foreach ($columns as $column) {
                        if (Schema::hasColumn($tableName, $column)) {
                            $table->dropColumn($column);
                        }
                    }
                });
            }
        }

        Schema::dropIfExists('sync_checkpoints');
        Schema::dropIfExists('sync_client_devices');
        Schema::dropIfExists('data_conflicts');
        Schema::dropIfExists('sync_transport_logs');
    }
};
