<?php

namespace Tests\Feature\Api;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;
use Spatie\Permission\Models\Permission;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    private function userWith(array $permissions = [], array $attrs = []): User
    {
        $user = User::factory()->withoutTwoFactor()->create($attrs + ['password' => Hash::make('secret-pass-123')]);
        foreach ($permissions as $name) {
            Permission::findOrCreate($name, 'web');
        }
        $user->givePermissionTo($permissions);

        return $user;
    }

    public function test_login_returns_token_user_and_permissions(): void
    {
        $user = $this->userWith(['stock-take.view'], ['email' => 'op@example.com']);

        $res = $this->postJson('/api/v1/auth/login', ['login' => 'op@example.com', 'password' => 'secret-pass-123', 'device_name' => 'Pixel']);

        $res->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email'], 'roles', 'permissions', 'two_factor_enabled'])
            ->assertJsonPath('permissions.0', 'stock-take.view');
        $this->assertSame('Pixel', $user->tokens()->first()->name);
    }

    public function test_login_rejects_bad_credentials_and_inactive_users(): void
    {
        $this->userWith([], ['email' => 'a@example.com']);
        $this->userWith([], ['email' => 'off@example.com', 'status' => 'inactive']);

        $this->postJson('/api/v1/auth/login', ['login' => 'a@example.com', 'password' => 'wrong'])
            ->assertStatus(422)->assertJsonValidationErrors('login');
        $this->postJson('/api/v1/auth/login', ['login' => 'off@example.com', 'password' => 'secret-pass-123'])
            ->assertStatus(422)->assertJsonValidationErrors('login');
    }

    public function test_two_factor_challenge_accepts_totp_and_recovery_codes(): void
    {
        $google = new Google2FA;
        $secret = $google->generateSecretKey();
        $user = $this->userWith([], [
            'email' => 'tf@example.com',
            'two_factor_secret' => encrypt($secret),
            'two_factor_recovery_codes' => encrypt(json_encode(['recover-1', 'recover-2'])),
            'two_factor_confirmed_at' => now(),
        ]);

        $challenge = $this->postJson('/api/v1/auth/login', ['login' => 'tf@example.com', 'password' => 'secret-pass-123'])
            ->assertOk()->assertJsonPath('two_factor', true)->assertJsonMissingPath('token')->json('challenge');

        $this->postJson('/api/v1/auth/two-factor-challenge', ['challenge' => $challenge, 'code' => '000000'])
            ->assertStatus(422)->assertJsonValidationErrors('code');

        $this->postJson('/api/v1/auth/two-factor-challenge', ['challenge' => $challenge, 'code' => $google->getCurrentOtp($secret)])
            ->assertOk()->assertJsonStructure(['token']);

        // Challenge is single-use.
        $this->postJson('/api/v1/auth/two-factor-challenge', ['challenge' => $challenge, 'code' => $google->getCurrentOtp($secret)])
            ->assertStatus(422);

        $challenge = $this->postJson('/api/v1/auth/login', ['login' => 'tf@example.com', 'password' => 'secret-pass-123'])->json('challenge');
        $this->postJson('/api/v1/auth/two-factor-challenge', ['challenge' => $challenge, 'recovery_code' => 'recover-1'])
            ->assertOk()->assertJsonStructure(['token']);
        $this->assertNotContains('recover-1', $user->fresh()->recoveryCodes());
    }

    public function test_protected_routes_require_a_token_and_return_json_401(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
        $this->getJson('/api/v1/dashboard')->assertUnauthorized();
    }

    public function test_me_and_logout_revoke_the_token(): void
    {
        $this->userWith(['users.view'], ['email' => 'm@example.com']);
        $token = $this->postJson('/api/v1/auth/login', ['login' => 'm@example.com', 'password' => 'secret-pass-123'])->json('token');

        $this->withToken($token)->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('user.email', 'm@example.com');
        $this->withToken($token)->postJson('/api/v1/auth/logout')->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_permission_middleware_gates_module_routes(): void
    {
        $viewer = $this->userWith(['stock-take.view']);
        $nobody = $this->userWith();

        $this->actingAs($nobody, 'sanctum')->getJson('/api/v1/stock-take-records')->assertForbidden();
        $this->actingAs($viewer, 'sanctum')->getJson('/api/v1/stock-take-records')->assertOk();
        $this->actingAs($viewer, 'sanctum')->postJson('/api/v1/stock-take-records', [])->assertForbidden();
        $this->actingAs($viewer, 'sanctum')->getJson('/api/v1/users')->assertForbidden();
    }

    public function test_dashboard_only_includes_permitted_sections(): void
    {
        $user = $this->userWith(['stock-take.view']);

        $this->actingAs($user, 'sanctum')->getJson('/api/v1/dashboard')
            ->assertOk()
            ->assertJsonPath('tension', null)
            ->assertJsonPath('users', null)
            ->assertJsonPath('stockTake.total', 0);
    }

    public function test_deactivated_user_token_is_rejected_and_revoked(): void
    {
        $user = $this->userWith(['stock-take.view'], ['email' => 'x@example.com']);
        $token = $this->postJson('/api/v1/auth/login', ['login' => 'x@example.com', 'password' => 'secret-pass-123'])->json('token');
        $user->update(['status' => 'inactive']);

        $this->withToken($token)->getJson('/api/v1/dashboard')->assertForbidden();
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_password_change_requires_current_password(): void
    {
        $user = $this->userWith();

        $this->actingAs($user, 'sanctum')->putJson('/api/v1/account/password', [
            'current_password' => 'nope', 'password' => 'New-pass-9876!', 'password_confirmation' => 'New-pass-9876!',
        ])->assertStatus(422);

        $this->actingAs($user, 'sanctum')->putJson('/api/v1/account/password', [
            'current_password' => 'secret-pass-123', 'password' => 'New-pass-9876!', 'password_confirmation' => 'New-pass-9876!',
        ])->assertOk();
        $this->assertTrue(Hash::check('New-pass-9876!', $user->fresh()->password));
    }
}
