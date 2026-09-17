<?php

namespace App\Console\Commands;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;

class FinalizeDeploy extends Command
{
    protected $signature = 'deploy:finalize';

    protected $description = 'Run post-deploy tasks (migrations, role/permission sync, admin bootstrap, caching). Called by deploy/deploy.sh after every deploy.';

    public function handle(): int
    {
        $this->call('migrate', ['--force' => true]);

        $this->call('db:seed', ['--class' => RolesAndPermissionsSeeder::class, '--force' => true]);

        $this->info($this->ensureAdminUser());

        $this->call('storage:link', ['--relative' => true]);

        Artisan::call('optimize:clear');
        $this->call('optimize');

        return self::SUCCESS;
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
            return 'Admin user: skipped (ADMIN_EMAIL not set)';
        }

        if (User::where('email', $email)->exists()) {
            return 'Admin user: skipped (already exists)';
        }

        $user = User::create([
            'name' => config('app.admin_name', 'Admin'),
            'username' => config('app.admin_username', 'admin'),
            'email' => $email,
            'password' => Hash::make(config('app.admin_password')),
            'email_verified_at' => now(),
        ]);

        $user->syncRoles(['admin']);

        return 'Admin user: created';
    }
}
