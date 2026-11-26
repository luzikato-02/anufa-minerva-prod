<?php

namespace App\Http\Controllers\Reeds;

use App\Http\Controllers\Controller;
use App\Models\Reed;
use App\Models\ReedInspection;
use App\Services\Reeds\ReedLifecycle;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * One endpoint per move. Each validates its own fields and hands off to ReedLifecycle, which enforces the
 * allowed transitions (409 when the reed's state does not allow the move). Every body may carry client_uuid.
 */
class ReedActionController extends Controller
{
    private const UUID = ['client_uuid' => 'nullable|uuid'];

    public function reserve(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(self::UUID + [
            'loom_number' => 'nullable|string|max:50',
            'fabric_style_id' => 'nullable|integer|exists:reed_fabric_styles,id',
            'note' => 'nullable|string|max:255',
        ]);

        return $this->done($this->lifecycle($request)->reserve($id, $data, $data['client_uuid'] ?? null));
    }

    public function release(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(self::UUID + ['note' => 'nullable|string|max:255']);

        return $this->done($this->lifecycle($request)->release($id, $data['note'] ?? null, $data['client_uuid'] ?? null));
    }

    public function issue(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(self::UUID + [
            'loom_number' => 'required|string|max:50',
            'fabric_style_id' => 'nullable|integer|exists:reed_fabric_styles,id',
            'order_no' => 'nullable|string|max:100',
            'note' => 'nullable|string|max:255',
        ]);

        return $this->done($this->lifecycle($request)->issue($id, $data, $data['client_uuid'] ?? null));
    }

    public function return(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(self::UUID + [
            'meters_woven' => 'required|numeric|min:0|max:10000000',
            'location_id' => 'nullable|integer|exists:reed_locations,id',
            'note' => 'nullable|string|max:255',
        ]);

        return $this->done($this->lifecycle($request)->return($id, $data, $data['client_uuid'] ?? null));
    }

    public function inspect(Request $request, int $id): JsonResponse
    {
        $checks = collect(ReedInspection::CHECKS)->mapWithKeys(fn ($c) => ["checklist.{$c}" => 'nullable|boolean'])->all();
        $data = $request->validate(self::UUID + $checks + [
            'grade' => ReedController::gradeRule(),
            'checklist' => 'nullable|array',
            'defect_dents' => 'nullable|string|max:255',
            'location_id' => 'nullable|integer|exists:reed_locations,id',
            'note' => 'nullable|string|max:255',
        ]);

        return $this->done($this->lifecycle($request)->inspect($id, $data, $data['client_uuid'] ?? null));
    }

    public function transfer(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(self::UUID + ['location_id' => 'required|integer|exists:reed_locations,id']);

        return $this->done($this->lifecycle($request)->transfer($id, (int) $data['location_id'], $data['client_uuid'] ?? null));
    }

    public function sendToRepair(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(self::UUID + [
            'vendor' => 'required|string|max:255',
            'defects' => 'nullable|string|max:255',
            'sent_on' => 'nullable|date',
        ]);

        return $this->done($this->lifecycle($request)->sendToRepair($id, $data, $data['client_uuid'] ?? null));
    }

    public function receiveFromRepair(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(self::UUID + [
            'returned_on' => 'nullable|date',
            'cost' => 'nullable|numeric|min:0',
            'work_done' => 'nullable|string|max:255',
            'location_id' => 'nullable|integer|exists:reed_locations,id',
        ]);

        return $this->done($this->lifecycle($request)->receiveFromRepair($id, $data, $data['client_uuid'] ?? null));
    }

    public function scrap(Request $request, int $id): JsonResponse
    {
        $data = $request->validate(self::UUID + ['reason' => 'required|string|max:255']);

        return $this->done($this->lifecycle($request)->scrap($id, $data['reason'], $data['client_uuid'] ?? null));
    }

    private function lifecycle(Request $request): ReedLifecycle
    {
        return ReedLifecycle::as($request->user());
    }

    private function done(Reed $reed): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => $reed->fresh(['spec:id,code', 'location:id,code', 'fabricStyle:id,code']),
        ]);
    }
}
