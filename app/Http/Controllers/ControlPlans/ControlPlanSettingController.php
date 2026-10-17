<?php

namespace App\Http\Controllers\ControlPlans;

use App\Http\Controllers\Controller;
use App\Models\ControlPlanSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

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

    /** Replaces the company logo printed above the mill name on every page. */
    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate(['logo' => 'required|file|mimes:png,jpg,jpeg|max:2048']);
        $settings = ControlPlanSetting::current();
        $old = $settings->logo_path;
        $settings->update(['logo_path' => $request->file('logo')->store('control-plans', 'local')]);
        if ($old) {
            Storage::disk('local')->delete($old);
        }

        return response()->json(['success' => true, 'data' => ['logo' => $settings->logoDataUri()]]);
    }

    public function deleteLogo(): JsonResponse
    {
        $settings = ControlPlanSetting::current();
        if ($settings->logo_path) {
            Storage::disk('local')->delete($settings->logo_path);
            $settings->update(['logo_path' => null]);
        }

        return response()->json(['success' => true]);
    }
}
