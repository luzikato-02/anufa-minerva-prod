<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\HandlesJsonColumns;
use App\Models\FinishEarlierRecord;
use App\Models\StockTakingRecord;
use App\Models\TensionRecord;
use App\Models\User;
use Inertia\Inertia;

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
