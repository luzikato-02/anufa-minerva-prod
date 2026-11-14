<?php

namespace App\Http\Controllers\Ai;

use App\Ai\Llm\ModelCatalog;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** Which AI models a user may pick, and the admin side of setting that per user. */
class AiModelsController extends Controller
{
    /** The signed-in user's model access, for the model pickers in every AI feature. */
    public function mine(Request $request, ModelCatalog $catalog): JsonResponse
    {
        return response()->json($catalog->accessFor($request->user()));
    }

    /** For User Management: every offered model and the app-wide default. */
    public function catalog(ModelCatalog $catalog): JsonResponse
    {
        return response()->json([
            'models' => $catalog->models(),
            'systemDefault' => $catalog->defaultModel(),
        ]);
    }

    /** Set a user's default model and the models they may use (null: all, now and added later). */
    public function update(Request $request, User $user, ModelCatalog $catalog): JsonResponse
    {
        // Ids the user already has stay valid even if the provider stopped listing them, so saving
        // other changes doesn't fail on them.
        $known = array_values(array_unique([...$catalog->models(), ...($user->ai_allowed_models ?? [])]));
        $validated = $request->validate([
            'allowed_models' => ['present', 'nullable', 'array'],
            'allowed_models.*' => ['string', 'distinct', 'in:'.implode(',', $known)],
            'default_model' => ['nullable', 'string', 'max:100'],
        ]);
        $allowed = $validated['allowed_models'];
        $default = $validated['default_model'] ?? null;

        if ($default !== null && ! in_array($default, $allowed ?? $catalog->models(), true)) {
            return response()->json([
                'message' => 'The default model must be one the user is allowed to use.',
                'errors' => ['default_model' => ['The default model must be one the user is allowed to use.']],
            ], 422);
        }

        $old = ['default_model' => $user->ai_default_model, 'allowed_models' => $user->ai_allowed_models];
        $user->ai_default_model = $default;
        $user->ai_allowed_models = $allowed === null ? null : array_values($allowed);
        $user->save();

        activity()
            ->causedBy($request->user())
            ->performedOn($user)
            ->event('ai_models')
            ->withProperties(['old' => $old, 'new' => ['default_model' => $default, 'allowed_models' => $user->ai_allowed_models]])
            ->log("AI models updated for user '{$user->name}'");

        return response()->json($user->load('roles:id,name'));
    }
}
