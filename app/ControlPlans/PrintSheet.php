<?php

namespace App\ControlPlans;

use App\Models\ControlPlanRevision;
use App\Models\ControlPlanSetting;

/**
 * Everything the W-WSD work station document prints for one revision, laid out once for every output (the print
 * preview, the PDF and the Word file): the page header, the revision history page, the control plan information
 * block, the characteristics table with its merged cells, and the notes and signature block under it.
 */
class PrintSheet
{
    public const PAGES = 2;

    public const PHASES = ['prototype' => 'Prototype', 'pre_launch' => 'Pre-launch', 'production' => 'Production'];

    public static function build(ControlPlanRevision $revision, ControlPlanSetting $settings, bool $watermark = false): array
    {
        $fmt = $settings->date_format;
        $plan = $revision->plan;
        $header = $revision->header ?? [];
        $info = $revision->info ?? [];
        $released = $revision->release_date !== null;
        $footer = ControlPlanRevision::footer($revision->content);

        $releaseDate = $released ? PlanDates::format($revision->release_date, $fmt) : '[set on release]';
        $nextReview = $revision->next_review_date
            ? PlanDates::format($revision->next_review_date, $fmt)
            : '[release date + '.$settings->review_period_years.' years]';

        return [
            'doc_no' => $plan->doc_no,
            'rev' => PlanDates::rev($revision->rev_no),
            'status' => $revision->status,
            'watermark' => $watermark,
            'mill' => $header['mill'] ?? '',
            'sp_ref' => $header['sp_ref'] ?? '',
            'sp_date' => $header['sp_date'] ?? '',
            'issued' => $header['issued'] ?? '',
            'rev_label' => PlanDates::rev($revision->rev_no).' / '.$releaseDate,
            'release_date' => $releaseDate,
            'next_review' => $nextReview,
            'history' => self::history($revision, $fmt),
            'info' => $info + ['phase' => 'production'],
            'phases' => self::PHASES,
            'title' => trim((string) ($info['title'] ?? '')) !== '' ? $info['title'] : '[CONTROL PLAN TITLE]',
            'rows' => self::rows($revision->content ?? []),
            'notes' => self::bullets($footer['notes']),
            'signatures' => $footer['signatures'],
            'logo' => $settings->logoDataUri(),
            'logo_file' => $settings->logoFile(),
        ];
    }

    /**
     * Revision history rows, oldest first: the imported rows, then each released revision's entries up to and
     * including this one. An unreleased revision's own entries carry a placeholder date.
     *
     * @return list<array{page: string, date: string, rev: string, description: list<string>, revised_by: string}>
     */
    private static function history(ControlPlanRevision $revision, string $fmt): array
    {
        $rows = [];
        foreach ($revision->plan->legacy_history ?? [] as $row) {
            $rows[] = [
                'page' => (string) ($row['page'] ?? ''),
                'date' => (string) ($row['date'] ?? ''),
                'rev' => (string) ($row['rev'] ?? ''),
                'description' => self::bullets((string) ($row['description'] ?? '')),
                'revised_by' => (string) ($row['revised_by'] ?? ''),
            ];
        }

        $earlier = ControlPlanRevision::with('submitter:id,name')
            ->where('control_plan_id', $revision->control_plan_id)
            ->where('rev_no', '<', $revision->rev_no)
            ->whereIn('status', [ControlPlanRevision::RELEASED, ControlPlanRevision::SUPERSEDED])
            ->orderBy('rev_no')
            ->get();

        foreach ($earlier->push($revision->loadMissing('submitter:id,name', 'author:id,name')) as $rev) {
            $date = $rev->release_date ? PlanDates::format($rev->release_date, $fmt) : '[set on release]';
            foreach ($rev->history ?? [] as $entry) {
                $rows[] = [
                    'page' => (string) ($entry['pages'] ?? ''),
                    'date' => $date,
                    'rev' => PlanDates::rev($rev->rev_no),
                    'description' => self::bullets((string) ($entry['description'] ?? '')),
                    'revised_by' => $rev->submitter?->name ?? $rev->author?->name ?? '',
                ];
            }
        }

        return $rows;
    }

    /** One change per line; several lines print as bullets. */
    private static function bullets(string $text): array
    {
        return array_values(array_filter(array_map('trim', preg_split('/\R/', $text)), fn ($l) => $l !== ''));
    }

    /**
     * The characteristics table, one row per line. Each row is the 15 printed cells in column order; the process
     * no., group, process name and machine cells merge down over the lines that share them. A cell covered by
     * the one above is ['covered' => true]; the cell that starts a merge carries its 'rowspan'.
     *
     * @return list<list<array{text?: string, rowspan?: int, covered?: bool, vertical?: bool, pic?: bool}>>
     */
    public static function rows(array $content): array
    {
        $ordered = RevisionDiff::ordered($content);
        $n = count($ordered);
        $runs = function (callable $key) use ($ordered, $n): array {
            $spans = array_fill(0, $n, 0);
            for ($i = 0; $i < $n;) {
                $k = $key($ordered[$i]);
                $j = $i;
                while ($j < $n && $key($ordered[$j]) === $k) {
                    $j++;
                }
                $spans[$i] = $j - $i;
                $i = $j;
            }

            return $spans;
        };
        $noRun = $runs(fn ($e) => (string) ($e['step']['no'] ?? ''));
        $groupRun = $runs(fn ($e) => ($e['step']['no'] ?? '').'|'.($e['step']['group'] ?? ''));
        $stepRun = $runs(fn ($e) => $e['step']['id']);

        $merged = fn (int $span, string $text, array $extra = []) => $span > 0
            ? ['text' => $text, 'rowspan' => $span] + $extra
            : ['covered' => true];
        $text = fn ($v) => ['text' => trim((string) $v) === '' ? '-' : (string) $v];

        $rows = [];
        foreach ($ordered as $i => $e) {
            $step = $e['step'];
            $line = $e['line'];
            $ref = trim((string) ($line['reaction_ref'] ?? ''));
            $reaction = trim((string) ($line['reaction'] ?? ''));
            $rows[] = [
                $merged($noRun[$i], (string) ($step['no'] ?? '')),
                $merged($groupRun[$i], (string) ($step['group'] ?? ''), ['vertical' => true]),
                $merged($stepRun[$i], (string) ($step['name'] ?? '')),
                $merged($stepRun[$i], (string) ($step['machine'] ?? '')),
                ['text' => '-'],
                $text($line['product'] ?? ''),
                $text($line['process'] ?? ''),
                $text($line['sc'] ?? ''),
                $text($line['spec'] ?? ''),
                $text($line['measurement'] ?? ''),
                $text($line['size'] ?? ''),
                $text($line['frequency'] ?? ''),
                $text($line['control'] ?? ''),
                $text($line['pic'] ?? '') + ['pic' => true],
                $text($ref !== '' ? trim($reaction.' ('.$ref.')') : $reaction),
            ];
        }

        return $rows;
    }
}
