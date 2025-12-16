<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ControlPlan;
use App\Models\ControlPlanItem;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ControlPlanController extends Controller
{
    /**
     * Display a listing of control plans
     */
    public function index(Request $request): JsonResponse
    {
        $query = ControlPlan::with('items');

        // Global search
        if ($search = $request->input('search')) {
            $query->search($search);
        }

        // Filter by document number
        if ($documentNumber = $request->input('document_number')) {
            $query->byDocumentNumber($documentNumber);
        }

        // Order by latest first
        $query->orderBy('created_at', 'desc');

        // Paginate results
        $perPage = $request->get('per_page', 10);
        $controlPlans = $query->paginate($perPage);

        return response()->json($controlPlans);
    }

    /**
     * Store a newly created control plan
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'document_number' => 'required|string|max:255|unique:control_plans,document_number',
            'title' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'items' => 'array',
            'items.*.process_no' => 'nullable|string|max:255',
            'items.*.process_step' => 'nullable|string|max:255',
            'items.*.process_items' => 'nullable|string',
            'items.*.machine_device_jig_tools' => 'nullable|string',
            'items.*.product_process_characteristics' => 'nullable|string',
            'items.*.special_characteristics' => 'nullable|string|max:255',
            'items.*.product_process_specification_tolerance' => 'nullable|string',
            'items.*.sample_size' => 'nullable|string|max:255',
            'items.*.sample_frequency' => 'nullable|string|max:255',
            'items.*.control_method' => 'nullable|string',
            'items.*.reaction_plan' => 'nullable|string',
            'items.*.sort_order' => 'nullable|integer|min:0',
        ]);

        try {
            DB::beginTransaction();

            // Create the control plan
            $controlPlan = ControlPlan::create([
                'document_number' => $validated['document_number'],
                'title' => $validated['title'] ?? null,
                'description' => $validated['description'] ?? null,
                'created_by' => auth()->id(),
            ]);

            // Create items if provided
            if (!empty($validated['items'])) {
                foreach ($validated['items'] as $index => $itemData) {
                    $itemData['control_plan_id'] = $controlPlan->id;
                    $itemData['sort_order'] = $itemData['sort_order'] ?? $index;
                    ControlPlanItem::create($itemData);
                }
            }

            DB::commit();

            // Reload with items
            $controlPlan->load('items');

            return response()->json([
                'status' => 'success',
                'message' => 'Control plan created successfully',
                'data' => $controlPlan
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to create control plan',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified control plan
     */
    public function show(ControlPlan $controlPlan): JsonResponse
    {
        $controlPlan->load('items');

        return response()->json([
            'status' => 'success',
            'data' => $controlPlan
        ]);
    }

    /**
     * Update the specified control plan
     */
    public function update(Request $request, ControlPlan $controlPlan): JsonResponse
    {
        $validated = $request->validate([
            'document_number' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('control_plans', 'document_number')->ignore($controlPlan->id),
            ],
            'title' => 'nullable|string|max:255',
            'description' => 'nullable|string',
            'items' => 'array',
            'items.*.id' => 'nullable|integer|exists:control_plan_items,id',
            'items.*.process_no' => 'nullable|string|max:255',
            'items.*.process_step' => 'nullable|string|max:255',
            'items.*.process_items' => 'nullable|string',
            'items.*.machine_device_jig_tools' => 'nullable|string',
            'items.*.product_process_characteristics' => 'nullable|string',
            'items.*.special_characteristics' => 'nullable|string|max:255',
            'items.*.product_process_specification_tolerance' => 'nullable|string',
            'items.*.sample_size' => 'nullable|string|max:255',
            'items.*.sample_frequency' => 'nullable|string|max:255',
            'items.*.control_method' => 'nullable|string',
            'items.*.reaction_plan' => 'nullable|string',
            'items.*.sort_order' => 'nullable|integer|min:0',
        ]);

        try {
            DB::beginTransaction();

            // Update the control plan
            $controlPlan->update([
                'document_number' => $validated['document_number'] ?? $controlPlan->document_number,
                'title' => $validated['title'] ?? $controlPlan->title,
                'description' => $validated['description'] ?? $controlPlan->description,
            ]);

            // Update items if provided
            if (isset($validated['items'])) {
                $existingItemIds = [];

                foreach ($validated['items'] as $index => $itemData) {
                    $itemData['sort_order'] = $itemData['sort_order'] ?? $index;

                    if (isset($itemData['id'])) {
                        // Update existing item
                        $item = ControlPlanItem::find($itemData['id']);
                        if ($item && $item->control_plan_id === $controlPlan->id) {
                            $item->update($itemData);
                            $existingItemIds[] = $item->id;
                        }
                    } else {
                        // Create new item
                        $itemData['control_plan_id'] = $controlPlan->id;
                        $newItem = ControlPlanItem::create($itemData);
                        $existingItemIds[] = $newItem->id;
                    }
                }

                // Delete items that are no longer in the list
                $controlPlan->items()->whereNotIn('id', $existingItemIds)->delete();
            }

            DB::commit();

            // Reload with items
            $controlPlan->load('items');

            return response()->json([
                'status' => 'success',
                'message' => 'Control plan updated successfully',
                'data' => $controlPlan
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to update control plan',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove the specified control plan
     */
    public function destroy(ControlPlan $controlPlan): JsonResponse
    {
        $controlPlan->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Control plan deleted successfully'
        ]);
    }

    /**
     * Add a single item to a control plan
     */
    public function addItem(Request $request, ControlPlan $controlPlan): JsonResponse
    {
        $validated = $request->validate([
            'process_no' => 'nullable|string|max:255',
            'process_step' => 'nullable|string|max:255',
            'process_items' => 'nullable|string',
            'machine_device_jig_tools' => 'nullable|string',
            'product_process_characteristics' => 'nullable|string',
            'special_characteristics' => 'nullable|string|max:255',
            'product_process_specification_tolerance' => 'nullable|string',
            'sample_size' => 'nullable|string|max:255',
            'sample_frequency' => 'nullable|string|max:255',
            'control_method' => 'nullable|string',
            'reaction_plan' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        // Get the next sort order if not provided
        if (!isset($validated['sort_order'])) {
            $maxSortOrder = $controlPlan->items()->max('sort_order') ?? -1;
            $validated['sort_order'] = $maxSortOrder + 1;
        }

        $validated['control_plan_id'] = $controlPlan->id;
        $item = ControlPlanItem::create($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Item added successfully',
            'data' => $item
        ], 201);
    }

    /**
     * Update a single item in a control plan
     */
    public function updateItem(Request $request, ControlPlan $controlPlan, ControlPlanItem $item): JsonResponse
    {
        // Ensure the item belongs to the control plan
        if ($item->control_plan_id !== $controlPlan->id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Item does not belong to this control plan'
            ], 404);
        }

        $validated = $request->validate([
            'process_no' => 'nullable|string|max:255',
            'process_step' => 'nullable|string|max:255',
            'process_items' => 'nullable|string',
            'machine_device_jig_tools' => 'nullable|string',
            'product_process_characteristics' => 'nullable|string',
            'special_characteristics' => 'nullable|string|max:255',
            'product_process_specification_tolerance' => 'nullable|string',
            'sample_size' => 'nullable|string|max:255',
            'sample_frequency' => 'nullable|string|max:255',
            'control_method' => 'nullable|string',
            'reaction_plan' => 'nullable|string',
            'sort_order' => 'nullable|integer|min:0',
        ]);

        $item->update($validated);

        return response()->json([
            'status' => 'success',
            'message' => 'Item updated successfully',
            'data' => $item
        ]);
    }

    /**
     * Delete a single item from a control plan
     */
    public function deleteItem(ControlPlan $controlPlan, ControlPlanItem $item): JsonResponse
    {
        // Ensure the item belongs to the control plan
        if ($item->control_plan_id !== $controlPlan->id) {
            return response()->json([
                'status' => 'error',
                'message' => 'Item does not belong to this control plan'
            ], 404);
        }

        $item->delete();

        return response()->json([
            'status' => 'success',
            'message' => 'Item deleted successfully'
        ]);
    }

    /**
     * Reorder items in a control plan
     */
    public function reorderItems(Request $request, ControlPlan $controlPlan): JsonResponse
    {
        $validated = $request->validate([
            'item_ids' => 'required|array',
            'item_ids.*' => 'integer|exists:control_plan_items,id',
        ]);

        try {
            DB::beginTransaction();

            foreach ($validated['item_ids'] as $index => $itemId) {
                ControlPlanItem::where('id', $itemId)
                    ->where('control_plan_id', $controlPlan->id)
                    ->update(['sort_order' => $index]);
            }

            DB::commit();

            $controlPlan->load('items');

            return response()->json([
                'status' => 'success',
                'message' => 'Items reordered successfully',
                'data' => $controlPlan
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to reorder items',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get statistics for control plans
     */
    public function statistics(): JsonResponse
    {
        $stats = [
            'total_control_plans' => ControlPlan::count(),
            'total_items' => ControlPlanItem::count(),
            'recent_control_plans' => ControlPlan::with('items')
                ->orderBy('created_at', 'desc')
                ->take(5)
                ->get(),
        ];

        return response()->json([
            'status' => 'success',
            'data' => $stats
        ]);
    }
}
