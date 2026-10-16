<?php

namespace App\ControlPlans;

use Carbon\CarbonInterface;
use Illuminate\Support\Carbon;

/** Dates as printed on control plans: "09 Oktober 2026" (Indonesian) or "09 October 2026" (English). */
class PlanDates
{
    private const MONTHS = [
        'id' => ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
        'en' => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    ];

    public static function format(CarbonInterface|string|null $date, string $format = 'id'): string
    {
        if ($date === null || $date === '') {
            return '';
        }
        $d = $date instanceof CarbonInterface ? $date : Carbon::parse($date);
        $months = self::MONTHS[$format] ?? self::MONTHS['id'];

        return $d->format('d').' '.$months[$d->month - 1].' '.$d->format('Y');
    }

    /** Revision numbers print with two digits: Rev 09, Rev 12. */
    public static function rev(int $revNo): string
    {
        return str_pad((string) $revNo, 2, '0', STR_PAD_LEFT);
    }
}
