<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\FinishEarlierRecordController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\StockTakeRecordController;
use App\Http\Controllers\Api\TensionRecordController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\DeployController;
use App\Http\Middleware\HandleAppearance;
use App\Http\Middleware\HandleInertiaRequests;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;
use Inertia\Inertia;

Route::get('/csrf-token', function () {
    return response()->json(['csrfToken' => csrf_token()]);
});

// No session/cookies/cache-backed throttling - this runs before the first
// `migrate`, so the `sessions`/`cache` tables may not exist yet.
Route::post('/deploy/finalize', [DeployController::class, 'finalize'])
    ->withoutMiddleware([
        EncryptCookies::class,
        AddQueuedCookiesToResponse::class,
        StartSession::class,
        ShareErrorsFromSession::class,
        ValidateCsrfToken::class,
        HandleAppearance::class,
        HandleInertiaRequests::class,
        AddLinkHeadersForPreloadedAssets::class,
    ]);


Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/', function () {
    return Inertia::render('welcome');
    })->name('home');

    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    Route::get('under-construction', function () {
        return Inertia::render('under-construction');
    })->name('under-construction');

    // ---- STOCK TAKE ----
    Route::middleware('permission:stock-take.view')->group(function () {
        Route::get('stock-take-records-main', function () {
            return Inertia::render('stock-take-records-display');
        })->name('stock-take-records-main');

        Route::get('stock-take-records/session/{sessionId}', [StockTakeRecordController::class, 'getSession']);
        Route::get('stock-take-records/check-batch', [StockTakeRecordController::class, 'checkBatch']);
        Route::get('stock-take-records/{stockTakeRecord}/download', [StockTakeRecordController::class, 'downloadCsv']);
        Route::get('stock-take-statistics', [StockTakeRecordController::class, 'statistics']);
    });

    Route::middleware('permission:stock-take.create')->group(function () {
        Route::get('batch-stock-taking-main', function () {
            return Inertia::render('batch-stock-taking-main');
        })->name('batch-stock-taking-main');

        Route::post('stock-take-records/record-batch', [StockTakeRecordController::class, 'recordBatch']);
    });

    Route::patch('stock-take-records/{id}/status', [StockTakeRecordController::class, 'updateSessionStatus'])
        ->middleware('permission:stock-take.edit');

    Route::resource('stock-take-records', StockTakeRecordController::class)
        ->only(['index', 'store', 'show', 'destroy', 'update'])
        ->middlewareFor(['index', 'show'], 'permission:stock-take.view')
        ->middlewareFor('store', 'permission:stock-take.create')
        ->middlewareFor('update', 'permission:stock-take.edit')
        ->middlewareFor('destroy', 'permission:stock-take.delete');

    // ---- TENSION RECORDS ----
    Route::middleware('permission:tension-records.view')->group(function () {
        Route::get('tension-records-display', function () {
            return Inertia::render('tension-records-display');
        })->name('tension-records-display');

        Route::get('tension-records/{tensionRecord}/download', [TensionRecordController::class, 'downloadCsv'])
            ->name('tension-records.download');

        Route::get('tension-statistics', [TensionRecordController::class, 'statistics'])
            ->name('tension-records.statistics');

        // Flattened problem list across all tension records (twisting + weaving)
        Route::get('tension-problems', [TensionRecordController::class, 'problems'])
            ->name('tension-records.problems');

        // ✅ Filtered endpoints (now conflict-free)
        Route::get('tension-records/type/{type}', [TensionRecordController::class, 'byType'])
            ->whereIn('type', ['twisting', 'weaving'])
            ->name('tension-records.by-type');
    });

    Route::middleware('permission:tension-records.create')->group(function () {
        Route::get('twisting-tension-main', function () {
            return Inertia::render('twisting-tension-main');
        })->name('twisting-tension-main');

        Route::get('weaving-tension-main', function () {
            return Inertia::render('weaving-tension-main');
        })->name('weaving-tension-main');
    });

    // Resolve a specific problem within a tension record
    Route::patch('tension-records/{tensionRecord}/problems/{problemId}/resolve', [TensionRecordController::class, 'resolveProblem'])
        ->middleware('permission:tension-records.edit')
        ->name('tension-records.problems.resolve');

    Route::resource('tension-records', TensionRecordController::class)
        ->only(['index', 'store', 'show', 'destroy', 'update'])
        ->middlewareFor(['index', 'show'], 'permission:tension-records.view')
        ->middlewareFor('store', 'permission:tension-records.create')
        ->middlewareFor('update', 'permission:tension-records.edit')
        ->middlewareFor('destroy', 'permission:tension-records.delete');

    // ---- FINISH EARLIER ----
    Route::middleware('permission:finish-earlier.view')->group(function () {
        Route::get('finish-earlier-display', function () {
            return Inertia::render('finish-earlier-records-display');
        })->name('finish-earlier-display');

        Route::get('/finish-earlier', [FinishEarlierRecordController::class, 'index']);
        Route::get('/finish-earlier/{id}', [FinishEarlierRecordController::class, 'show']);
        Route::get('/finish-earlier/{productionOrder}/pdf', [FinishEarlierRecordController::class, 'exportPdf']);
        Route::get('/finish-earlier/{productionOrder}/download', [FinishEarlierRecordController::class, 'downloadCsv']);
        Route::get('/finish-earlier/session/{productionOrder}', [FinishEarlierRecordController::class, 'getSession']);
    });

    Route::middleware('permission:finish-earlier.create')->group(function () {
        Route::post('/finish-earlier/start-session', [FinishEarlierRecordController::class, 'store']);
        Route::post('/finish-earlier/{productionOrder}/add-entry', [FinishEarlierRecordController::class, 'addEntry']);
    });

    Route::post('/finish-earlier/{id}/finish', [FinishEarlierRecordController::class, 'finish'])
        ->middleware('permission:finish-earlier.edit');

    Route::delete('/finish-earlier/{id}', [FinishEarlierRecordController::class, 'destroy'])
        ->middleware('permission:finish-earlier.delete');

    // ---- USER & ROLE MANAGEMENT ----
    Route::middleware('permission:users.view')->group(function () {
        Route::get('user-maintenance', function () {
            return Inertia::render('user-maintenance-main');
        })->name('user-maintenance');

        Route::get('api/users', [UserController::class, 'index']);
        Route::get('user-management-statistics', [UserController::class, 'statistics']);
    });

    Route::middleware('permission:users.manage')->group(function () {
        Route::post('api/users', [UserController::class, 'store']);
        Route::patch('api/users/{user}', [UserController::class, 'update']);
        Route::delete('api/users/{user}', [UserController::class, 'destroy']);
        Route::put('api/users/{user}/roles', [UserController::class, 'syncRoles']);
    });

    Route::redirect('role-management', '/user-maintenance');

    Route::middleware('permission:roles.manage')->group(function () {
        Route::get('api/roles', [RoleController::class, 'index']);
        Route::post('api/roles', [RoleController::class, 'store']);
        Route::patch('api/roles/{role}', [RoleController::class, 'update']);
        Route::delete('api/roles/{role}', [RoleController::class, 'destroy']);
        Route::get('api/permissions', [RoleController::class, 'permissions']);
    });

    // ---- ACTIVITY LOG ----
    Route::middleware('permission:activity-log.view')->group(function () {
        Route::get('activity-log', function () {
            return Inertia::render('activity-log');
        })->name('activity-log');

        Route::get('api/activity-log', [ActivityLogController::class, 'index']);
    });
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
