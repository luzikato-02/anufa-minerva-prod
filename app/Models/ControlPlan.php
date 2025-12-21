<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ControlPlan extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'document_number',
        'title',
        'description',
        'created_by',
        'control_plan_number',
        'part_number_latest_change_level',
        'part_name_description',
        'key_contact_phone',
        'core_team',
        'organization_plant',
        'organization_code',
        'customer_engineering_approval_date',
        'customer_quality_approval_date',
        'other_approval_date',
        'manufacturing_step',
        'production_area',
        'referensi_sp',
        'tanggal_diterbitkan_sp',
        'tanggal_diterbitkan',
        'no_revisi_tanggal_revisi_terakhir',
        'tanggal_review_berikutnya',
        'signatures_dibuat_oleh',
        'signatures_disetujui_oleh',
        'asterisk_legend',
    ];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'signatures_dibuat_oleh' => 'array',
        'signatures_disetujui_oleh' => 'array',
    ];

    /**
     * Get the items (rows) for this control plan
     */
    public function items(): HasMany
    {
        return $this->hasMany(ControlPlanItem::class)->orderBy('sort_order');
    }

    /**
     * Get the revision history for this control plan
     */
    public function revisionHistory(): HasMany
    {
        return $this->hasMany(ControlPlanRevisionHistory::class)->orderBy('date_of_revision', 'desc');
    }

    /**
     * Get the user who created this control plan
     */
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Scope to search by document number
     */
    public function scopeByDocumentNumber($query, $documentNumber)
    {
        return $query->where('document_number', $documentNumber);
    }

    /**
     * Scope to search by title
     */
    public function scopeSearch($query, $search)
    {
        return $query->where(function ($q) use ($search) {
            $q->where('document_number', 'like', "%{$search}%")
              ->orWhere('title', 'like', "%{$search}%")
              ->orWhere('description', 'like', "%{$search}%");
        });
    }

    /**
     * Get the total number of items in this control plan
     */
    public function getItemCountAttribute(): int
    {
        return $this->items()->count();
    }
}
