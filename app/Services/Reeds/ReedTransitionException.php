<?php

namespace App\Services\Reeds;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/** A move the reed's current state does not allow. Rendered as 409 with a message the floor can act on. */
class ReedTransitionException extends RuntimeException
{
    public function render(): JsonResponse
    {
        return response()->json(['status' => 'error', 'message' => $this->getMessage()], 409);
    }
}
