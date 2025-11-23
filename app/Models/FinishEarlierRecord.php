<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FinishEarlierRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'metadata',
        'entries'
    ];

    protected $casts = [
        'metadata' => 'array',
        'entries'  => 'array',
    ];

    /**
     * Add a new entry and recalculate metadata.
     */
    public function addEntry(array $entry)
    {
        $entries = $this->entries ?? [];
        $entries[] = $entry;

        // Recalculate totals
        $total = count($entries);
        $totalMeters = array_sum(array_column($entries, 'meters_finish'));
        $average = round($totalMeters / $total);

        // Update metadata
        $metadata = $this->metadata;
        $metadata['total_finish_earlier'] = $total;
        $metadata['average_meters_finish'] = $average;

        // Save everything
        $this->entries = $entries;
        $this->metadata = $metadata;
        $this->save();

        return $this;
    }
}
