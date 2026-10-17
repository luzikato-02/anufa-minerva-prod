<?php

namespace App\ControlPlans;

use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as RenderedPdf;
use Dompdf\Frame;

/** Renders a PrintSheet to PDF with dompdf, A4 landscape. */
class PdfExport
{
    /** Renders allowed before giving up on the layout settling; it normally settles on the second. */
    private const MAX_RENDERS = 4;

    /**
     * Two things only show after a render: the page count (dompdf's counter(pages) comes out as 0, so "Halaman N
     * dari M" needs the total up front) and which characteristic rows start a new page (their merged step cells
     * repeat the step there). Render, note both, and render again with them filled in until nothing changes.
     */
    public static function make(array $sheet): RenderedPdf
    {
        $sheet += ['pages' => null, 'page_starts' => []];

        for ($i = 0; $i < self::MAX_RENDERS; $i++) {
            $rowPages = [];
            $pdf = self::load($sheet);
            $pdf->getDomPDF()->setCallbacks([[
                'event' => 'begin_frame',
                'f' => function (Frame $frame, $canvas) use (&$rowPages) {
                    $node = $frame->get_node();
                    if ($node instanceof \DOMElement && $node->nodeName === 'tr' && $node->hasAttribute('data-row')) {
                        $rowPages[(int) $node->getAttribute('data-row')] ??= $canvas->get_page_number();
                    }
                },
            ]]);
            $pdf->render();

            $pages = $pdf->getDomPDF()->getCanvas()->get_page_count();
            $starts = [];
            foreach ($rowPages as $row => $page) {
                if (isset($rowPages[$row - 1]) && $rowPages[$row - 1] !== $page) {
                    $starts[] = $row;
                }
            }
            if ($pages === $sheet['pages'] && $starts === $sheet['page_starts']) {
                return $pdf;
            }
            $sheet['pages'] = $pages;
            $sheet['page_starts'] = $starts;
        }

        return self::load($sheet);
    }

    private static function load(array $sheet): RenderedPdf
    {
        return Pdf::loadView('control-plans.sheet', ['s' => $sheet, 'screen' => false])->setPaper('A4', 'landscape');
    }
}
