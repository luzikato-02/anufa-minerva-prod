<?php

use App\Http\Controllers\Api\DataSyncController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

Route::middleware('auth:sanctum')->get('/user', function (Request $request) {
    return $request->user();
});

// Data Sync API routes (for Electron desktop app)
Route::prefix('sync')->name('sync.')->group(function () {
    // Device registration (no auth required for initial registration)
    Route::post('register-device', [DataSyncController::class, 'registerDevice'])
        ->name('register-device');
    
    // Protected sync endpoints
    Route::middleware('auth:sanctum')->group(function () {
        // Sync status
        Route::get('status', [DataSyncController::class, 'getSyncStatus'])
            ->name('status');
        
        // Upload data from client to server
        Route::post('upload', [DataSyncController::class, 'upload'])
            ->name('upload');
        
        // Download data from server to client
        Route::get('download', [DataSyncController::class, 'download'])
            ->name('download');
        
        // Conflicts management
        Route::get('conflicts', [DataSyncController::class, 'getConflicts'])
            ->name('conflicts');
        Route::post('conflicts/{id}/resolve', [DataSyncController::class, 'resolveConflict'])
            ->name('conflicts.resolve');
        
        // Sync logs
        Route::get('logs', [DataSyncController::class, 'getSyncLogs'])
            ->name('logs');
    });
});
