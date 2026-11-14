<?php

namespace App\Ai\Tools;

use Illuminate\Support\Carbon;

/**
 * A from/to day range read in the plant's timezone, with the UTC instants needed to query timestamp
 * columns (the database stores UTC). Bad or missing dates fall back to the last 30 days.
 */
final class DateWindow
{
    private function __construct(
        public readonly Carbon $fromLocal,
        public readonly Carbon $toLocal,
    ) {}

    public static function fromArgs(array $args, int $defaultDays = 30): self
    {
        $tz = config('ai.chat.timezone');
        $today = Carbon::now($tz)->startOfDay();
        $parse = function ($value) use ($tz): ?Carbon {
            if (! is_string($value) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
                return null;
            }
            try {
                return Carbon::createFromFormat('!Y-m-d', $value, $tz);
            } catch (\Throwable) {
                return null;
            }
        };

        $to = $parse($args['date_to'] ?? null) ?? $today->copy();
        $from = $parse($args['date_from'] ?? null) ?? $to->copy()->subDays($defaultDays - 1);
        if ($from->gt($to)) {
            [$from, $to] = [$to, $from];
        }

        return new self($from->startOfDay(), $to->copy()->endOfDay());
    }

    public function startUtc(): Carbon
    {
        return $this->fromLocal->copy()->utc();
    }

    public function endUtc(): Carbon
    {
        return $this->toLocal->copy()->utc();
    }

    /** A UTC timestamp as a plant-local date string. */
    public static function localDate($timestamp): ?string
    {
        return $timestamp ? Carbon::parse($timestamp)->setTimezone(config('ai.chat.timezone'))->toDateString() : null;
    }

    public function describe(): array
    {
        return [
            'from' => $this->fromLocal->toDateString(),
            'to' => $this->toLocal->toDateString(),
            'timezone' => config('ai.chat.timezone'),
        ];
    }
}
