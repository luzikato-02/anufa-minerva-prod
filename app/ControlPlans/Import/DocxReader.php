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
            $out .= match ($child->namespaceURI === self::W ? $child->localName : '') {
                't' => $child->textContent,
                'tab' => ' ',
                'br', 'cr' => "\n",
                'sym' => self::SYMBOLS[strtoupper($child->getAttributeNS(self::W, 'char'))] ?? '',
                'p' => "\n".self::text($child),
                default => self::text($child),
            };
        }

        return $out;
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
