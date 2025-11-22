<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Http\Controllers\Api\StockTakeRecordController;
use App\Http\Controllers\Api\TensionRecordController;

// Mobile routes group
Route::prefix('mobile')->group(function () {

    // Public routes (no auth)
    Route::post('/login', function (Request $request) {
        $request->validate([
            'login' => 'required|string', // can be email or username
            'password' => 'required|string',
        ]);

        $login = $request->login;

        $user = User::where('email', $login)
                    ->orWhere('username', $login)
                    ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $token = $user->createToken('mobile-app-token')->plainTextToken;

        return response()->json([
            'access_token' => $token,
            'token_type' => 'Bearer',
            'user' => $user,
        ]);
    });

    // Routes that require authentication
    Route::middleware(['throttle:60,1','auth:sanctum'])->group(function () {

        Route::post('/logout', function (Request $request) {
            $request->user()->currentAccessToken()->delete();
            return response()->json(['message' => 'Logged out']);
        });

        // Tension features endpoints
        Route::resource('tension-records', TensionRecordController::class)->only([
            'index', 'store', 'show', 'destroy', 'update'
        ]);

        Route::get('tension-records/{tensionRecord}/download', [TensionRecordController::class, 'downloadCsv'])
            ->name('tension-records.download');
        
        Route::get('tension-statistics', [TensionRecordController::class, 'statistics'])
            ->name('tension-records.statistics');

        Route::get('tension-records/type/{type}', [TensionRecordController::class, 'byType'])
            ->whereIn('type', ['twisting', 'weaving'])
            ->name('tension-records.by-type');

        // Stock taking features endpoints
        Route::get('stock-take-records/session/{sessionId}', [StockTakeRecordController::class, 'getSession']);

        Route::get('stock-take-records/check-batch', [StockTakeRecordController::class, 'checkBatch']);

        Route::post('stock-take-records/record-batch', [StockTakeRecordController::class, 'recordBatch']);

        Route::patch('stock-take-records/{id}/status', [StockTakeRecordController::class, 'updateSessionStatus']);

        Route::get('stock-take-records/{stockTakeRecord}/download', [StockTakeRecordController::class, 'downloadCsv']);

        Route::resource('stock-take-records', StockTakeRecordController::class)->only([
            'index', 'store', 'show', 'destroy', 'update'
        ]);
    });
});
