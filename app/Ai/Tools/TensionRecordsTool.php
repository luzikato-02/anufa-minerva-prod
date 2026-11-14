<?php

namespace App\Ai\Tools;

use App\Models\TensionRecord;
use App\Models\User;

/**
 * Twisting and weaving tension records: one row per record, or aggregated by machine, day, item or operator.
 * Readings live in the measurement_data JSON, so they are summarised here in PHP rather than in SQL.
 */
class TensionRecordsTool extends Tool
{
    private const GROUPS = ['none', 'machine', 'day', 'item_number', 'operator', 'record_type'];

    public function name(): string
    {
        return 'tension_records';
    }

    public function description(): string
    {
        return 'Twisting and weaving yarn tension records. Each record is one measuring session on one machine: '
            .'the spec (target ± tolerance), process parameters, and a max and min tension reading per position '
            .'(twisting: per spindle; weaving: per creel side/row/column). Returns per-record summaries, or with '
            .'group_by, aggregates per machine/day/item/operator: record count, positions measured, positions out '
            .'of spec (max above target+tolerance or min below target−tolerance), mean/extreme readings and open problems. '
            .'Use it for questions about tension levels, out-of-spec rates, which machines were checked and when.';
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
                'machine' => ['type' => 'string', 'description' => 'Exact machine number, e.g. "2704".'],
                'item_number' => ['type' => 'string', 'description' => 'Item number, matched as a substring.'],
                'operator' => ['type' => 'string', 'description' => 'Operator name, matched as a substring.'],
                'production_order' => ['type' => 'string', 'description' => 'Exact production order.'],
                'group_by' => ['type' => 'string', 'enum' => self::GROUPS, 'description' => 'Aggregate instead of listing records. Defaults to none.'],
                'limit' => ['type' => 'integer', 'description' => 'Rows to return (records or groups). Defaults to 50.'],
            ],
        ];
    }

    public function run(array $args, User $user): ToolResult
    {
        $window = DateWindow::fromArgs($args);
        $type = $this->oneOf($args, 'record_type', ['twisting', 'weaving', 'all'], 'all');
        $groupBy = $this->oneOf($args, 'group_by', self::GROUPS, 'none');
        $machine = $this->str($args, 'machine');
        $item = $this->str($args, 'item_number');
        $operator = $this->str($args, 'operator');
        $order = $this->str($args, 'production_order');
        $limit = $this->limit($args);

        $records = TensionRecord::query()
            ->select(['id', 'record_type', 'form_data', 'measurement_data', 'problems', 'metadata', 'created_at'])
            ->when($type !== 'all', fn ($q) => $q->byType($type))
            ->whereBetween('created_at', [$window->startUtc(), $window->endUtc()])
            ->orderByDesc('created_at')
            ->lazy(200)
            ->map(fn (TensionRecord $r) => $this->summarise($r))
            ->filter(function (array $r) use ($machine, $item, $operator, $order) {
                return (! $machine || strcasecmp((string) $r['machine'], $machine) === 0)
                    && (! $item || stripos((string) $r['item_number'], $item) !== false)
                    && (! $operator || stripos((string) $r['operator'], $operator) !== false)
                    && (! $order || strcasecmp((string) $r['production_order'], $order) === 0);
            })
            ->values()
            ->all();

        $totals = $this->aggregate($records);
        $result = [
            'window' => $window->describe(),
            'filters' => array_filter(compact('type', 'machine', 'item', 'operator', 'order')),
            'totals' => $totals,
        ];

        if ($groupBy === 'none') {
            $rows = array_map(fn ($r) => array_diff_key($r, array_flip(['_sum_max', '_n_max', '_sum_min', '_n_min'])), $records);
            $result['records'] = array_slice($rows, 0, $limit);
            $result['records_returned'] = count($result['records']);
            $result['truncated'] = count($rows) > $limit;

            return new ToolResult($result, count($rows));
        }

        $key = $groupBy === 'day' ? 'date' : $groupBy;
        $groups = [];
        foreach ($records as $r) {
            $groups[(string) ($r[$key] ?? '(none)')][] = $r;
        }
        $rows = [];
        foreach ($groups as $value => $members) {
            $rows[] = [$groupBy => (string) $value] + $this->aggregate($members);
        }
        usort($rows, $groupBy === 'day'
            ? fn ($a, $b) => strcmp($b['day'], $a['day'])
            : fn ($a, $b) => $b['records'] <=> $a['records'] ?: strnatcmp((string) $a[$groupBy], (string) $b[$groupBy]));

        $result['group_by'] = $groupBy;
        $result['groups'] = array_slice($rows, 0, $limit);
        $result['groups_total'] = count($rows);
        $result['truncated'] = count($rows) > $limit;

        return new ToolResult($result, count($records));
    }

    /** One record flattened to the fields a question can be about, plus its reading statistics. */
    private function summarise(TensionRecord $record): array
    {
        $form = $record->form_data ?? [];
        $meta = $record->metadata ?? [];
        $num = fn ($v) => is_numeric($v) ? (float) $v : null;
        $target = $num($form['specTens'] ?? null);
        $tolerance = $num($form['tensPlus'] ?? null);
        $hasSpec = $target !== null && $tolerance !== null && $tolerance > 0;

        $maxes = [];
        $mins = [];
        $measured = 0;
        $out = 0;
        foreach (self::readings($record->measurement_data ?? []) as $reading) {
            $max = $num($reading['max'] ?? null);
            $min = $num($reading['min'] ?? null);
            if ($max === null && $min === null) {
                continue;
            }
            $measured++;
            if ($max !== null) {
                $maxes[] = $max;
            }
            if ($min !== null) {
                $mins[] = $min;
            }
            if ($hasSpec && (($max !== null && $max > $target + $tolerance) || ($min !== null && $min < $target - $tolerance))) {
                $out++;
            }
        }

        $problems = is_array($record->problems) ? $record->problems : [];
        $open = count(array_filter($problems, fn ($p) => ($p['status'] ?? 'open') !== 'resolved'));

        return [
            'id' => $record->id,
            'record_type' => $record->record_type,
            'date' => DateWindow::localDate($record->created_at),
            'machine' => $meta['machine_number'] ?? $form['machineNumber'] ?? null,
            'item_number' => $meta['item_number'] ?? $form['itemNumber'] ?? null,
            'yarn_code' => $meta['yarn_code'] ?? $form['yarnCode'] ?? null,
            'operator' => $meta['operator'] ?? $form['operator'] ?? null,
            'production_order' => $form['productionOrder'] ?? null,
            'spec_target' => $target,
            'spec_tolerance' => $tolerance,
            'dtex' => $form['dtexNumber'] ?? null,
            'tpm' => $form['tpm'] ?? null,
            'rpm' => $form['rpm'] ?? null,
            'status' => $meta['status'] ?? null,
            'completion_pct' => $num($meta['progress_percentage'] ?? null),
            'positions_measured' => $measured,
            'positions_out_of_spec' => $hasSpec ? $out : null,
            'mean_max' => $maxes ? round(array_sum($maxes) / count($maxes), 2) : null,
            'mean_min' => $mins ? round(array_sum($mins) / count($mins), 2) : null,
            'highest_max' => $maxes ? max($maxes) : null,
            'lowest_min' => $mins ? min($mins) : null,
            'problems' => count($problems),
            'open_problems' => $open,
            '_sum_max' => array_sum($maxes),
            '_n_max' => count($maxes),
            '_sum_min' => array_sum($mins),
            '_n_min' => count($mins),
        ];
    }

    /** Every {max, min} reading. Twisting: spindle => reading. Weaving: side => row => col => reading. */
    public static function readings(array $measurements): \Generator
    {
        foreach ($measurements as $value) {
            if (! is_array($value)) {
                continue;
            }
            if (array_key_exists('max', $value) || array_key_exists('min', $value)) {
                yield $value;

                continue;
            }
            foreach ($value as $row) {
                foreach (is_array($row) ? $row : [] as $reading) {
                    if (is_array($reading)) {
                        yield $reading;
                    }
                }
            }
        }
    }

    private function aggregate(array $records): array
    {
        $sum = fn (string $k) => array_sum(array_column($records, $k));
        $measured = $sum('positions_measured');
        $withSpec = array_filter($records, fn ($r) => $r['positions_out_of_spec'] !== null);
        $specMeasured = array_sum(array_column($withSpec, 'positions_measured'));
        $out = array_sum(array_column($withSpec, 'positions_out_of_spec'));
        $highs = array_filter(array_column($records, 'highest_max'), fn ($v) => $v !== null);
        $lows = array_filter(array_column($records, 'lowest_min'), fn ($v) => $v !== null);

        return [
            'records' => count($records),
            'machines' => count(array_unique(array_filter(array_column($records, 'machine')))),
            'positions_measured' => $measured,
            'positions_out_of_spec' => $out,
            'out_of_spec_pct' => $specMeasured ? round($out / $specMeasured * 100, 2) : null,
            'records_without_spec' => count($records) - count($withSpec),
            'mean_max' => $sum('_n_max') ? round($sum('_sum_max') / $sum('_n_max'), 2) : null,
            'mean_min' => $sum('_n_min') ? round($sum('_sum_min') / $sum('_n_min'), 2) : null,
            'highest_max' => $highs ? max($highs) : null,
            'lowest_min' => $lows ? min($lows) : null,
            'open_problems' => $sum('open_problems'),
        ];
    }
}
