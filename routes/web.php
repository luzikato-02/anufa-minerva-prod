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
    Route::get('stock-take-records/session/{sessionId}', [StockTakeRecordController::class, 'getSession'])
    -> middleware('permission:005');

    Route::get('stock-take-records/check-batch', [StockTakeRecordController::class, 'checkBatch'])
    -> middleware('permission:005');

    Route::post('stock-take-records/record-batch', [StockTakeRecordController::class, 'recordBatch'])
    -> middleware('permission:005');

    Route::patch('stock-take-records/{id}/status', [StockTakeRecordController::class, 'updateSessionStatus'])
    ->middleware('permission:004');

    Route::get('stock-take-records/{stockTakeRecord}/download', [StockTakeRecordController::class, 'downloadCsv'])
    ->middleware('permission:004|005');

    Route::resource('stock-take-records', StockTakeRecordController::class)->only([
        'index', 'store', 'show', 'destroy', 'update'
    ]);

    // Tension Records Routes
    Route::get('tension-records-display', function () {
        return Inertia::render('tension-records-display');
    })->name('tension-records-display');

    Route::get('twisting-tension-main', function () {
        return Inertia::render('twisting-tension-main');
    })->name('twisting-tension-main') -> middleware('permission:002','permission:003');
    
    Route::get('weaving-tension-main', function () {
        return Inertia::render('weaving-tension-main');
    })->name('weaving-tension-main') -> middleware('permission:002','permission:003');;

    Route::get('user-maintenance', function () {
        return Inertia::render('user-maintenance-main');
    })->name('user-maintenance');

    Route::get('finish-earlier-record', function () {
        return Inertia::render('under-construction');
    })->name('finish-earlier-record');

    Route::get('finish-earlier-display', function () {
        return Inertia::render('under-construction');
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

     // ✅ Filtered endpoints (now conflict-free)
    Route::get('tension-records/type/{type}', [TensionRecordController::class, 'byType'])
        ->whereIn('type', ['twisting', 'weaving'])
        ->name('tension-records.by-type');

});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
