import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useEffect, useRef, useState } from 'react';

const WIDTH = 600;
const HEIGHT = 240;
const INK = '#111827';

/** The drawn ink cropped to its bounds with a small margin, as a PNG data: URI; null when nothing is drawn. */
function cropped(canvas: HTMLCanvasElement): string | null {
    const ctx = canvas.getContext('2d')!;
    const { width, height } = canvas;
    const px = ctx.getImageData(0, 0, width, height).data;
    let [x0, y0, x1, y1] = [width, height, -1, -1];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (px[(y * width + x) * 4 + 3] > 0) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
            }
        }
    }
    if (x1 < 0) return null;
    const pad = 8;
    x0 = Math.max(0, x0 - pad);
    y0 = Math.max(0, y0 - pad);
    x1 = Math.min(width - 1, x1 + pad);
    y1 = Math.min(height - 1, y1 + pad);
    const out = document.createElement('canvas');
    out.width = x1 - x0 + 1;
    out.height = y1 - y0 + 1;
    out.getContext('2d')!.drawImage(
        canvas,
        x0,
        y0,
        out.width,
        out.height,
        0,
        0,
        out.width,
        out.height,
    );
    return out.toDataURL('image/png');
}

/**
 * Makes the paper of a photographed or scanned signature transparent, so only the ink prints and the crop can
 * trim to it. The paper's brightness is taken as the median, since ink covers a small part of the picture;
 * pixels near it fade out and darker ones keep their colour. A picture that already has transparency is left
 * as it is.
 */
function dropPaper(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
) {
    const img = ctx.getImageData(x, y, w, h);
    const px = img.data;
    const lum = new Uint8Array(px.length / 4);
    let opaque = 0;
    for (let i = 0; i < lum.length; i++) {
        const o = i * 4;
        lum[i] = (px[o] * 299 + px[o + 1] * 587 + px[o + 2] * 114) / 1000;
        if (px[o + 3] === 255) opaque++;
    }
    if (opaque < lum.length * 0.98) return;
    const paper = [...lum].sort((a, b) => a - b)[lum.length >> 1];
    // Fully clear within 30 of the paper, fully inked from 90 below it, faded in between.
    for (let i = 0; i < lum.length; i++) {
        const a = (paper - 30 - lum[i]) / 60;
        px[i * 4 + 3] = Math.round(255 * Math.min(1, Math.max(0, a)));
    }
    ctx.putImageData(img, x, y);
}

interface Props {
    open: boolean;
    /** Shown in the title, e.g. "Dibuat oleh". */
    role: string;
    name: string;
    onClose: () => void;
    /** Receives the signature as a PNG data: URI; throws to show an error. */
    onSave: (image: string) => Promise<void>;
}

/** Draw a signature with a mouse, finger or pen, or upload a picture of one. */
export function SignatureDialog({ open, role, name, onClose, onSave }: Props) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const file = useRef<HTMLInputElement>(null);
    const last = useRef<{ x: number; y: number } | null>(null);
    const [inked, setInked] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ctx = () => canvas.current?.getContext('2d') ?? null;

    const clear = () => {
        ctx()?.clearRect(0, 0, WIDTH, HEIGHT);
        setInked(false);
        setError(null);
    };

    useEffect(() => {
        if (open) {
            setInked(false);
            setError(null);
        }
    }, [open]);

    const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
        const r = e.currentTarget.getBoundingClientRect();
        return {
            x: ((e.clientX - r.left) * WIDTH) / r.width,
            y: ((e.clientY - r.top) * HEIGHT) / r.height,
        };
    };

    const stroke = (to: { x: number; y: number }) => {
        const c = ctx();
        const from = last.current;
        if (!c || !from) return;
        c.strokeStyle = INK;
        c.lineWidth = 3;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath();
        c.moveTo(from.x, from.y);
        c.lineTo(to.x === from.x && to.y === from.y ? to.x + 0.1 : to.x, to.y);
        c.stroke();
        last.current = to;
        setInked(true);
    };

    const upload = (f: File | undefined) => {
        if (!f) return;
        if (!['image/png', 'image/jpeg'].includes(f.type)) {
            setError('Choose a PNG or JPG picture of the signature.');
            return;
        }
        const url = URL.createObjectURL(f);
        const img = new Image();
        img.onload = () => {
            const c = ctx();
            if (!c) return;
            c.clearRect(0, 0, WIDTH, HEIGHT);
            const scale = Math.min(WIDTH / img.width, HEIGHT / img.height, 1);
            const w = img.width * scale;
            const h = img.height * scale;
            const x = Math.floor((WIDTH - w) / 2);
            const y = Math.floor((HEIGHT - h) / 2);
            c.drawImage(img, x, y, w, h);
            dropPaper(c, x, y, Math.ceil(w), Math.ceil(h));
            URL.revokeObjectURL(url);
            setInked(true);
            setError(null);
        };
        img.onerror = () => setError('That picture could not be opened.');
        img.src = url;
    };

    const save = async () => {
        const image = canvas.current && cropped(canvas.current);
        if (!image) {
            setError('Draw your signature in the box first.');
            return;
        }
        setBusy(true);
        setError(null);
        try {
            await onSave(image);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Sign as {name || 'yourself'}</DialogTitle>
                    <DialogDescription>
                        {role}. Draw your signature in the box with a mouse,
                        finger or pen, or upload a picture of it. It prints in
                        your box on this revision until the plan is edited.
                    </DialogDescription>
                </DialogHeader>
                <canvas
                    ref={canvas}
                    width={WIDTH}
                    height={HEIGHT}
                    role="img"
                    aria-label={
                        inked ? 'Your signature' : 'Empty signature box'
                    }
                    className="aspect-[5/2] w-full cursor-crosshair touch-none rounded-md border-2 border-dashed bg-white"
                    onPointerDown={(e) => {
                        e.currentTarget.setPointerCapture(e.pointerId);
                        last.current = point(e);
                        stroke(point(e));
                    }}
                    onPointerMove={(e) => {
                        if (last.current) stroke(point(e));
                    }}
                    onPointerUp={() => (last.current = null)}
                    onPointerCancel={() => (last.current = null)}
                />
                <input
                    ref={file}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                        upload(e.target.files?.[0]);
                        e.target.value = '';
                    }}
                />
                {error && (
                    <Alert variant="destructive" role="alert">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}
                <DialogFooter className="gap-2 sm:justify-between">
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => file.current?.click()}
                        >
                            Upload picture
                        </Button>
                        <Button
                            variant="ghost"
                            disabled={busy || !inked}
                            onClick={clear}
                        >
                            Clear
                        </Button>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button disabled={busy} onClick={() => void save()}>
                            {busy ? 'Signing…' : 'Sign'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
