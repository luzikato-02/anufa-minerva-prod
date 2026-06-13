<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RoleController extends Controller
{
    public function index()
    {
        return Role::with('permissions:id,name')->get(['id', 'name']);
    }

    public function permissions()
    {
        return Permission::orderBy('name')->get(['id', 'name']);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:roles,name'],
            'permissions' => ['array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $role = Role::create(['name' => $validated['name']]);
        $role->syncPermissions($validated['permissions'] ?? []);

        activity()
            ->causedBy($request->user())
            ->performedOn($role)
            ->event('created')
            ->withProperties(['attributes' => ['name' => $role->name, 'permissions' => $role->permissions->pluck('name')]])
            ->log("Role '{$role->name}' created");

        return $role->load('permissions:id,name');
    }

    public function update(Request $request, Role $role)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('roles', 'name')->ignore($role->id)],
            'permissions' => ['array'],
            'permissions.*' => ['string', 'exists:permissions,name'],
        ]);

        $oldPermissions = $role->permissions->pluck('name');

        $role->update(['name' => $validated['name']]);
        $role->syncPermissions($validated['permissions'] ?? []);

        activity()
            ->causedBy($request->user())
            ->performedOn($role)
            ->event('updated')
            ->withProperties([
                'old' => ['permissions' => $oldPermissions],
                'attributes' => ['name' => $role->name, 'permissions' => $role->permissions->pluck('name')],
            ])
            ->log("Role '{$role->name}' updated");

        return $role->load('permissions:id,name');
    }

    public function destroy(Request $request, Role $role)
    {
        $name = $role->name;

        activity()
            ->causedBy($request->user())
            ->performedOn($role)
            ->event('deleted')
            ->withProperties(['attributes' => ['name' => $name]])
            ->log("Role '{$name}' deleted");

        $role->delete();

        return response()->noContent();
    }
}
