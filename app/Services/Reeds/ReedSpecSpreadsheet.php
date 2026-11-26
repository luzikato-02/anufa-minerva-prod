<?php

namespace App\Services\Reeds;

use App\Models\ReedSpec;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;

/**
 * The reed spec import: an .xlsx template people fill in, and the reader that turns a filled-in sheet
 * (or a CSV) into specs. Rows are matched on code: a new code creates a spec, an existing one is updated,
 * and a blank cell leaves that field as it was. The whole file is checked first and nothing is saved
 * unless every row is valid.
 */
class ReedSpecSpreadsheet
{
    /** Column heading => field. The heading is what the template shows; matching ignores case, spaces and "*". */
    public const COLUMNS = [
        'Code *' => 'code',
        'Dents per 10 cm' => 'dents_per_10cm',
        'Overall width' => 'width_mm',
        'Total hole' => 'total_hole',
        'Height' => 'height_mm',
        'Type' => 'reed_type',
        'Wire profile' => 'wire_profile',
        'Wire thickness' => 'wire_thickness_mm',
        'Wire material' => 'wire_material',
        'Min spare stock' => 'min_stock',
        'Notes' => 'notes',
    ];

    private const EXAMPLE = ['RD-90-1600', '90', '1600 mm', '14400', '120 mm', 'Profile (air-jet)', 'Flat', '0.30 mm', 'Stainless', '3', 'Example row: delete before importing'];

    public const MAX_ROWS = 2000;

    public function template(): Spreadsheet
    {
        $book = new Spreadsheet;
        $sheet = $book->getActiveSheet()->setTitle('Specs');
        $headings = array_keys(self::COLUMNS);
        $last = Coordinate::stringFromColumnIndex(count($headings));

        $sheet->fromArray($headings, null, 'A1');
        $sheet->fromArray(self::EXAMPLE, null, 'A2');
        $sheet->getStyle("A1:{$last}1")->getFont()->setBold(true);
        $sheet->getStyle("A2:{$last}2")->getFont()->setItalic(true)->getColor()->setRGB('808080');
        // Text format so Excel keeps "90/10" or "1-2" as typed instead of turning them into dates.
        $sheet->getStyle("A1:{$last}".(self::MAX_ROWS + 1))->getNumberFormat()->setFormatCode(NumberFormat::FORMAT_TEXT);
        $sheet->freezePane('A2');
        foreach (range(1, count($headings)) as $i) {
            $sheet->getColumnDimensionByColumn($i)->setWidth($i === count($headings) ? 40 : 18);
        }

        $help = $book->createSheet()->setTitle('How to use');
        $help->fromArray([
            ['How to import reed specs'],
            [''],
            ['1. Fill in one row per spec on the "Specs" sheet. The grey example row is ignored on import; overwrite or delete it.'],
            ['2. Only "Code" is required. Every other column is free text: write it however you like, e.g. "90", "1600 mm", "Profile".'],
            ['3. "Min spare stock" must be a whole number (blank means 0). The inventory warns when usable stock falls below it.'],
            ['4. A code that already exists updates that spec. Blank cells leave its current values unchanged.'],
            ['5. Save the file and upload it on Reed Settings > Specs > Import. Nothing is saved if any row has a problem; the errors list the row numbers to fix.'],
            [''],
            ['Columns'],
            ...array_map(fn ($h) => [$h], $headings),
        ], null, 'A1');
        $help->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $help->getStyle('A9')->getFont()->setBold(true);
        $help->getColumnDimension('A')->setWidth(110);
        $book->setActiveSheetIndex(0);

        return $book;
    }

    /**
     * @return array{created: int, updated: int, errors: list<string>}
     */
    public function import(UploadedFile $file): array
    {
        try {
            $book = IOFactory::load($file->getRealPath());
        } catch (\Throwable) {
            return $this->failed(['The file could not be read. Upload the .xlsx template, or a .csv with the same columns.']);
        }
        $sheet = $book->getSheetByName('Specs') ?? $book->getSheet(0);
        $rows = $sheet->toArray(null, true, false, false);

        $header = array_shift($rows) ?? [];
        $fieldAt = $this->mapHeader($header);
        if (! in_array('code', $fieldAt, true)) {
            return $this->failed(['No "Code" column found in the first row. Start from the template.']);
        }

        $errors = [];
        $parsed = [];
        $seen = [];
        foreach ($rows as $i => $cells) {
            $line = $i + 2; // spreadsheet row number, after the header
            $values = [];
            foreach ($fieldAt as $col => $field) {
                $values[$field] = $this->text($cells[$col] ?? null);
            }
            if (count(array_filter($values, fn ($v) => $v !== null)) === 0 || ($values['notes'] ?? null) === self::EXAMPLE[10]) {
                continue; // blank row, or the template's example left in
            }
            if (count($parsed) >= self::MAX_ROWS) {
                $errors[] = 'More than '.self::MAX_ROWS.' rows; split the file.';
                break;
            }

            $code = $values['code'] ?? null;
            if ($code === null) {
                $errors[] = "Row {$line}: Code is empty.";

                continue;
            }
            if (mb_strlen($code) > 50) {
                $errors[] = "Row {$line}: Code is longer than 50 characters.";
            }
            $key = mb_strtolower($code);
            if (isset($seen[$key])) {
                $errors[] = "Row {$line}: Code {$code} is also on row {$seen[$key]}.";
            }
            $seen[$key] = $line;

            if (isset($values['min_stock'])) {
                if (! preg_match('/^\d{1,5}$/', $values['min_stock'])) {
                    $errors[] = "Row {$line}: Min spare stock must be a whole number, not \"{$values['min_stock']}\".";
                } else {
                    $values['min_stock'] = (int) $values['min_stock'];
                }
            }
            foreach ($values as $field => $v) {
                if (is_string($v) && $field !== 'code' && mb_strlen($v) > 255) {
                    $errors[] = "Row {$line}: ".array_search($field, self::COLUMNS, true).' is longer than 255 characters.';
                }
            }

            $parsed[] = array_filter($values, fn ($v) => $v !== null);
        }

        if (! $errors && ! $parsed) {
            $errors[] = 'The file has no spec rows.';
        }
        if ($errors) {
            return $this->failed($errors);
        }

        $created = 0;
        $updated = 0;
        DB::transaction(function () use ($parsed, &$created, &$updated) {
            $existing = ReedSpec::whereIn(DB::raw('lower(code)'), array_map(fn ($r) => mb_strtolower($r['code']), $parsed))
                ->get()->keyBy(fn (ReedSpec $s) => mb_strtolower($s->code));
            foreach ($parsed as $values) {
                $spec = $existing->get(mb_strtolower($values['code']));
                if ($spec) {
                    unset($values['code']); // keep the stored spelling
                    $spec->update($values);
                    $updated++;
                } else {
                    ReedSpec::create($values + ['min_stock' => 0]);
                    $created++;
                }
            }
        });

        return ['created' => $created, 'updated' => $updated, 'errors' => []];
    }

    /** @return array<int, string> column index => field */
    private function mapHeader(array $header): array
    {
        $byKey = [];
        foreach (self::COLUMNS as $heading => $field) {
            $byKey[$this->key($heading)] = $field;
            $byKey[$this->key($field)] = $field;
        }
        $byKey[$this->key('Working width')] = 'total_hole'; // heading on templates downloaded before the rename
        $map = [];
        foreach ($header as $col => $cell) {
            $field = $byKey[$this->key((string) $cell)] ?? null;
            if ($field && ! in_array($field, $map, true)) {
                $map[$col] = $field;
            }
        }

        return $map;
    }

    private function key(string $s): string
    {
        return preg_replace('/[^a-z0-9]/', '', strtolower($s));
    }

    private function text(mixed $v): ?string
    {
        if ($v === null) {
            return null;
        }
        if (is_float($v) && floor($v) === $v && abs($v) < 1e15) {
            $v = (int) $v;
        }
        if (is_bool($v)) {
            $v = $v ? 'TRUE' : 'FALSE';
        }
        $s = trim((string) $v);

        return $s === '' ? null : $s;
    }

    /** @return array{created: int, updated: int, errors: list<string>} */
    private function failed(array $errors): array
    {
        return ['created' => 0, 'updated' => 0, 'errors' => array_values($errors)];
    }
}
