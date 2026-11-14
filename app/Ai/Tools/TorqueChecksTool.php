<?php

namespace App\Ai\Tools;

use App\Models\TorqueCheckReading;
use App\Models\User;

/** Creel adaptor torque readings, judged against their creel type's allowed range. */
class TorqueChecksTool extends Tool
{
    private const GROUPS = ['none', 'machine', 'side', 'creel_type', 'operator', 'check_date', 'sheet'];

    public function name(): string
    {
        return 'torque_checks';
    }

    public function description(): string
    {
        return 'Creel adaptor torque check readings (Nm). Each sheet is one check of one machine by one operator '
            .'on one date; each reading is one creel position (side Ai/Ao/Bi/Bo, row number, column letter) and is '
            .'judged against the creel type\'s torque_min..torque_max. Filtered by check date. Returns totals and '
            .'per-group counts of readings, out-of-range readings, mean/min/max torque; with group_by none it lists '
            .'the out-of-range readings.';
    }

    public function permission(): ?string
    {
        return 'torque-checks.view';
    }

    public function parameters(): array
    {
        return [
            'type' => 'object',
            'properties' => self::dateParams() + [
                'machine' => ['type' => 'string', 'description' => 'Exact machine number.'],
                'side' => ['type' => 'string', 'enum' => ['Ai', 'Ao', 'Bi', 'Bo']],
                'creel_type' => ['type' => 'string', 'description' => 'Creel type name, matched as a substring.'],
                'operator' => ['type' => 'string', 'description' => 'Operator name, matched as a substring.'],
                'group_by' => ['type' => 'string', 'enum' => self::GROUPS, 'description' => 'Defaults to machine.'],
                'limit' => ['type' => 'integer', 'description' => 'Rows to return. Defaults to 50.'],
            ],
        ];
    }

    public function run(array $args, User $user): ToolResult
    {
        $window = DateWindow::fromArgs($args);
        $groupBy = $this->oneOf($args, 'group_by', self::GROUPS, 'machine');
        $limit = $this->limit($args);
        $machine = $this->str($args, 'machine');
        $side = $this->oneOf($args, 'side', ['Ai', 'Ao', 'Bi', 'Bo'], '');
        $creelType = $this->str($args, 'creel_type');
        $operator = $this->str($args, 'operator');

        $query = TorqueCheckReading::query()
            ->join('torque_check_sheets as s', 's.id', '=', 'torque_check_readings.torque_check_sheet_id')
            ->join('creel_types as c', 'c.id', '=', 's.creel_type_id')
            ->whereNull('s.deleted_at')
            ->whereBetween('s.check_date', [$window->fromLocal->toDateString(), $window->toLocal->toDateString()])
            ->when($machine, fn ($q) => $q->where('s.machine_number', $machine))
            ->when($side, fn ($q) => $q->where('torque_check_readings.side', $side))
            ->when($creelType, fn ($q) => $q->whereRaw('LOWER(c.name) LIKE ?', ['%'.mb_strtolower($creelType).'%']))
            ->when($operator, fn ($q) => $q->whereRaw('LOWER(s.operator_name) LIKE ?', ['%'.mb_strtolower($operator).'%']));

        $readings = $query->get([
            's.id as sheet', 's.check_date', 's.machine_number as machine', 's.operator_name as operator',
            'c.name as creel_type', 'c.torque_min', 'c.torque_max', 'torque_check_readings.side',
            'torque_check_readings.row_no', 'torque_check_readings.column_letter', 'torque_check_readings.value',
            'torque_check_readings.note',
        ])->map(function ($r) {
            $value = (float) $r->value;
            $min = $r->torque_min !== null ? (float) $r->torque_min : null;
            $max = $r->torque_max !== null ? (float) $r->torque_max : null;

            return [
                'sheet' => $r->sheet,
                'check_date' => substr((string) $r->check_date, 0, 10),
                'machine' => $r->machine,
                'operator' => $r->operator,
                'creel_type' => $r->creel_type,
                'allowed_range' => [$min, $max],
                'side' => $r->side,
                'position' => $r->row_no.$r->column_letter,
                'value' => $value,
                'out_of_range' => ($min !== null && $value < $min) || ($max !== null && $value > $max),
                'note' => $r->note,
            ];
        })->all();

        $result = ['window' => $window->describe(), 'totals' => $this->aggregate($readings)];

        if ($groupBy === 'none') {
            $bad = array_values(array_filter($readings, fn ($r) => $r['out_of_range']));
            usort($bad, fn ($a, $b) => strcmp($b['check_date'], $a['check_date']));
            $result['out_of_range_readings'] = array_slice($bad, 0, $limit);
            $result['truncated'] = count($bad) > $limit;

            return new ToolResult($result, count($readings));
        }

        $groups = [];
        foreach ($readings as $r) {
            $groups[(string) ($r[$groupBy] ?? '(none)')][] = $r;
        }
        $out = [];
        foreach ($groups as $value => $members) {
            $out[] = [$groupBy => (string) $value] + $this->aggregate($members);
        }
        usort($out, fn ($a, $b) => $b['out_of_range'] <=> $a['out_of_range'] ?: strnatcmp((string) $a[$groupBy], (string) $b[$groupBy]));

        $result['group_by'] = $groupBy;
        $result['groups'] = array_slice($out, 0, $limit);
        $result['groups_total'] = count($out);
        $result['truncated'] = count($out) > $limit;

        return new ToolResult($result, count($readings));
    }

    private function aggregate(array $readings): array
    {
        $values = array_column($readings, 'value');
        $bad = count(array_filter($readings, fn ($r) => $r['out_of_range']));

        return [
            'sheets' => count(array_unique(array_column($readings, 'sheet'))),
            'readings' => count($readings),
            'out_of_range' => $bad,
            'out_of_range_pct' => $readings ? round($bad / count($readings) * 100, 2) : null,
            'mean' => $values ? round(array_sum($values) / count($values), 2) : null,
            'min' => $values ? min($values) : null,
            'max' => $values ? max($values) : null,
        ];
    }
}
