<?php

use App\Http\Controllers\Api\StockTakeRecordController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Api\TensionRecordController;
use App\Http\Controllers\Api\FinishEarlierRecordController;

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

    Route::get('finish-earlier-display', function () {
        return Inertia::render('finish-earlier-records-display');
    })->name('finish-earlier-display');

    Route::get('under-construction', function () {
        return Inertia::render('under-construction');
    })->name('under-construction');

    Route::resource('tension-records', TensionRecordController::class)->only([
        'index', 'store', 'show', 'destroy', 'update'
    ]);

    Route::get('tension-records/{tensionRecord}/download', [TensionRecordController::class, 'downloadCsv'])
        ->name('tension-records.download');
    
    Route::get('tension-statistics', [TensionRecordController::class, 'statistics'])
        ->name('tension-records.statistics');

    // Tension Problems endpoints
    Route::get('tension-problems', [TensionRecordController::class, 'allProblems'])
        ->name('tension-problems.index');
    
    Route::get('tension-records/{tensionRecord}/problems', [TensionRecordController::class, 'problems'])
        ->name('tension-records.problems');
    
    Route::post('tension-records/{tensionRecord}/problems', [TensionRecordController::class, 'addProblem'])
        ->name('tension-records.problems.store');
    
    Route::patch('tension-problems/{tensionProblem}/resolve', [TensionRecordController::class, 'resolveProblem'])
        ->name('tension-problems.resolve');

    // Tension Measurements endpoints
    Route::get('tension-records/{tensionRecord}/measurements', [TensionRecordController::class, 'measurements'])
        ->name('tension-records.measurements');
    
    Route::get('tension-records/{tensionRecord}/measurements/grouped', [TensionRecordController::class, 'measurementsGrouped'])
        ->name('tension-records.measurements.grouped');
    
    Route::get('tension-records/{tensionRecord}/measurements/out-of-spec', [TensionRecordController::class, 'outOfSpecMeasurements'])
        ->name('tension-records.measurements.out-of-spec');

    // Twisting measurement update
    Route::patch('tension-records/{tensionRecord}/twisting-measurements/{spindleNumber}', [TensionRecordController::class, 'updateTwistingMeasurement'])
        ->name('tension-records.twisting-measurements.update')
        ->where('spindleNumber', '[0-9]+');

    // Weaving measurement update
    Route::patch('tension-records/{tensionRecord}/weaving-measurements/{side}/{row}/{column}', [TensionRecordController::class, 'updateWeavingMeasurement'])
        ->name('tension-records.weaving-measurements.update')
        ->where('column', '[0-9]+');

    // Weaving statistics endpoints
    Route::get('tension-records/{tensionRecord}/weaving-stats/by-side', [TensionRecordController::class, 'weavingStatsBySide'])
        ->name('tension-records.weaving-stats.by-side');
    
    Route::get('tension-records/{tensionRecord}/weaving-stats/by-row', [TensionRecordController::class, 'weavingStatsByRow'])
        ->name('tension-records.weaving-stats.by-row');

    // Filtered endpoints by type
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
require __DIR__.'/admin.php';
