<?php

namespace App\ControlPlans\Import;

/**
 * What a reader found in a Word or PDF control plan, before anything is known about which part is which.
 *
 * lines: the document's text in reading order, one entry per paragraph or visual line; a table row is one entry
 * with its cells joined by spaces, so "Referensi SP : W-W-01" reads the same from a table as from running text.
 *
 * tables: each table as rows of cells. A cell's col is where it starts and span how wide it is, in grid columns
 * for Word; a PDF signature block has no grid, so its cells carry their x position with span 0. A cell merged into
 * the one above it has empty text. Paragraphs inside a cell are separated by "\n".
 *
 * @phpstan-type Cell array{text: string, col: float, span: float}
 */
final class ImportedDocument
{
    /**
     * @param  list<string>  $lines
     * @param  list<list<list<Cell>>>  $tables
     * @param  list<string>  $warnings  what the reader could not do, worded for the person importing
     */
    public function __construct(
        public readonly string $format,
        public readonly array $lines,
        public readonly array $tables,
        public readonly array $warnings = [],
    ) {}
}
