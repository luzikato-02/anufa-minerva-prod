<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\HandlesJsonColumns;
use App\Models\FinishEarlierRecord;
use App\Models\StockTakingRecord;
use App\Models\TensionRecord;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Spatie\Activitylog\Models\Activity;

class DashboardController extends Controller
{
    use HandlesJsonColumns;

    public function index()
    {
        return Inertia::render('dashboard', $this->stats());
    }

    /**
     * The web dashboard's numbers plus finish-earlier counts for the mobile home screen.
     * The finish-earlier block is added here, not in stats(), so the web dashboard's props stay as they are.
     */
    public function apiIndex()
    {
        $stats = $this->stats();

        // Plain aggregate counts, gated by the same permission as the finish-earlier list. Weeks start on Monday.
        $stats['finishEarlier'] = auth()->user()->can('finish-earlier.view') ? [
            'total'     => FinishEarlierRecord::count(),
            'this_week' => FinishEarlierRecord::where('created_at', '>=', now()->startOfWeek())->count(),
        ] : null;

        return response()->json($stats);
    }

    /**
     * Panels for the web dashboard, each included only when the user can view that module:
     * 30-day record counts, the oldest open problems, last check per machine,
     * recent stock take sessions and recent activity (sign-ins excluded).
     *
     * Query: tz_offset = caller's minutes from UTC, so days are the caller's days.
     */
    public function overview(Request $request): JsonResponse
    {
        $validated = $request->validate(['tz_offset' => 'nullable|integer|min:-840|max:840']);
        $offset = (int) ($validated['tz_offset'] ?? 0);
        $user = $request->user();
        $toLocal = fn ($ts) => Carbon::parse($ts)->utc()->addMinutes($offset);
        $localToday = now()->utc()->addMinutes($offset)->startOfDay();

        $data = ['tension' => null, 'stock_take' => null, 'activity' => null];

        if ($user->can('tension-records.view')) {
            $from = $localToday->copy()->subDays(29);

            // Records per local day for the last 30 days, split by type.
            $daily = [];
            for ($i = 0; $i < 30; $i++) {
                $daily[$from->copy()->addDays($i)->toDateString()] = ['twisting' => 0, 'weaving' => 0];
            }
            $recent = TensionRecord::where('created_at', '>=', $from->copy()->subMinutes($offset))
                ->get(['record_type', 'created_at']);
            foreach ($recent as $record) {
                $day = $toLocal($record->created_at)->toDateString();
                if (isset($daily[$day][$record->record_type])) {
                    $daily[$day][$record->record_type]++;
                }
            }

            // Open problems, oldest first, plus open counts per machine.
            $openProblems = [];
            $openByMachine = [];
            $withProblems = TensionRecord::whereRaw("{$this->jsonArrayLength('problems')} > 0")
                ->get(['id', 'record_type', 'metadata', 'form_data', 'problems']);
            foreach ($withProblems as $record) {
                $machine = $record->metadata['machine_number'] ?? $record->form_data['machineNumber'] ?? null;
                foreach ($record->problems ?? [] as $problem) {
                    if (($problem['status'] ?? 'open') === 'resolved') {
                        continue;
                    }
                    if ($machine) {
                        $openByMachine[$record->record_type.'|'.$machine] = ($openByMachine[$record->record_type.'|'.$machine] ?? 0) + 1;
                    }
                    $reported = ! empty($problem['timestamp']) ? Carbon::parse($problem['timestamp']) : null;
                    $openProblems[] = [
                        'record_id'   => $record->id,
                        'record_type' => $record->record_type,
                        'machine'     => $machine,
                        'position'    => $this->problemPosition($problem),
                        'description' => $problem['description'] ?? null,
                        'reported_at' => $reported?->toIso8601String(),
                        'age_hours'   => $reported ? round($reported->diffInMinutes(now()) / 60, 1) : null,
                    ];
                }
            }
            usort($openProblems, fn ($a, $b) => ($b['age_hours'] ?? -1) <=> ($a['age_hours'] ?? -1));

            // Last check per machine seen in the last 30 days.
            $machineExpr = $this->jsonExtract('metadata', '$.machine_number');
            $machines = TensionRecord::where('created_at', '>=', now()->subDays(30))
                ->whereRaw("{$machineExpr} IS NOT NULL")
                ->selectRaw("record_type, {$machineExpr} as machine, MAX(created_at) as last_checked")
                ->groupBy('record_type')
                ->groupByRaw($machineExpr)
                ->get()
                ->map(fn ($row) => [
                    'machine'       => $row->machine,
                    'type'          => $row->record_type,
                    'last_checked'  => Carbon::parse($row->last_checked)->toIso8601String(),
                    'open_problems' => $openByMachine[$row->record_type.'|'.$row->machine] ?? 0,
                ])
                ->sortBy(['type', 'machine'], SORT_NATURAL)
                ->values();

            $data['tension'] = [
                'daily'               => collect($daily)->map(fn ($v, $date) => ['date' => $date] + $v)->values(),
                'open_problems_total' => count($openProblems),
                'open_problems'       => array_slice($openProblems, 0, 10),
                'machines'            => $machines,
            ];
        }

        if ($user->can('stock-take.view')) {
            $data['stock_take'] = StockTakingRecord::latest()->take(5)->get(['id', 'session_id', 'metadata', 'created_at'])
                ->map(fn ($s) => [
                    'id'         => $s->id,
                    'session_id' => $s->session_id,
                    'leader'     => $s->metadata['session_leader'] ?? null,
                    'status'     => $s->metadata['session_status'] ?? null,
                    'checked'    => (int) ($s->metadata['total_checked_batches'] ?? 0),
                    'total'      => (int) ($s->metadata['total_batches'] ?? 0),
                    'started_at' => $s->created_at?->toIso8601String(),
                ]);
        }

        if ($user->can('activity-log.view')) {
            $data['activity'] = Activity::query()
                ->with('causer:id,name')
                ->where(fn ($q) => $q->whereNull('event')->orWhereNotIn('event', ['login', 'logout']))
                ->latest()
                ->take(10)
                ->get()
                ->map(fn (Activity $a) => [
                    'id'      => $a->id,
                    'at'      => $a->created_at?->toIso8601String(),
                    'who'     => $a->causer?->name ?? 'System',
                    'summary' => $this->activitySummary($a),
                ]);
        }

        return response()->json($data);
    }

    /** "Sp 37" for twisting, "AO · R3 · C12" for weaving positions stored as "AO-3-Col12". */
    private function problemPosition(array $problem): ?string
    {
        if (isset($problem['spindleNumber'])) {
            return 'Sp '.$problem['spindleNumber'];
        }
        $position = $problem['position'] ?? null;
        if (is_string($position) && preg_match('/^([A-Z]+)-(\d+)-Col(\d+)$/', $position, $m)) {
            return "{$m[1]} · R{$m[2]} · C{$m[3]}";
        }

        return $position;
    }

    /** A readable line for the feed, e.g. "recorded twisting tension · TW-14". */
    private function activitySummary(Activity $activity): string
    {
        $verb = match ($activity->event ?? $activity->description) {
            'created' => 'recorded',
            'updated' => 'updated',
            'deleted' => 'deleted',
            default   => null,
        };
        $attributes = $activity->properties['attributes'] ?? [];
        $meta = $attributes['metadata'] ?? [];

        $subject = match ($activity->subject_type) {
            TensionRecord::class      => trim(($attributes['record_type'] ?? '').' tension').
                (! empty($meta['machine_number']) ? ' · '.$meta['machine_number'] : ''),
            FinishEarlierRecord::class => 'finish earlier'.
                (! empty($meta['production_order']) ? ' · PO '.$meta['production_order'] : ''),
            StockTakingRecord::class  => 'stock take'.
                (! empty($attributes['session_id']) ? ' · '.$attributes['session_id'] : ''),
            default => $activity->subject_type ? strtolower(class_basename($activity->subject_type)) : null,
        };

        if ($verb && $subject) {
            return "{$verb} {$subject}";
        }

        return $activity->description;
    }

    private function stats(): array
    {
        $user = auth()->user();

        $tension = null;
        if ($user->can('tension-records.view')) {
            $openProblems = TensionRecord::whereRaw("{$this->jsonArrayLength('problems')} > 0")
                ->get(['problems'])
                ->sum(fn ($r) => collect($r->problems ?? [])
                    ->filter(fn ($p) => ($p['status'] ?? 'open') === 'open')
                    ->count());
            $tension = [
                'total'         => TensionRecord::count(),
                'twisting'      => TensionRecord::byType('twisting')->count(),
                'weaving'       => TensionRecord::byType('weaving')->count(),
                'open_problems' => $openProblems,
            ];
        }

        $stockTake = null;
        if ($user->can('stock-take.view')) {
            $sessions  = StockTakingRecord::all(['id', 'metadata']);
            $total     = $sessions->count();
            // Sessions store "In Progress" / "Completed"; compare case- and separator-insensitively.
            $status = fn ($s) => strtolower(str_replace('_', ' ', $s->metadata['session_status'] ?? ''));
            $completed = $sessions->filter(fn ($s) => $status($s) === 'completed')->count();
            $stockTake = [
                'total'       => $total,
                'in_progress' => $sessions->filter(fn ($s) => $status($s) === 'in progress')->count(),
                'completed'   => $completed,
                'completion'  => $total > 0 ? round($completed / $total * 100) : 0,
            ];
        }

        $users = null;
        if ($user->can('users.view')) {
            $users = [
                'total'      => User::count(),
                'unassigned' => User::doesntHave('roles')->count(),
            ];
        }

        return compact('tension', 'stockTake', 'users');
    }
}
