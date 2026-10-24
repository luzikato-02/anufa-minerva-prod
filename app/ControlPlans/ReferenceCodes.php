<?php

namespace App\ControlPlans;

use App\Models\ControlPlanReference;

/**
 * Finds document codes (QA-IK-14, T-WSD-W-3, TCF-W014…) in a revision's text so the reference library can say
 * where each is used. A code is upper-case letters followed by one or more dash-separated parts.
 */
class ReferenceCodes
{
    public const PATTERN = '/(?<![A-Za-z0-9-])[A-Z]+(?:-[A-Z0-9]+)+(?![A-Za-z0-9-])/';

    /** A whole value that is one code and nothing else. */
    public const EXACT = '/^[A-Z]+(?:-[A-Z0-9]+)+$/';

    /** Line fields that can hold a code, with the column name the library shows. */
    public const FIELDS = [
        'spec' => 'Specification',
        'control' => 'Control method',
        'reaction' => 'Reaction plan',
        'reaction_ref' => 'Reaction plan',
    ];

    /** @return list<string> */
    public static function in(?string $text): array
    {
        if ($text === null || $text === '') {
            return [];
        }
        preg_match_all(self::PATTERN, $text, $m);

        return array_values(array_unique($m[0]));
    }

    /**
     * Where each code is used in one revision: code => [where => number of lines], where is a column name
     * (Specification, Control method, Reaction plan) or Referensi SP for the document header.
     *
     * @return array<string, array<string, int>>
     */
    public static function usages(array $header, array $content): array
    {
        $uses = [];
        foreach (self::in($header['sp_ref'] ?? null) as $code) {
            $uses[$code]['Referensi SP'] = 1;
        }
        foreach ($content['lines'] ?? [] as $line) {
            $seen = [];
            foreach (self::FIELDS as $field => $label) {
                foreach (self::in($line[$field] ?? null) as $code) {
                    // A line counts once per column, even when the reaction text and its reference repeat the code.
                    if (! isset($seen[$code][$label])) {
                        $seen[$code][$label] = true;
                        $uses[$code][$label] = ($uses[$code][$label] ?? 0) + 1;
                    }
                }
            }
        }

        return $uses;
    }

    /** @return list<string> */
    public static function all(array $header, array $content): array
    {
        return array_keys(self::usages($header, $content));
    }

    /** The reference library entries a revision uses, as they are now: what a released revision keeps. */
    public static function snapshot(array $header, array $content): array
    {
        return ControlPlanReference::whereIn('code', self::all($header, $content))->get(['code', 'title', 'type', 'revision', 'link'])->toArray();
    }
}
