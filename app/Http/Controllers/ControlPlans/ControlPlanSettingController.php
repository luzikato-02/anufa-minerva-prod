<?php

namespace App\Http\Controllers\ControlPlans;

use App\Http\Controllers\Controller;
use App\Models\ControlPlanSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ControlPlanSettingController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $settings = ControlPlanSetting::current();
        $settings->update($request->validate([
            'mill' => 'nullable|string|max:255',
            'org_plant' => 'nullable|string|max:255',
            'org_code' => 'nullable|string|max:255',
            'date_format' => 'required|in:id,en',
            'review_period_years' => 'required|integer|min:1|max:10',
        ]));

        return response()->json(['success' => true, 'data' => $settings->fresh()]);
    }
}
