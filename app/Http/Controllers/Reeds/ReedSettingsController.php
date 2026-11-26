<?php

namespace App\Http\Controllers\Reeds;

use App\Http\Controllers\Controller;
use App\Models\Reed;
use App\Models\ReedFabricStyle;
use App\Models\ReedLocation;
use App\Models\ReedSpec;
use App\Services\Reeds\ReedSpecSpreadsheet;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Master data for the reed inventory: specs, fabric styles and storage locations. */
class ReedSettingsController extends Controller
{
    public function page(): Response
    {
        return Inertia::render('reed-settings');
    }

    // ---- Specs ----

    public function specs(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => ReedSpec::withCount(['reeds', 'reeds as active_reeds_count' => fn ($q) => $q->where('status', '!=', Reed::SCRAPPED)])
                ->orderBy('code')->get(),
        ]);
    }

    public function storeSpec(Request $request): JsonResponse
    {
        $spec = ReedSpec::create($this->specFields($request));

        return response()->json(['status' => 'success', 'data' => $spec], 201);
    }

    public function updateSpec(Request $request, int $id): JsonResponse
    {
        $spec = ReedSpec::findOrFail($id);
        $spec->update($this->specFields($request, $spec->id));

        return response()->json(['status' => 'success', 'data' => $spec->fresh()]);
    }

    public function destroySpec(int $id): JsonResponse
    {
        $spec = ReedSpec::withCount('reeds')->findOrFail($id);
        if ($spec->reeds_count > 0) {
            return $this->refuse("Cannot delete: {$spec->reeds_count} reeds use spec {$spec->code}.");
        }
        $spec->delete();

        return response()->json(['status' => 'success']);
    }

    public function specTemplate(ReedSpecSpreadsheet $sheet): StreamedResponse
    {
        $book = $sheet->template();

        return response()->streamDownload(
            fn () => (new Xlsx($book))->save('php://output'),
            'reed-spec-import-template.xlsx',
            ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        );
    }

    public function importSpecs(Request $request, ReedSpecSpreadsheet $sheet): JsonResponse
    {
        $request->validate(['file' => 'required|file|max:5120|mimes:xlsx,xls,csv,txt']);
        $result = $sheet->import($request->file('file'));

        if ($result['errors']) {
            return response()->json([
                'status' => 'error',
                'message' => 'Nothing was imported. Fix these rows and upload again.',
                'errors' => $result['errors'],
            ], 422);
        }

        return response()->json(['status' => 'success', 'data' => $result]);
    }

    /** Everything but the code and min_stock is free text, kept as typed. */
    private function specFields(Request $request, ?int $ignore = null): array
    {
        // A number sent for a text field ("dents_per_10cm": 90) is taken as its text.
        foreach (['dents_per_10cm', 'width_mm', 'total_hole', 'height_mm', 'reed_type', 'machine_type', 'wire_profile', 'wire_thickness_mm', 'wire_material', 'notes'] as $field) {
            $v = $request->input($field);
            if (is_int($v) || is_float($v)) {
                $request->merge([$field => (string) $v]);
            } elseif (is_string($v)) {
                $request->merge([$field => trim($v) === '' ? null : trim($v)]);
            }
        }

        $fields = $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('reed_specs', 'code')->ignore($ignore)],
            'dents_per_10cm' => 'nullable|string|max:255',
            'width_mm' => 'nullable|string|max:255',
            'total_hole' => 'nullable|string|max:255',
            'height_mm' => 'nullable|string|max:255',
            'reed_type' => 'nullable|string|max:255',
            'machine_type' => 'nullable|string|max:255',
            'wire_profile' => 'nullable|string|max:255',
            'wire_thickness_mm' => 'nullable|string|max:255',
            'wire_material' => 'nullable|string|max:255',
            'min_stock' => 'nullable|integer|min:0|max:10000',
            'notes' => 'nullable|string|max:255',
        ]);
        $fields['min_stock'] ??= 0;

        return $fields;
    }

    // ---- Fabric styles ----

    public function styles(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => ReedFabricStyle::with('reedSpec:id,code')->orderBy('code')->get(),
        ]);
    }

    public function storeStyle(Request $request): JsonResponse
    {
        $style = ReedFabricStyle::create($this->styleFields($request));

        return response()->json(['status' => 'success', 'data' => $style->load('reedSpec:id,code')], 201);
    }

    public function updateStyle(Request $request, int $id): JsonResponse
    {
        $style = ReedFabricStyle::findOrFail($id);
        $style->update($this->styleFields($request, $style->id));

        return response()->json(['status' => 'success', 'data' => $style->fresh('reedSpec:id,code')]);
    }

    public function destroyStyle(int $id): JsonResponse
    {
        $style = ReedFabricStyle::findOrFail($id);
        if (Reed::where('fabric_style_id', $style->id)->exists()) {
            return $this->refuse("Cannot delete: a reed is reserved for or running style {$style->code}. Mark it inactive instead.");
        }
        $style->delete();

        return response()->json(['status' => 'success']);
    }

    private function styleFields(Request $request, ?int $ignore = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('reed_fabric_styles', 'code')->ignore($ignore)],
            'description' => 'nullable|string|max:255',
            'reed_spec_id' => 'nullable|integer|exists:reed_specs,id',
            'ends_per_10cm' => 'nullable|numeric|gt:0|max:10000',
            'is_active' => 'boolean',
        ]);
    }

    // ---- Locations ----

    public function locations(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => ReedLocation::withCount('reeds')->orderBy('code')->get(),
        ]);
    }

    public function storeLocation(Request $request): JsonResponse
    {
        $location = ReedLocation::create($this->locationFields($request));

        return response()->json(['status' => 'success', 'data' => $location], 201);
    }

    public function updateLocation(Request $request, int $id): JsonResponse
    {
        $location = ReedLocation::findOrFail($id);
        $location->update($this->locationFields($request, $location->id));

        return response()->json(['status' => 'success', 'data' => $location->fresh()]);
    }

    public function destroyLocation(int $id): JsonResponse
    {
        $location = ReedLocation::withCount('reeds')->findOrFail($id);
        if ($location->reeds_count > 0) {
            return $this->refuse("Cannot delete: {$location->reeds_count} reeds are stored in {$location->code}. Move them first.");
        }
        $location->delete();

        return response()->json(['status' => 'success']);
    }

    private function locationFields(Request $request, ?int $ignore = null): array
    {
        return $request->validate([
            'code' => ['required', 'string', 'max:50', Rule::unique('reed_locations', 'code')->ignore($ignore)],
            'zone' => 'nullable|string|max:100',
            'notes' => 'nullable|string|max:255',
        ]);
    }

    private function refuse(string $message): JsonResponse
    {
        return response()->json(['status' => 'error', 'message' => $message], 422);
    }
}
