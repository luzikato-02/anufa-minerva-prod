<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ControlPlan;
use App\Models\ControlPlanItem;
use App\Models\ControlPlanRevisionHistory;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

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
            'control_plan_number' => 'nullable|string|max:255',
            'part_number_latest_change_level' => 'nullable|string|max:255',
            'part_name_description' => 'nullable|string|max:255',
            'key_contact_phone' => 'nullable|string|max:255',
            'core_team' => 'nullable|string|max:255',
            'organization_plant' => 'nullable|string|max:255',
            'organization_code' => 'nullable|string|max:255',
            'customer_engineering_approval_date' => 'nullable|string|max:255',
            'customer_quality_approval_date' => 'nullable|string|max:255',
            'other_approval_date' => 'nullable|string|max:255',
            'manufacturing_step' => 'nullable|in:prototype,pre-launch,production',
            'production_area' => 'nullable|string|max:255',
            'referensi_sp' => 'nullable|string|max:255',
            'tanggal_diterbitkan_sp' => 'nullable|date',
            'tanggal_diterbitkan' => 'nullable|date',
            'no_revisi_tanggal_revisi_terakhir' => 'nullable|string|max:255',
            'tanggal_review_berikutnya' => 'nullable|date',
            'signatures_dibuat_oleh' => 'nullable|array',
            'signatures_disetujui_oleh' => 'nullable|array',
            'asterisk_legend' => 'nullable|string',
            'items' => 'array',
            'items.*.process_no' => 'nullable|string|max:255',
            'items.*.process_step' => 'nullable|string|max:255',
            'items.*.process_items' => 'nullable|string',
            'items.*.machine_device_jig_tools' => 'nullable|string',
            'items.*.product_process_characteristics' => 'nullable|string',
            'items.*.product_characteristics' => 'nullable|string',
            'items.*.process_characteristics' => 'nullable|string',
            'items.*.special_characteristics' => 'nullable|string|max:255',
            'items.*.product_process_specification_tolerance' => 'nullable|string',
            'items.*.evaluation_measurement_technique' => 'nullable|string',
            'items.*.sample_size' => 'nullable|string|max:255',
            'items.*.sample_frequency' => 'nullable|string|max:255',
            'items.*.control_method' => 'nullable|string',
            'items.*.reaction_plan' => 'nullable|string',
            'items.*.sort_order' => 'nullable|integer|min:0',
            'items.*.is_new_revision' => 'nullable|boolean',
        ]);

        try {
            DB::beginTransaction();

            // Create the control plan
            $controlPlan = ControlPlan::create([
                'document_number' => $validated['document_number'],
                'title' => $validated['title'] ?? null,
                'description' => $validated['description'] ?? null,
                'created_by' => auth()->id(),
                'control_plan_number' => $validated['control_plan_number'] ?? null,
                'part_number_latest_change_level' => $validated['part_number_latest_change_level'] ?? null,
                'part_name_description' => $validated['part_name_description'] ?? null,
                'key_contact_phone' => $validated['key_contact_phone'] ?? null,
                'core_team' => $validated['core_team'] ?? null,
                'organization_plant' => $validated['organization_plant'] ?? null,
                'organization_code' => $validated['organization_code'] ?? null,
                'customer_engineering_approval_date' => $validated['customer_engineering_approval_date'] ?? null,
                'customer_quality_approval_date' => $validated['customer_quality_approval_date'] ?? null,
                'other_approval_date' => $validated['other_approval_date'] ?? null,
                'manufacturing_step' => $validated['manufacturing_step'] ?? 'production',
                'production_area' => $validated['production_area'] ?? null,
                'referensi_sp' => $validated['referensi_sp'] ?? null,
                'tanggal_diterbitkan_sp' => $validated['tanggal_diterbitkan_sp'] ?? null,
                'tanggal_diterbitkan' => $validated['tanggal_diterbitkan'] ?? null,
                'no_revisi_tanggal_revisi_terakhir' => $validated['no_revisi_tanggal_revisi_terakhir'] ?? null,
                'tanggal_review_berikutnya' => $validated['tanggal_review_berikutnya'] ?? null,
                'signatures_dibuat_oleh' => $validated['signatures_dibuat_oleh'] ?? null,
                'signatures_disetujui_oleh' => $validated['signatures_disetujui_oleh'] ?? null,
                'asterisk_legend' => $validated['asterisk_legend'] ?? null,
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
        try {
            $controlPlan->load(['items', 'revisionHistory', 'creator']);
            
            // Get latest revision number for auto-suggestion
            $latestRevision = $controlPlan->revisionHistory()->orderBy('date_of_revision', 'desc')->first();
            $nextRevisionNumber = '01';
            if ($latestRevision) {
                $revisionNum = intval($latestRevision->revision_number);
                $nextRevisionNumber = str_pad($revisionNum + 1, 2, '0', STR_PAD_LEFT);
            }

            return response()->json([
                'status' => 'success',
                'data' => $controlPlan,
                'next_revision_number' => $nextRevisionNumber
            ]);
        } catch (\Exception $e) {
            \Log::error('Error loading control plan: ' . $e->getMessage(), [
                'control_plan_id' => $controlPlan->id,
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'status' => 'error',
                'message' => 'Failed to load control plan: ' . $e->getMessage()
            ], 500);
        }
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
            'control_plan_number' => 'nullable|string|max:255',
            'part_number_latest_change_level' => 'nullable|string|max:255',
            'part_name_description' => 'nullable|string|max:255',
            'key_contact_phone' => 'nullable|string|max:255',
            'core_team' => 'nullable|string|max:255',
            'organization_plant' => 'nullable|string|max:255',
            'organization_code' => 'nullable|string|max:255',
            'customer_engineering_approval_date' => 'nullable|string|max:255',
            'customer_quality_approval_date' => 'nullable|string|max:255',
            'other_approval_date' => 'nullable|string|max:255',
            'manufacturing_step' => 'nullable|in:prototype,pre-launch,production',
            'production_area' => 'nullable|string|max:255',
            'referensi_sp' => 'nullable|string|max:255',
            'tanggal_diterbitkan_sp' => 'nullable|date',
            'tanggal_diterbitkan' => 'nullable|date',
            'no_revisi_tanggal_revisi_terakhir' => 'nullable|string|max:255',
            'tanggal_review_berikutnya' => 'nullable|date',
            'items' => 'array',
            'items.*.id' => 'nullable|integer|exists:control_plan_items,id',
            'items.*.process_no' => 'nullable|string|max:255',
            'items.*.process_step' => 'nullable|string|max:255',
            'items.*.process_items' => 'nullable|string',
            'items.*.machine_device_jig_tools' => 'nullable|string',
            'items.*.product_process_characteristics' => 'nullable|string',
            'items.*.product_characteristics' => 'nullable|string',
            'items.*.process_characteristics' => 'nullable|string',
            'items.*.special_characteristics' => 'nullable|string|max:255',
            'items.*.product_process_specification_tolerance' => 'nullable|string',
            'items.*.evaluation_measurement_technique' => 'nullable|string',
            'items.*.sample_size' => 'nullable|string|max:255',
            'items.*.sample_frequency' => 'nullable|string|max:255',
            'items.*.control_method' => 'nullable|string',
            'items.*.reaction_plan' => 'nullable|string',
            'items.*.sort_order' => 'nullable|integer|min:0',
            'revision_history' => 'nullable|array',
            'revision_history.page' => 'nullable|string|max:255',
            'revision_history.date_of_revision' => 'nullable|date',
            'revision_history.revision_number' => 'nullable|string|max:255',
            'revision_history.description' => 'nullable|string',
            'revision_history.revised_by' => 'nullable|string|max:255',
            'override_revision_history' => 'nullable|array',
            'override_revision_history.*.page' => 'nullable|string|max:255',
            'override_revision_history.*.date_of_revision' => 'nullable|date',
            'override_revision_history.*.revision_number' => 'nullable|string|max:255',
            'override_revision_history.*.description' => 'nullable|string',
            'override_revision_history.*.revised_by' => 'nullable|string|max:255',
        ]);

        try {
            DB::beginTransaction();

            // Update the control plan
            $controlPlan->update([
                'document_number' => $validated['document_number'] ?? $controlPlan->document_number,
                'title' => $validated['title'] ?? $controlPlan->title,
                'description' => $validated['description'] ?? $controlPlan->description,
                'control_plan_number' => $validated['control_plan_number'] ?? $controlPlan->control_plan_number,
                'part_number_latest_change_level' => $validated['part_number_latest_change_level'] ?? $controlPlan->part_number_latest_change_level,
                'part_name_description' => $validated['part_name_description'] ?? $controlPlan->part_name_description,
                'key_contact_phone' => $validated['key_contact_phone'] ?? $controlPlan->key_contact_phone,
                'core_team' => $validated['core_team'] ?? $controlPlan->core_team,
                'organization_plant' => $validated['organization_plant'] ?? $controlPlan->organization_plant,
                'organization_code' => $validated['organization_code'] ?? $controlPlan->organization_code,
                'customer_engineering_approval_date' => $validated['customer_engineering_approval_date'] ?? $controlPlan->customer_engineering_approval_date,
                'customer_quality_approval_date' => $validated['customer_quality_approval_date'] ?? $controlPlan->customer_quality_approval_date,
                'other_approval_date' => $validated['other_approval_date'] ?? $controlPlan->other_approval_date,
                'manufacturing_step' => $validated['manufacturing_step'] ?? $controlPlan->manufacturing_step,
                'production_area' => $validated['production_area'] ?? $controlPlan->production_area,
                'referensi_sp' => $validated['referensi_sp'] ?? $controlPlan->referensi_sp,
                'tanggal_diterbitkan_sp' => $validated['tanggal_diterbitkan_sp'] ?? $controlPlan->tanggal_diterbitkan_sp,
                'tanggal_diterbitkan' => $validated['tanggal_diterbitkan'] ?? $controlPlan->tanggal_diterbitkan,
                'no_revisi_tanggal_revisi_terakhir' => $validated['no_revisi_tanggal_revisi_terakhir'] ?? $controlPlan->no_revisi_tanggal_revisi_terakhir,
                'tanggal_review_berikutnya' => $validated['tanggal_review_berikutnya'] ?? $controlPlan->tanggal_review_berikutnya,
                'signatures_dibuat_oleh' => $validated['signatures_dibuat_oleh'] ?? $controlPlan->signatures_dibuat_oleh,
                'signatures_disetujui_oleh' => $validated['signatures_disetujui_oleh'] ?? $controlPlan->signatures_disetujui_oleh,
                'asterisk_legend' => $validated['asterisk_legend'] ?? $controlPlan->asterisk_legend,
            ]);

            // Handle revision history override or new entry
            if (isset($validated['override_revision_history']) && is_array($validated['override_revision_history'])) {
                // Delete existing revision history
                $controlPlan->revisionHistory()->delete();
                // Create new revision history entries
                foreach ($validated['override_revision_history'] as $revisionData) {
                    if (!empty($revisionData['revision_number'])) {
                        ControlPlanRevisionHistory::create([
                            'control_plan_id' => $controlPlan->id,
                            'page' => $revisionData['page'] ?? null,
                            'date_of_revision' => $revisionData['date_of_revision'] ?? now(),
                            'revision_number' => $revisionData['revision_number'],
                            'description' => $revisionData['description'] ?? null,
                            'revised_by' => $revisionData['revised_by'] ?? null,
                        ]);
                    }
                }
            } elseif (isset($validated['revision_history']) && !empty($validated['revision_history']['revision_number'])) {
                // Create new revision history entry
                ControlPlanRevisionHistory::create([
                    'control_plan_id' => $controlPlan->id,
                    'page' => $validated['revision_history']['page'] ?? null,
                    'date_of_revision' => $validated['revision_history']['date_of_revision'] ?? now(),
                    'revision_number' => $validated['revision_history']['revision_number'],
                    'description' => $validated['revision_history']['description'] ?? null,
                    'revised_by' => $validated['revision_history']['revised_by'] ?? null,
                ]);
            }

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
            'evaluation_measurement_technique' => 'nullable|string',
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
            'evaluation_measurement_technique' => 'nullable|string',
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

    /**
     * Export control plan as PDF
     */
    public function exportPdf(ControlPlan $controlPlan)
    {
        $controlPlan->load(['items', 'revisionHistory', 'creator']);

        // Calculate next review date (1 year from last update)
        $nextReviewDate = $controlPlan->updated_at 
            ? Carbon::parse($controlPlan->updated_at)->addYear()->format('d F Y')
            : '-';

        // Get revision number from latest revision history or default to 1
        $latestRevision = $controlPlan->revisionHistory()->orderBy('date_of_revision', 'desc')->first();
        $revision = $latestRevision ? $latestRevision->revision_number : '1';

        $pdf = Pdf::loadView('pdf.control_plan', [
            'controlPlan' => $controlPlan,
            'nextReviewDate' => $nextReviewDate,
            'revision' => $revision,
        ]);

        // Set paper to landscape A4
        $pdf->setPaper('a4', 'landscape');
        
        // Set options for better rendering
        $pdf->setOption('enable-local-file-access', true);
        $pdf->setOption('isHtml5ParserEnabled', true);
        $pdf->setOption('isRemoteEnabled', true);

        $filename = sprintf(
            'ControlPlan_%s_%s.pdf',
            $controlPlan->document_number,
            now()->format('Y-m-d')
        );

        return $pdf->download($filename);
    }

    /**
     * Stream control plan PDF (view in browser)
     */
    public function viewPdf(ControlPlan $controlPlan)
    {
        $controlPlan->load(['items', 'revisionHistory', 'creator']);

        // Calculate next review date (1 year from last update)
        $nextReviewDate = $controlPlan->updated_at 
            ? Carbon::parse($controlPlan->updated_at)->addYear()->format('d F Y')
            : '-';

        // Get revision number from latest revision history or default to 1
        $latestRevision = $controlPlan->revisionHistory()->orderBy('date_of_revision', 'desc')->first();
        $revision = $latestRevision ? $latestRevision->revision_number : '1';

        $pdf = Pdf::loadView('pdf.control_plan', [
            'controlPlan' => $controlPlan,
            'nextReviewDate' => $nextReviewDate,
            'revision' => $revision,
        ]);

        // Set paper to landscape A4
        $pdf->setPaper('a4', 'landscape');
        
        // Set options for better rendering
        $pdf->setOption('enable-local-file-access', true);
        $pdf->setOption('isHtml5ParserEnabled', true);
        $pdf->setOption('isRemoteEnabled', true);

        return $pdf->stream('ControlPlan_' . $controlPlan->document_number . '.pdf');
    }
}
