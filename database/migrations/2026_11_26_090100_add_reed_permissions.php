<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

/**
 * reeds.view: see the reed inventory. reeds.operate: receive, reserve, issue, return, inspect and move reeds.
 * reeds.manage: specs, fabric styles, locations, repair orders and scrapping.
 * Deploys do not run the seeders, so the permissions are created and handed out here.
 */
return new class extends Migration
{
    private const GRANTS = [
        'admin' => ['reeds.view', 'reeds.operate', 'reeds.manage'],
        'engineer' => ['reeds.view', 'reeds.operate', 'reeds.manage'],
        'operator' => ['reeds.view', 'reeds.operate'],
        'analyst' => ['reeds.view'],
    ];

    public function up(): void
    {
        foreach (['reeds.view', 'reeds.operate', 'reeds.manage'] as $name) {
            Permission::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }
        foreach (self::GRANTS as $role => $permissions) {
            Role::where('name', $role)->where('guard_name', 'web')->first()?->givePermissionTo($permissions);
        }
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Permission::whereIn('name', ['reeds.view', 'reeds.operate', 'reeds.manage'])->where('guard_name', 'web')->delete();
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
