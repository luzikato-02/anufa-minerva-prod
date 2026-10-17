<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/** The control plan module's settings: one row, created with the defaults on first use. */
class ControlPlanSetting extends Model
{
    protected $fillable = ['mill', 'org_plant', 'org_code', 'date_format', 'review_period_years', 'logo_path'];

    protected $casts = [
        'review_period_years' => 'integer',
    ];

    /** The company logo as a data: URI, which the print preview, dompdf and the settings page all load inline. */
    public function logoDataUri(): ?string
    {
        $path = $this->logoFile();

        return $path ? 'data:'.mime_content_type($path).';base64,'.base64_encode((string) file_get_contents($path)) : null;
    }

    /** The logo's absolute path on disk, or null when none is uploaded (or the file has gone). */
    public function logoFile(): ?string
    {
        $disk = Storage::disk('local');

        return $this->logo_path && $disk->exists($this->logo_path) ? $disk->path($this->logo_path) : null;
    }

    public static function current(): self
    {
        return self::query()->first() ?? self::create([
            'mill' => '',
            'org_plant' => '',
            'org_code' => '',
            'date_format' => 'id',
            'review_period_years' => 2,
        ]);
    }
}
