<?php

namespace App\Http\Controllers\Reeds;

use App\Http\Controllers\Controller;
use App\Models\Reed;
use App\Models\ReedFabricStyle;
use App\Models\ReedLocation;
use App\Models\ReedMovement;
use App\Models\ReedSpec;
use App\Services\Reeds\ReedLifecycle;
use BaconQrCode\Renderer\Color\Rgb;
use BaconQrCode\Renderer\Image\SvgImageBackEnd;
use BaconQrCode\Renderer\ImageRenderer;
use BaconQrCode\Renderer\RendererStyle\Fill;
use BaconQrCode\Renderer\RendererStyle\RendererStyle;
use BaconQrCode\Writer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/** Reed inventory: list, detail with history, the style match, receipts and labels. */
class ReedController extends Controller
{
    public function page(): Response
    {
        return Inertia::render('reeds');
    }

    public function index(Request $request): JsonResponse
    {
        $query = Reed::query()->with(['spec:id,code,dents_per_10cm,width_mm', 'location:id,code', 'fabricStyle:id,code']);

        if ($statuses = array_filter(explode(',', (string) $request->input('status')))) {
            $query->whereIn('status', array_intersect($statuses, Reed::STATUSES));
        } elseif (! $request->boolean('include_scrapped')) {
            $query->where('status', '!=', Reed::SCRAPPED);
        }
        if ($spec = $request->integer('spec_id')) {
            $query->where('reed_spec_id', $spec);
        }
        if (($grade = $request->input('grade')) && in_array($grade, Reed::GRADES, true)) {
            $query->where('grade', $grade);
        }
        if ($location = $request->integer('location_id')) {
            $query->where('location_id', $location);
        }
        if ($search = strtolower(trim((string) $request->input('search')))) {
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(serial_no) LIKE ?', ["%{$search}%"])
                    ->orWhereRaw('LOWER(loom_number) LIKE ?', ["%{$search}%"])
                    ->orWhereRaw('LOWER(po_no) LIKE ?', ["%{$search}%"])
                    ->orWhereRaw('LOWER(order_no) LIKE ?', ["%{$search}%"]);
            });
        }

        // Whitelisted sort ids only, so sort_by never reaches SQL as-is.
        $sortable = [
            'serial' => 'serial_no',
            'status' => 'status',
            'grade' => 'grade',
            'meters' => 'meters_woven',
            'days' => 'days_mounted',
            'inspected' => 'last_inspected_at',
            'updated' => 'updated_at',
        ];
        $sortBy = $request->input('sort_by');
        if (is_string($sortBy) && isset($sortable[$sortBy])) {
            $query->orderBy($sortable[$sortBy], strtolower((string) $request->input('sort_dir')) === 'desc' ? 'desc' : 'asc');
        }
        $query->orderBy('serial_no');

        return response()->json($query->paginate(min(max((int) $request->get('per_page', 50), 1), 500)));
    }

    /** Counts per status and the specs whose usable stock is below their minimum. */
    public function stats(): JsonResponse
    {
        $byStatus = Reed::query()->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');
        $usable = Reed::query()->where('status', Reed::IN_STOCK)->whereIn('grade', ['A', 'B'])
            ->selectRaw('reed_spec_id, COUNT(*) as n')->groupBy('reed_spec_id')->pluck('n', 'reed_spec_id');
        $onLoom = Reed::query()->where('status', Reed::ON_LOOM)
            ->selectRaw('reed_spec_id, COUNT(*) as n')->groupBy('reed_spec_id')->pluck('n', 'reed_spec_id');

        $specs = ReedSpec::orderBy('code')->get(['id', 'code', 'min_stock'])->map(fn (ReedSpec $s) => [
            'id' => $s->id,
            'code' => $s->code,
            'min_stock' => $s->min_stock,
            'usable_in_stock' => (int) ($usable[$s->id] ?? 0),
            'on_loom' => (int) ($onLoom[$s->id] ?? 0),
        ]);

        return response()->json([
            'status' => 'success',
            'data' => [
                'by_status' => collect(Reed::STATUSES)->mapWithKeys(fn ($st) => [$st => (int) ($byStatus[$st] ?? 0)]),
                'specs' => $specs,
                'short_specs' => $specs->filter(fn ($s) => $s['usable_in_stock'] < $s['min_stock'])->values(),
            ],
        ]);
    }

    public function show(int $id): JsonResponse
    {
        $reed = Reed::with(['spec', 'location:id,code,zone', 'fabricStyle:id,code,description'])->findOrFail($id);

        return response()->json([
            'status' => 'success',
            'data' => [
                'reed' => $reed,
                'movements' => $reed->movements()
                    ->with(['user:id,name', 'fromLocation:id,code', 'toLocation:id,code', 'fabricStyle:id,code'])
                    ->orderByDesc('occurred_at')->orderByDesc('id')->limit(300)->get(),
                'inspections' => $reed->inspections()->with('user:id,name')->orderByDesc('inspected_at')->get(),
                'repairs' => $reed->repairs()->orderByDesc('sent_on')->orderByDesc('id')->get(),
            ],
        ]);
    }

    /** Resolve a scanned label to a reed. */
    public function byCode(string $code): JsonResponse
    {
        $reed = Reed::whereRaw('LOWER(serial_no) = ?', [strtolower(trim($code))])->first(['id', 'serial_no']);

        return $reed
            ? response()->json(['status' => 'success', 'data' => $reed])
            : response()->json(['status' => 'error', 'message' => "No reed with serial {$code}."], 404);
    }

    /** Reeds that can run a style: its spec, in stock, grade A or B; best grade then least worn first. */
    public function match(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'fabric_style_id' => 'required|integer|exists:reed_fabric_styles,id',
            'loom_number' => 'nullable|string|max:50',
        ]);
        $style = ReedFabricStyle::with('reedSpec')->findOrFail($validated['fabric_style_id']);
        if (! $style->reed_spec_id) {
            return response()->json(['status' => 'error', 'message' => "Style {$style->code} has no reed spec yet. Set one in Reed Settings."], 422);
        }

        $candidates = Reed::with(['location:id,code'])
            ->where('reed_spec_id', $style->reed_spec_id)
            ->where('status', Reed::IN_STOCK)
            ->whereIn('grade', ['A', 'B'])
            ->orderBy('grade')->orderBy('meters_woven')->orderBy('serial_no')
            ->limit(50)->get();
        $reserved = Reed::where('reed_spec_id', $style->reed_spec_id)->where('status', Reed::RESERVED)
            ->get(['id', 'serial_no', 'loom_number', 'reserved_at']);
        $mounted = ! empty($validated['loom_number'])
            ? Reed::where('status', Reed::ON_LOOM)->where('loom_number', $validated['loom_number'])->first(['id', 'serial_no'])
            : null;

        return response()->json([
            'status' => 'success',
            'data' => [
                'style' => $style,
                'spec' => $style->reedSpec,
                'candidates' => $candidates,
                'reserved' => $reserved,
                'mounted_on_loom' => $mounted,
            ],
        ]);
    }

    public function receive(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'reed_spec_id' => 'required|integer|exists:reed_specs,id',
            'quantity' => 'required_without:serials|nullable|integer|min:1|max:200',
            'serials' => 'nullable|array|max:200',
            'serials.*' => 'required|string|max:50|distinct|unique:reeds,serial_no',
            'location_id' => 'nullable|integer|exists:reed_locations,id',
            'supplier' => 'nullable|string|max:255',
            'po_no' => 'nullable|string|max:100',
            'received_on' => 'nullable|date',
            'unit_cost' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:255',
        ]);

        $serials = array_values(array_filter(array_map('trim', $validated['serials'] ?? [])));
        $reeds = ReedLifecycle::as($request->user())->receive(
            ReedSpec::findOrFail($validated['reed_spec_id']),
            (int) ($validated['quantity'] ?? 0),
            $serials,
            $validated,
            isset($validated['location_id']) ? ReedLocation::find($validated['location_id']) : null,
        );

        return response()->json(['status' => 'success', 'data' => $reeds->values()], 201);
    }

    /**
     * A printable sheet of QR labels for the given reeds. The QR holds the serial number only, which is what
     * the scan lookup (byCode) expects. Rendered server-side with the QR library Fortify already ships.
     */
    public function labels(Request $request): Response
    {
        $ids = array_slice(array_filter(array_map('intval', explode(',', (string) $request->input('ids')))), 0, 500);
        $writer = new Writer(new ImageRenderer(
            new RendererStyle(160, 1, null, null, Fill::uniformColor(new Rgb(255, 255, 255), new Rgb(0, 0, 0))),
            new SvgImageBackEnd,
        ));
        $reeds = Reed::with('spec:id,code,dents_per_10cm,width_mm')->whereIn('id', $ids)->orderBy('serial_no')
            ->get(['id', 'serial_no', 'reed_spec_id', 'received_on'])
            ->map(fn (Reed $reed) => [
                'id' => $reed->id,
                'serial_no' => $reed->serial_no,
                'spec' => $reed->spec?->only(['code', 'dents_per_10cm', 'width_mm']),
                'received_on' => $reed->received_on?->toDateString(),
                'qr_svg' => self::stripXmlHeader($writer->writeString($reed->serial_no)),
            ]);

        return Inertia::render('reed-labels', ['reeds' => $reeds]);
    }

    /** Drop the <?xml ?> line so the SVG can be inlined into the page. */
    private static function stripXmlHeader(string $svg): string
    {
        return trim(substr($svg, strpos($svg, "\n") + 1));
    }

    /** The latest moves across all reeds, for the activity panel. */
    public function recentMovements(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => ReedMovement::with(['reed:id,serial_no', 'user:id,name'])
                ->orderByDesc('occurred_at')->orderByDesc('id')->limit(30)->get(),
        ]);
    }

    /** Options for the pickers: specs, active styles, locations. */
    public function pickerOptions(): JsonResponse
    {
        return response()->json([
            'status' => 'success',
            'data' => [
                'specs' => ReedSpec::orderBy('code')->get(['id', 'code', 'dents_per_10cm', 'width_mm', 'reed_type']),
                'styles' => ReedFabricStyle::where('is_active', true)->orderBy('code')->get(['id', 'code', 'description', 'reed_spec_id']),
                'locations' => ReedLocation::orderBy('code')->get(['id', 'code', 'zone']),
                'statuses' => Reed::STATUSES,
                'grades' => Reed::GRADES,
            ],
        ]);
    }

    /** Validation for the grade field, shared with the action controller. */
    public static function gradeRule(): array
    {
        return ['required', Rule::in(Reed::GRADES)];
    }
}
