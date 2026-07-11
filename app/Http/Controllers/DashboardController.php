<?php

namespace App\Http\Controllers;

use App\Models\RuntimeShiftAggregate;
use App\Models\RuntimeUploadBatch;
use App\Models\StockTakingRecord;
use App\Models\TensionRecord;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class DashboardController extends Controller
{
    public function index()
    {
        $user = auth()->user();

        $tension = null;
        if ($user->can('tension-records.view')) {
            $probLen = DB::connection()->getDriverName() === 'sqlite'
                ? 'JSON_ARRAY_LENGTH(problems)'
                : 'JSON_LENGTH(problems)';
            $openProblems = TensionRecord::whereRaw("{$probLen} > 0")
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

        $runtime = null;
        if ($user->can('runtime.view')) {
            $runtime = [
                'batches'  => RuntimeUploadBatch::count(),
                'outliers' => RuntimeShiftAggregate::where(function ($q) {
                    $q->where('has_speed_outlier', true)->orWhere('has_runtime_outlier', true);
                })->select('machine_number')->distinct()->count(),
            ];
        }

        $users = null;
        if ($user->can('users.view')) {
            $users = [
                'total'      => User::count(),
                'unassigned' => User::doesntHave('roles')->count(),
            ];
        }

        return Inertia::render('dashboard', compact('tension', 'stockTake', 'runtime', 'users'));
    }
}
