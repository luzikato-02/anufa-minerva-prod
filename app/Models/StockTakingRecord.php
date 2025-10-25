<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class StockTakingRecord extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'indv_batch_data',
        'metadata',
        'user_id', // if you have user authentication
    ];

    protected $casts = [
        'indv_batch_data' => 'array',
        'metadata' => 'array',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    // Scopes for filtering

    public function scopeByLeader($query, $operator)
    {
        return $query->whereJsonContains('metadata->session_leader', $operator);
    }

    // Accessors
    public function getLeaderAttribute()
    {
        return $this->metadata['session_leader'] ?? null;
    }


}
