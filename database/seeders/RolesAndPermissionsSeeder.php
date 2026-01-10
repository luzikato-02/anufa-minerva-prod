<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions (wrapped in try-catch for database cache driver)
        try {
            app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        } catch (\Exception $e) {
            // Cache clearing failed, continue anyway
        }

        // Create permissions
        $permissions = [
            // User management
            'users.view',
            'users.create',
            'users.edit',
            'users.delete',
            
            // Role management
            'roles.view',
            'roles.create',
            'roles.edit',
            'roles.delete',
            
            // Permission management
            'permissions.view',
            'permissions.create',
            'permissions.edit',
            'permissions.delete',
            
            // Settings
            'settings.view',
            'settings.edit',
            
            // Stock taking
            'stock-taking.view',
            'stock-taking.create',
            'stock-taking.edit',
            'stock-taking.delete',
            
            // Tension records
            'tension-records.view',
            'tension-records.create',
            'tension-records.edit',
            'tension-records.delete',
            
            // Finish earlier records
            'finish-earlier.view',
            'finish-earlier.create',
            'finish-earlier.edit',
            'finish-earlier.delete',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission, 'guard_name' => 'web']);
        }

        // Create roles and assign permissions
        
        // Super Admin - has all permissions
        $superAdmin = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => 'web']);
        $superAdmin->givePermissionTo(Permission::all());

        // Admin - has most permissions except system-level ones
        $admin = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'web']);
        $admin->givePermissionTo([
            'users.view',
            'users.create',
            'users.edit',
            'users.delete',
            'roles.view',
            'roles.create',
            'roles.edit',
            'permissions.view',
            'settings.view',
            'settings.edit',
            'stock-taking.view',
            'stock-taking.create',
            'stock-taking.edit',
            'stock-taking.delete',
            'tension-records.view',
            'tension-records.create',
            'tension-records.edit',
            'tension-records.delete',
            'finish-earlier.view',
            'finish-earlier.create',
            'finish-earlier.edit',
            'finish-earlier.delete',
        ]);

        // Operator - can create and view records
        $operator = Role::firstOrCreate(['name' => 'operator', 'guard_name' => 'web']);
        $operator->givePermissionTo([
            'stock-taking.view',
            'stock-taking.create',
            'tension-records.view',
            'tension-records.create',
            'finish-earlier.view',
            'finish-earlier.create',
        ]);

        // Viewer - can only view
        $viewer = Role::firstOrCreate(['name' => 'viewer', 'guard_name' => 'web']);
        $viewer->givePermissionTo([
            'stock-taking.view',
            'tension-records.view',
            'finish-earlier.view',
        ]);

        // Optionally assign admin role to the first user
        $firstUser = User::first();
        if ($firstUser) {
            $firstUser->assignRole('super-admin');
        }
    }
}
