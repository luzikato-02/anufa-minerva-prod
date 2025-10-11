<?php

namespace App\Http\Requests\Auth;

use App\Models\User;
use Illuminate\Auth\Events\Lockout;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class LoginRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
{
    return [
        'login' => ['required', 'string'],
        'password' => ['required', 'string'],
    ];
}

protected function credentials(): array
{
    $login = $this->input('login');

    $field = filter_var($login, FILTER_VALIDATE_EMAIL) ? 'email' : 'username';

    return [
        $field => $login,
        'password' => $this->input('password'),
    ];
}
    /**
     * Validate the request's credentials and return the user without logging them in.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function validateCredentials(): User
{
    $this->ensureIsNotRateLimited();

    $credentials = $this->credentials();

    /** @var User|null $user */
    $user = Auth::getProvider()->retrieveByCredentials($credentials);

    if (! $user || ! Auth::getProvider()->validateCredentials($user, ['password' => $this->input('password')])) {
        RateLimiter::hit($this->throttleKey());

        throw ValidationException::withMessages([
            'login' => __('auth.failed'),
        ]);
    }

    RateLimiter::clear($this->throttleKey());

    return $user;
}
    /**
     * Ensure the login request is not rate limited.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function ensureIsNotRateLimited(): void
    {
        if (! RateLimiter::tooManyAttempts($this->throttleKey(), 5)) {
            return;
        }

        event(new Lockout($this));

        $seconds = RateLimiter::availableIn($this->throttleKey());

        throw ValidationException::withMessages([
            'email' => __('auth.throttle', [
                'seconds' => $seconds,
                'minutes' => ceil($seconds / 60),
            ]),
        ]);
    }

    /**
     * Get the rate-limiting throttle key for the request.
     */
    public function throttleKey(): string
    {
        return $this->string('email')
            ->lower()
            ->append('|'.$this->ip())
            ->transliterate()
            ->value();
    }
}
