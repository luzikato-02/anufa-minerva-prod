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

    /** The page header fields an author writes; the revision and review dates change with every release, so are not marked. */
    private const HEADER_FIELDS = ['mill', 'sp_ref', 'sp_date', 'issued'];

    public const PHASES = ['prototype' => 'Prototype', 'pre_launch' => 'Pre-launch', 'production' => 'Production'];

    /** $logo: the logo keys from SheetLogo::toArray(); the shared logo from Settings when null. */
    public static function build(ControlPlanRevision $revision, ControlPlanSetting $settings, bool $watermark = false, ?array $logo = null): array
    {
        $fmt = $settings->date_format;
        $plan = $revision->plan;
        $header = $revision->header ?? [];
        $info = $revision->info ?? [];
        $released = $revision->release_date !== null;
        $footer = ControlPlanRevision::footer($revision->content);
        // What changed is printed bold italic: everything that differs from the last release before this revision.
        $base = $revision->previousReleased();
        $baseHeader = $base?->header ?? [];
        $baseInfo = $base?->info ?? [];
        $baseNotes = $base ? self::bullets(ControlPlanRevision::footer($base->content)['notes']) : null;
        $notes = self::bullets($footer['notes']);

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
            'rows' => self::rows($revision->content ?? [], $base?->content),
            'notes' => $notes,
            'notes_changed' => $baseNotes === null ? [] : array_keys(array_diff($notes, $baseNotes)),
            'changed' => $base === null ? [] : array_keys(array_filter([
                ...array_map(fn ($k) => trim((string) ($header[$k] ?? '')) !== trim((string) ($baseHeader[$k] ?? '')), array_combine(self::HEADER_FIELDS, self::HEADER_FIELDS)),
                ...array_map(fn ($k) => trim((string) ($info[$k] ?? '')) !== trim((string) ($baseInfo[$k] ?? '')), array_combine(ControlPlanRevision::INFO_FIELDS, ControlPlanRevision::INFO_FIELDS)),
            ])),
            'signatures' => $footer['signatures'],
            'signed' => $revision->signed($fmt),
        ] + ($logo ?? ['logo' => $settings->logoDataUri(), 'logo_file' => $settings->logoFile()]);
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
     * the one above is ['covered' => true]; the cell that starts a merge carries its 'rowspan'. Given the content of
     * the last release, a cell whose text differs from it (or that belongs to a new line or step) is 'changed'.
     *
     * @return list<list<array{text?: string, rowspan?: int, covered?: bool, vertical?: bool, pic?: bool, changed?: bool}>>
     */
    public static function rows(array $content, ?array $base = null): array
    {
        $ordered = RevisionDiff::ordered($content);
        $n = count($ordered);
        $baseSteps = array_column($base['steps'] ?? [], null, 'id');
        $baseLines = array_column($base['lines'] ?? [], null, 'id');
        // Whether a field of an entry's step or line differs from the base; nothing differs when there is no base.
        $stepChanged = fn (array $e, string $f) => $base !== null
            && (! isset($baseSteps[$e['step']['id']]) || trim((string) ($e['step'][$f] ?? '')) !== trim((string) ($baseSteps[$e['step']['id']][$f] ?? '')));
        $lineChanged = fn (array $e, string ...$fs) => $base !== null && (! isset($baseLines[$e['line']['id']])
            || array_filter($fs, fn ($f) => trim((string) ($e['line'][$f] ?? '')) !== trim((string) ($baseLines[$e['line']['id']][$f] ?? ''))) !== []);
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

        // A merged cell is changed when the field changed on any of the steps it covers.
        $merged = function (int $i, array $spans, string $f, array $extra = []) use ($ordered, $stepChanged) {
            if ($spans[$i] === 0) {
                return ['covered' => true];
            }
            $changed = false;
            for ($j = $i; $j < $i + $spans[$i]; $j++) {
                $changed = $changed || $stepChanged($ordered[$j], $f);
            }

            return ['text' => (string) ($ordered[$i]['step'][$f] ?? ''), 'rowspan' => $spans[$i]] + $extra + ($changed ? ['changed' => true] : []);
        };
        $text = fn ($v, bool $changed = false) => ['text' => trim((string) $v) === '' ? '-' : (string) $v] + ($changed ? ['changed' => true] : []);

        $rows = [];
        foreach ($ordered as $i => $e) {
            $line = $e['line'];
            $ref = trim((string) ($line['reaction_ref'] ?? ''));
            $reaction = trim((string) ($line['reaction'] ?? ''));
            $field = fn (string $f) => $text($line[$f] ?? '', $lineChanged($e, $f));
            $rows[] = [
                $merged($i, $noRun, 'no'),
                $merged($i, $groupRun, 'group', ['vertical' => true]),
                $merged($i, $stepRun, 'name'),
                $merged($i, $stepRun, 'machine'),
                ['text' => '-'],
                $field('product'),
                $field('process'),
                $field('sc'),
                $field('spec'),
                $field('measurement'),
                $field('size'),
                $field('frequency'),
                $field('control'),
                $field('pic') + ['pic' => true],
                $text($ref !== '' ? trim($reaction.' ('.$ref.')') : $reaction, $lineChanged($e, 'reaction', 'reaction_ref')),
            ];
        }

        return $rows;
    }
}
