<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MlEnergyModel extends Model
{
    protected $fillable = [
        'name', 'model_type', 'hyperparams', 'r2_score', 'cv_r2_score', 'rmse', 'mae',
        'training_samples', 'model_file', 'trained_by', 'is_active',
    ];

    protected $casts = [
        'r2_score'         => 'float',
        'cv_r2_score'      => 'float',
        'rmse'             => 'float',
        'mae'              => 'float',
        'is_active'        => 'boolean',
        'training_samples' => 'integer',
        'hyperparams'      => 'array',
    ];

    public function trainedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'trained_by');
    }
}
