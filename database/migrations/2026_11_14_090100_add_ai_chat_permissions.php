<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * ai-chat.use: ask the data chat questions. The chat only answers from modules the user can already view.
 * Deploys do not run the seeders, so the permission is created here and given to admins, engineers and analysts.
 */
return new class extends Migration
{
    public function up(): void
    {
        $permission = Permission::firstOrCreate(['name' => 'ai-chat.use', 'guard_name' => 'web']);
        foreach (['admin', 'engineer', 'analyst'] as $role) {
            Role::where('name', $role)->where('guard_name', 'web')->first()?->givePermissionTo($permission);
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Permission::where('name', 'ai-chat.use')->where('guard_name', 'web')->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
