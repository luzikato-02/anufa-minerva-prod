import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/ui/app_button.dart';

/// Opens the camera and returns the first barcode read, or null if dismissed.
/// A provider so tests (no camera) can substitute a fake.
typedef BarcodeScan = Future<String?> Function(BuildContext context);

final barcodeScanProvider = Provider<BarcodeScan>((_) => (context) => Navigator.of(context).push<String>(MaterialPageRoute(fullscreenDialog: true, builder: (_) => const ScannerPage())));

class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key});

  @override
  State<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<ScannerPage> {
  final _controller = MobileScannerController(detectionSpeed: DetectionSpeed.noDuplicates, formats: const [BarcodeFormat.code128, BarcodeFormat.code39, BarcodeFormat.ean13, BarcodeFormat.ean8, BarcodeFormat.qrCode, BarcodeFormat.dataMatrix, BarcodeFormat.itf14, BarcodeFormat.codabar, BarcodeFormat.upcA]);
  bool _done = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_done) return;
    final value = capture.barcodes.map((b) => b.rawValue).whereType<String>().firstOrNull;
    if (value == null || value.isEmpty) return;
    _done = true;
    Navigator.of(context).pop(value);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Scan barcode'), actions: [
          IconButton(tooltip: 'Toggle flashlight', icon: const Icon(LucideIcons.flashlight), onPressed: _controller.toggleTorch),
        ]),
        body: Stack(children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(mainAxisSize: MainAxisSize.min, children: [
                  const Icon(LucideIcons.cameraOff, size: 40),
                  const SizedBox(height: 12),
                  Text(error.errorCode == MobileScannerErrorCode.permissionDenied ? 'Camera permission is needed to scan. Enable it in Settings, or type the batch number instead.' : 'The camera is not available. Type the batch number instead.', textAlign: TextAlign.center),
                  const SizedBox(height: 16),
                  AppButton(label: 'Close', variant: AppButtonVariant.outline, onPressed: () => Navigator.of(context).pop()),
                ]),
              ),
            ),
          ),
          Center(child: Container(width: 280, height: 160, decoration: BoxDecoration(border: Border.all(color: Colors.white70, width: 2), borderRadius: BorderRadius.circular(12)))),
          const Positioned(left: 0, right: 0, bottom: 32, child: Text('Point the camera at the batch barcode', textAlign: TextAlign.center, style: TextStyle(color: Colors.white, fontSize: 15))),
        ]),
      );
}
