<?php

namespace App\ControlPlans\Import;

use DOMDocument;
use DOMElement;
use DOMNode;
use DOMXPath;
use RuntimeException;
use ZipArchive;

/**
 * Reads a .docx straight from its XML: the page headers first (older plans keep the document header block
 * there), then the body. Merged cells come out exactly: gridSpan gives a cell's width, and a cell that continues a
 * vertical merge is read as empty.
 */
class DocxReader
{
    private const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

    /** Checkbox glyphs from the Wingdings fonts (w:sym), as the characters PlanImport looks for. */
    private const SYMBOLS = [
        'F0FE' => '☒', 'F078' => '☒', 'F0FD' => '☒', 'F053' => '☒', 'F0FC' => '☒', 'F0D6' => '☒',
        'F0A8' => '☐', 'F06F' => '☐', 'F0A3' => '☐', 'F0A1' => '☐', 'F071' => '☐',
    ];

    /** @var list<string> */
    private array $lines = [];

    /** @var list<list<list<array{text: string, col: float, span: float}>>> */
    private array $tables = [];

    public static function read(string $path): ImportedDocument
    {
        $zip = new ZipArchive;
        if ($zip->open($path) !== true) {
            throw new RuntimeException('Not a Word (.docx) file.');
        }
        $parts = [];
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = $zip->getNameIndex($i);
            if (preg_match('#^word/header\d*\.xml$#', $name)) {
                $parts[] = $name;
            }
        }
        sort($parts, SORT_NATURAL);
        $parts[] = 'word/document.xml';

        $reader = new self;
        $found = false;
        foreach ($parts as $name) {
            $xml = $zip->getFromName($name);
            if ($xml === false) {
                continue;
            }
            $dom = new DOMDocument;
            if (! $dom->loadXML($xml, LIBXML_NONET | LIBXML_COMPACT)) {
                continue;
            }
            $root = $dom->getElementsByTagNameNS(self::W, $name === 'word/document.xml' ? 'body' : 'hdr')->item(0);
            if ($root instanceof DOMElement) {
                $reader->blocks($root);
                $found = $found || $name === 'word/document.xml';
            }
        }
        $zip->close();
        if (! $found) {
            throw new RuntimeException('Not a Word (.docx) file.');
        }

        return new ImportedDocument('docx', $reader->lines, $reader->tables);
    }

    /** Paragraphs and tables in document order; content controls (w:sdt) are looked into. */
    private function blocks(DOMElement $parent): void
    {
        foreach ($this->children($parent) as $node) {
            if ($node->localName === 'p') {
                $text = trim(self::text($node));
                if ($text !== '') {
                    $this->lines[] = self::flat($text);
                }
            } elseif ($node->localName === 'tbl') {
                $this->table($node);
            }
        }
    }

    private function table(DOMElement $tbl): void
    {
        $rows = [];
        foreach ($this->children($tbl) as $tr) {
            if ($tr->localName !== 'tr') {
                continue;
            }
            $col = 0;
            if (($before = $this->first($tr, 'trPr/w:gridBefore')) !== null) {
                $col += (int) $before->getAttributeNS(self::W, 'val');
            }
            $cells = [];
            foreach ($this->children($tr) as $tc) {
                if ($tc->localName !== 'tc') {
                    continue;
                }
                $span = max(1, (int) ($this->first($tc, 'tcPr/w:gridSpan')?->getAttributeNS(self::W, 'val') ?: 1));
                $vMerge = $this->first($tc, 'tcPr/w:vMerge');
                $continues = $vMerge !== null && $vMerge->getAttributeNS(self::W, 'val') !== 'restart';

                $paragraphs = [];
                foreach ($this->children($tc) as $node) {
                    if ($node->localName === 'p') {
                        $paragraphs[] = trim(self::text($node));
                    } elseif ($node->localName === 'tbl') {
                        // A table inside a cell is read as a table of its own.
                        $this->table($node);
                    }
                }
                $text = $continues ? '' : trim(implode("\n", $paragraphs));
                $cells[] = ['text' => $text, 'col' => (float) $col, 'span' => (float) $span];
                $col += $span;
            }
            $rows[] = $cells;
            $line = trim(implode(' ', array_filter(array_map(fn ($c) => self::flat($c['text']), $cells))));
            if ($line !== '') {
                $this->lines[] = $line;
            }
        }
        $this->tables[] = $rows;
    }

    /** A paragraph's text: runs, tabs as spaces, line breaks as "\n", checkbox symbols, text boxes. */
    private static function text(DOMNode $node): string
    {
        $out = '';
        foreach ($node->childNodes as $child) {
            if (! $child instanceof DOMElement) {
                continue;
            }
            // Word stores a drawing twice, the modern version and a fallback; read the modern one only.
            if ($child->localName === 'Fallback') {
                continue;
            }
            // A superscript mark such as "Barcode Scanner^EP" stays a word of its own in plain text.
            if ($child->localName === 'r' && $child->namespaceURI === self::W
                && $child->getElementsByTagNameNS(self::W, 'vertAlign')->item(0)?->getAttributeNS(self::W, 'val') === 'superscript') {
                $sup = self::text($child);
                $out .= (preg_match('/[\pL\pN]$/u', $out) && preg_match('/^[\pL\pN]/u', $sup) ? ' ' : '').$sup;

                continue;
            }
            if ($child->localName === 'wgp') {
                $out .= "\n".self::shapes($child)."\n";

                continue;
            }
            $out .= match ($child->namespaceURI === self::W ? $child->localName : '') {
                't' => $child->textContent,
                'tab' => ' ',
                'br', 'cr' => "\n",
                'sym' => self::SYMBOLS[strtoupper($child->getAttributeNS(self::W, 'char'))] ?? '',
                // A paragraph in a text box is set apart from the text around the box.
                'p' => "\n".self::text($child)."\n",
                default => self::text($child),
            };
        }

        return $out;
    }

    /**
     * A group of drawn shapes. Some plans draw the phase checkboxes: a label in a text box beside each rectangle,
     * and a cross (or a text box holding "X" or a tick) over the chosen rectangle. Then the labels come out as
     * "☐ Prototype ☐ Pre-launch ☒ Production"; otherwise the text boxes' text, left to right.
     */
    private static function shapes(DOMElement $group): string
    {
        [$labels, $boxes, $ticks] = [[], [], []];
        foreach ($group->getElementsByTagName('*') as $shape) {
            if ($shape->localName !== 'wsp') {
                continue;
            }
            $off = null;
            $ext = null;
            $geometry = '';
            $text = '';
            foreach ($shape->getElementsByTagName('*') as $el) {
                match ($el->localName) {
                    'off' => $off ??= $el,
                    'ext' => $ext ??= $el,
                    'prstGeom' => $geometry = $el->getAttribute('prst'),
                    'txbxContent' => $text = self::flat(self::text($el)),
                    default => null,
                };
            }
            $x = (int) $off?->getAttribute('x');
            $w = (int) $ext?->getAttribute('cx');
            $y = (int) $off?->getAttribute('y');
            $h = (int) $ext?->getAttribute('cy');
            if ($geometry === 'mathMultiply' || preg_match('/^[xX✓✔√]$/u', $text)) {
                $ticks[] = [$x + $w / 2, $y + $h / 2];
            } elseif ($text !== '') {
                $labels[] = ['x' => $x, 'text' => $text];
            } elseif (in_array($geometry, ['rect', 'flowChartProcess', 'roundRect'], true)) {
                $boxes[] = ['x' => $x, 'right' => $x + $w, 'y' => $y, 'bottom' => $y + $h];
            }
        }
        usort($labels, fn ($a, $b) => $a['x'] <=> $b['x']);
        if (! $ticks || count($boxes) < 2) {
            return implode(' ', array_column($labels, 'text'));
        }

        // Each box belongs to the first label starting right of it; a ticked box ticks that label.
        $ticked = [];
        foreach ($ticks as [$tx, $ty]) {
            foreach ($boxes as $box) {
                $height = $box['bottom'] - $box['y'];
                if ($tx >= $box['x'] && $tx <= $box['right'] && $ty >= $box['y'] - $height && $ty <= $box['bottom'] + $height) {
                    $right = array_filter($labels, fn ($l) => $l['x'] >= $box['x']);
                    if ($right) {
                        $ticked[array_key_first($right)] = true;
                    }
                }
            }
        }

        return implode(' ', array_map(fn ($i, $l) => (isset($ticked[$i]) ? '☒ ' : '☐ ').$l['text'], array_keys($labels), $labels));
    }

    /** Child elements, with content controls (w:sdt → w:sdtContent) opened up in place. */
    private function children(DOMElement $parent): array
    {
        $out = [];
        foreach ($parent->childNodes as $child) {
            if (! $child instanceof DOMElement || $child->namespaceURI !== self::W) {
                continue;
            }
            if ($child->localName === 'sdt') {
                foreach ($child->childNodes as $part) {
                    if ($part instanceof DOMElement && $part->localName === 'sdtContent') {
                        array_push($out, ...$this->children($part));
                    }
                }

                continue;
            }
            $out[] = $child;
        }

        return $out;
    }

    private function first(DOMElement $context, string $path): ?DOMElement
    {
        $xpath = new DOMXPath($context->ownerDocument);
        $xpath->registerNamespace('w', self::W);
        $node = $xpath->query('w:'.$path, $context)->item(0);

        return $node instanceof DOMElement ? $node : null;
    }

    /** Text on one line: line breaks and runs of spaces become single spaces. */
    public static function flat(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', $text));
    }
}
