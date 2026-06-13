<?php

namespace App\Http\Controllers;

use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;

class DeployController extends Controller
{
    /**
     * Run post-deploy tasks (migrations, role/permission sync, caching).
     *
     * Intended for FTP-only hosting where there is no shell access to run
     * artisan commands after uploading files. Protected by DEPLOY_TOKEN.
     */
    public function finalize(Request $request): JsonResponse
    {
        $token = config('app.deploy_token');

        if (empty($token) || ! hash_equals($token, (string) $request->bearerToken())) {
            abort(403);
        }

        $output = [];

        Artisan::call('migrate', ['--force' => true]);
        $output['migrate'] = Artisan::output();

        Artisan::call('db:seed', ['--class' => RolesAndPermissionsSeeder::class, '--force' => true]);
        $output['seed'] = Artisan::output();

        Artisan::call('storage:link');
        $output['storage_link'] = Artisan::output();

        Artisan::call('optimize');
        $output['optimize'] = Artisan::output();

        return response()->json($output);
    }
}
