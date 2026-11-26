<?php

namespace App\Services\Reeds;

use App\Models\Reed;
use App\Models\ReedFabricStyle;
use App\Models\ReedInspection;
use App\Models\ReedLocation;
use App\Models\ReedMovement;
use App\Models\ReedRepair;
use App\Models\ReedSpec;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Every change to a reed's status, location or wear goes through here: the reed row is locked, the move is
 * checked against the allowed transitions, and one movement row is written in the same transaction.
 *
 *   in_stock ⇄ reserved → on_loom → returned → (inspect) → in_stock (A/B) | quarantine (C/X)
 *   quarantine | in_stock | returned → in_repair → returned (re-inspect before stock)
 *   anything but on_loom → scrapped
 */
class ReedLifecycle
{
    /** Grades a reed may be issued with. */
    private const USABLE = ['A', 'B'];

    public function __construct(private readonly ?User $user = null) {}

    public static function as(?User $user): self
    {
        return new self($user);
    }

    /**
     * Create one reed per piece of a goods receipt. Serials are taken as given, or numbered R00001, R00002…
     *
     * @param  list<string>  $serials
     * @return Collection<int, Reed>
     */
    public function receive(ReedSpec $spec, int $quantity, array $serials, array $receipt, ?ReedLocation $location): Collection
    {
        return DB::transaction(function () use ($spec, $quantity, $serials, $receipt, $location) {
            $count = $serials ? count($serials) : $quantity;
            $reeds = collect();
            for ($i = 0; $i < $count; $i++) {
                $reed = Reed::create([
                    'serial_no' => $serials[$i] ?? 'tmp-'.Str::uuid(),
                    'reed_spec_id' => $spec->id,
                    'status' => Reed::IN_STOCK,
                    'grade' => 'A',
                    'location_id' => $location?->id,
                    'supplier' => $receipt['supplier'] ?? null,
                    'po_no' => $receipt['po_no'] ?? null,
                    'received_on' => $receipt['received_on'] ?? now()->toDateString(),
                    'unit_cost' => $receipt['unit_cost'] ?? null,
                    'notes' => $receipt['notes'] ?? null,
                ]);
                if (! isset($serials[$i])) {
                    $reed->update(['serial_no' => 'R'.str_pad((string) $reed->id, 5, '0', STR_PAD_LEFT)]);
                }
                $this->log($reed, 'receive', null, null, [
                    'to_location_id' => $location?->id,
                    'note' => ! empty($receipt['po_no']) ? 'PO '.$receipt['po_no'] : null,
                ]);
                $reeds->push($reed);
            }

            return $reeds;
        });
    }

    public function reserve(int $reedId, array $data, ?string $clientUuid = null): Reed
    {
        return $this->apply($reedId, 'reserve', $clientUuid, function (Reed $reed) use ($data) {
            $this->expect($reed, [Reed::IN_STOCK], 'reserve');
            $this->expectUsable($reed);
            $style = $this->styleFor($reed, $data['fabric_style_id'] ?? null);
            $reed->fill([
                'status' => Reed::RESERVED,
                'reserved_at' => now(),
                'loom_number' => $data['loom_number'] ?? null,
                'fabric_style_id' => $style?->id,
            ]);

            return ['loom_number' => $reed->loom_number, 'fabric_style_id' => $style?->id, 'note' => $data['note'] ?? null];
        });
    }

    public function release(int $reedId, ?string $note = null, ?string $clientUuid = null): Reed
    {
        return $this->apply($reedId, 'release', $clientUuid, function (Reed $reed) use ($note) {
            $this->expect($reed, [Reed::RESERVED], 'release');
            $reed->fill(['status' => Reed::IN_STOCK, 'reserved_at' => null, 'loom_number' => null, 'fabric_style_id' => null]);

            return ['note' => $note];
        });
    }

    public function issue(int $reedId, array $data, ?string $clientUuid = null): Reed
    {
        return $this->apply($reedId, 'issue', $clientUuid, function (Reed $reed) use ($data) {
            $this->expect($reed, [Reed::IN_STOCK, Reed::RESERVED], 'issue');
            $this->expectUsable($reed);
            $loom = trim((string) $data['loom_number']);
            $mounted = Reed::where('status', Reed::ON_LOOM)->where('loom_number', $loom)->where('id', '!=', $reed->id)->first();
            if ($mounted) {
                throw new ReedTransitionException("Reed {$mounted->serial_no} is still on loom {$loom}. Return it first.");
            }
            $style = $this->styleFor($reed, $data['fabric_style_id'] ?? null);
            $reed->fill([
                'status' => Reed::ON_LOOM,
                'loom_number' => $loom,
                'fabric_style_id' => $style?->id,
                'order_no' => $data['order_no'] ?? null,
                'mounted_at' => now(),
                'reserved_at' => null,
                'location_id' => null,
                'issue_count' => $reed->issue_count + 1,
            ]);

            return ['loom_number' => $loom, 'fabric_style_id' => $style?->id, 'order_no' => $reed->order_no, 'note' => $data['note'] ?? null];
        });
    }

    public function return(int $reedId, array $data, ?string $clientUuid = null): Reed
    {
        return $this->apply($reedId, 'return', $clientUuid, function (Reed $reed) use ($data) {
            $this->expect($reed, [Reed::ON_LOOM], 'return');
            $meters = (float) ($data['meters_woven'] ?? 0);
            // Started days on the loom: 0–24 h counts as 1.
            $minutes = $reed->mounted_at ? (int) floor($reed->mounted_at->diffInMinutes(now(), true)) : 0;
            $days = $reed->mounted_at ? max(1, intdiv($minutes + 1439, 1440)) : 0;
            $extra = [
                'loom_number' => $reed->loom_number,
                'fabric_style_id' => $reed->fabric_style_id,
                'order_no' => $reed->order_no,
                'meters' => $meters,
                'note' => $data['note'] ?? null,
            ];
            $reed->fill([
                'status' => Reed::RETURNED,
                'meters_woven' => $reed->meters_woven + $meters,
                'days_mounted' => $reed->days_mounted + $days,
                'loom_number' => null,
                'fabric_style_id' => null,
                'order_no' => null,
                'mounted_at' => null,
                'location_id' => $data['location_id'] ?? null,
            ]);

            return $extra;
        });
    }

    /** Record an inspection. A and B go back to stock, C and X wait in quarantine for repair or scrap. */
    public function inspect(int $reedId, array $data, ?string $clientUuid = null): Reed
    {
        return $this->apply($reedId, 'inspect', $clientUuid, function (Reed $reed) use ($data) {
            $this->expect($reed, [Reed::RETURNED, Reed::IN_STOCK, Reed::QUARANTINE], 'inspect');
            $grade = $data['grade'];
            $usable = in_array($grade, self::USABLE, true);
            $locationId = $data['location_id'] ?? $reed->location_id;
            if ($usable && ! $locationId) {
                throw new ReedTransitionException('Pick a rack location to put the reed back in stock.');
            }
            $checklist = collect(ReedInspection::CHECKS)
                ->mapWithKeys(fn ($check) => [$check => (bool) ($data['checklist'][$check] ?? false)])
                ->all();
            ReedInspection::create([
                'reed_id' => $reed->id,
                'grade' => $grade,
                'checklist' => $checklist,
                'defect_dents' => $data['defect_dents'] ?? null,
                'note' => $data['note'] ?? null,
                'user_id' => $this->user?->id,
                'inspected_at' => now(),
            ]);
            $reed->fill([
                'grade' => $grade,
                'status' => $usable ? Reed::IN_STOCK : Reed::QUARANTINE,
                'location_id' => $locationId,
                'last_inspected_at' => now(),
            ]);
            $found = collect($checklist)->filter()->keys()->map(fn ($k) => str_replace('_', ' ', $k))->implode(', ');

            return ['note' => trim("Grade {$grade}".($found ? " — {$found}" : '').(! empty($data['note']) ? ". {$data['note']}" : ''))];
        });
    }

    public function transfer(int $reedId, int $locationId, ?string $clientUuid = null): Reed
    {
        return $this->apply($reedId, 'transfer', $clientUuid, function (Reed $reed) use ($locationId) {
            $this->expect($reed, [Reed::IN_STOCK, Reed::RESERVED, Reed::RETURNED, Reed::QUARANTINE], 'move');
            if ($reed->location_id === $locationId) {
                throw new ReedTransitionException('The reed is already in that location.');
            }
            $reed->location_id = $locationId;

            return [];
        });
    }

    public function sendToRepair(int $reedId, array $data, ?string $clientUuid = null): Reed
    {
        return $this->apply($reedId, 'repair_out', $clientUuid, function (Reed $reed) use ($data) {
            $this->expect($reed, [Reed::QUARANTINE, Reed::IN_STOCK, Reed::RETURNED], 'send to repair');
            ReedRepair::create([
                'reed_id' => $reed->id,
                'vendor' => $data['vendor'],
                'defects' => $data['defects'] ?? null,
                'sent_on' => $data['sent_on'] ?? now()->toDateString(),
            ]);
            $reed->fill(['status' => Reed::IN_REPAIR, 'location_id' => null, 'repair_count' => $reed->repair_count + 1]);

            return ['note' => trim($data['vendor'].(! empty($data['defects']) ? ": {$data['defects']}" : ''))];
        });
    }

    /** Back from the vendor. It lands as returned so it is inspected before it goes back to stock. */
    public function receiveFromRepair(int $reedId, array $data, ?string $clientUuid = null): Reed
    {
        return $this->apply($reedId, 'repair_in', $clientUuid, function (Reed $reed) use ($data) {
            $this->expect($reed, [Reed::IN_REPAIR], 'receive from repair');
            $reed->openRepair()?->update([
                'returned_on' => $data['returned_on'] ?? now()->toDateString(),
                'cost' => $data['cost'] ?? null,
                'work_done' => $data['work_done'] ?? null,
            ]);
            $reed->fill(['status' => Reed::RETURNED, 'location_id' => $data['location_id'] ?? null]);

            return ['note' => $data['work_done'] ?? null];
        });
    }

    public function scrap(int $reedId, string $reason, ?string $clientUuid = null): Reed
    {
        return $this->apply($reedId, 'scrap', $clientUuid, function (Reed $reed) use ($reason) {
            if ($reed->status === Reed::ON_LOOM) {
                throw new ReedTransitionException("Reed {$reed->serial_no} is on loom {$reed->loom_number}. Return it before scrapping.");
            }
            $this->expect($reed, array_diff(Reed::STATUSES, [Reed::SCRAPPED, Reed::ON_LOOM]), 'scrap');
            $reed->fill(['status' => Reed::SCRAPPED, 'grade' => 'X', 'location_id' => null, 'loom_number' => null, 'fabric_style_id' => null, 'reserved_at' => null]);

            return ['note' => $reason];
        });
    }

    /**
     * Lock the reed, run the change, write the movement. A client_uuid seen before returns the reed as it is
     * now instead of applying the change again.
     *
     * @param  callable(Reed): array<string, mixed>  $change
     */
    private function apply(int $reedId, string $type, ?string $clientUuid, callable $change): Reed
    {
        if ($clientUuid && ($seen = ReedMovement::where('client_uuid', $clientUuid)->first())) {
            return Reed::findOrFail($seen->reed_id);
        }

        return DB::transaction(function () use ($reedId, $type, $clientUuid, $change) {
            $reed = Reed::lockForUpdate()->findOrFail($reedId);
            $fromStatus = $reed->status;
            $fromLocation = $reed->location_id;
            $extra = $change($reed);
            $reed->save();
            $this->log($reed, $type, $fromStatus, $fromLocation, $extra + ['client_uuid' => $clientUuid]);

            return $reed;
        });
    }

    private function log(Reed $reed, string $type, ?string $fromStatus, ?int $fromLocation, array $extra): void
    {
        ReedMovement::create([
            'reed_id' => $reed->id,
            'type' => $type,
            'from_status' => $fromStatus,
            'to_status' => $reed->status,
            'from_location_id' => $fromLocation,
            'to_location_id' => $extra['to_location_id'] ?? $reed->location_id,
            'loom_number' => $extra['loom_number'] ?? null,
            'fabric_style_id' => $extra['fabric_style_id'] ?? null,
            'order_no' => $extra['order_no'] ?? null,
            'meters' => $extra['meters'] ?? null,
            'note' => isset($extra['note']) ? Str::limit((string) $extra['note'], 250) : null,
            'client_uuid' => $extra['client_uuid'] ?? null,
            'user_id' => $this->user?->id,
            'occurred_at' => now(),
        ]);
    }

    /** @param  list<string>  $allowed */
    private function expect(Reed $reed, array $allowed, string $verb): void
    {
        if (! in_array($reed->status, $allowed, true)) {
            $state = str_replace('_', ' ', $reed->status);
            throw new ReedTransitionException("Can't {$verb} reed {$reed->serial_no}: it is {$state}.");
        }
    }

    private function expectUsable(Reed $reed): void
    {
        if (! in_array($reed->grade, self::USABLE, true)) {
            throw new ReedTransitionException("Reed {$reed->serial_no} is grade {$reed->grade}. Only grade A or B reeds go on a loom.");
        }
    }

    /** The style, checked against the reed's spec when the style names one. */
    private function styleFor(Reed $reed, mixed $styleId): ?ReedFabricStyle
    {
        if (! $styleId) {
            return null;
        }
        $style = ReedFabricStyle::with('reedSpec')->findOrFail($styleId);
        if ($style->reed_spec_id && $style->reed_spec_id !== $reed->reed_spec_id) {
            $needs = $style->reedSpec?->code ?? 'another spec';
            throw new ReedTransitionException("Style {$style->code} needs reed spec {$needs}; reed {$reed->serial_no} is a different spec.");
        }

        return $style;
    }
}
