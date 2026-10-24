<?php

namespace App\ControlPlans;

use PhpOffice\PhpWord\Element\Section;
use PhpOffice\PhpWord\Element\Table;
use PhpOffice\PhpWord\IOFactory;
use PhpOffice\PhpWord\PhpWord;
use PhpOffice\PhpWord\Settings;
use PhpOffice\PhpWord\Shared\Converter;

/** Writes a PrintSheet as a Word document in the W-WSD layout: A4 landscape, revision history page, then the plan. */
class WordExport
{
    private const FONT = 'Arial';

    private const CELL = ['borderSize' => 4, 'borderColor' => '1F1F1F', 'valign' => 'top'];

    private const HEAD_CELL = self::CELL + ['bgColor' => 'F2F2F2', 'valign' => 'center'];

    /** Widths of the 15 characteristics columns, in twips; they add up to the A4 landscape text width. */
    private const MAIN_WIDTHS = [560, 420, 1300, 1100, 380, 1100, 900, 620, 1500, 1200, 520, 900, 1250, 700, 1250];

    /** Saves the document to a temporary file and returns its path. */
    public static function save(array $s): string
    {
        // PhpWord writes text into the XML as it is unless told to escape it, and a plan's text has & and <
        // ("TCF1 & TCF2", "< 100 splices"): without this Word reports the file as corrupt.
        Settings::setOutputEscapingEnabled(true);
        $word = new PhpWord;
        $word->setDefaultFontName(self::FONT);
        $word->setDefaultFontSize(8);

        foreach ([1, 2] as $page) {
            $section = $word->addSection([
                'orientation' => 'landscape',
                'pageSizeW' => Converter::cmToTwip(29.7),
                'pageSizeH' => Converter::cmToTwip(21),
                'marginTop' => Converter::cmToTwip(1),
                'marginBottom' => Converter::cmToTwip(1),
                'marginLeft' => Converter::cmToTwip(1),
                'marginRight' => Converter::cmToTwip(1),
            ]);
            if ($s['watermark']) {
                $section->addHeader()->addText('DRAFT · not for the shop floor', ['bold' => true, 'color' => 'B3261E', 'size' => 10], ['alignment' => 'right']);
            }
            self::pageHeader($section, $s, $page);
            $page === 1 ? self::history($section, $s) : self::plan($section, $s);
        }

        $path = tempnam(sys_get_temp_dir(), 'cp').'.docx';
        IOFactory::createWriter($word, 'Word2007')->save($path);

        return $path;
    }

    private static function pageHeader(Section $section, array $s, int $page): void
    {
        if ($s['logo_file']) {
            $section->addImage($s['logo_file'], ['height' => Converter::cmToPoint(1.2), 'spaceAfter' => 60]);
        }
        $section->addText($s['mill']);
        $section->addText($s['doc_no']);
        $section->addText('WORK STATION DOCUMENT', ['bold' => true, 'size' => 11], ['alignment' => 'center', 'spaceAfter' => 120]);

        $rows = [
            ['Referensi SP', $s['sp_ref'], 'Tanggal diterbitkan', $s['issued']],
            ['Tanggal Diterbitkan SP', $s['sp_date'], 'No. Revisi/Tanggal Revisi terakhir', $s['rev_label']],
            ['', '', 'Tanggal Review berikutnya', $s['next_review']],
            ['', '', 'Halaman', $page.' dari '.PrintSheet::PAGES],
        ];
        $table = $section->addTable(['cellMargin' => 20]);
        foreach ($rows as $i => $r) {
            // The last row carries the rule that separates the header block from the page body.
            $cell = $i === count($rows) - 1 ? ['borderBottomSize' => 6, 'borderBottomColor' => '1F1F1F'] : [];
            $table->addRow();
            $table->addCell(2800, $cell)->addText($r[0]);
            $table->addCell(200, $cell)->addText($r[0] !== '' ? ':' : '');
            $table->addCell(3400, $cell)->addText($r[1]);
            $table->addCell(4000, $cell)->addText($r[2]);
            $table->addCell(200, $cell)->addText(':');
            $table->addCell(5000, $cell)->addText($r[3]);
        }
        $section->addTextBreak(1, ['size' => 4]);
    }

    private static function history(Section $section, array $s): void
    {
        $section->addText('REVISION HISTORY', ['bold' => true, 'size' => 10], ['alignment' => 'center', 'spaceBefore' => 200, 'spaceAfter' => 120]);
        $table = self::grid($section);
        $widths = [1100, 2300, 1400, 8000, 2800];
        $table->addRow(null, ['tblHeader' => true]);
        foreach (['Page', 'Date of Revision', 'Revision No', 'Description', 'Revised by'] as $i => $label) {
            self::headCell($table, $widths[$i], $label);
        }
        foreach ($s['history'] as $h) {
            $table->addRow(null, ['cantSplit' => true]);
            $table->addCell($widths[0], self::CELL)->addText($h['page']);
            $table->addCell($widths[1], self::CELL)->addText($h['date']);
            $table->addCell($widths[2], self::CELL)->addText($h['rev']);
            $desc = $table->addCell($widths[3], self::CELL);
            if (count($h['description']) > 1) {
                foreach ($h['description'] as $d) {
                    $desc->addListItem($d, 0, null, ['listType' => \PhpOffice\PhpWord\Style\ListItem::TYPE_BULLET_FILLED]);
                }
            } else {
                $desc->addText($h['description'][0] ?? '');
            }
            $table->addCell($widths[4], self::CELL)->addText($h['revised_by']);
        }
        if (! $s['history']) {
            $table->addRow();
            $table->addCell(array_sum($widths), self::CELL + ['gridSpan' => 5])->addText('No revision history yet.', ['italic' => true, 'color' => '6B6F73']);
        }
    }

    private static function plan(Section $section, array $s): void
    {
        $info = $s['info'];
        $phases = collect($s['phases'])->map(fn ($label, $key) => '['.(($info['phase'] ?? '') === $key ? 'X' : ' ').'] '.$label)->implode('    ');
        $head = $section->addTable();
        $head->addRow();
        $head->addCell(5200, ['valign' => 'center'])->addText($phases);
        $head->addCell(5200, ['valign' => 'center'])->addText($s['title'], ['bold' => true, 'size' => 10], ['alignment' => 'center']);
        $head->addCell(5200);

        $field = fn (string $label, string $value) => [$label, $value];
        $approval = fn (string $name, string $date) => trim(($info[$name] ?? '').' '.($info[$date] ?? ''));
        $planApproval = in_array($s['status'], ['released', 'superseded'], true) ? $s['release_date'] : '';
        $rows = [
            [[2, $field('Control Plan Number: ', $s['doc_no'])], [1, $field('Key Contact/Phone: ', $info['key_contact'] ?? '')], [2, $field('Date (Orig.): ', $s['issued'])], [1, $field('Date (Rev.): ', $s['release_date'])]],
            [[2, $field('Part Number / Latest Change Level: ', $info['part_number'] ?? '')], [1, $field('Core Team: ', $info['core_team'] ?? '')], [1, $field('', '')], [2, $field("Customer Engineering Approval/Date (If Req'd.) ", $approval('cust_eng_name', 'cust_eng_date'))]],
            [[2, $field('Part Name / Description: ', $info['part_name'] ?? '')], [1, $field('Organization/Plan Approval/Date: ', $planApproval)], [1, $field('', '')], [2, $field("Customer Quality Approval/Date (If Req'd.) ", $approval('cust_qual_name', 'cust_qual_date'))]],
            [[1, $field('Organization/Plant: ', $info['org_plant'] ?? '')], [1, $field('Organization Code: ', $info['org_code'] ?? '')], [1, $field("Other Approval/Date (If Req'd.) ", $approval('other1_name', 'other1_date'))], [1, $field('', '')], [2, $field("Other Approval (If Req'd.) ", $approval('other2_name', 'other2_date'))]],
        ];
        $unit = 2600;
        $infoTable = self::grid($section);
        foreach ($rows as $row) {
            $infoTable->addRow();
            foreach ($row as [$span, [$label, $value]]) {
                $run = $infoTable->addCell($unit * $span, self::CELL + ($span > 1 ? ['gridSpan' => $span] : []))->addTextRun();
                $run->addText($label, ['bold' => true]);
                $run->addText($value);
            }
        }

        $section->addTextBreak(1, ['size' => 4]);
        $w = self::MAIN_WIDTHS;
        $table = self::grid($section);
        $font = ['size' => 7];
        $th = fn (int $width, string $label, array $extra = []) => self::headCell($table, $width, $label, $extra, $font);

        $table->addRow(null, ['tblHeader' => true]);
        $th($w[0], 'Process No.', ['vMerge' => 'restart']);
        $th($w[1] + $w[2], 'Process Name', ['vMerge' => 'restart', 'gridSpan' => 2]);
        $th($w[3], 'Machine, Device, Jig, Tools for MFG', ['vMerge' => 'restart']);
        $th($w[4] + $w[5] + $w[6], 'Characteristic', ['gridSpan' => 3]);
        $th($w[7], 'Special Char. Class', ['vMerge' => 'restart']);
        $th(array_sum(array_slice($w, 8, 6)), 'Methods', ['gridSpan' => 6]);
        $th($w[14], 'Reaction Plan', ['vMerge' => 'restart']);

        $table->addRow(null, ['tblHeader' => true]);
        $table->addCell($w[0], self::HEAD_CELL + ['vMerge' => 'continue']);
        $table->addCell($w[1] + $w[2], self::HEAD_CELL + ['vMerge' => 'continue', 'gridSpan' => 2]);
        $table->addCell($w[3], self::HEAD_CELL + ['vMerge' => 'continue']);
        $th($w[4], 'No.', ['vMerge' => 'restart']);
        $th($w[5], 'Product', ['vMerge' => 'restart']);
        $th($w[6], 'Process', ['vMerge' => 'restart']);
        $table->addCell($w[7], self::HEAD_CELL + ['vMerge' => 'continue']);
        $th($w[8], 'Product/Process Specification/ Tolerance', ['vMerge' => 'restart']);
        $th($w[9], 'Evaluation/ Measurement technique', ['vMerge' => 'restart']);
        $th($w[10] + $w[11], 'Sample', ['gridSpan' => 2]);
        $th($w[12], 'Control Method', ['vMerge' => 'restart']);
        $th($w[13], 'PIC', ['vMerge' => 'restart']);
        $table->addCell($w[14], self::HEAD_CELL + ['vMerge' => 'continue']);

        $table->addRow(null, ['tblHeader' => true]);
        $table->addCell($w[0], self::HEAD_CELL + ['vMerge' => 'continue']);
        $table->addCell($w[1] + $w[2], self::HEAD_CELL + ['vMerge' => 'continue', 'gridSpan' => 2]);
        $table->addCell($w[3], self::HEAD_CELL + ['vMerge' => 'continue']);
        foreach ([4, 5, 6, 7, 8, 9] as $i) {
            $table->addCell($w[$i], self::HEAD_CELL + ['vMerge' => 'continue']);
        }
        $th($w[10], 'Size');
        $th($w[11], 'Freq');
        foreach ([12, 13, 14] as $i) {
            $table->addCell($w[$i], self::HEAD_CELL + ['vMerge' => 'continue']);
        }

        foreach ($s['rows'] as $row) {
            $table->addRow(null, ['cantSplit' => true]);
            foreach ($row as $i => $cell) {
                $center = in_array($i, [0, 4, 7, 10], true) ? ['alignment' => 'center'] : [];
                if (! empty($cell['covered'])) {
                    $table->addCell($w[$i], self::CELL + ['vMerge' => 'continue']);

                    continue;
                }
                $style = self::CELL + (($cell['rowspan'] ?? 1) > 1 ? ['vMerge' => 'restart'] : []);
                $table->addCell($w[$i], $style)->addText($cell['text'], $font, $center);
            }
        }

        self::footer($section, $s);
    }

    /** The notes under the characteristics table, then the "Dibuat oleh" / "Disetujui oleh" signature boxes. */
    private static function footer(Section $section, array $s): void
    {
        foreach ($s['notes'] as $i => $note) {
            $section->addText($note, ['size' => 7], ['spaceBefore' => $i === 0 ? 80 : 0, 'spaceAfter' => 0]);
        }
        $groups = array_filter(['Dibuat oleh' => $s['signatures']['prepared'], 'Disetujui oleh' => $s['signatures']['approved']]);
        if (! $groups) {
            return;
        }

        $section->addTextBreak(1, ['size' => 6]);
        $box = 2400;
        $gap = 340;
        $sign = $section->addTable(['cellMargin' => 40, 'alignment' => 'right']);
        $none = ['borderSize' => 0, 'borderColor' => 'FFFFFF'];
        $rows = [
            'role' => ['height' => null, 'cell' => self::HEAD_CELL],
            'space' => ['height' => Converter::cmToTwip(1.8), 'cell' => self::CELL],
            'who' => ['height' => null, 'cell' => self::CELL + ['borderBottomSize' => 0, 'borderBottomColor' => 'FFFFFF']],
            'pos' => ['height' => null, 'cell' => self::CELL + ['borderTopSize' => 0, 'borderTopColor' => 'FFFFFF']],
        ];
        foreach ($rows as $part => $row) {
            $sign->addRow($row['height'], ['cantSplit' => true]);
            $first = true;
            foreach ($groups as $label => $people) {
                if (! $first) {
                    $sign->addCell($gap, $none);
                }
                $first = false;
                if ($part === 'role') {
                    $sign->addCell($box * count($people), $row['cell'] + ['gridSpan' => count($people)])
                        ->addText($label, ['bold' => true], ['alignment' => 'center']);

                    continue;
                }
                foreach ($people as $p) {
                    $cell = $sign->addCell($box, $row['cell'] + ($part === 'space' ? ['valign' => 'center'] : []));
                    if ($part !== 'space') {
                        $cell->addText($part === 'who' ? $p['name'] : $p['position'], $part === 'who' ? ['bold' => true] : ['size' => 7], ['alignment' => 'center']);
                    } elseif ($sig = $s['signed'][$p['id']] ?? null) {
                        // At most 1.3 cm tall and 4 cm wide, to stay inside the box.
                        $png = base64_decode(substr($sig['image'], strpos($sig['image'], ',') + 1));
                        [$w, $h] = getimagesizefromstring($png);
                        $height = min(Converter::cmToPoint(1.3), Converter::cmToPoint(4) * $h / $w);
                        $cell->addImage($png, ['height' => $height, 'width' => $height * $w / $h, 'alignment' => 'center']);
                        $cell->addText($sig['at'], ['size' => 6, 'color' => '555555'], ['alignment' => 'center', 'spaceAfter' => 0]);
                    }
                }
            }
        }
    }

    private static function grid(Section $section): Table
    {
        return $section->addTable(['borderSize' => 4, 'borderColor' => '1F1F1F', 'cellMargin' => 40, 'width' => 100 * 50, 'unit' => 'pct']);
    }

    private static function headCell(Table $table, int $width, string $label, array $extra = [], array $font = []): void
    {
        $table->addCell($width, self::HEAD_CELL + $extra)->addText($label, ['bold' => true] + $font, ['alignment' => 'center']);
    }
}
