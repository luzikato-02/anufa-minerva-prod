'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { BarcodeReader } from '@/lib/barcode-reader';
import { AlertCircle, Flashlight, FlashlightOff, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
    open: boolean;
    onClose: () => void;
    onScan: (barcode: string) => void;
}

// How often to run barcode detection against the live video frame.
const SCAN_INTERVAL_MS = 300;

// How often to nudge the camera into refocusing on browsers without
// continuous-autofocus support (e.g. Safari/iOS).
const REFOCUS_INTERVAL_MS = 2500;

// MediaTrackCapabilities/MediaTrackConstraintSet don't yet include the
// Image Capture API fields (focusMode, focusDistance, zoom, torch) in TS's
// DOM types.
type ExtendedCapabilities = MediaTrackCapabilities & {
    focusMode?: string[];
    focusDistance?: { min: number; max: number; step: number };
    zoom?: { min: number; max: number; step: number };
    torch?: boolean;
};

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [torchSupported, setTorchSupported] = useState(false);
    const [torchOn, setTorchOn] = useState(false);
    const [focusDistanceRange, setFocusDistanceRange] = useState<{ min: number; max: number; step: number } | null>(null);
    const [focusDistance, setFocusDistance] = useState<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const scanIntervalRef = useRef<number | null>(null);
    const refocusIntervalRef = useRef<number | null>(null);
    const torchOnRef = useRef(false);
    const isMountedRef = useRef(true);

    const clearRefocusNudge = () => {
        if (refocusIntervalRef.current !== null) {
            window.clearInterval(refocusIntervalRef.current);
            refocusIntervalRef.current = null;
        }
    };

    // "Continuous" autofocus on phone cameras is usually tuned for normal
    // photography distances and struggles at the few-cm range barcode
    // scanning needs. When manual focus distance control is available
    // (Chrome for Android), start near the lens's closest focus point and
    // let the user fine-tune with a slider. Returns the applied distance,
    // or null if manual focus distance isn't supported.
    const enableManualNearFocus = (track: MediaStreamTrack, capabilities?: ExtendedCapabilities): number | null => {
        const range = capabilities?.focusDistance;
        if (!capabilities?.focusMode?.includes('manual') || !range || range.max <= range.min) {
            return null;
        }

        const nearValue = range.max;
        track
            .applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance: nearValue } as MediaTrackConstraintSet] })
            .catch((err) => console.warn('Unable to set manual focus distance:', err));

        return nearValue;
    };

    // Most mobile browsers default to a fixed focus once the initial frame
    // is sharp. Continuous autofocus (Image Capture API, Chromium-only)
    // keeps the camera refocusing as it's moved closer to a barcode.
    // Returns true if continuous autofocus is supported.
    const enableContinuousFocus = (track: MediaStreamTrack, capabilities?: ExtendedCapabilities): boolean => {
        if (capabilities?.focusMode?.includes('continuous')) {
            const constraints: MediaTrackConstraintSet & { focusMode?: string } = {
                focusMode: 'continuous',
            };
            track.applyConstraints({ advanced: [constraints] }).catch((err) => {
                console.warn('Unable to enable continuous focus:', err);
            });
            return true;
        }

        return false;
    };

    // Safari/iOS doesn't expose focusMode at all, so the camera can settle
    // on the wrong focus distance and never re-trigger autofocus. Nudging
    // the zoom level (supported on iOS 15.4+) forces a refocus without a
    // visible flicker. If zoom isn't supported either, fall back to fully
    // restarting the stream, which also re-triggers the camera's autofocus.
    const startRefocusNudge = (track: MediaStreamTrack, capabilities: ExtendedCapabilities | undefined, deviceId?: string) => {
        const zoom = capabilities?.zoom;
        if (zoom && zoom.max > zoom.min) {
            const settings = track.getSettings() as MediaTrackSettings & { zoom?: number };
            const base = settings.zoom ?? zoom.min;
            const delta = zoom.step || (zoom.max - zoom.min) / 100;
            const nudged = base + delta <= zoom.max ? base + delta : base - delta;

            refocusIntervalRef.current = window.setInterval(() => {
                track
                    .applyConstraints({ advanced: [{ zoom: nudged } as MediaTrackConstraintSet] })
                    .then(() => track.applyConstraints({ advanced: [{ zoom: base } as MediaTrackConstraintSet] }))
                    .catch((err) => console.warn('Zoom refocus nudge failed:', err));
            }, REFOCUS_INTERVAL_MS);
            return;
        }

        refocusIntervalRef.current = window.setInterval(() => {
            startStream(deviceId).catch((err) => console.warn('Stream restart for refocus failed:', err));
        }, REFOCUS_INTERVAL_MS * 2);
    };

    // Requests a camera stream and attaches it to the video element. The
    // previous stream (if any) is only stopped once the new one is ready,
    // so a failed camera switch doesn't kill the current feed.
    const startStream = async (deviceId?: string): Promise<MediaStream> => {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: deviceId
                ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
                : { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
        }
        streamRef.current = stream;

        const track = stream.getVideoTracks()[0];
        const capabilities = track?.getCapabilities?.() as ExtendedCapabilities | undefined;

        clearRefocusNudge();
        const nearFocusValue = enableManualNearFocus(track, capabilities);
        if (nearFocusValue !== null) {
            setFocusDistanceRange(capabilities!.focusDistance!);
            setFocusDistance(nearFocusValue);
        } else {
            setFocusDistanceRange(null);
            setFocusDistance(null);

            if (!enableContinuousFocus(track, capabilities)) {
                startRefocusNudge(track, capabilities, deviceId);
            }
        }

        const torchAvailable = !!capabilities?.torch;
        setTorchSupported(torchAvailable);
        if (torchAvailable && torchOnRef.current) {
            track.applyConstraints({ advanced: [{ torch: true } as MediaTrackConstraintSet] }).catch((err) => {
                console.warn('Unable to restore torch state:', err);
            });
        } else if (!torchAvailable && torchOnRef.current) {
            torchOnRef.current = false;
            setTorchOn(false);
        }

        const video = videoRef.current;
        if (video) {
            video.srcObject = stream;
            await video.play();
        }

        return stream;
    };

    const handleFocusDistanceChange = (value: number) => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track) return;

        setFocusDistance(value);
        track
            .applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance: value } as MediaTrackConstraintSet] })
            .catch((err) => console.warn('Unable to set manual focus distance:', err));
    };

    const toggleTorch = async () => {
        const track = streamRef.current?.getVideoTracks()[0];
        if (!track) return;

        const next = !torchOnRef.current;
        try {
            await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
            torchOnRef.current = next;
            setTorchOn(next);
        } catch (err) {
            console.warn('Unable to toggle torch:', err);
        }
    };

    useEffect(() => {
        if (!open) return;

        isMountedRef.current = true;

        const startScanning = async () => {
            try {
                setIsLoading(true);
                setScanError(null);

                if (!navigator.mediaDevices?.getUserMedia) {
                    setScanError(
                        'Camera access is unavailable. Open this page over HTTPS (or via localhost) using a browser that supports camera access.',
                    );
                    setIsLoading(false);
                    return;
                }

                const stream = await startStream();

                if (!isMountedRef.current) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                // Device labels are only populated after permission is
                // granted, so enumerate cameras after the first stream.
                const devices = await navigator.mediaDevices.enumerateDevices();
                const cameras = devices.filter((d) => d.kind === 'videoinput');

                if (isMountedRef.current) {
                    setVideoDevices(cameras);
                    const activeDeviceId = stream.getVideoTracks()[0]?.getSettings().deviceId;
                    if (activeDeviceId) setSelectedDeviceId(activeDeviceId);
                }

                const reader = await BarcodeReader.create();

                if (!isMountedRef.current) return;

                setIsLoading(false);
                setIsScanning(true);

                scanIntervalRef.current = window.setInterval(async () => {
                    if (!videoRef.current || videoRef.current.readyState < videoRef.current.HAVE_CURRENT_DATA) {
                        return;
                    }

                    try {
                        const barcode = await reader.detect(videoRef.current);
                        if (barcode) {
                            onScan(barcode.rawValue);
                            handleClose();
                        }
                    } catch (err) {
                        console.error('Barcode detection error:', err);
                    }
                }, SCAN_INTERVAL_MS);
            } catch (err: any) {
                if (!isMountedRef.current) return;

                console.error('Scanner error:', err);
                if (err.name === 'NotAllowedError') {
                    setScanError(
                        'Camera access denied. Please allow camera permission.',
                    );
                } else if (err.name === 'NotFoundError') {
                    setScanError('No camera device found.');
                } else if (err.name === 'NotReadableError') {
                    setScanError('Camera is in use by another app.');
                } else {
                    setScanError(`Error: ${err.message}`);
                }
                setIsLoading(false);
            }
        };

        startScanning();

        return () => {
            isMountedRef.current = false;
            stopCamera();
        };
    }, [open]);

    const stopCamera = () => {
        if (scanIntervalRef.current !== null) {
            window.clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
        }

        clearRefocusNudge();

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
    };

    const handleCameraChange = async (deviceId: string) => {
        if (deviceId === selectedDeviceId) return;

        try {
            const stream = await startStream(deviceId);

            if (!isMountedRef.current) {
                stream.getTracks().forEach((t) => t.stop());
                return;
            }

            setSelectedDeviceId(deviceId);
        } catch (err: any) {
            console.error('Camera switch error:', err);
            setScanError(`Unable to switch camera: ${err.message}`);
        }
    };

    const handleManualInput = () => {
        const input = prompt('Enter batch number manually:');
        if (input?.trim()) {
            onScan(input.trim());
            handleClose();
        }
    };

    const handleClose = () => {
        stopCamera();
        setScanError(null);
        setIsScanning(false);
        setIsLoading(false);
        setVideoDevices([]);
        setSelectedDeviceId('');
        setTorchSupported(false);
        setTorchOn(false);
        torchOnRef.current = false;
        setFocusDistanceRange(null);
        setFocusDistance(null);
        onClose();
    };

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Scan Batch Barcode</DialogTitle>
                    <DialogDescription>
                        Point your camera at the barcode to scan
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {scanError ? (
                        <div className="flex gap-3 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
                            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                            <div>
                                <p className="text-sm font-medium text-destructive">
                                    Scanner Error
                                </p>
                                <p className="mt-1 text-xs text-destructive/80">
                                    {scanError}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {videoDevices.length > 1 && (
                                <Select value={selectedDeviceId} onValueChange={handleCameraChange}>
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select camera" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {videoDevices.map((device, index) => (
                                            <SelectItem key={device.deviceId} value={device.deviceId}>
                                                {device.label || `Camera ${index + 1}`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    playsInline
                                    muted
                                    className="h-full w-full object-cover"
                                />
                                {isLoading && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="h-8 w-8 animate-spin text-yellow-400" />
                                            <p className="text-xs text-yellow-400">
                                                Initializing scanner...
                                            </p>
                                        </div>
                                    </div>
                                )}
                                {isScanning && (
                                    <div className="pointer-events-none absolute inset-0">
                                        <div className="absolute inset-8 rounded-lg border-2 border-yellow-400 opacity-75" />
                                        <div className="absolute top-2 left-1/2 -translate-x-1/2 text-xs font-medium text-yellow-400">
                                            Align barcode within frame
                                        </div>
                                    </div>
                                )}
                                {isScanning && torchSupported && (
                                    <button
                                        type="button"
                                        onClick={toggleTorch}
                                        aria-label={torchOn ? 'Turn off flash' : 'Turn on flash'}
                                        aria-pressed={torchOn}
                                        className={`absolute top-2 right-2 rounded-full p-2 transition-colors ${
                                            torchOn
                                                ? 'bg-yellow-400 text-black'
                                                : 'bg-black/50 text-yellow-400'
                                        }`}
                                    >
                                        {torchOn ? (
                                            <FlashlightOff className="h-5 w-5" />
                                        ) : (
                                            <Flashlight className="h-5 w-5" />
                                        )}
                                    </button>
                                )}
                            </div>

                            {isScanning && focusDistanceRange && focusDistance !== null && (
                                <div className="space-y-1">
                                    <label htmlFor="focus-distance" className="text-xs text-muted-foreground">
                                        Focus
                                    </label>
                                    <input
                                        id="focus-distance"
                                        type="range"
                                        min={focusDistanceRange.min}
                                        max={focusDistanceRange.max}
                                        step={focusDistanceRange.step || (focusDistanceRange.max - focusDistanceRange.min) / 100}
                                        value={focusDistance}
                                        onChange={(e) => handleFocusDistanceChange(Number(e.target.value))}
                                        className="w-full"
                                    />
                                </div>
                            )}
                        </>
                    )}

                    <div className="flex gap-2 pt-2">
                        <Button
                            variant="outline"
                            onClick={handleClose}
                            className="h-10 flex-1 bg-transparent"
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="secondary"
                            onClick={handleManualInput}
                            className="h-10 flex-1"
                        >
                            Enter Manually
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
