<?php

namespace App\ControlPlans\Import;

use App\ControlPlans\PlanDates;
use App\ControlPlans\ReferenceCodes;
use App\Http\Controllers\ControlPlans\ControlPlanController;
use App\Models\ControlPlanRevision;
use Illuminate\Support\Str;

/**
 * Turns what a reader found in a W-WSD document into a control plan: the document header and plan information
 * from their labels ("Referensi SP :", "Control Plan Number:"…), the steps and characteristic lines from the
 * characteristics table, the revision history rows, the notes and the signature block. Tables are recognised by
 * their header words, and columns by their header labels, so a plan whose columns are in another order or that
 * lacks some still imports. Whatever could not be found is listed in warnings for the person importing.
 */
class PlanImport
{
    /** Labels of the header block and the plan information block, as WordExport prints them. */
    private const LABELS = [
        'sp_ref' => 'Referensi SP',
        'sp_date' => 'Tanggal Diterbitkan SP',
        'issued' => 'Tanggal diterbitkan',
        'rev' => 'No. Revisi/Tanggal Revisi terakhir',
        'next_review' => 'Tanggal Review berikutnya',
        'page' => 'Halaman',
        'doc_no' => 'Control Plan Number',
        'key_contact' => 'Key Contact/Phone',
        'orig_date' => 'Date (Orig.)',
        'rev_date' => 'Date (Rev.)',
        'part_number' => 'Part Number / Latest Change Level',
        'core_team' => 'Core Team',
        'cust_eng' => 'Customer Engineering Approval/Date (If Req\'d.)',
        'part_name' => 'Part Name / Description',
        'plan_approval' => 'Organization/Plan Approval/Date',
        'cust_qual' => 'Customer Quality Approval/Date (If Req\'d.)',
        'org_plant' => 'Organization/Plant',
        'org_code' => 'Organization Code',
        'other1' => 'Other Approval/Date (If Req\'d.)',
        'other2' => 'Other Approval (If Req\'d.)',
    ];

    /** Words that make up table headers. A line or row of only these is a header, never content. */
    private const HEADER_WORDS = [
        'process', 'no', 'number', 'name', 'operation', 'description', 'machine', 'device', 'jig', 'jigs', 'tool',
        'tools', 'for', 'mfg', 'manufacturing', 'characteristic', 'characteristics', 'product', 'special', 'char',
        'class', 'method', 'methods', 'specification', 'tolerance', 'evaluation', 'measurement', 'technique', 'sample',
        'size', 'freq', 'frequency', 'control', 'pic', 'reaction', 'plan', 'page', 'date', 'of', 'revision', 'rev',
        'revised', 'by', 'and',
        // History tables headed in Indonesian, or in both languages.
        'halaman', 'hal', 'tanggal', 'tgl', 'revisi', 'nomor', 'keterangan', 'uraian', 'perubahan', 'deskripsi',
        'diubah', 'direvisi', 'oleh',
    ];

    /** Characteristics table columns by header text, the first match winning; null for the characteristic No. */
    private const LINE_COLUMNS = [
        'reaction' => '/reaction/i',
        'pic' => '/\bpic\b|person\s+in\s+charge/i',
        'control' => '/control\s*method/i',
        'frequency' => '/\bfreq/i',
        'size' => '/\bsize\b/i',
        'measurement' => '/evaluation|measurement/i',
        'spec' => '/specification|tolerance/i',
        'sc' => '/special/i',
        'machine' => '/machine|device|jig|tool/i',
        'no' => '/process\s*(no|number)\b/i',
        'name' => '/process\s*name|operation/i',
        'product' => '/product/i',
        'process' => '/process/i',
    ];

    private const HISTORY_COLUMNS = [
        'revised_by' => '/revised\s*by|\bby\b|\boleh\b/i',
        'description' => '/description|keterangan|uraian|perubahan|deskripsi/i',
        // Before rev: "Date of Revision" and "Tanggal Revisi" are the date.
        'date' => '/date|tanggal|\btgl\b/i',
        'rev' => '/revision\s*no|\brev/i',
        'page' => '/page|halaman|\bhal\b/i',
    ];

    private const PHASE_WORDS = '(prototype|pre-?\s?launch|production)';

    /** A ticked box in front of a phase: [X], ☒, ☑, ■, ×, ✓. */
    private const TICKED = '(?:\[\s*[xX✓✔]\s*\]|[☒☑■×✓✔])';

    private const DATE_AT_END = '/^(.*?)[\s,;\/]*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4}|\d{1,2}\s+\pL+\.?\s+\d{4}|\d{4}-\d{1,2}-\d{1,2})\s*$/u';

    /** @var list<string> */
    private array $warnings = [];

    private bool $cut = false;

    public static function hasLabel(string $text): bool
    {
        return preg_match(self::labelPattern(), $text) === 1;
    }

    public static function isHeaderText(string $text): bool
    {
        $words = array_filter(preg_split('/[^\pL]+/u', mb_strtolower($text)));

        return $words !== [] && array_diff($words, self::HEADER_WORDS) === [];
    }

    /**
     * @return array{doc_no: string, rev_no: ?int, header: array<string, string>, info: array<string, string>,
     *     content: array{steps: list<array>, lines: list<array>, notes: string, signatures: array{prepared: list<array>, approved: list<array>}},
     *     history: list<array{page: string, date: string, rev: string, description: string, revised_by: string}>,
     *     release_date: ?string, next_review_date: ?string, format: string, warnings: list<string>}
     */
    public static function from(ImportedDocument $doc): array
    {
        return (new self)->build($doc);
    }

    private function build(ImportedDocument $doc): array
    {
        $this->warnings = $doc->warnings;
        $f = $this->labelled($doc->lines);

        [$steps, $lines, $history, $signatures] = [[], [], [], ['prepared' => [], 'approved' => []]];
        $foundLines = false;
        // The table read last, so one carried on without its header (Word splits a table at a page break, or
        // the author started a new one) continues it: [kind, keys, width].
        $last = null;
        foreach (array_merge(...array_map(fn ($t) => $this->sections($t), $doc->tables ?: [[]])) as $table) {
            [$columns, $body] = $this->columns($table);
            $found = $this->signatures($table);
            if (! $columns && ! $found && $last && $last[2] === self::width($table)) {
                [$kind, $keys] = $last;
            } elseif ($known = $this->kind($table)) {
                [$kind, $keys] = $known;
            } else {
                $signatures = $found ?: $signatures;
                $last = null;

                continue;
            }
            if ($kind === 'lines') {
                $foundLines = true;
                $this->characteristics($body, $keys, $steps, $lines);
            } else {
                array_push($history, ...$this->history($body, $keys));
            }
            $last = [$kind, $keys, self::width($table)];
        }

        if (! $foundLines) {
            $this->warnings[] = 'No characteristics table was found (one with Process No., Characteristic and Reaction Plan columns). The plan starts with one empty line to fill in.';
        }
        if (! $lines) {
            $empty = ControlPlanController::emptyContent();
            [$steps, $lines] = [$empty['steps'], $empty['lines']];
        }
        $noSize = count(array_filter($lines, fn ($l) => trim($l['size']) === ''));
        if ($foundLines && $noSize > 0) {
            $this->warnings[] = ($noSize === 1 ? '1 characteristic has' : "{$noSize} characteristics have").' no sample size. Fill it in before submitting.';
        }
        if (! $history) {
            $this->warnings[] = 'No revision history table was found.';
        } elseif ($missing = $this->missingRevisions($history)) {
            $this->warnings[] = $missing;
        }

        [$revNo, $revDate] = $this->revision($f['rev'] ?? '', $history);
        $docNo = $this->docNo($f, $doc->lines);
        if ($docNo === '') {
            $this->warnings[] = 'The document number was not found. Enter it before importing.';
        }
        if ($revNo === null) {
            $this->warnings[] = 'The revision number was not found. Enter it before importing.';
        }
        if ($this->cut) {
            $this->warnings[] = 'Some text was longer than the editor allows and was cut short. Check the long cells.';
        }

        $approval = fn (string $key) => $this->splitDate($f[$key] ?? '');
        [$custEng, $custEngDate] = $approval('cust_eng');
        [$custQual, $custQualDate] = $approval('cust_qual');
        [$other1, $other1Date] = $approval('other1');
        [$other2, $other2Date] = $approval('other2');

        return [
            'format' => $doc->format,
            'doc_no' => $this->cut($docNo, 255),
            'rev_no' => $revNo,
            'header' => [
                'mill' => $this->cut($this->mill($doc->lines, $docNo), 255),
                'sp_ref' => $this->cut($f['sp_ref'] ?? '', 255),
                'sp_date' => $this->cut($f['sp_date'] ?? '', 255),
                'issued' => $this->cut(($f['issued'] ?? '') !== '' ? $f['issued'] : ($f['orig_date'] ?? ''), 255),
            ],
            'info' => array_map(fn ($v) => $this->cut($v, 255), array_replace(array_fill_keys(ControlPlanRevision::INFO_FIELDS, ''), [
                'phase' => $this->phase($doc->lines),
                'title' => $this->title($doc->lines),
                'key_contact' => $f['key_contact'] ?? '',
                'core_team' => $f['core_team'] ?? '',
                'part_number' => $f['part_number'] ?? '',
                'part_name' => $f['part_name'] ?? '',
                'org_plant' => $f['org_plant'] ?? '',
                'org_code' => $f['org_code'] ?? '',
                'cust_eng_name' => $custEng, 'cust_eng_date' => $custEngDate,
                'cust_qual_name' => $custQual, 'cust_qual_date' => $custQualDate,
                'other1_name' => $other1, 'other1_date' => $other1Date,
                'other2_name' => $other2, 'other2_date' => $other2Date,
            ])),
            'content' => [
                'steps' => $steps,
                'lines' => $lines,
                'notes' => $this->cut($this->notes($doc->lines), 5000),
                'signatures' => $signatures,
            ],
            'history' => $history,
            'release_date' => $revDate ?? PlanDates::parse($f['rev_date'] ?? ''),
            'next_review_date' => PlanDates::parse($f['next_review'] ?? ''),
            'warnings' => array_values(array_unique($this->warnings)),
        ];
    }

    /** One regex matching any label; each alternative is a named group, longest label first. */
    private static function labelPattern(): string
    {
        static $pattern = null;
        if ($pattern !== null) {
            return $pattern;
        }
        $labels = self::LABELS;
        uasort($labels, fn ($a, $b) => strlen($b) <=> strlen($a));
        $parts = [];
        foreach ($labels as $key => $label) {
            $optional = str_ends_with($label, "(If Req'd.)");
            $label = trim(str_replace("(If Req'd.)", '', $label));
            $p = preg_quote($label, '/');
            $p = str_replace(['\\/', ' ', '\\.', "'"], ['\s*\/\s*', '\s*', '\.?', "['’]?"], $p);
            $p = str_replace(['\\(', '\\)'], ['\(\s*', '\s*\)'], $p);
            // Plans also misspell it "Costumer".
            $p = str_replace('Customer', 'C[uo]st[ou]mer', $p);
            if ($optional) {
                $p .= "(?:\s*\(\s*if\s+req['’]?d\.?\s*\))?";
            }
            $parts[] = "(?<{$key}>{$p})";
        }

        return $pattern = '/(?<![\pL\pN])(?:'.implode('|', $parts).')\s*:?/iu';
    }

    /**
     * The value after each label: the rest of its line up to the next label. A label that appears again (the
     * header repeats on every page) keeps its first value. Placeholders such as "[set on release]" count as empty.
     *
     * @return array<string, string>
     */
    private function labelled(array $lines): array
    {
        $out = [];
        foreach ($lines as $line) {
            if (! preg_match_all(self::labelPattern(), $line, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE)) {
                continue;
            }
            foreach ($matches as $i => $m) {
                $key = null;
                foreach (array_keys(self::LABELS) as $k) {
                    if (isset($m[$k]) && $m[$k][1] >= 0 && $m[$k][0] !== '') {
                        $key = $k;
                        break;
                    }
                }
                $start = $m[0][1] + strlen($m[0][0]);
                $end = isset($matches[$i + 1]) ? $matches[$i + 1][0][1] : strlen($line);
                $value = trim(substr($line, $start, $end - $start), " \t:");
                if ($key !== null && ! isset($out[$key])) {
                    $out[$key] = preg_match('/^\[.*\]$/', $value) ? '' : $value;
                }
            }
        }

        return $out;
    }

    /**
     * A table's header text per grid column (the header rows are the leading rows of header words only; a header
     * cell spanning several columns names each of them) and its body rows. A title row above the header, such as
     * "REVISION HISTORY" across the table, and empty rows around it are left out.
     *
     * @return array{0: array<int, string>, 1: list<list<array{text: string, col: float, span: float}>>}
     */
    private function columns(array $table): array
    {
        $columns = [];
        $h = 0;
        $isHeader = fn (int $r) => isset($table[$r]) && self::isHeaderText(implode(' ', array_column($table[$r], 'text')));
        $filled = fn (int $r) => count(array_filter($table[$r] ?? [], fn ($c) => $c['span'] > 0 && trim($c['text']) !== ''));
        while ($h < 3 && ! $isHeader($h) && $filled($h) <= 1 && isset($table[$h + 1])) {
            $h++;
        }
        if (! $isHeader($h)) {
            $h = 0;
        }
        while ($h < count($table) && self::isHeaderText(implode(' ', array_column($table[$h], 'text')))) {
            foreach ($table[$h] as $cell) {
                if ($cell['span'] <= 0 || trim($cell['text']) === '') {
                    continue;
                }
                for ($c = (int) $cell['col']; $c < (int) ($cell['col'] + $cell['span']); $c++) {
                    $columns[$c] = trim(($columns[$c] ?? '').' '.DocxReader::flat($cell['text']));
                }
            }
            $h++;
        }
        ksort($columns);

        return [$columns, array_slice($table, $h)];
    }

    /** @return array<int, string> grid column => field, for the columns that name one */
    private function keys(array $columns, array $rules): array
    {
        $keys = [];
        foreach ($columns as $c => $text) {
            foreach ($rules as $key => $pattern) {
                if (preg_match($pattern, $text)) {
                    $keys[$c] = $key;
                    break;
                }
            }
        }

        return $keys;
    }

    /** "Process Name" over two columns is the step group, then the step name. */
    private function stepGroup(array $keys): array
    {
        foreach ($keys as $c => $key) {
            if ($key === 'name' && ($keys[$c + 1] ?? null) === 'name') {
                $keys[$c] = 'group';
            }
        }

        return $keys;
    }

    /** A body row as field => text. A cell spanning several columns goes to the step name if it covers it. */
    private function values(array $row, array $keys): array
    {
        $out = [];
        foreach ($row as $cell) {
            $covered = [];
            for ($c = (int) $cell['col']; $c < (int) ($cell['col'] + max(1, $cell['span'])); $c++) {
                if (isset($keys[$c])) {
                    $covered[] = $keys[$c];
                }
            }
            if (! $covered || trim($cell['text']) === '') {
                continue;
            }
            $key = in_array('name', $covered, true) ? 'name' : $covered[0];
            $out[$key] = isset($out[$key]) ? $out[$key]."\n".$cell['text'] : $cell['text'];
        }

        return $out;
    }

    /**
     * Steps and lines from the characteristics table. A row with no step cells continues the step above (they
     * were merged down); a row repeating the step above continues it too (a PDF repeats merged cells after a page
     * break). A new step without its own process no. or group shares those of the step above.
     */
    private function characteristics(array $body, array $keys, array &$steps, array &$lines): void
    {
        $current = array_key_last($steps);
        $same = fn (string $a, string $b) => mb_strtolower($a) === mb_strtolower($b);
        $first = true;
        foreach ($body as $row) {
            if (self::isHeaderText(implode(' ', array_column($row, 'text')))) {
                continue;
            }
            $v = array_map(fn ($t) => DocxReader::flat($t), $this->values($row, $keys));
            if (! array_filter($v, fn ($t) => $t !== '')) {
                continue;
            }
            $step = ['no' => $v['no'] ?? '', 'group' => $v['group'] ?? '', 'name' => $v['name'] ?? '', 'machine' => $v['machine'] ?? ''];
            $cur = $current !== null ? $steps[$current] : null;
            // A step carried on over a page break repeats its cells, sometimes with other capitals or, on the
            // first row after the break, another process number; it is still the same step.
            $repeats = $cur !== null && ($step['name'] !== '' || $step['machine'] !== '')
                && $same($step['name'], $cur['name']) && $same($step['machine'], $cur['machine'])
                && ($step['group'] === '' || $same($step['group'], $cur['group']))
                && ($step['no'] === '' || $step['no'] === $cur['no'] || $first);
            $continues = $cur !== null && (! array_filter($step, fn ($t) => $t !== '') || $repeats);
            if ($repeats && $step['no'] !== '' && $step['no'] !== $cur['no']) {
                $this->warnings[] = "“{$cur['name']}” is process no. {$cur['no']}, then {$step['no']} where it carries on after a page break. It was kept as no. {$cur['no']}; check the number in the editor.";
            }
            $first = false;
            if (! $continues) {
                $inherit = $cur !== null && $step['no'] === '';
                $steps[] = [
                    'id' => Str::uuid()->toString(),
                    'no' => $this->cut($step['no'] !== '' ? $step['no'] : ($cur['no'] ?? ''), 50),
                    'group' => $this->cut($step['group'] !== '' ? $step['group'] : ($inherit ? $cur['group'] : ''), 255),
                    'name' => $this->cut($step['name'], 255),
                    'machine' => $this->cut($step['machine'], 255),
                ];
                $current = array_key_last($steps);
            }

            [$reaction, $ref] = $this->reaction($v['reaction'] ?? '');
            $line = ['id' => Str::uuid()->toString(), 'step_id' => $steps[$current]['id']];
            foreach (ControlPlanRevision::LINE_FIELDS as $field) {
                $line[$field] = $this->cut(match ($field) {
                    'reaction' => $reaction,
                    'reaction_ref' => $ref,
                    default => $v[$field] ?? '',
                }, 2000);
            }
            $lines[] = $line;
        }
    }

    /** "Segregate product (QA-IK-14)" is the reaction plan and the document it refers to. */
    private function reaction(string $text): array
    {
        if (preg_match('/^(.*?)\s*\(\s*([A-Z]+(?:-[A-Z0-9]+)+)\s*\)\s*$/s', $text, $m)) {
            return [trim($m[1]), $m[2]];
        }

        return [$text, ''];
    }

    /**
     * A table cut where a characteristics or history header starts inside it: a Word plan may keep the plan
     * information block and the first characteristics in one table, or start a new section with its own header.
     */
    private function sections(array $table): array
    {
        $isHeader = fn (int $r) => self::isHeaderText(implode(' ', array_column($table[$r], 'text')));
        $starts = [0];
        for ($r = 1; $r < count($table); $r++) {
            if ($isHeader($r) && ! $isHeader($r - 1) && $this->kind(array_slice($table, $r)) !== null) {
                $starts[] = $r;
            }
        }
        $starts[] = count($table);

        return array_map(fn ($i) => array_slice($table, $starts[$i], $starts[$i + 1] - $starts[$i]), array_keys(array_slice($starts, 0, -1)));
    }

    /** "lines" or "history" with the column keys, for a table whose header names one of those tables. */
    private function kind(array $table): ?array
    {
        [$columns] = $this->columns($table);
        $lineKeys = $this->keys($columns, self::LINE_COLUMNS);
        $historyKeys = $this->keys($columns, self::HISTORY_COLUMNS);
        if (in_array('reaction', $lineKeys, true) && array_intersect(['product', 'spec'], $lineKeys)) {
            return ['lines', $this->stepGroup($lineKeys)];
        }
        if (in_array('rev', $historyKeys, true) && in_array('description', $historyKeys, true)) {
            return ['history', $historyKeys];
        }

        return null;
    }

    /** The number of grid columns a table spans. */
    private static function width(array $table): int
    {
        $width = 0;
        foreach ($table as $row) {
            foreach ($row as $cell) {
                $width = max($width, (int) ($cell['col'] + max(1, $cell['span'])));
            }
        }

        return $width;
    }

    /**
     * A warning when the history rows do not run without gaps from the first revision (Rev 00, or Rev 01 where the
     * first issue has no row of its own), as a sign some were not read.
     */
    private function missingRevisions(array $history): ?string
    {
        $revs = array_values(array_unique(array_filter(array_map(fn ($h) => preg_match('/\d{1,3}/', $h['rev'], $m) ? (int) $m[0] : null, $history), 'is_int')));
        if (! $revs) {
            return null;
        }
        $absent = array_values(array_diff(range(min($revs) === 0 ? 0 : 1, max($revs)), $revs));
        if (! $absent) {
            return null;
        }
        // Runs of three or more read "00 to 08".
        $runs = [];
        foreach ($absent as $r) {
            $last = array_key_last($runs);
            if ($last !== null && end($runs[$last]) === $r - 1) {
                $runs[$last][] = $r;
            } else {
                $runs[] = [$r];
            }
        }
        $list = implode(', ', array_map(fn ($run) => count($run) > 2
            ? PlanDates::rev($run[0]).' to '.PlanDates::rev(end($run))
            : implode(', ', array_map(fn ($r) => PlanDates::rev($r), $run)), $runs));

        return "The revision history has no row for Rev {$list}. If the file lists them, check its history table: they were not read.";
    }

    private function history(array $body, array $keys): array
    {
        $rows = [];
        foreach ($body as $row) {
            $v = $this->values($row, $keys);
            $flat = array_map(fn ($t) => DocxReader::flat($t), $v);
            if (! array_filter($flat) || preg_match('/no revision history/i', implode(' ', $flat))) {
                continue;
            }
            $description = implode("\n", array_filter(array_map(
                fn ($l) => trim(preg_replace('/^[•·▪●◦○■\-–]\s*/u', '', trim($l))),
                preg_split('/\R/', $v['description'] ?? ''),
            ), fn ($l) => $l !== ''));
            $rows[] = [
                'page' => $this->cut($flat['page'] ?? '', 255),
                'date' => $this->cut($flat['date'] ?? '', 255),
                'rev' => $this->cut($flat['rev'] ?? '', 50),
                'description' => $this->cut($description, 5000),
                'revised_by' => $this->cut($flat['revised_by'] ?? '', 255),
            ];
        }

        return $rows;
    }

    /**
     * The signature block: the row with "Dibuat oleh" / "Disetujui oleh", then the names, then the positions
     * (or both in one cell, one per line). Each person goes to the group whose title is over them. The boxes are
     * signed by hand on paper (user_id null) until someone gives them to an account in the editor.
     */
    private function signatures(array $table): ?array
    {
        $roles = ['prepared' => '/dibuat\s+oleh|prepared\s+by/i', 'approved' => '/disetujui\s+oleh|approved\s+by/i'];
        foreach ($table as $r => $row) {
            $groups = [];
            foreach ($row as $cell) {
                foreach ($roles as $group => $pattern) {
                    if (preg_match($pattern, $cell['text'])) {
                        $groups[$group] = ['from' => $cell['col'], 'to' => $cell['col'] + $cell['span'], 'mid' => $cell['col'] + $cell['span'] / 2];
                    }
                }
            }
            if (! $groups) {
                continue;
            }
            $rest = array_values(array_filter(array_slice($table, $r + 1), fn ($row) => array_filter($row, fn ($c) => trim($c['text']) !== '')));
            [$names, $positions] = [$rest[0] ?? [], $rest[1] ?? null];

            $out = ['prepared' => [], 'approved' => []];
            $used = [];
            foreach ($names as $cell) {
                $parts = preg_split('/\R/', trim($cell['text']));
                $name = DocxReader::flat($parts[0] ?? '');
                if ($name === '') {
                    continue;
                }
                $mid = $cell['col'] + $cell['span'] / 2;
                $group = null;
                foreach ($groups as $g => $range) {
                    if ($range['to'] > $range['from'] && $mid >= $range['from'] && $mid < $range['to']) {
                        $group = $g;
                    }
                }
                $group ??= collect($groups)->sortBy(fn ($range) => abs($range['mid'] - $mid))->keys()->first();

                $position = DocxReader::flat(implode(' ', array_slice($parts, 1)));
                if ($positions !== null) {
                    $best = null;
                    foreach ($positions as $i => $p) {
                        $d = abs($p['col'] + $p['span'] / 2 - $mid);
                        if (! isset($used[$i]) && trim($p['text']) !== '' && ($best === null || $d < $best[1])) {
                            $best = [$i, $d];
                        }
                    }
                    if ($best !== null) {
                        $used[$best[0]] = true;
                        $position = DocxReader::flat($positions[$best[0]]['text']);
                    }
                }
                if (count($out[$group]) < ControlPlanRevision::MAX_SIGNERS) {
                    $out[$group][] = ['id' => Str::uuid()->toString(), 'user_id' => null, 'name' => $this->cut($name, 255), 'position' => $this->cut($position, 255)];
                }
            }

            return $out['prepared'] || $out['approved'] ? $out : null;
        }

        return null;
    }

    /**
     * The revision number and its date from "No. Revisi/Tanggal Revisi terakhir : 11 / 15 Oktober 2026"; without
     * it, the highest revision in the history table.
     *
     * @return array{0: ?int, 1: ?string}
     */
    private function revision(string $value, array $history): array
    {
        if (preg_match('/^\s*(?:rev(?:isi)?\.?\s*)?(\d{1,3})\b(.*)$/iu', $value, $m)) {
            return [(int) $m[1], PlanDates::parse($m[2])];
        }
        $revs = array_filter(array_map(fn ($h) => preg_match('/\d{1,3}/', $h['rev'], $m) ? (int) $m[0] : null, $history), 'is_int');
        if (! $revs) {
            return [null, null];
        }
        $rev = max($revs);
        foreach (array_reverse($history) as $h) {
            if (preg_match('/\d{1,3}/', $h['rev'], $m) && (int) $m[0] === $rev) {
                return [$rev, PlanDates::parse($h['date'])];
            }
        }

        return [$rev, null];
    }

    /** The Control Plan Number; else the line above "WORK STATION DOCUMENT"; else the first line that is a code. */
    private function docNo(array $f, array $lines): string
    {
        if (($f['doc_no'] ?? '') !== '') {
            return ReferenceCodes::in($f['doc_no'])[0] ?? $f['doc_no'];
        }
        foreach ($lines as $i => $line) {
            if ($i > 0 && preg_match('/^work\s+station\s+document$/i', $line) && preg_match(ReferenceCodes::EXACT, $lines[$i - 1])) {
                return $lines[$i - 1];
            }
        }
        foreach ($lines as $line) {
            if (preg_match(ReferenceCodes::EXACT, $line)) {
                return $line;
            }
        }

        return '';
    }

    /** The mill is printed on the line above the document number at the top of the page. */
    private function mill(array $lines, string $docNo): string
    {
        $i = $docNo === '' ? false : array_search($docNo, $lines, true);
        if ($i === false || $i === 0) {
            return '';
        }
        $above = $lines[$i - 1];

        return self::hasLabel($above) || preg_match(ReferenceCodes::EXACT, $above) || mb_strlen($above) > 120 ? '' : $above;
    }

    private function phase(array $lines): string
    {
        foreach ($lines as $line) {
            if (preg_match('/'.self::TICKED.'\s*'.self::PHASE_WORDS.'/iu', $line, $m)) {
                $word = mb_strtolower(preg_replace('/\W/', '', $m[1]));

                return match (true) {
                    $word === 'prototype' => 'prototype',
                    str_starts_with($word, 'pre') => 'pre_launch',
                    default => 'production',
                };
            }
        }

        return 'production';
    }

    /** What follows the phase checkboxes on their line; else the first line naming a control plan. */
    private function title(array $lines): string
    {
        $prefix = '/^(?:\s*(?:\[\s*[xX✓✔]?\s*\]|[☐☒☑■□×✓✔])?\s*'.self::PHASE_WORDS.'\b)+/iu';
        foreach ($lines as $line) {
            if (preg_match($prefix, $line, $m) && preg_match_all('/'.self::PHASE_WORDS.'/iu', $m[0]) >= 2) {
                $rest = trim(mb_substr($line, mb_strlen($m[0])));
                if ($rest !== '' && ! preg_match('/^\[.*\]$/', $rest)) {
                    return $rest;
                }
            }
        }
        foreach ($lines as $line) {
            if (preg_match('/control\s+plan/i', $line) && ! self::hasLabel($line) && mb_strlen($line) <= 200 && ! preg_match('/^\[.*\]$/', $line)) {
                return $line;
            }
        }

        return '';
    }

    /** Notes under the table start with asterisks: "* Depends on the article". */
    private function notes(array $lines): string
    {
        $notes = array_values(array_unique(array_filter($lines, fn ($l) => preg_match('/^\*+\s*\S/u', $l) === 1)));

        return implode("\n", $notes);
    }

    /** "Pak Dedi 01/02/2020" → ["Pak Dedi", "01/02/2020"]. */
    private function splitDate(string $value): array
    {
        if (preg_match(self::DATE_AT_END, $value, $m) && PlanDates::parse($m[2]) !== null) {
            return [trim($m[1]), $m[2]];
        }

        return [$value, ''];
    }

    private function cut(string $text, int $max): string
    {
        if (mb_strlen($text) <= $max) {
            return $text;
        }
        $this->cut = true;

        return mb_substr($text, 0, $max);
    }
}
