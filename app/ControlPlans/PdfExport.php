<?php

namespace App\ControlPlans;

use Barryvdh\DomPDF\Facade\Pdf;
use Barryvdh\DomPDF\PDF as RenderedPdf;

/** Renders a PrintSheet to PDF with dompdf, A4 landscape. */
class PdfExport
{
    /**
     * dompdf's counter(pages) comes out as 0, so "Halaman N dari M" needs the total up front: render once to count
     * the pages, then again with the count filled in. The two renders only differ in that number.
     */
    public static function make(array $sheet): RenderedPdf
    {
        $first = self::load($sheet);
        $first->render();
        $sheet['pages'] = $first->getDomPDF()->getCanvas()->get_page_count();

        return self::load($sheet);
    }

    private static function load(array $sheet): RenderedPdf
    {
        return Pdf::loadView('control-plans.sheet', ['s' => $sheet, 'screen' => false])->setPaper('A4', 'landscape');
    }
}
