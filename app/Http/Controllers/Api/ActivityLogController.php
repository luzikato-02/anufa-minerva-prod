<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Spatie\Activitylog\Models\Activity;

class ActivityLogController extends Controller
{
    public function index(Request $request)
    {
        $query = Activity::query()->with('causer:id,name,username');

        // Free-text search over the description and the user's name or username.
        if ($search = strtolower(trim((string) $request->query('search')))) {
            $query->where(function ($q) use ($search) {
                $q->whereRaw('LOWER(description) LIKE ?', ["%{$search}%"])
                    ->orWhereIn('causer_id', User::query()->select('id')->where(function ($u) use ($search) {
                        $u->whereRaw('LOWER(name) LIKE ?', ["%{$search}%"])
                            ->orWhereRaw('LOWER(username) LIKE ?', ["%{$search}%"]);
                    }));
            });
        }

        // Whitelisted sort ids only; newest first otherwise.
        $sortable = ['at' => 'created_at', 'event' => 'event', 'subject' => 'subject_type'];
        $sortBy = $request->query('sort_by');
        if (is_string($sortBy) && isset($sortable[$sortBy])) {
            $query->orderBy($sortable[$sortBy], strtolower((string) $request->query('sort_dir')) === 'asc' ? 'asc' : 'desc');
        }
        $query->latest()->orderByDesc('id');

        if ($causerId = $request->query('causer_id')) {
            $query->where('causer_id', $causerId);
        }

        if ($subjectType = $request->query('subject_type')) {
            $query->where('subject_type', $subjectType);
        }

        if ($event = $request->query('event')) {
            $query->where('event', $event);
        }

        if ($dateFrom = $request->query('date_from')) {
            $query->whereDate('created_at', '>=', $dateFrom);
        }

        if ($dateTo = $request->query('date_to')) {
            $query->whereDate('created_at', '<=', $dateTo);
        }

        $perPage = max(1, min((int) $request->query('per_page', 15), 200));

        return $query->paginate($perPage)->withQueryString();
    }
}
