<?php

namespace App\ControlPlans;

use App\Models\ControlPlanRevision;

/**
 * Line-by-line changes between two revisions' content. Lines keep their id from revision to revision, so a line
 * is "changed" when its own fields or its step's fields differ, "added" when the base has no line with its id,
 * and "removed" when the new content has dropped it.
 */
class RevisionDiff
{
    /**
     * @return array{rows: list<array{kind: string, step: array, line: array, old: array<string, string>}>, added: int, changed: int, removed: int, notes_changed: bool, signatures_changed: bool}
     */
    public static function compare(?array $base, array $content): array
    {
        $baseLines = self::ordered($base ?? ['steps' => [], 'lines' => []]);
        $lines = self::ordered($content);
        $baseById = [];
        foreach ($baseLines as $entry) {
            $baseById[$entry['line']['id']] = $entry;
        }

        $rows = [];
        $seen = [];
        foreach ($lines as $entry) {
            $id = $entry['line']['id'];
            $seen[$id] = true;
            $was = $baseById[$id] ?? null;
            if (! $was) {
                $rows[] = ['kind' => 'added'] + $entry + ['old' => []];

                continue;
            }
            $old = [];
            foreach (ControlPlanRevision::LINE_FIELDS as $f) {
                if (($entry['line'][$f] ?? '') !== ($was['line'][$f] ?? '')) {
                    $old[$f] = (string) ($was['line'][$f] ?? '');
                }
            }
            foreach (ControlPlanRevision::STEP_FIELDS as $f) {
                if (($entry['step'][$f] ?? '') !== ($was['step'][$f] ?? '')) {
                    $old['step_'.$f] = (string) ($was['step'][$f] ?? '');
                }
            }
            if ($old) {
                $rows[] = ['kind' => 'changed'] + $entry + ['old' => $old];
            }
        }
        foreach ($baseLines as $entry) {
            if (! isset($seen[$entry['line']['id']])) {
                $rows[] = ['kind' => 'removed'] + $entry + ['old' => []];
            }
        }

        $count = fn (string $kind) => count(array_filter($rows, fn ($r) => $r['kind'] === $kind));

        // The notes and signature block are compared as a whole; ids are left out so re-adding a signer is no change.
        $was = ControlPlanRevision::footer($base);
        $now = ControlPlanRevision::footer($content);
        $people = fn (array $footer) => array_map(fn ($group) => array_map(fn ($s) => [trim($s['name']), trim($s['position'])], $group), $footer['signatures']);

        return [
            'rows' => $rows, 'added' => $count('added'), 'changed' => $count('changed'), 'removed' => $count('removed'),
            'notes_changed' => $base !== null && trim($was['notes']) !== trim($now['notes']),
            'signatures_changed' => $base !== null && $people($was) !== $people($now),
        ];
    }

    /**
     * The content's lines in print order (steps in order, each step's lines in order), each with its step.
     *
     * @return list<array{step: array, line: array}>
     */
    public static function ordered(array $content): array
    {
        $out = [];
        $lines = $content['lines'] ?? [];
        foreach ($content['steps'] ?? [] as $step) {
            foreach ($lines as $line) {
                if (($line['step_id'] ?? null) === $step['id']) {
                    $out[] = ['step' => $step, 'line' => $line];
                }
            }
        }

        return $out;
    }
}
