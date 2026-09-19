<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/** Token counterpart of EnsureUserIsActive: deactivated users lose API access at once. */
class EnsureApiUserIsActive
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user && $user->status === 'inactive') {
            $user->tokens()->delete();

            return response()->json([
                'message' => 'User authorization revoked. Contact your Minerva system administrator to manage your access',
            ], 403);
        }

        return $next($request);
    }
}
