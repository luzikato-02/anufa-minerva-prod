<?php

use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\DocumentIntelligenceController;
use App\Http\Controllers\Api\CreelRecordController;
use App\Http\Controllers\Api\MachineMaintenanceController;
use App\Http\Controllers\Api\FinishEarlierRecordController;
use App\Http\Controllers\Api\FinishEarlierScanController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\CreelTypeController;
use App\Http\Controllers\Api\StockSheetController;
use App\Http\Controllers\Api\TorqueCheckController;
use App\Http\Controllers\Api\StockTakeRecordController;
use App\Http\Controllers\Api\TensionRecordController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/csrf-token', function () {
    return response()->json(['csrfToken' => csrf_token()]);
});

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/', function () {
        return redirect()->route('dashboard');
    })->name('home');

    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

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

    // ---- STOCK SHEETS (the paper stock list) ----
    Route::middleware('permission:stock-take.view')->group(function () {
        Route::get('stock-sheets-main', function () {
            return Inertia::render('stock-sheets-display');
        })->name('stock-sheets-main');

        Route::get('stock-sheets', [StockSheetController::class, 'index']);
        Route::get('stock-sheets/{stockSheet}', [StockSheetController::class, 'show'])->whereNumber('stockSheet');
        Route::get('stock-sheets/{stockSheet}/download', [StockSheetController::class, 'downloadCsv'])->whereNumber('stockSheet');
    });

    Route::middleware('permission:stock-take.create')->group(function () {
        Route::get('stock-sheet-main', function () {
            return Inertia::render('stock-sheet-record');
        })->name('stock-sheet-main');

        Route::post('stock-sheets/rows', [StockSheetController::class, 'storeRow']);
    });

    Route::patch('stock-sheets/rows/{row}', [StockSheetController::class, 'updateRow'])->middleware('permission:stock-take.edit');
    Route::delete('stock-sheets/rows/{row}', [StockSheetController::class, 'destroyRow'])->middleware('permission:stock-take.delete');
    Route::patch('stock-sheets/{stockSheet}', [StockSheetController::class, 'update'])->middleware('permission:stock-take.edit');
    Route::delete('stock-sheets/{stockSheet}', [StockSheetController::class, 'destroy'])->middleware('permission:stock-take.delete');

    // ---- TORQUE CHECKS (creel adaptor torque) ----
    Route::middleware('permission:torque-checks.view')->group(function () {
        Route::get('torque-checks-main', function () {
            return Inertia::render('torque-checks-display');
        })->name('torque-checks-main');

        Route::get('torque-checks', [TorqueCheckController::class, 'index']);
        Route::get('torque-checks/{torqueCheckSheet}', [TorqueCheckController::class, 'show'])->whereNumber('torqueCheckSheet');
        Route::get('torque-checks/{torqueCheckSheet}/download', [TorqueCheckController::class, 'downloadCsv'])->whereNumber('torqueCheckSheet');
        Route::get('torque-checks/session/{sessionId}', [TorqueCheckController::class, 'getSession']);
    });

    Route::middleware('permission:torque-checks.create')->group(function () {
        Route::get('torque-check-session', function () {
            return Inertia::render('torque-check-session');
        })->name('torque-check-session');

        Route::get('torque-check-main', function () {
            return Inertia::render('torque-check-record');
        })->name('torque-check-main');

        Route::post('torque-checks/readings', [TorqueCheckController::class, 'storeReading']);
    });

    Route::patch('torque-checks/readings/{reading}', [TorqueCheckController::class, 'updateReading'])->middleware('permission:torque-checks.edit');
    Route::delete('torque-checks/readings/{reading}', [TorqueCheckController::class, 'destroyReading'])->middleware('permission:torque-checks.delete');
    Route::patch('torque-checks/{torqueCheckSheet}', [TorqueCheckController::class, 'update'])->middleware('permission:torque-checks.edit');
    Route::delete('torque-checks/{torqueCheckSheet}', [TorqueCheckController::class, 'destroy'])->middleware('permission:torque-checks.delete');

    // ---- CREEL TYPE SETTINGS (torque standards) ----
    Route::middleware('permission:creel-types.view')->group(function () {
        Route::get('creel-type-settings', function () {
            return Inertia::render('creel-type-settings');
        })->name('creel-type-settings');

        Route::get('creel-types', [CreelTypeController::class, 'index']);
    });

    Route::middleware('permission:creel-types.manage')->group(function () {
        Route::post('creel-types', [CreelTypeController::class, 'store']);
        Route::patch('creel-types/{id}', [CreelTypeController::class, 'update']);
        Route::delete('creel-types/{id}', [CreelTypeController::class, 'destroy']);
    });

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

        // Filtered endpoints
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

        // Resumable weaving-tension sessions, keyed by production order
        Route::post('tension-records/start-session', [TensionRecordController::class, 'startSession'])
            ->name('tension-records.start-session');
        Route::get('tension-records/session/{productionOrder}', [TensionRecordController::class, 'getSession'])
            ->name('tension-records.session');
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
        Route::post('/finish-earlier/submit-scan', [FinishEarlierRecordController::class, 'submitScan']);

        Route::get('finish-earlier-scan', fn () => Inertia::render('finish-earlier-scan'))
            ->name('finish-earlier-scan');
        Route::post('finish-earlier-scan/extract', [FinishEarlierScanController::class, 'extract']);
    });

    Route::post('/finish-earlier/{id}/finish', [FinishEarlierRecordController::class, 'finish'])
        ->middleware('permission:finish-earlier.edit');

    Route::patch('/finish-earlier/{id}', [FinishEarlierRecordController::class, 'update'])
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
        Route::patch('api/users/{user}/status', [UserController::class, 'updateStatus']);
    });

    Route::redirect('role-management', '/user-maintenance');

    Route::middleware('permission:roles.manage')->group(function () {
        Route::get('api/roles', [RoleController::class, 'index']);
        Route::post('api/roles', [RoleController::class, 'store']);
        Route::patch('api/roles/{role}', [RoleController::class, 'update']);
        Route::delete('api/roles/{role}', [RoleController::class, 'destroy']);
        Route::get('api/permissions', [RoleController::class, 'permissions']);
    });

    // ---- CREEL VISUALIZATION ----
    Route::middleware('permission:creel.view')->group(function () {
        Route::get('creel-visualization', fn () => Inertia::render('creel-visualization'))
            ->name('creel-visualization');
        Route::get('creel-viewer/{id}', function ($id) {
            $record = \App\Models\CreelRecord::findOrFail($id);

            // Collect all finish-earlier entries for this production order
            $feRecords = \App\Models\FinishEarlierRecord::where(
                'metadata->production_order', $record->order_number
            )->get();

            $finishedPositions = $feRecords->flatMap(function ($fe) {
                return collect($fe->entries ?? [])->map(fn ($e) => [
                    'side'   => $e['creel_side']    ?? '',
                    'column' => (int) ($e['column_number'] ?? 0),
                    'row'    => $e['row_number']    ?? '',
                    'meters' => (float) ($e['meters_finish'] ?? 0),
                ]);
            })->filter(fn ($p) => $p['side'] && $p['column'] && $p['row'])
              ->values()->all();

            return Inertia::render('creel-viewer', [
                'record'            => $record,
                'finishedPositions' => $finishedPositions,
            ]);
        })->name('creel-viewer');

        // Look up the latest creel record for a given production order (used by finish-earlier table)
        Route::get('creel-records/by-order/{orderNumber}', function ($orderNumber) {
            $record = \App\Models\CreelRecord::where('order_number', $orderNumber)
                ->orderBy('created_at', 'desc')->first();
            if (!$record) {
                return response()->json(['id' => null], 404);
            }
            return response()->json(['id' => $record->id]);
        });

        Route::get('creel-records', [CreelRecordController::class, 'index']);
        Route::get('creel-records/{id}', [CreelRecordController::class, 'show']);
    });
    Route::post('creel-records', [CreelRecordController::class, 'store'])
        ->middleware('permission:creel.create');
    Route::patch('creel-records/{id}/positions', [CreelRecordController::class, 'positions'])
        ->middleware('permission:creel.edit');
    Route::patch('creel-records/{id}/specs', [CreelRecordController::class, 'specs'])
        ->middleware('permission:creel.edit');
    Route::patch('creel-records/{id}/raw', [CreelRecordController::class, 'rawUpdate'])
        ->middleware('permission:creel.edit');
    Route::delete('creel-records/{id}', [CreelRecordController::class, 'destroy'])
        ->middleware('permission:creel.delete');

    // ---- MACHINE MAINTENANCE ----
    Route::middleware('permission:machine-maintenance.view')->group(function () {
        Route::get('machine-maintenance', fn () => Inertia::render('machine-maintenance'))
            ->name('machine-maintenance');
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

    // ---- ACTIVITY LOG ----
    Route::middleware('permission:activity-log.view')->group(function () {
        Route::get('activity-log', function () {
            return Inertia::render('activity-log');
        })->name('activity-log');

        Route::get('api/activity-log', [ActivityLogController::class, 'index']);
    });

    // ---- DOCUMENT INTELLIGENCE ----
    Route::get('document-intelligence', fn () => Inertia::render('document-intelligence'))
        ->name('document-intelligence');
    Route::post('document-intelligence/process', [DocumentIntelligenceController::class, 'process']);
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
