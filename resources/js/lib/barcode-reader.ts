import 'barcode-detector/polyfill';

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
