<?php

namespace App\ControlPlans;

use App\Models\ControlPlanSetting;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * The company logo one print, PDF or Word request prints, as the browser chose it for that plan: the shared logo
 * from Settings (the default), none, or an image kept only in the browser and sent with the request. That image
 * is never stored: the Word file needs it on disk, so it goes to a temporary file the caller removes with
 * cleanup() once the response is sent.
 */
class SheetLogo
{
    /** Largest logo image accepted, decoded. */
    private const MAX_BYTES = 2 * 1024 * 1024;

    private function __construct(
        public readonly ?string $uri,
        public readonly ?string $file,
        private readonly bool $temporary = false,
    ) {}

    public static function fromRequest(Request $request, ControlPlanSetting $settings): self
    {
        $logo = $request->input('logo', 'shared');

        return match ($logo) {
            'shared' => new self($settings->logoDataUri(), $settings->logoFile()),
            'none' => new self(null, null),
            default => self::upload(is_string($logo) ? $logo : ''),
        };
    }

    /** The sheet's logo keys, for PrintSheet::build(). */
    public function toArray(): array
    {
        return ['logo' => $this->uri, 'logo_file' => $this->file];
    }

    public function cleanup(): void
    {
        if ($this->temporary && $this->file) {
            @unlink($this->file);
        }
    }

    /** The image as a PNG, re-encoded so only its pixels reach dompdf and the Word file. */
    private static function upload(string $dataUri): self
    {
        $fail = fn () => throw ValidationException::withMessages(['logo' => 'The logo must be a PNG or JPG image, at most 2 MB.']);
        if (! preg_match('#^data:image/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$#', $dataUri, $m)) {
            $fail();
        }
        $bytes = base64_decode($m[2], true);
        $image = $bytes !== false && strlen($bytes) <= self::MAX_BYTES ? @imagecreatefromstring($bytes) : false;
        if (! $image) {
            $fail();
        }

        $w = imagesx($image);
        $h = imagesy($image);
        $scale = min(1, 1200 / $w, 400 / $h);
        $out = imagecreatetruecolor(max(1, (int) round($w * $scale)), max(1, (int) round($h * $scale)));
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
        imagecopyresampled($out, $image, 0, 0, 0, 0, imagesx($out), imagesy($out), $w, $h);

        ob_start();
        imagepng($out, null, 9);
        $png = (string) ob_get_clean();

        // PhpWord picks the image type from the extension, so the reserved temporary name gets one.
        $reserved = tempnam(sys_get_temp_dir(), 'cplogo');
        $file = $reserved.'.png';
        rename($reserved, $file);
        file_put_contents($file, $png);

        return new self('data:image/png;base64,'.base64_encode($png), $file, true);
    }
}
