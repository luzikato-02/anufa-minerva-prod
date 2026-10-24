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

    /**
     * A date as written on a paper plan, as Y-m-d: "15 Oktober 2026", "15 Okt 2026", "15 October 2026",
     * "15/10/2026", "15-10-2026", "15.10.2026" or "2026-10-15". Null when the text holds no date like those.
     */
    public static function parse(?string $text): ?string
    {
        $text = trim((string) $text);
        if (preg_match('/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/', $text, $m)) {
            [$y, $mo, $d] = [(int) $m[1], (int) $m[2], (int) $m[3]];
        } elseif (preg_match('/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})\b/', $text, $m)) {
            [$d, $mo, $y] = [(int) $m[1], (int) $m[2], (int) $m[3]];
        } elseif (preg_match('/\b(\d{1,2})\s+([A-Za-z]+)\.?,?\s+(\d{4})\b/u', $text, $m) && ($mo = self::month($m[2])) !== null) {
            [$d, $y] = [(int) $m[1], (int) $m[3]];
        } else {
            return null;
        }
        if ($y < 100) {
            $y += 2000;
        }

        return checkdate($mo, $d, $y) ? sprintf('%04d-%02d-%02d', $y, $mo, $d) : null;
    }

    /** The month number of an Indonesian or English month name, whole or its first three letters. */
    private static function month(string $name): ?int
    {
        $name = mb_strtolower($name);
        foreach (self::MONTHS as $months) {
            foreach ($months as $i => $month) {
                $month = mb_strtolower($month);
                if ($name === $month || (mb_strlen($name) >= 3 && str_starts_with($month, $name))) {
                    return $i + 1;
                }
            }
        }

        // Agt is the usual Indonesian short form of Agustus.
        return $name === 'agt' ? 8 : null;
    }

    /** Revision numbers print with two digits: Rev 09, Rev 12. */
    public static function rev(int $revNo): string
    {
        return str_pad((string) $revNo, 2, '0', STR_PAD_LEFT);
    }
}
