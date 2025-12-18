<?php

use App\Http\Controllers\Api\StockTakeRecordController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Api\TensionRecordController;
use App\Http\Controllers\Api\FinishEarlierRecordController;
use App\Http\Controllers\Api\ControlPlanController;

Route::get('/csrf-token', function () {
    return response()->json(['csrfToken' => csrf_token()]);
}); 


Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/', function () {
    return Inertia::render('welcome');
    })->name('home');

    Route::get('dashboard', function () {
        return Inertia::render('dashboard');
    })->name('dashboard');

    // Stock Take Records Routes
    Route::get('stock-take-records-main', function () {
        return Inertia::render('stock-take-records-display');
    })->name('stock-take-records-main');

    Route::get('batch-stock-taking-main', function () {
        return Inertia::render('batch-stock-taking-main');
    })->name('batch-stock-taking-main');

    // ✅ GET session data by ID
    Route::get('stock-take-records/session/{sessionId}', [StockTakeRecordController::class, 'getSession']);

    // ✅ GET session data by ID
    Route::get('stock-take-records/check-batch', [StockTakeRecordController::class, 'checkBatch']);

    Route::post('stock-take-records/record-batch', [StockTakeRecordController::class, 'recordBatch']);

    Route::patch('stock-take-records/{id}/status', [StockTakeRecordController::class, 'updateSessionStatus']);

    Route::get('stock-take-records/{stockTakeRecord}/download', [StockTakeRecordController::class, 'downloadCsv']);

    Route::resource('stock-take-records', StockTakeRecordController::class)->only([
        'index', 'store', 'show', 'destroy', 'update'
    ]);

    // Tension Records Routes
    Route::get('tension-records-display', function () {
        return Inertia::render('tension-records-display');
    })->name('tension-records-display');

    Route::get('twisting-tension-main', function () {
        return Inertia::render('twisting-tension-main');
    })->name('twisting-tension-main');
    
    Route::get('weaving-tension-main', function () {
        return Inertia::render('weaving-tension-main');
    })->name('weaving-tension-main');

    Route::get('user-maintenance', function () {
        return Inertia::render('user-maintenance-main');
    })->name('user-maintenance');

    Route::get('finish-earlier-display', function () {
        return Inertia::render('finish-earlier-records-display');
    })->name('finish-earlier-display');

    Route::get('under-construction', function () {
        return Inertia::render('under-construction');
    })->name('under-construction');

    // Control Plans Routes
    Route::get('control-plans-display', function () {
        return Inertia::render('control-plans-display');
    })->name('control-plans-display');

    Route::get('control-plans-create', function () {
        return Inertia::render('control-plan-create');
    })->name('control-plans-create');

    Route::get('control-plans/{controlPlan}/edit', function ($controlPlan) {
        return Inertia::render('control-plan-edit', [
            'controlPlanId' => $controlPlan
        ]);
    })->name('control-plans-edit');

    Route::get('/control-plans/statistics', [ControlPlanController::class, 'statistics']);
    Route::resource('control-plans', ControlPlanController::class)->only([
        'index', 'store', 'show', 'update', 'destroy'
    ]);
    Route::post('/control-plans/{controlPlan}/items', [ControlPlanController::class, 'addItem']);
    Route::put('/control-plans/{controlPlan}/items/{item}', [ControlPlanController::class, 'updateItem']);
    Route::delete('/control-plans/{controlPlan}/items/{item}', [ControlPlanController::class, 'deleteItem']);
    Route::post('/control-plans/{controlPlan}/reorder', [ControlPlanController::class, 'reorderItems']);

    Route::resource('tension-records', TensionRecordController::class)->only([
        'index', 'store', 'show', 'destroy', 'update'
    ]);

    Route::get('tension-records/{tensionRecord}/download', [TensionRecordController::class, 'downloadCsv'])
        ->name('tension-records.download');
    
    Route::get('tension-statistics', [TensionRecordController::class, 'statistics'])
        ->name('tension-records.statistics');

     // ✅ Filtered endpoints (now conflict-free)
    Route::get('tension-records/type/{type}', [TensionRecordController::class, 'byType'])
        ->whereIn('type', ['twisting', 'weaving'])
        ->name('tension-records.by-type');

    // Finish Earlier Record Endpoints
    Route::get('/finish-earlier', [FinishEarlierRecordController::class, 'index']);
    Route::get('/finish-earlier/{id}', [FinishEarlierRecordController::class, 'show']);
    Route::get('/finish-earlier/{productionOrder}/pdf', [FinishEarlierRecordController::class, 'exportPdf']);
    Route::get('/finish-earlier/{productionOrder}/download', [FinishEarlierRecordController::class, 'downloadCsv']);
    Route::get('/finish-earlier/session/{productionOrder}', [FinishEarlierRecordController::class, 'getSession']);
    Route::post('/finish-earlier/start-session', [FinishEarlierRecordController::class, 'store']);
    Route::post('/finish-earlier/{productionOrder}/add-entry', [FinishEarlierRecordController::class, 'addEntry']);
    Route::post('/finish-earlier/{id}/finish', [FinishEarlierRecordController::class, 'finish']);
    Route::delete('/finish-earlier/{id}', [FinishEarlierRecordController::class, 'destroy']);
    
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
