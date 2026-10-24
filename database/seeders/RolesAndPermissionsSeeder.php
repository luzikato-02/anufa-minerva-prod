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
            'creel.view',
            'creel.create',
            'creel.edit',
            'creel.delete',
            'machine-maintenance.view',
            'machine-maintenance.manage',
            'torque-checks.view',
            'torque-checks.create',
            'torque-checks.edit',
            'torque-checks.delete',
            'creel-types.view',
            'creel-types.manage',
            'control-plans.view',
            'control-plans.author',
            'control-plans.review',
            'control-plans.approve',
            'control-plans.settings',
            // Sign for others and review or release one's own submission; every use is noted in the revision history.
            'control-plans.override',
            // Delete a whole plan with its revisions, or replace one with an imported file.
            'control-plans.delete',
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
                'creel.view',
                'creel.create',
                'creel.edit',
                'creel.delete',
                'machine-maintenance.view',
                'machine-maintenance.manage',
                'torque-checks.view',
                'torque-checks.create',
                'torque-checks.edit',
                'torque-checks.delete',
                'creel-types.view',
                'creel-types.manage',
                'control-plans.view',
                'control-plans.author',
                'activity-log.view',
            ],
            'analyst' => [
                'tension-records.view',
                'stock-take.view',
                'finish-earlier.view',
                'creel.view',
                'machine-maintenance.view',
                'torque-checks.view',
                'creel-types.view',
                'control-plans.view',
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
                'creel.view',
                'creel.create',
                'machine-maintenance.view',
                'torque-checks.view',
                'torque-checks.create',
                'torque-checks.edit',
                'creel-types.view',
                'control-plans.view',
            ],
            // Control plan workflow: QA reviews a submitted revision, the approver (mill manager) releases it.
            'qa-reviewer' => [
                'control-plans.view',
                'control-plans.review',
            ],
            'approver' => [
                'control-plans.view',
                'control-plans.approve',
            ],
        ];

        foreach ($rolePermissions as $role => $rolePerms) {
            Role::firstOrCreate(['name' => $role, 'guard_name' => 'web'])
                ->syncPermissions($rolePerms);
        }
    }
}
