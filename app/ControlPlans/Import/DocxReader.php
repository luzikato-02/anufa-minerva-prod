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
 * vertical merge is read as empty. Text set in bold italic is noted too: plans print what their latest revision
 * changed that way, and the import keeps it as that revision's changes.
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

    /** @var list<list<list<array{text: string, col: float, span: float, marked?: true}>>> */
    private array $tables = [];

    /** @var list<string> the bold italic passages, each flattened to one line */
    private array $marked = [];

    /** The bold italic text read so far that has not ended yet. */
    private string $run = '';

    /** Paragraph and character styles: id => [bold, italic, based on], a null meaning the style does not say. */
    private array $styles = [];

    /** The style of the paragraph being read. */
    private string $paragraphStyle = '';

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
        $reader->styles($zip->getFromName('word/styles.xml') ?: '');
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

        return new ImportedDocument('docx', $reader->lines, $reader->tables, marked: $reader->marked);
    }

    private function styles(string $xml): void
    {
        $dom = new DOMDocument;
        if ($xml === '' || ! $dom->loadXML($xml, LIBXML_NONET | LIBXML_COMPACT)) {
            return;
        }
        foreach ($dom->getElementsByTagNameNS(self::W, 'style') as $style) {
            $rPr = $this->first($style, 'rPr');
            $this->styles[$style->getAttributeNS(self::W, 'styleId')] = [
                self::toggle($rPr ? $this->first($rPr, 'b') : null),
                self::toggle($rPr ? $this->first($rPr, 'i') : null),
                $this->first($style, 'basedOn')?->getAttributeNS(self::W, 'val'),
            ];
        }
    }

    /** A w:b or w:i: on unless its val turns it off; null when absent. */
    private static function toggle(?DOMElement $el): ?bool
    {
        return $el === null ? null : ! in_array($el->getAttributeNS(self::W, 'val'), ['0', 'false', 'off'], true);
    }

    /** Bold or italic (0 or 1) as a style says, or a style it is based on; null when none says. */
    private function fromStyle(string $id, int $which): ?bool
    {
        for ($depth = 0; $id !== '' && isset($this->styles[$id]) && $depth < 10; $depth++) {
            if ($this->styles[$id][$which] !== null) {
                return $this->styles[$id][$which];
            }
            $id = (string) $this->styles[$id][2];
        }

        return null;
    }

    /** A run is bold italic by its own formatting, else its character style, else its paragraph's style. */
    private function boldItalic(DOMElement $run): bool
    {
        $rPr = $this->first($run, 'rPr');
        $charStyle = (string) ($rPr ? $this->first($rPr, 'rStyle')?->getAttributeNS(self::W, 'val') : '');
        foreach (['b' => 0, 'i' => 1] as $tag => $which) {
            $on = self::toggle($rPr ? $this->first($rPr, $tag) : null)
                ?? $this->fromStyle($charStyle, $which)
                ?? $this->fromStyle($this->paragraphStyle, $which)
                ?? false;
            if (! $on) {
                return false;
            }
        }

        return true;
    }

    /** Ends the bold italic passage being read; one with no letter or digit in it is not kept. */
    private function endRun(): void
    {
        $text = self::flat($this->run);
        if (preg_match('/[\pL\pN]/u', $text)) {
            $this->marked[] = $text;
        }
        $this->run = '';
    }

    /** Paragraphs and tables in document order; content controls (w:sdt) are looked into. */
    private function blocks(DOMElement $parent): void
    {
        foreach ($this->children($parent) as $node) {
            if ($node->localName === 'p') {
                $text = trim($this->text($node));
                $this->endRun();
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
                $before = count($this->marked);
                foreach ($this->children($tc) as $node) {
                    if ($node->localName === 'p') {
                        $paragraphs[] = trim($this->text($node));
                        $this->endRun();
                    } elseif ($node->localName === 'tbl') {
                        // A table inside a cell is read as a table of its own.
                        $this->table($node);
                    }
                }
                $text = $continues ? '' : trim(implode("\n", $paragraphs));
                $cells[] = ['text' => $text, 'col' => (float) $col, 'span' => (float) $span]
                    + ($text !== '' && count($this->marked) > $before ? ['marked' => true] : []);
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
    private function text(DOMNode $node): string
    {
        if ($node instanceof DOMElement && $node->localName === 'p') {
            $outer = $this->paragraphStyle;
            $this->paragraphStyle = (string) $this->first($node, 'pPr/w:pStyle')?->getAttributeNS(self::W, 'val');
            $text = $this->paragraph($node);
            $this->paragraphStyle = $outer;

            return $text;
        }

        return $this->paragraph($node);
    }

    private function paragraph(DOMNode $node): string
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
                $sup = $this->text($child);
                $out .= (preg_match('/[\pL\pN]$/u', $out) && preg_match('/^[\pL\pN]/u', $sup) ? ' ' : '').$sup;

                continue;
            }
            if ($child->localName === 'wgp') {
                $out .= "\n".$this->shapes($child)."\n";

                continue;
            }
            // A run's text joins the bold italic passage, or ends it; spaces between bold italic runs belong to it.
            if ($child->localName === 'r' && $child->namespaceURI === self::W) {
                $text = $this->text($child);
                if ($this->boldItalic($child)) {
                    $this->run .= $text;
                } elseif (trim($text) === '' && $this->run !== '') {
                    $this->run .= $text;
                } elseif (trim($text) !== '') {
                    $this->endRun();
                }
                $out .= $text;

                continue;
            }
            $out .= match ($child->namespaceURI === self::W ? $child->localName : '') {
                't' => $child->textContent,
                'tab' => ' ',
                'br', 'cr' => "\n",
                'sym' => self::SYMBOLS[strtoupper($child->getAttributeNS(self::W, 'char'))] ?? '',
                // A paragraph in a text box is set apart from the text around the box.
                'p' => "\n".$this->text($child)."\n",
                default => $this->text($child),
            };
        }

        return $out;
    }

    /**
     * A group of drawn shapes. Some plans draw the phase checkboxes: a label in a text box beside each rectangle,
     * and a cross (or a text box holding "X" or a tick) over the chosen rectangle. Then the labels come out as
     * "☐ Prototype ☐ Pre-launch ☒ Production"; otherwise the text boxes' text, left to right.
     */
    private function shapes(DOMElement $group): string
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
                    'txbxContent' => $text = self::flat($this->text($el)),
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
