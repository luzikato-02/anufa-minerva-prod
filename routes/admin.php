<?php

use App\Http\Controllers\Admin\RoleController;
use App\Http\Controllers\Admin\PermissionController;
use App\Http\Controllers\Admin\UserManagementController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Admin Routes
|--------------------------------------------------------------------------
|
| Here is where you can register admin routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Access is restricted to users
| with admin or super-admin roles.
|
*/

Route::middleware(['auth', 'verified', 'admin'])->prefix('admin')->name('admin.')->group(function () {

    // Admin Dashboard
    Route::get('/', function () {
        return Inertia::render('admin/dashboard');
    })->name('dashboard');

    // Roles Management
    Route::resource('roles', RoleController::class)->except(['create', 'edit', 'show']);

    // Permissions Management
    Route::resource('permissions', PermissionController::class)->except(['create', 'edit', 'show']);

    // Users Management
    Route::resource('users', UserManagementController::class)->except(['create', 'edit', 'show']);
    Route::patch('users/{user}/roles', [UserManagementController::class, 'updateRoles'])->name('users.update-roles');
});
