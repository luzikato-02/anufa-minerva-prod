<?php

namespace App\Http\Controllers\ControlPlans;

use App\Http\Controllers\Controller;
use App\Models\ControlPlanRevision;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * Signing a box in a revision's signature block. Only the account the author linked to that box can sign it or
 * take the signature back, and only while the revision is still being worked on: a released revision is final.
 * Someone with control-plans.override can do either for that account; the revision history notes each time.
 */
class ControlPlanSignatureController extends Controller
{
    /** Largest signature image accepted, decoded. */
    private const MAX_BYTES = 1024 * 1024;

    public function store(Request $request, ControlPlanRevision $revision, string $signerId): JsonResponse
    {
        $box = $this->guard($request, $revision, $signerId);
        $request->validate(['image' => 'required|string|max:'.(int) (self::MAX_BYTES * 4 / 3 + 64)]);
        $proxy = $box['user_id'] !== $request->user()->id;

        $revision->signatures()->updateOrCreate(
            ['signer_id' => $signerId],
            ['user_id' => $box['user_id'], 'signed_by' => $proxy ? $request->user()->id : null, 'image' => self::png($request->input('image'))],
        );
        if ($proxy) {
            $this->note($revision, $request, 'Signed for '.self::who($box).'.');
        }

        return response()->json(['success' => true], 201);
    }

    public function destroy(Request $request, ControlPlanRevision $revision, string $signerId): JsonResponse
    {
        $box = $this->guard($request, $revision, $signerId);
        $removed = $revision->signatures()->where('signer_id', $signerId)->delete();
        if ($removed && $box['user_id'] !== $request->user()->id) {
            $this->note($revision, $request, 'Removed the signature of '.self::who($box).'.');
        }

        return response()->json(['success' => true]);
    }

    /** The box being signed, once the user may sign it: as its owner, or for its owner with control-plans.override. */
    private function guard(Request $request, ControlPlanRevision $revision, string $signerId): array
    {
        abort_unless($revision->isOpen(), 422, 'This revision is released, so its signatures can no longer change.');
        $box = $revision->signer($signerId);
        abort_if(! $box, 404, 'That signature box is no longer in the plan. Reload the page.');
        if ($box['user_id'] === $request->user()->id) {
            return $box;
        }
        abort_unless($request->user()->can('control-plans.override'), 403, 'Only '.self::who($box).' can sign here.');
        abort_if($box['user_id'] === null, 422, 'This box is signed on paper. Give it to an account in the editor to sign it here.');

        return $box;
    }

    private static function who(array $box): string
    {
        return $box['name'] !== '' ? $box['name'] : 'the person named in this box';
    }

    private function note(ControlPlanRevision $revision, Request $request, string $body): void
    {
        $revision->comments()->create(['user_id' => $request->user()->id, 'kind' => 'comment', 'body' => $body]);
    }

    /**
     * The uploaded or drawn image as a PNG data: URI. Re-encoding it keeps only the pixels, and scales a large
     * image down to what a 42 × 18 mm box needs.
     */
    private static function png(string $dataUri): string
    {
        $fail = fn () => throw ValidationException::withMessages(['image' => 'The signature must be a PNG or JPG image, at most 1 MB.']);
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
        $scale = min(1, 800 / $w, 400 / $h);
        $out = imagecreatetruecolor(max(1, (int) round($w * $scale)), max(1, (int) round($h * $scale)));
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagefill($out, 0, 0, imagecolorallocatealpha($out, 0, 0, 0, 127));
        imagecopyresampled($out, $image, 0, 0, 0, 0, imagesx($out), imagesy($out), $w, $h);

        ob_start();
        imagepng($out, null, 9);

        return 'data:image/png;base64,'.base64_encode((string) ob_get_clean());
    }
}
