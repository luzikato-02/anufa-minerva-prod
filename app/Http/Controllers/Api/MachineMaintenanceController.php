<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MachineDefinition;
use App\Models\MachineType;
use Illuminate\Http\Request;

class MachineMaintenanceController extends Controller
{
    // ── Machine Types ─────────────────────────────────────────────────────────

    public function machineTypes()
    {
        return response()->json(MachineType::withCount('machineDefinitions')->orderBy('type_name')->get());
    }

    public function storeMachineType(Request $request)
    {
        $data = $request->validate([
            'type_name'          => 'required|string|max:100|unique:machine_types,type_name',
            'total_spindles'     => 'required|integer|min:1',
            'rpm_min'            => 'nullable|integer|min:0',
            'rpm_max'            => 'nullable|integer|min:0|gte:rpm_min',
            'min_runtime_hours'  => 'nullable|numeric|min:0',
            'max_runtime_hours'  => 'nullable|numeric|min:0|gte:min_runtime_hours',
            'description'        => 'nullable|string|max:500',
        ]);

        return response()->json(MachineType::create($data), 201);
    }

    public function updateMachineType(Request $request, string $id)
    {
        $type = MachineType::findOrFail($id);

        $data = $request->validate([
            'type_name'          => "required|string|max:100|unique:machine_types,type_name,{$id}",
            'total_spindles'     => 'required|integer|min:1',
            'rpm_min'            => 'nullable|integer|min:0',
            'rpm_max'            => 'nullable|integer|min:0|gte:rpm_min',
            'min_runtime_hours'  => 'nullable|numeric|min:0',
            'max_runtime_hours'  => 'nullable|numeric|min:0|gte:min_runtime_hours',
            'description'        => 'nullable|string|max:500',
        ]);

        $type->update($data);

        return response()->json($type);
    }

    public function destroyMachineType(string $id)
    {
        $type = MachineType::findOrFail($id);

        if ($type->machineDefinitions()->exists()) {
            return response()->json(['message' => 'Cannot delete: machine definitions are using this type.'], 422);
        }

        $type->delete();

        return response()->json(['message' => 'Machine type deleted.']);
    }

    // ── Machine Definitions ───────────────────────────────────────────────────

    public function machineDefinitions()
    {
        return response()->json(
            MachineDefinition::with('machineType:id,type_name,total_spindles')
                ->orderBy('machine_number')
                ->get()
        );
    }

    public function storeMachineDefinition(Request $request)
    {
        $data = $request->validate([
            'machine_number'  => 'required|string|max:20|unique:machine_definitions,machine_number',
            'machine_type_id' => 'required|exists:machine_types,id',
            'is_active'       => 'boolean',
            'notes'           => 'nullable|string|max:500',
        ]);

        $def = MachineDefinition::create($data);
        $def->load('machineType:id,type_name,total_spindles');

        return response()->json($def, 201);
    }

    public function updateMachineDefinition(Request $request, string $id)
    {
        $def = MachineDefinition::findOrFail($id);

        $data = $request->validate([
            'machine_number'  => "required|string|max:20|unique:machine_definitions,machine_number,{$id}",
            'machine_type_id' => 'required|exists:machine_types,id',
            'is_active'       => 'boolean',
            'notes'           => 'nullable|string|max:500',
        ]);

        $def->update($data);
        $def->load('machineType:id,type_name,total_spindles');

        return response()->json($def);
    }

    public function destroyMachineDefinition(string $id)
    {
        MachineDefinition::findOrFail($id)->delete();

        return response()->json(['message' => 'Machine definition deleted.']);
    }
}
