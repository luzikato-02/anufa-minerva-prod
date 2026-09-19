<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\DocumentIntelligenceController;
use App\Http\Controllers\Api\FinishEarlierRecordController;
use App\Http\Controllers\Api\FinishEarlierScanController;
use App\Http\Controllers\Api\MachineMaintenanceController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\StockTakeRecordController;
use App\Http\Controllers\Api\TensionRecordController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\V1\AccountController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Mobile API (/api/v1) — Sanctum bearer tokens
|--------------------------------------------------------------------------
| Mirrors routes/web.php: same controllers, same `permission:*` gates, but
| every response is JSON. Route names are prefixed `v1.` so they never clash
| with the web names.
*/

Route::name('v1.')->group(function () {
    Route::get('ping', fn () => response()->json(['ok' => true, 'app' => config('app.name')]));

    // --- Auth (guest) ---
    Route::middleware('throttle:10,1')->group(function () {
        Route::post('auth/login', [AuthController::class, 'login']);
        Route::post('auth/two-factor-challenge', [AuthController::class, 'twoFactorChallenge']);
        Route::post('auth/forgot-password', [AuthController::class, 'forgotPassword']);
        Route::post('auth/reset-password', [AuthController::class, 'resetPassword']);
    });

    Route::middleware(['auth:sanctum', 'api.active'])->group(function () {
        // --- Session / account ---
        Route::get('auth/me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        Route::patch('account/profile', [AccountController::class, 'updateProfile']);
        Route::delete('account', [AccountController::class, 'destroy']);
        Route::put('account/password', [AccountController::class, 'updatePassword'])->middleware('throttle:6,1');
        Route::get('account/two-factor', [AccountController::class, 'twoFactorStatus']);
        Route::post('account/two-factor/enable', [AccountController::class, 'enableTwoFactor']);
        Route::post('account/two-factor/confirm', [AccountController::class, 'confirmTwoFactor']);
        Route::post('account/two-factor/disable', [AccountController::class, 'disableTwoFactor']);
        Route::post('account/two-factor/recovery-codes', [AccountController::class, 'recoveryCodes']);
        Route::put('account/two-factor/recovery-codes', [AccountController::class, 'regenerateRecoveryCodes']);

        Route::get('dashboard', [DashboardController::class, 'apiIndex']);

        // --- Stock taking ---
        Route::middleware('permission:stock-take.view')->group(function () {
            Route::get('stock-take-records/session/{sessionId}', [StockTakeRecordController::class, 'getSession']);
            Route::get('stock-take-records/check-batch', [StockTakeRecordController::class, 'checkBatch']);
            Route::get('stock-take-records/{stockTakeRecord}/download', [StockTakeRecordController::class, 'downloadCsv']);
            Route::get('stock-take-statistics', [StockTakeRecordController::class, 'statistics']);
        });
        Route::post('stock-take-records/record-batch', [StockTakeRecordController::class, 'recordBatch'])
            ->middleware('permission:stock-take.create');
        Route::patch('stock-take-records/{id}/status', [StockTakeRecordController::class, 'updateSessionStatus'])
            ->middleware('permission:stock-take.edit');
        Route::resource('stock-take-records', StockTakeRecordController::class)
            ->only(['index', 'store', 'show', 'destroy', 'update'])
            ->middlewareFor(['index', 'show'], 'permission:stock-take.view')
            ->middlewareFor('store', 'permission:stock-take.create')
            ->middlewareFor('update', 'permission:stock-take.edit')
            ->middlewareFor('destroy', 'permission:stock-take.delete');

        // --- Tension (twisting + weaving) ---
        Route::middleware('permission:tension-records.view')->group(function () {
            Route::get('tension-records/{tensionRecord}/download', [TensionRecordController::class, 'downloadCsv']);
            Route::get('tension-statistics', [TensionRecordController::class, 'statistics']);
            Route::get('tension-problems', [TensionRecordController::class, 'problems']);
            Route::get('tension-records/type/{type}', [TensionRecordController::class, 'byType'])
                ->whereIn('type', ['twisting', 'weaving']);
        });
        Route::middleware('permission:tension-records.create')->group(function () {
            Route::post('tension-records/start-session', [TensionRecordController::class, 'startSession']);
            Route::get('tension-records/session/{productionOrder}', [TensionRecordController::class, 'getSession']);
        });
        Route::patch('tension-records/{tensionRecord}/problems/{problemId}/resolve', [TensionRecordController::class, 'resolveProblem'])
            ->middleware('permission:tension-records.edit');
        Route::resource('tension-records', TensionRecordController::class)
            ->only(['index', 'store', 'show', 'destroy', 'update'])
            ->middlewareFor(['index', 'show'], 'permission:tension-records.view')
            ->middlewareFor('store', 'permission:tension-records.create')
            ->middlewareFor('update', 'permission:tension-records.edit')
            ->middlewareFor('destroy', 'permission:tension-records.delete');

        // --- Finish earlier ---
        Route::middleware('permission:finish-earlier.view')->group(function () {
            Route::get('finish-earlier', [FinishEarlierRecordController::class, 'index']);
            Route::get('finish-earlier/{id}', [FinishEarlierRecordController::class, 'show']);
            Route::get('finish-earlier/{productionOrder}/pdf', [FinishEarlierRecordController::class, 'exportPdf']);
            Route::get('finish-earlier/{productionOrder}/download', [FinishEarlierRecordController::class, 'downloadCsv']);
            Route::get('finish-earlier/session/{productionOrder}', [FinishEarlierRecordController::class, 'getSession']);
        });
        Route::middleware('permission:finish-earlier.create')->group(function () {
            Route::post('finish-earlier/start-session', [FinishEarlierRecordController::class, 'store']);
            Route::post('finish-earlier/{productionOrder}/add-entry', [FinishEarlierRecordController::class, 'addEntry']);
            Route::post('finish-earlier/submit-scan', [FinishEarlierRecordController::class, 'submitScan']);
            Route::post('finish-earlier-scan/extract', [FinishEarlierScanController::class, 'extract']);
        });
        Route::post('finish-earlier/{id}/finish', [FinishEarlierRecordController::class, 'finish'])
            ->middleware('permission:finish-earlier.edit');
        Route::patch('finish-earlier/{id}', [FinishEarlierRecordController::class, 'update'])
            ->middleware('permission:finish-earlier.edit');
        Route::delete('finish-earlier/{id}', [FinishEarlierRecordController::class, 'destroy'])
            ->middleware('permission:finish-earlier.delete');

        // --- Users & roles ---
        Route::middleware('permission:users.view')->group(function () {
            Route::get('users', [UserController::class, 'index']);
            Route::get('user-management-statistics', [UserController::class, 'statistics']);
        });
        Route::middleware('permission:users.manage')->group(function () {
            Route::post('users', [UserController::class, 'store']);
            Route::patch('users/{user}', [UserController::class, 'update']);
            Route::delete('users/{user}', [UserController::class, 'destroy']);
            Route::put('users/{user}/roles', [UserController::class, 'syncRoles']);
            Route::patch('users/{user}/status', [UserController::class, 'updateStatus']);
        });
        Route::middleware('permission:roles.manage')->group(function () {
            Route::get('roles', [RoleController::class, 'index']);
            Route::post('roles', [RoleController::class, 'store']);
            Route::patch('roles/{role}', [RoleController::class, 'update']);
            Route::delete('roles/{role}', [RoleController::class, 'destroy']);
            Route::get('permissions', [RoleController::class, 'permissions']);
        });

        // --- Machine maintenance ---
        Route::middleware('permission:machine-maintenance.view')->group(function () {
            Route::get('machine-types', [MachineMaintenanceController::class, 'machineTypes']);
            Route::get('machine-definitions', [MachineMaintenanceController::class, 'machineDefinitions']);
        });
        Route::middleware('permission:machine-maintenance.manage')->group(function () {
            Route::post('machine-types', [MachineMaintenanceController::class, 'storeMachineType']);
            Route::patch('machine-types/{id}', [MachineMaintenanceController::class, 'updateMachineType']);
            Route::delete('machine-types/{id}', [MachineMaintenanceController::class, 'destroyMachineType']);
            Route::post('machine-definitions', [MachineMaintenanceController::class, 'storeMachineDefinition']);
            Route::patch('machine-definitions/{id}', [MachineMaintenanceController::class, 'updateMachineDefinition']);
            Route::delete('machine-definitions/{id}', [MachineMaintenanceController::class, 'destroyMachineDefinition']);
        });

        // --- Activity log & document intelligence ---
        Route::get('activity-log', [ActivityLogController::class, 'index'])->middleware('permission:activity-log.view');
        Route::post('document-intelligence/process', [DocumentIntelligenceController::class, 'process']);
    });
});
