<?php

namespace App\Http\Controllers\ControlPlans;

use App\ControlPlans\PrintSheet;
use App\ControlPlans\WordExport;
use App\Http\Controllers\Controller;
use App\Models\ControlPlanRevision;
use App\Models\ControlPlanSetting;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * The W-WSD document for one revision: as HTML for the print preview, and as PDF or Word to download. Any
 * revision not yet released carries a DRAFT watermark in the files; the preview can switch it off to check layout.
 */
class ControlPlanExportController extends Controller
{
    public function print(Request $request, ControlPlanRevision $revision): Response
    {
        abort_unless($revision->isVisibleTo($request->user()), 403);
        $watermark = $revision->isOpen() && $request->boolean('watermark', true);

        return response()->view('control-plans.sheet', ['s' => PrintSheet::build($revision, ControlPlanSetting::current(), $watermark), 'screen' => true]);
    }

    public function download(Request $request, ControlPlanRevision $revision, string $format): Response|BinaryFileResponse
    {
        abort_unless($revision->isVisibleTo($request->user()), 403);
        abort_unless(in_array($format, ['pdf', 'docx'], true), 404);

        $sheet = PrintSheet::build($revision, ControlPlanSetting::current(), $revision->isOpen());
        $name = self::fileName($revision, $format);

        if ($format === 'pdf') {
            return Pdf::loadView('control-plans.sheet', ['s' => $sheet, 'screen' => false])
                ->setPaper('A4', 'landscape')
                ->download($name);
        }

        return response()->download(WordExport::save($sheet), $name)->deleteFileAfterSend();
    }

    public static function fileName(ControlPlanRevision $revision, string $format): string
    {
        return $revision->plan->doc_no.' Rev '.str_pad((string) $revision->rev_no, 2, '0', STR_PAD_LEFT).($revision->isOpen() ? ' DRAFT' : '').'.'.$format;
    }
}
