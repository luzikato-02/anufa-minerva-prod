<?php

namespace App\ControlPlans\Import;

use RuntimeException;
use Smalot\PdfParser\Parser;

/**
 * Reads a text PDF (one saved from Word or exported here) from the position of each piece of text. A PDF has no
 * tables, only text drawn at points, so the tables are rebuilt:
 *
 * - columns: text in a table cell starts at the cell's left edge, so the left edges of the body text bunch up,
 *   one bunch per column; the header labels (centred, often wrapped) then name the columns they sit over.
 * - rows: every characteristic has exactly one sample size and every history row one revision number, so each
 *   new value in that column starts a row. Cells are top-aligned (a row's text starts on its first line) or
 *   centred (shorter cells sit lower than the row's top), and text is put in its row accordingly.
 *
 * It works best on PDFs laid out like the W-WSD document; the import preview shows what came out.
 */
class PdfReader
{
    /** Points within which two pieces of text count as on the same line, or starting at the same left edge. */
    private const SAME_LINE = 2.0;

    private const SAME_COLUMN = 6.0;

    /** Font size assumed when nothing tells it otherwise; plan tables print at 7–8 pt. */
    private const DEFAULT_SIZE = 7.5;

    public static function read(string $path): ImportedDocument
    {
        try {
            $pdf = (new Parser)->parseFile($path);
        } catch (\Throwable $e) {
            throw new RuntimeException('Not a PDF file, or a damaged one.', 0, $e);
        }

        $lines = [];
        $tables = [];
        $hasText = false;
        foreach ($pdf->getPages() as $page) {
            $chunks = [];
            foreach ($page->getDataTm() as [$tm, $text]) {
                $chunks[] = ['x' => (float) $tm[4], 'y' => (float) $tm[5], 'text' => (string) $text];
            }
            $pageLines = self::lines($chunks);
            $hasText = $hasText || $pageLines !== [];
            array_push($lines, ...self::readingLines($pageLines));
            array_push($tables, ...self::tables($pageLines));
        }
        if (! $hasText) {
            throw new RuntimeException('This PDF has no text in it, so it is probably a scan. Import the Word file instead, or type the plan in.');
        }

        return new ImportedDocument('pdf', $lines, $tables, [
            'Read from a PDF: the table was rebuilt from where its text sits on the page. Check the steps and lines against the document, or import the Word file if you have it.',
        ]);
    }

    /**
     * Text grouped into visual lines, top of the page first, each line's pieces left to right. A piece that starts
     * with a space continues the one before it (PDFs often draw one cell's text in several pieces).
     *
     * @return list<array{y: float, chunks: list<array{x: float, y: float, text: string}>}>
     */
    private static function lines(array $chunks): array
    {
        usort($chunks, fn ($a, $b) => [$b['y'], $a['x']] <=> [$a['y'], $b['x']]);
        $lines = [];
        foreach ($chunks as $c) {
            $last = array_key_last($lines);
            if ($last !== null && abs($lines[$last]['y'] - $c['y']) <= self::SAME_LINE) {
                $lines[$last]['chunks'][] = $c;
            } else {
                $lines[] = ['y' => $c['y'], 'chunks' => [$c]];
            }
        }

        $out = [];
        foreach ($lines as $line) {
            usort($line['chunks'], fn ($a, $b) => $a['x'] <=> $b['x']);
            $glued = [];
            foreach ($line['chunks'] as $c) {
                if (trim($c['text']) === '') {
                    continue;
                }
                $prev = array_key_last($glued);
                if ($prev !== null && preg_match('/^\s/u', $c['text'])) {
                    $glued[$prev]['text'] .= $c['text'];
                } else {
                    $glued[] = $c;
                }
            }
            if ($glued) {
                $out[] = ['y' => $line['y'], 'chunks' => array_map(fn ($c) => ['text' => DocxReader::flat($c['text'])] + $c, $glued)];
            }
        }

        return $out;
    }

    /**
     * The page's lines as text for finding labelled fields. A value that wraps onto the next line in its box
     * ("Organization/Plant: PT. Indo Kordsa" over "Tbk/TCF") is put back after its label.
     *
     * @return list<string>
     */
    private static function readingLines(array $lines): array
    {
        $out = [];
        $prev = null;
        foreach ($lines as $line) {
            $labelled = array_filter($line['chunks'], fn ($c) => PlanImport::hasLabel($c['text']));
            if ($prev !== null && ! $labelled && 4 * self::DEFAULT_SIZE >= $prev['y'] - $line['y']) {
                $rest = [];
                foreach ($line['chunks'] as $c) {
                    $above = null;
                    foreach ($out[$prev['i']]['chunks'] as $j => $p) {
                        if (abs($p['x'] - $c['x']) <= self::SAME_LINE && PlanImport::hasLabel($p['text'])) {
                            $above = $j;
                        }
                    }
                    if ($above === null) {
                        $rest[] = $c;
                    } else {
                        $out[$prev['i']]['chunks'][$above]['text'] .= ' '.$c['text'];
                    }
                }
                if (! $rest) {
                    $prev['y'] = $line['y'];

                    continue;
                }
                $line['chunks'] = $rest;
            }
            $out[] = $line;
            $prev = ['i' => array_key_last($out), 'y' => $line['y']];
        }

        return array_map(fn ($l) => implode(' ', array_column($l['chunks'], 'text')), $out);
    }

    /** The characteristics table, the revision history table and the signature block found on one page. */
    private static function tables(array $lines): array
    {
        $tables = [];
        foreach ([
            // Which header holds the table, and which column has exactly one value per row.
            ['anchor' => '/\breaction\b/i', 'rows' => '/\bsize\b/i'],
            ['anchor' => '/\brevised\s+by\b|\brevision\s+no\b/i', 'rows' => '/\brevision\s+no\b|\brev\b/i'],
        ] as $kind) {
            $header = self::headerZone($lines, $kind['anchor']);
            if ($header === null) {
                continue;
            }
            [$from, $to] = $header;
            $body = [];
            for ($i = $to + 1; $i < count($lines); $i++) {
                if (self::endsTable(implode(' ', array_column($lines[$i]['chunks'], 'text')))) {
                    break;
                }
                $body[] = $lines[$i];
            }
            $grid = self::grid(array_slice($lines, $from, $to - $from + 1), $body, $kind['rows']);
            if ($grid !== null) {
                $tables[] = $grid;
            }
        }
        if (($signatures = self::signatures($lines)) !== null) {
            $tables[] = $signatures;
        }

        return $tables;
    }

    /** The first and last line of the table header around the line matching $anchor: header words only. */
    private static function headerZone(array $lines, string $anchor): ?array
    {
        $isHeader = fn (array $line) => PlanImport::isHeaderText(implode(' ', array_column($line['chunks'], 'text')));
        foreach ($lines as $i => $line) {
            if (! preg_match($anchor, implode(' ', array_column($line['chunks'], 'text'))) || ! $isHeader($line)) {
                continue;
            }
            $from = $i;
            while ($from > 0 && $isHeader($lines[$from - 1])) {
                $from--;
            }
            $to = $i;
            while ($to + 1 < count($lines) && $isHeader($lines[$to + 1])) {
                $to++;
            }

            return [$from, $to];
        }

        return null;
    }

    /** Where a table's body stops: the notes, the signature block, or the next table's header. */
    private static function endsTable(string $text): bool
    {
        return preg_match('/^\*|^(catatan|notes?)\b|dibuat\s+oleh|disetujui\s+oleh|prepared\s+by|approved\s+by/iu', $text) === 1
            || (PlanImport::isHeaderText($text) && preg_match('/\breaction\b|\brevised\s+by\b/i', $text) === 1);
    }

    /** @return list<list<array{text: string, col: float, span: float}>>|null header row, then one row per body row */
    private static function grid(array $headerLines, array $bodyLines, string $rowColumn): ?array
    {
        $body = array_merge(...array_map(fn ($l) => $l['chunks'], $bodyLines ?: [['chunks' => []]]));
        if (! $body) {
            return null;
        }
        $size = self::fontSize($body);
        $charWidth = 0.55 * $size;

        // Columns: left edges of the body text, bunched.
        $xs = array_column($body, 'x');
        sort($xs);
        $starts = [];
        foreach ($xs as $x) {
            if (! $starts || $x - end($starts)['last'] > self::SAME_COLUMN) {
                $starts[] = ['x' => $x, 'last' => $x];
            } else {
                $starts[array_key_last($starts)]['last'] = $x;
            }
        }
        $starts = array_column($starts, 'x');
        $columnOf = function (float $x) use (&$starts): int {
            $col = 0;
            foreach ($starts as $i => $s) {
                if ($x >= $s - self::SAME_LINE) {
                    $col = $i;
                }
            }

            return $col;
        };

        // Header labels name the column their middle sits over.
        $labels = array_fill(0, count($starts), '');
        foreach ($headerLines as $line) {
            foreach ($line['chunks'] as $c) {
                $col = $columnOf($c['x'] + mb_strlen($c['text']) * $charWidth / 2);
                $labels[$col] = trim($labels[$col].' '.$c['text']);
            }
        }

        // A column without a label: beside Process Name it is the step group under the same label (the two
        // share one header cell); otherwise it is part of the nearest column, e.g. an indented bullet list.
        for ($changed = true; $changed;) {
            $changed = false;
            foreach ($labels as $i => $label) {
                if ($label !== '' || count($starts) < 2) {
                    continue;
                }
                foreach ([$i - 1, $i + 1] as $n) {
                    if (isset($labels[$n]) && preg_match('/process\s*name|operation/i', $labels[$n])) {
                        $labels[$i] = $labels[$n];
                        $changed = true;

                        continue 3;
                    }
                }
                $left = $i > 0 ? $starts[$i] - $starts[$i - 1] : INF;
                $right = $i + 1 < count($starts) ? $starts[$i + 1] - $starts[$i] : INF;
                $into = $left <= $right ? $i - 1 : $i + 1;
                if ($into > $i) {
                    // The column to the right takes over this one's left edge.
                    $starts[$into] = $starts[$i];
                }
                array_splice($starts, $i, 1);
                array_splice($labels, $i, 1);
                $changed = true;

                continue 2;
            }
        }

        // Rows start where the row column has a value.
        $key = 0;
        foreach ($labels as $i => $label) {
            if (preg_match($rowColumn, $label)) {
                $key = $i;
                break;
            }
        }
        $tops = [];
        foreach ($body as $c) {
            if ($columnOf($c['x']) === $key && (! $tops || end($tops) - $c['y'] > self::SAME_LINE)) {
                $tops[] = $c['y'];
            }
        }
        if (! $tops) {
            return null;
        }
        rsort($tops);

        // Each cell's text as a block of wrapped lines. When cells are top-aligned every block starts on a row's
        // first line; a block starting anywhere else means the cells are centred, and the row value is centred too.
        $blocks = [];
        foreach ($body as $c) {
            $blocks[$columnOf($c['x'])][] = $c;
        }
        $cellBlocks = [];
        foreach ($blocks as $col => $chunks) {
            usort($chunks, fn ($a, $b) => $b['y'] <=> $a['y']);
            foreach ($chunks as $c) {
                $last = array_key_last($cellBlocks);
                if ($last !== null && $cellBlocks[$last]['col'] === $col && end($cellBlocks[$last]['chunks'])['y'] - $c['y'] <= 1.8 * $size) {
                    $cellBlocks[$last]['chunks'][] = $c;
                } else {
                    $cellBlocks[] = ['col' => $col, 'chunks' => [$c]];
                }
            }
        }
        $onTop = fn (float $y) => (bool) array_filter($tops, fn ($t) => abs($t - $y) <= self::SAME_LINE);
        $centred = (bool) array_filter($cellBlocks, fn ($b) => ! $onTop($b['chunks'][0]['y']));

        $cells = array_fill(0, count($tops), array_fill(0, count($starts), []));
        if ($centred) {
            foreach ($cellBlocks as $b) {
                $mid = ($b['chunks'][0]['y'] + end($b['chunks'])['y']) / 2;
                $row = 0;
                foreach ($tops as $i => $top) {
                    if (abs($mid - $top) < abs($mid - $tops[$row])) {
                        $row = $i;
                    }
                }
                array_push($cells[$row][$b['col']], ...$b['chunks']);
            }
        } else {
            foreach ($body as $c) {
                $row = 0;
                foreach ($tops as $i => $top) {
                    if ($c['y'] <= $top + self::SAME_LINE) {
                        $row = $i;
                    }
                }
                $cells[$row][$columnOf($c['x'])][] = $c;
            }
        }

        $grid = [array_map(fn ($label, $i) => ['text' => $label, 'col' => (float) $i, 'span' => 1.0], $labels, array_keys($labels))];
        foreach ($cells as $row) {
            $grid[] = array_map(fn ($chunks, $i) => ['text' => self::cellText($chunks), 'col' => (float) $i, 'span' => 1.0], $row, array_keys($row));
        }

        return $grid;
    }

    /** A cell's pieces as text: pieces on one line joined by spaces, lines by "\n". */
    private static function cellText(array $chunks): string
    {
        $lines = [];
        foreach (self::lines($chunks) as $line) {
            $lines[] = implode(' ', array_column($line['chunks'], 'text'));
        }

        return implode("\n", $lines);
    }

    /**
     * The "Dibuat oleh" / "Disetujui oleh" block: the line with the group titles, then the names and positions
     * under them. Text in a signature box is centred, so each cell carries its middle (span 0).
     */
    private static function signatures(array $lines): ?array
    {
        $middle = fn (array $c) => ['text' => $c['text'], 'col' => $c['x'] + mb_strlen($c['text']) * 0.55 * self::DEFAULT_SIZE / 2, 'span' => 0.0];
        foreach ($lines as $i => $line) {
            $text = implode(' ', array_column($line['chunks'], 'text'));
            if (! preg_match('/dibuat\s+oleh|disetujui\s+oleh|prepared\s+by|approved\s+by/i', $text)) {
                continue;
            }
            $rows = [array_map($middle, $line['chunks'])];
            for ($j = $i + 1; $j < count($lines) && count($rows) < 3 && $line['y'] - $lines[$j]['y'] < 150; $j++) {
                $texts = array_column($lines[$j]['chunks'], 'text');
                // The date under a signature drawn in the app is not a name.
                if (array_filter($texts, fn ($t) => \App\ControlPlans\PlanDates::parse($t) === null)) {
                    $rows[] = array_map($middle, $lines[$j]['chunks']);
                }
            }

            return $rows;
        }

        return null;
    }

    /** The body's font size, from how far apart the lines of wrapped cells are (about 1.5 × the size). */
    private static function fontSize(array $chunks): float
    {
        $gaps = [];
        foreach ($chunks as $a) {
            foreach ($chunks as $b) {
                $gap = $a['y'] - $b['y'];
                if (abs($a['x'] - $b['x']) <= 1 && $gap > 4 && $gap < 20) {
                    $gaps[] = $gap;
                }
            }
        }
        if (! $gaps) {
            return self::DEFAULT_SIZE;
        }
        sort($gaps);

        return $gaps[intdiv(count($gaps), 2)] / 1.5;
    }
}
