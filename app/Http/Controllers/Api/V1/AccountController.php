<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Laravel\Fortify\Actions\ConfirmTwoFactorAuthentication;
use Laravel\Fortify\Actions\DisableTwoFactorAuthentication;
use Laravel\Fortify\Actions\EnableTwoFactorAuthentication;
use Laravel\Fortify\Actions\GenerateNewRecoveryCodes;
use Laravel\Fortify\Features;

/** JSON versions of the web Settings controllers (profile, password, two-factor). */
class AccountController extends Controller
{
    public function updateProfile(ProfileUpdateRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->fill($request->validated());

        if ($user->isDirty('email')) {
            $user->email_verified_at = null;
        }

        $user->save();

        return response()->json(AuthController::userPayload($user->fresh()));
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'current_password:sanctum'],
            'password' => ['required', Password::defaults(), 'confirmed'],
        ]);

        $request->user()->update(['password' => Hash::make($validated['password'])]);

        return response()->json(['message' => 'Password updated']);
    }

    public function destroy(Request $request): JsonResponse
    {
        $request->validate(['password' => ['required', 'current_password:sanctum']]);

        $user = $request->user();
        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Account deleted']);
    }

    public function twoFactorStatus(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'enabled' => $user->hasEnabledTwoFactorAuthentication(),
            'pending_confirmation' => ! is_null($user->two_factor_secret) && is_null($user->two_factor_confirmed_at),
            'requires_confirmation' => Features::optionEnabled(Features::twoFactorAuthentication(), 'confirm'),
        ]);
    }

    /** Starts setup; returns the secret + QR SVG to display until it is confirmed. */
    public function enableTwoFactor(Request $request, EnableTwoFactorAuthentication $enable): JsonResponse
    {
        $this->confirmPassword($request);

        $enable($user = $request->user());

        return response()->json([
            'secret' => decrypt($user->fresh()->two_factor_secret),
            'qr_svg' => $user->fresh()->twoFactorQrCodeSvg(),
            'qr_url' => $user->fresh()->twoFactorQrCodeUrl(),
        ]);
    }

    public function confirmTwoFactor(Request $request, ConfirmTwoFactorAuthentication $confirm): JsonResponse
    {
        $request->validate(['code' => ['required', 'string']]);

        $confirm($user = $request->user(), $request->input('code'));

        return response()->json(['recovery_codes' => $this->decodeRecoveryCodes($user->fresh())]);
    }

    public function disableTwoFactor(Request $request, DisableTwoFactorAuthentication $disable): JsonResponse
    {
        $this->confirmPassword($request);

        $disable($request->user());

        return response()->json(['message' => 'Two-factor authentication disabled']);
    }

    public function recoveryCodes(Request $request): JsonResponse
    {
        $this->confirmPassword($request);

        return response()->json(['recovery_codes' => $this->decodeRecoveryCodes($request->user())]);
    }

    public function regenerateRecoveryCodes(Request $request, GenerateNewRecoveryCodes $generate): JsonResponse
    {
        $this->confirmPassword($request);

        $generate($user = $request->user());

        return response()->json(['recovery_codes' => $this->decodeRecoveryCodes($user->fresh())]);
    }

    /** Stands in for the web `password.confirm` step, which needs a session. */
    private function confirmPassword(Request $request): void
    {
        $request->validate(['password' => ['required', 'current_password:sanctum']]);
    }

    private function decodeRecoveryCodes(User $user): array
    {
        return $user->two_factor_recovery_codes ? json_decode(decrypt($user->two_factor_recovery_codes), true) : [];
    }
}
