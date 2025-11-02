'use client';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { debug } from 'console';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface BarcodeScannerProps {
    open: boolean;
    onClose: () => void;
    onScan: (barcode: string) => void;
}

async function loadQuagga() {
    if (window.Quagga) return Promise.resolve();
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src =
            'https://cdn.jsdelivr.net/npm/quagga@0.12.1/dist/quagga.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.body.appendChild(script);
    });
}

export function BarcodeScanner({ open, onClose, onScan }: BarcodeScannerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [scanError, setScanError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const streamRef = useRef<MediaStream | null>(null);
    const quaggaInitialized = useRef(false);

    useEffect(() => {
        if (!open) {
            quaggaInitialized.current = false;
            return;
        }

        let isMounted = true;

        const initQuagga = async () => {
            try {
                setIsLoading(true);
                setScanError(null);

                // Load Quagga library
                await loadQuagga();
                if (!isMounted) return;

                // Wait for dialog to render
                await new Promise(resolve => setTimeout(resolve, 100));
                if (!isMounted || !videoRef.current) {
                    console.log('Video ref not ready');
                    return;
                }

                console.log('Requesting camera access...');
                
                // Get camera stream
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { 
                        facingMode: 'environment',
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                });

                console.log('Camera stream obtained');

                if (!isMounted) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }

                streamRef.current = stream;

                // Attach stream to video
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    
                    // Wait a bit for video to start playing
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                if (!isMounted || quaggaInitialized.current) return;

                console.log('Initializing Quagga...');

                // Initialize Quagga
                const config = {
                    inputStream: {
                        type: 'LiveStream',
                        target: videoRef.current,
                    },
                    decoder: {
                        readers: [
                            'code_128_reader',
                            'ean_reader',
                            'ean_8_reader',
                            'code_39_reader',
                            'upc_reader',
                            'upc_e_reader',
                        ],
                    },
                    locator: {
                        patchSize: 'medium',
                        halfSample: true,
                    },
                    numOfWorkers: navigator.hardwareConcurrency || 4,
                    frequency: 10,
                };

                window.Quagga.init(config, (err: any) => {
                    if (!isMounted) return;
                    
                    if (err) {
                        console.error('Quagga init error:', err);
                        setScanError(
                            'Failed to initialize scanner. Please try again.',
                        );
                        setIsLoading(false);
                        return;
                    }

                    console.log('Quagga initialized successfully');
                    quaggaInitialized.current = true;
                    setIsLoading(false);
                    setIsScanning(true);
                    
                    window.Quagga.start();

                    window.Quagga.onDetected((result: any) => {
                        if (result?.codeResult?.code) {
                            const code = result.codeResult.code;
                            console.log('[SCAN SUCCESS]', code);
                            onScan(code);
                            handleClose();
                        }
                    });
                });
            } catch (err: any) {
                if (!isMounted) return;
                
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

        initQuagga();

        return () => {
            isMounted = false;
            stopCamera();
        };
    }, [open]);

    const stopCamera = () => {
        if (window.Quagga && quaggaInitialized.current) {
            try {
                window.Quagga.stop();
                window.Quagga.offDetected();
                quaggaInitialized.current = false;
            } catch (err) {
                console.warn('Error stopping Quagga:', err);
            }
        }
        
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        
        if (videoRef.current) {
            videoRef.current.srcObject = null;
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
                        </div>
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

declare global {
    interface Window {
        Quagga: any;
    }
}