<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\HandlesJsonColumns;
use App\Models\StockTakingRecord;
use App\Models\TensionRecord;
use App\Models\User;
use Inertia\Inertia;

class DashboardController extends Controller
{
    use HandlesJsonColumns;

    public function index()
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
            $completed = $sessions->filter(fn ($s) => ($s->metadata['session_status'] ?? '') === 'completed')->count();
            $stockTake = [
                'total'       => $total,
                'in_progress' => $sessions->filter(fn ($s) => ($s->metadata['session_status'] ?? '') === 'in_progress')->count(),
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

        return Inertia::render('dashboard', compact('tension', 'stockTake', 'users'));
    }
}
