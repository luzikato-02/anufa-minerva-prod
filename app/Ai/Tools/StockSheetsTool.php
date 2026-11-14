<?php

namespace App\Ai\Tools;

use App\Models\StockSheetRow;
use App\Models\User;

/** Spool lots counted on stock sheets: material, batch, colour, cheese count and weight. */
class StockSheetsTool extends Tool
{
    private const GROUPS = ['none', 'material_code', 'batch', 'color', 'sheet_date', 'leader'];

    public function name(): string
    {
        return 'stock_sheets';
    }

    public function description(): string
    {
        return 'Stock sheet lines: each line is one spool lot found during a stock count, with sheet date, the '
            .'leader who counted, colour, material code, batch, production date, cheese/bobbin count found (chs), '
            .'total bobbins and original weight of the batch, the weight actually counted (kg), storage position '
            .'and remark. Filtered by sheet date. Returns lines, or with group_by, totals per material/batch/colour/day/leader '
            .'(lines, bobbins counted, kg counted).';
    }

    public function permission(): ?string
    {
        return 'stock-take.view';
    }

    public function parameters(): array
    {
        return [
            'type' => 'object',
            'properties' => self::dateParams() + [
                'material_code' => ['type' => 'string', 'description' => 'Material code, matched as a substring.'],
                'batch' => ['type' => 'string', 'description' => 'Batch number, matched as a substring.'],
                'color' => ['type' => 'string', 'description' => 'Colour, matched as a substring.'],
                'group_by' => ['type' => 'string', 'enum' => self::GROUPS, 'description' => 'Aggregate instead of listing lines. Defaults to none.'],
                'limit' => ['type' => 'integer', 'description' => 'Rows to return (lines or groups). Defaults to 50.'],
            ],
        ];
    }

    public function run(array $args, User $user): ToolResult
    {
        $window = DateWindow::fromArgs($args, 90);
        $groupBy = $this->oneOf($args, 'group_by', self::GROUPS, 'none');
        $limit = $this->limit($args);
        $like = fn (string $v) => '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($v)).'%';

        $query = StockSheetRow::query()
            ->join('stock_sheets', 'stock_sheets.id', '=', 'stock_sheet_rows.stock_sheet_id')
            ->whereNull('stock_sheets.deleted_at')
            ->whereBetween('stock_sheets.sheet_date', [$window->fromLocal->toDateString(), $window->toLocal->toDateString()]);
        foreach (['material_code', 'batch', 'color'] as $field) {
            if ($value = $this->str($args, $field)) {
                $query->whereRaw("LOWER(stock_sheet_rows.{$field}) LIKE ?", [$like($value)]);
            }
        }

        $rows = $query
            ->orderByDesc('stock_sheets.sheet_date')
            ->orderBy('stock_sheet_rows.stock_sheet_id')
            ->orderBy('stock_sheet_rows.line_no')
            ->get([
                'stock_sheet_rows.stock_sheet_id as sheet_id', 'stock_sheets.sheet_date', 'stock_sheets.leader',
                'stock_sheet_rows.line_no', 'stock_sheet_rows.color', 'stock_sheet_rows.material_code',
                'stock_sheet_rows.batch', 'stock_sheet_rows.prod_date', 'stock_sheet_rows.chs',
                'stock_sheet_rows.total_bobbins', 'stock_sheet_rows.original_weight',
                'stock_sheet_rows.actual_weight', 'stock_sheet_rows.position', 'stock_sheet_rows.remark',
            ])
            ->map(fn ($r) => [
                'sheet_id' => $r->sheet_id,
                'sheet_date' => substr((string) $r->sheet_date, 0, 10),
                'leader' => $r->leader,
                'line_no' => $r->line_no,
                'color' => $r->color,
                'material_code' => $r->material_code,
                'batch' => $r->batch,
                'prod_date' => $r->prod_date?->toDateString(),
                'bobbins_counted' => $r->chs,
                'total_bobbins' => $r->total_bobbins,
                'original_weight_kg' => $r->original_weight,
                'counted_weight_kg' => $r->actual_weight,
                'position' => $r->position,
                'remark' => $r->remark,
            ])
            ->all();

        $totals = $this->aggregate($rows);
        $result = ['window' => $window->describe(), 'totals' => $totals];

        if ($groupBy === 'none') {
            $result['lines'] = array_slice($rows, 0, $limit);
            $result['truncated'] = count($rows) > $limit;

            return new ToolResult($result, count($rows));
        }

        $groups = [];
        foreach ($rows as $r) {
            $groups[(string) ($r[$groupBy] ?? '(none)')][] = $r;
        }
        $out = [];
        foreach ($groups as $value => $members) {
            $out[] = [$groupBy => (string) $value] + $this->aggregate($members);
        }
        usort($out, $groupBy === 'sheet_date'
            ? fn ($a, $b) => strcmp($b['sheet_date'], $a['sheet_date'])
            : fn ($a, $b) => $b['counted_weight_kg'] <=> $a['counted_weight_kg']);

        $result['group_by'] = $groupBy;
        $result['groups'] = array_slice($out, 0, $limit);
        $result['groups_total'] = count($out);
        $result['truncated'] = count($out) > $limit;

        return new ToolResult($result, count($rows));
    }

    private function aggregate(array $rows): array
    {
        return [
            'lines' => count($rows),
            'sheets' => count(array_unique(array_column($rows, 'sheet_id'))),
            'batches' => count(array_unique(array_column($rows, 'batch'))),
            'bobbins_counted' => array_sum(array_column($rows, 'bobbins_counted')),
            'counted_weight_kg' => round(array_sum(array_column($rows, 'counted_weight_kg')), 2),
            'lines_without_weight' => count(array_filter($rows, fn ($r) => $r['counted_weight_kg'] === null)),
        ];
    }
}
