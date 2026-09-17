import 'barcode-detector/polyfill';
import { setZXingModuleOverrides } from 'barcode-detector';
import zxingReaderWasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url';

// Self-host the ZXing WASM binary as a bundled Vite asset instead of the
// library's default of fetching it from jsDelivr's CDN at runtime. This app
// runs on factory-floor networks — barcode scanning shouldn't depend on an
// external CDN being reachable, and self-hosting also removes the ~600ms
// cold-fetch latency from the first scan of a session.
setZXingModuleOverrides({ locateFile: () => zxingReaderWasmUrl });

// https://developer.mozilla.org/en-US/docs/Web/API/Barcode_Detection_API#supported_barcode_formats
// Mirrors the format whitelist used by georapbox/barcode-scanner.
const WHITELISTED_FORMATS: BarcodeFormat[] = [
    'aztec',
    'code_128',
    'code_39',
    'code_93',
    'codabar',
    'data_matrix',
    'ean_13',
    'ean_8',
    'itf',
    'pdf417',
    'qr_code',
    'upc_a',
    'upc_e',
];

export interface DetectedBarcodeResult {
    rawValue: string;
    format: string;
}

/**
 * Thin wrapper around the (native or polyfilled) BarcodeDetector API.
 */
export class BarcodeReader {
    private readonly detector: BarcodeDetector;

    private constructor(formats: BarcodeFormat[]) {
        this.detector = new BarcodeDetector({ formats });
    }

    static async getSupportedFormats(): Promise<BarcodeFormat[]> {
        const supported = await BarcodeDetector.getSupportedFormats();
        return WHITELISTED_FORMATS.filter((format) => supported.includes(format));
    }

    static async create(): Promise<BarcodeReader> {
        const formats = await BarcodeReader.getSupportedFormats();
        return new BarcodeReader(formats.length > 0 ? formats : WHITELISTED_FORMATS);
    }

    /**
     * Detects a barcode from the given video frame. Returns `null` when no
     * barcode is present in the current frame (this is expected while the
     * camera is still searching, not an error).
     */
    async detect(source: HTMLVideoElement): Promise<DetectedBarcodeResult | null> {
        const results = await this.detector.detect(source);
        const first = results[0];
        return first ? { rawValue: first.rawValue, format: first.format } : null;
    }
}

// WASM module instantiation is the expensive part of BarcodeReader.create()
// (measured ~600ms cold). Call this as soon as a scan screen mounts — well
// before the user taps "Scan" — so the module is already warm by the time
// they open the scanner. Cached: later calls (including the scanner dialog
// itself) reuse the same instance instead of re-initializing.
let warmReaderPromise: Promise<BarcodeReader> | null = null;
export function preloadBarcodeReader(): Promise<BarcodeReader> {
    if (!warmReaderPromise) {
        warmReaderPromise = BarcodeReader.create();
    }
    return warmReaderPromise;
}
