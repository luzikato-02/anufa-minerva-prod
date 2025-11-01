<?php

use App\Http\Controllers\Api\StockTakeRecordController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\Api\TensionRecordController;

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

     // ✅ Filtered endpoints (now conflict-free)
    Route::get('tension-records/type/{type}', [TensionRecordController::class, 'byType'])
        ->whereIn('type', ['twisting', 'weaving'])
        ->name('tension-records.by-type');

});



require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
