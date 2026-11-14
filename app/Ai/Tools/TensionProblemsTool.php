<?php

namespace App\Ai\Tools;

use App\Models\TensionRecord;
use App\Models\User;
use Illuminate\Support\Carbon;

/** Problems operators reported on tension records (broken yarn, bad spindles, ...), with their resolution. */
class TensionProblemsTool extends Tool
{
    public function name(): string
    {
        return 'tension_problems';
    }

    public function description(): string
    {
        return 'Problems operators reported while recording tension (e.g. a faulty spindle or creel position), '
            .'each with its machine, position, description, when it was reported, and whether and when it was '
            .'resolved. Filtered by the date the problem was reported. Returns counts by machine and status, '
            .'the median hours to resolve, and the matching problems newest first.';
    }

    public function permission(): ?string
    {
        return 'tension-records.view';
    }

    public function parameters(): array
    {
        return [
            'type' => 'object',
            'properties' => self::dateParams() + [
                'record_type' => ['type' => 'string', 'enum' => ['twisting', 'weaving', 'all'], 'description' => 'Defaults to all.'],
                'status' => ['type' => 'string', 'enum' => ['open', 'resolved', 'all'], 'description' => 'Defaults to all.'],
                'machine' => ['type' => 'string', 'description' => 'Exact machine number.'],
                'search' => ['type' => 'string', 'description' => 'Substring to look for in the problem description.'],
                'limit' => ['type' => 'integer', 'description' => 'Problems to list. Defaults to 50.'],
            ],
        ];
    }

    public function run(array $args, User $user): ToolResult
    {
        $window = DateWindow::fromArgs($args);
        $type = $this->oneOf($args, 'record_type', ['twisting', 'weaving', 'all'], 'all');
        $status = $this->oneOf($args, 'status', ['open', 'resolved', 'all'], 'all');
        $machine = $this->str($args, 'machine');
        $search = $this->str($args, 'search');
        $limit = $this->limit($args);
        $start = $window->startUtc();
        $end = $window->endUtc();

        // A problem can be reported days after its record was created (weaving sessions run long), so look a
        // little further back for records and filter on each problem's own timestamp.
        $records = TensionRecord::query()
            ->select(['id', 'record_type', 'form_data', 'problems', 'metadata', 'created_at'])
            ->whereNotNull('problems')
            ->when($type !== 'all', fn ($q) => $q->byType($type))
            ->whereBetween('created_at', [$start->copy()->subDays(14), $end])
            ->lazy(200);

        $problems = [];
        foreach ($records as $record) {
            $recordMachine = $record->metadata['machine_number'] ?? $record->form_data['machineNumber'] ?? null;
            if ($machine && strcasecmp((string) $recordMachine, $machine) !== 0) {
                continue;
            }
            foreach (is_array($record->problems) ? $record->problems : [] as $p) {
                if (! is_array($p)) {
                    continue;
                }
                $reported = $this->time($p['timestamp'] ?? null) ?? $record->created_at;
                if ($reported->lt($start) || $reported->gt($end)) {
                    continue;
                }
                $pStatus = ($p['status'] ?? 'open') === 'resolved' ? 'resolved' : 'open';
                if ($status !== 'all' && $pStatus !== $status) {
                    continue;
                }
                if ($search && stripos((string) ($p['description'] ?? ''), $search) === false) {
                    continue;
                }
                $resolved = $this->time($p['resolution']['resolved_at'] ?? null);
                $problems[] = [
                    'record_id' => $record->id,
                    'record_type' => $record->record_type,
                    'machine' => $recordMachine,
                    'spindle' => $p['spindleNumber'] ?? null,
                    'position' => $p['position'] ?? null,
                    'description' => $p['description'] ?? null,
                    'reported_at' => $reported->copy()->setTimezone(config('ai.chat.timezone'))->format('Y-m-d H:i'),
                    'status' => $pStatus,
                    'resolved_at' => $resolved?->copy()->setTimezone(config('ai.chat.timezone'))->format('Y-m-d H:i'),
                    'resolution_action' => $p['resolution']['action'] ?? null,
                    'after_repair_max' => $p['resolution']['after_repair_max'] ?? null,
                    'after_repair_min' => $p['resolution']['after_repair_min'] ?? null,
                    'resolved_by' => $p['resolution']['resolved_by'] ?? null,
                    'hours_to_resolve' => $resolved ? round(max(0, $reported->diffInMinutes($resolved, false)) / 60, 1) : null,
                    '_ts' => $reported->getTimestamp(),
                ];
            }
        }

        usort($problems, fn ($a, $b) => $b['_ts'] <=> $a['_ts']);
        $problems = array_map(fn ($p) => array_diff_key($p, ['_ts' => 1]), $problems);

        $byMachine = [];
        foreach ($problems as $p) {
            $m = (string) ($p['machine'] ?? '(none)');
            $byMachine[$m] ??= ['machine' => $m, 'open' => 0, 'resolved' => 0];
            $byMachine[$m][$p['status']]++;
        }
        usort($byMachine, fn ($a, $b) => ($b['open'] + $b['resolved']) <=> ($a['open'] + $a['resolved']));

        $hours = array_values(array_filter(array_column($problems, 'hours_to_resolve'), fn ($h) => $h !== null));
        sort($hours);
        $median = $hours ? (count($hours) % 2 ? $hours[intdiv(count($hours), 2)] : ($hours[count($hours) / 2 - 1] + $hours[count($hours) / 2]) / 2) : null;

        return new ToolResult([
            'window' => $window->describe(),
            'filters' => array_filter(compact('type', 'status', 'machine', 'search')),
            'totals' => [
                'problems' => count($problems),
                'open' => count(array_filter($problems, fn ($p) => $p['status'] === 'open')),
                'resolved' => count(array_filter($problems, fn ($p) => $p['status'] === 'resolved')),
                'median_hours_to_resolve' => $median,
            ],
            'by_machine' => array_slice(array_values($byMachine), 0, $this->maxRows()),
            'problems' => array_slice($problems, 0, $limit),
            'truncated' => count($problems) > $limit,
        ], count($problems));
    }

    private function time($value): ?Carbon
    {
        if (! is_string($value) || $value === '') {
            return null;
        }
        try {
            return Carbon::parse($value)->utc();
        } catch (\Throwable) {
            return null;
        }
    }
}
