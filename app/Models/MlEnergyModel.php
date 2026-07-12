<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MlEnergyModel extends Model
{
    protected $fillable = [
        'name', 'model_type', 'hyperparams', 'r2_score', 'cv_r2_score', 'cv_r2_std',
        'test_r2', 'test_rmse', 'test_mae', 'rmse', 'mae', 'overfit_gap', 'auto_tuned',
        'training_samples', 'model_file', 'trained_by', 'is_active',
    ];

    protected $casts = [
        'r2_score'         => 'float',
        'cv_r2_score'      => 'float',
        'cv_r2_std'        => 'float',
        'test_r2'          => 'float',
        'test_rmse'        => 'float',
        'test_mae'         => 'float',
        'rmse'             => 'float',
        'mae'              => 'float',
        'overfit_gap'      => 'float',
        'auto_tuned'       => 'boolean',
        'is_active'        => 'boolean',
        'training_samples' => 'integer',
        'hyperparams'      => 'array',
    ];

    public function trainedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'trained_by');
    }
}
