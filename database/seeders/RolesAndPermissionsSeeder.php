<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Seed roles and permissions.
     */
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'tension-records.view',
            'tension-records.create',
            'tension-records.edit',
            'tension-records.delete',
            'stock-take.view',
            'stock-take.create',
            'stock-take.edit',
            'stock-take.delete',
            'finish-earlier.view',
            'finish-earlier.create',
            'finish-earlier.edit',
            'finish-earlier.delete',
            'users.view',
            'users.manage',
            'roles.manage',
            'activity-log.view',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        $rolePermissions = [
            'admin' => $permissions,
            'engineer' => [
                'tension-records.view',
                'tension-records.create',
                'tension-records.edit',
                'tension-records.delete',
                'stock-take.view',
                'stock-take.create',
                'stock-take.edit',
                'stock-take.delete',
                'finish-earlier.view',
                'finish-earlier.create',
                'finish-earlier.edit',
                'finish-earlier.delete',
                'activity-log.view',
            ],
            'analyst' => [
                'tension-records.view',
                'stock-take.view',
                'finish-earlier.view',
                'activity-log.view',
            ],
            'operator' => [
                'tension-records.view',
                'tension-records.create',
                'tension-records.edit',
                'stock-take.view',
                'stock-take.create',
                'stock-take.edit',
                'finish-earlier.view',
                'finish-earlier.create',
                'finish-earlier.edit',
            ],
        ];

        foreach ($rolePermissions as $role => $rolePerms) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web'])
                ->syncPermissions($rolePerms);
        }
    }
}
