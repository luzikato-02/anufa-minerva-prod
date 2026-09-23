<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CreelType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CreelTypeController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => CreelType::withCount('torqueCheckSheets')->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:creel_types,name',
            'torque_min' => 'required|numeric|min:0',
            'torque_max' => 'required|numeric|gte:torque_min',
        ]);

        $type = CreelType::create($validated);

        return response()->json(['status' => 'success', 'data' => $type], 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $type = CreelType::findOrFail($id);

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', Rule::unique('creel_types', 'name')->ignore($type->id)],
            'torque_min' => 'required|numeric|min:0',
            'torque_max' => 'required|numeric|gte:torque_min',
        ]);

        $type->update($validated);

        return response()->json(['status' => 'success', 'data' => $type->fresh()]);
    }

    public function destroy(string $id): JsonResponse
    {
        $type = CreelType::withCount('torqueCheckSheets')->findOrFail($id);

        if ($type->torque_check_sheets_count > 0) {
            return response()->json([
                'status' => 'error',
                'message' => 'Cannot delete: torque checks are using this creel type.',
            ], 422);
        }

        $type->delete();

        return response()->json(['status' => 'success', 'message' => 'Creel type deleted successfully.']);
    }
}
