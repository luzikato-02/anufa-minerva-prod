<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\StockSheet;
use App\Models\StockSheetRow;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class StockSheetController extends Controller
{
    /** Row fields shared by create and update. */
    private function rowRules(bool $partial = false): array
    {
        $req = $partial ? 'sometimes|required' : 'required';

        return [
            'color' => 'nullable|string|max:255',
            'material_code' => "{$req}|string|max:255",
            'batch' => "{$req}|string|max:255",
            'prod_date' => 'nullable|date',
            'chs' => 'nullable|integer|min:0',
            'actual_weight' => 'nullable|numeric|min:0',
            'position' => 'nullable|integer|min:0|max:999',
            'remark' => 'nullable|string|max:255',
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $query = StockSheet::query()->withCount('rows')
            ->withSum('rows as total_weight', 'actual_weight')
            ->withSum('rows as total_chs', 'chs');

        if ($search = strtolower(trim((string) $request->input('search')))) {
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(leader) LIKE ?', ["%{$search}%"])
                    ->orWhereHas('rows', function ($r) use ($search) {
                        $r->whereRaw('LOWER(batch) LIKE ?', ["%{$search}%"])
                            ->orWhereRaw('LOWER(material_code) LIKE ?', ["%{$search}%"])
                            ->orWhereRaw('LOWER(color) LIKE ?', ["%{$search}%"]);
                    });
            });
        }

        $query->orderByDesc('sheet_date')->orderByDesc('id');

        return response()->json($query->paginate(min((int) $request->get('per_page', 10), 200)));
    }

    public function show(StockSheet $stockSheet): JsonResponse
    {
        return response()->json(['status' => 'success', 'data' => $stockSheet->load('rows')]);
    }

    /**
     * Records one row. The sheet is created on the first row (found by its client uuid), so every queued
     * upload stands on its own and a rejected one cannot orphan the rows that follow it.
     */
    public function storeRow(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sheet_client_uuid' => 'required|uuid',
            'sheet_date' => 'required|date',
            'leader' => 'required|string|max:255',
            'client_uuid' => 'nullable|uuid',
        ] + $this->rowRules());

        if (! empty($data['client_uuid'])) {
            $existing = StockSheetRow::where('client_uuid', $data['client_uuid'])->first();
            if ($existing) {
                return response()->json(['success' => true, 'message' => 'Row already recorded', 'data' => $existing]);
            }
        }

        $row = DB::transaction(function () use ($data, $request) {
            $sheet = StockSheet::firstOrCreate(
                ['client_uuid' => $data['sheet_client_uuid']],
                ['sheet_date' => $data['sheet_date'], 'leader' => $data['leader'], 'user_id' => $request->user()->id],
            );

            // The date follows the latest row, so changing it on the sheet after the first row still takes effect.
            if (! $sheet->wasRecentlyCreated && $sheet->sheet_date->toDateString() !== Carbon::parse($data['sheet_date'])->toDateString()) {
                $sheet->update(['sheet_date' => $data['sheet_date']]);
            }

            $next = (int) StockSheetRow::where('stock_sheet_id', $sheet->id)->max('line_no') + 1;

            return StockSheetRow::create(
                collect($data)->only(['color', 'material_code', 'batch', 'prod_date', 'chs', 'actual_weight', 'position', 'remark', 'client_uuid'])->all()
                + ['stock_sheet_id' => $sheet->id, 'line_no' => $next, 'user_id' => $request->user()->id]
            );
        });

        return response()->json(['success' => true, 'message' => 'Row recorded', 'data' => $row->load('sheet:id,client_uuid')], 201);
    }

    public function updateRow(Request $request, StockSheetRow $row): JsonResponse
    {
        $row->update($request->validate($this->rowRules(partial: true)));

        return response()->json(['status' => 'success', 'data' => $row->fresh()]);
    }

    public function destroyRow(StockSheetRow $row): JsonResponse
    {
        DB::transaction(function () use ($row) {
            $sheetId = $row->stock_sheet_id;
            $row->delete();
            // Keep the NO column continuous, like the paper sheet.
            StockSheetRow::where('stock_sheet_id', $sheetId)->orderBy('line_no')->get()
                ->each(fn ($r, $i) => $r->line_no === $i + 1 ?: $r->update(['line_no' => $i + 1]));
        });

        return response()->json(['status' => 'success', 'message' => 'Row deleted']);
    }

    public function update(Request $request, StockSheet $stockSheet): JsonResponse
    {
        $stockSheet->update($request->validate([
            'sheet_date' => 'sometimes|date',
            'leader' => 'sometimes|string|max:255',
            'note' => 'nullable|string|max:255',
        ]));

        return response()->json(['status' => 'success', 'data' => $stockSheet->fresh()]);
    }

    public function destroy(StockSheet $stockSheet): JsonResponse
    {
        $stockSheet->rows()->delete();
        $stockSheet->delete();

        return response()->json(['status' => 'success', 'message' => 'Stock sheet deleted successfully.']);
    }

    /** Rows in the paper's column order; the app turns this into a CSV file, as it does for stock-take sessions. */
    public function downloadCsv(StockSheet $stockSheet): JsonResponse
    {
        $rows = $stockSheet->rows()->get();
        if ($rows->isEmpty()) {
            return response()->json(['success' => false, 'message' => 'This sheet has no rows yet.'], 404);
        }

        return response()->json([
            'success' => true,
            'sheet_id' => $stockSheet->id,
            'sheet_date' => $stockSheet->sheet_date->toDateString(),
            'leader' => $stockSheet->leader,
            'summary' => $rows->map(fn ($r) => [
                'NO' => $r->line_no,
                'WARNA' => $r->color,
                'KODE MATERIAL' => $r->material_code,
                'BATCH' => $r->batch,
                'PROD DATE' => $r->prod_date?->toDateString(),
                'CHS' => $r->chs,
                'BERAT ACTUAL' => $r->actual_weight,
                'POSITION' => $r->position,
                'REMARK' => $r->remark,
            ])->values(),
        ]);
    }
}
