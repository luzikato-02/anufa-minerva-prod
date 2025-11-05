<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Clear cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Permissions
        $permissions = [
            '001', //view reports
            '002', //record tension data
            '003', //edit tension data
            '004', //manage stock take sessions
            '005', //conduct batch stock take
            '006', //edit stock take data
            '007', //record finish earlier data
            '008', //edit finish earlier data
            '100', //manage users
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Roles
        $master = Role::firstOrCreate(['name' => 'master']);
        $operator = Role::firstOrCreate(['name' => 'operator']);
        $analyst = Role::firstOrCreate(['name' => 'analyst']);

        // Assign permissions
        $master->syncPermissions(Permission::all());
        $operator->syncPermissions(['001', '002', '003', '005', '006', '007', '008']);
        $analyst->syncPermissions(['001', '002', '003', '005', '006', '004']);
    }
}
