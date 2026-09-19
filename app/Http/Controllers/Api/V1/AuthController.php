<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\Contracts\TwoFactorAuthenticationProvider;
use Laravel\Fortify\Features;

class AuthController extends Controller
{
    private const CHALLENGE_TTL_SECONDS = 300;

    /** Same payload the web app shares with Inertia (`auth.user/roles/permissions`). */
    public static function userPayload(User $user): array
    {
        return [
            'user' => $user,
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getAllPermissions()->pluck('name')->values(),
            'two_factor_enabled' => $user->hasEnabledTwoFactorAuthentication(),
        ];
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $request->validate(['device_name' => ['nullable', 'string', 'max:100']]);

        $user = $request->validateCredentials();

        if (Features::enabled(Features::twoFactorAuthentication()) && $user->hasEnabledTwoFactorAuthentication()) {
            $challenge = Str::random(64);
            Cache::put($this->challengeKey($challenge), [
                'user_id' => $user->getKey(),
                'device_name' => $request->input('device_name'),
            ], self::CHALLENGE_TTL_SECONDS);

            return response()->json(['two_factor' => true, 'challenge' => $challenge]);
        }

        return $this->issueToken($request, $user, $request->input('device_name'));
    }

    public function twoFactorChallenge(Request $request): JsonResponse
    {
        $data = $request->validate([
            'challenge' => ['required', 'string'],
            'code' => ['nullable', 'string'],
            'recovery_code' => ['nullable', 'string'],
        ]);

        $pending = Cache::get($this->challengeKey($data['challenge']));
        $user = $pending ? User::find($pending['user_id']) : null;

        if (! $user) {
            throw ValidationException::withMessages(['challenge' => 'The sign-in session expired. Please log in again.']);
        }

        if (! empty($data['code'])) {
            $valid = app(TwoFactorAuthenticationProvider::class)
                ->verify(decrypt($user->two_factor_secret), $data['code']);

            if (! $valid) {
                throw ValidationException::withMessages(['code' => 'The provided two factor authentication code was invalid.']);
            }
        } elseif (! empty($data['recovery_code'])) {
            $code = collect($user->recoveryCodes())->first(fn ($c) => hash_equals($c, $data['recovery_code']));

            if (! $code) {
                throw ValidationException::withMessages(['recovery_code' => 'The provided two factor recovery code was invalid.']);
            }

            $user->replaceRecoveryCode($code);
        } else {
            throw ValidationException::withMessages(['code' => 'A code or recovery code is required.']);
        }

        Cache::forget($this->challengeKey($data['challenge']));

        return $this->issueToken($request, $user, $pending['device_name']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(self::userPayload($request->user()));
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();

        $user->currentAccessToken()->delete();

        activity()->causedBy($user)->event('logout')
            ->withProperties(['ip' => $request->ip(), 'client' => 'mobile'])
            ->log('User logged out');

        return response()->json(['message' => 'Logged out']);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);

        // Same response either way so the endpoint cannot be used to probe for accounts.
        Password::sendResetLink($request->only('email'));

        return response()->json(['message' => 'If that email is registered, a reset link has been sent.']);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', PasswordRule::defaults(), 'confirmed'],
        ]);

        $status = Password::reset($data + ['password_confirmation' => $request->input('password_confirmation')], function (User $user, string $password) {
            $user->forceFill(['password' => Hash::make($password)])->save();
            $user->tokens()->delete();
        });

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => __($status)]);
        }

        return response()->json(['message' => __($status)]);
    }

    private function issueToken(Request $request, User $user, ?string $deviceName): JsonResponse
    {
        activity()->causedBy($user)->event('login')
            ->withProperties(['ip' => $request->ip(), 'client' => 'mobile'])
            ->log('User logged in');

        return response()->json([
            'token' => $user->createToken($deviceName ?: 'mobile')->plainTextToken,
            ...self::userPayload($user),
        ]);
    }

    private function challengeKey(string $challenge): string
    {
        return 'api-2fa-challenge:'.hash('sha256', $challenge);
    }
}
