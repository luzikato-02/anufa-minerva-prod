<?php

namespace App\Http\Controllers;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;

class DeployController extends Controller
{
    /**
     * Run post-deploy tasks (migrations, role/permission sync, admin
     * bootstrap, caching).
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

        $output['admin_user'] = $this->ensureAdminUser();

        Artisan::call('storage:link');
        $output['storage_link'] = Artisan::output();

        Artisan::call('optimize');
        $output['optimize'] = Artisan::output();

        return response()->json($output);
    }

    /**
     * Create the first admin user from env vars, if none exists yet.
     *
     * There is no public registration route, so without this there would be
     * no way to log in to a fresh production deploy.
     */
    private function ensureAdminUser(): string
    {
        $email = config('app.admin_email');

        if (empty($email)) {
            return 'skipped (ADMIN_EMAIL not set)';
        }

        if (User::where('email', $email)->exists()) {
            return 'skipped (already exists)';
        }

        $user = User::create([
            'name' => config('app.admin_name', 'Admin'),
            'username' => config('app.admin_username', 'admin'),
            'email' => $email,
            'password' => Hash::make(config('app.admin_password')),
            'email_verified_at' => now(),
        ]);

        $user->syncRoles(['admin']);

        return 'created';
    }
}
