import 'dart:ui' as ui;

import 'package:anufa_minerva_mobile/features/dashboard/widgets/plied_cord_texture.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

const _accent = Color(0xFF6BA8F0);

Widget _host({bool paused = false, VoidCallback? onTap}) => MaterialApp(
      home: Scaffold(
        body: Stack(children: [
          const Positioned.fill(child: ColoredBox(color: Colors.black)),
          Positioned.fill(child: PliedCordTexture(accent: _accent, paused: paused)),
          Center(child: TextButton(onPressed: onTap, child: const Text('under the texture'))),
        ]),
      ),
    );

Future<List<int>> _render(WidgetTester t, double value) async {
  final bytes = await t.runAsync(() async {
    final recorder = ui.PictureRecorder();
    CordPainter(AlwaysStoppedAnimation(value), whiteOpacity: 0.10, accent: _accent, accentOpacity: 0.18).paint(Canvas(recorder), const Size(120, 60));
    final image = await recorder.endRecording().toImage(120, 60);
    return (await image.toByteData())!.buffer.asUint8List().toList();
  });
  return bytes!;
}

void main() {
  testWidgets('it animates while running, and only frames its own layer', (tester) async {
    await tester.pumpWidget(_host());
    await tester.pump(const Duration(seconds: 1));
    expect(tester.binding.hasScheduledFrame, isTrue); // the ticker keeps asking for frames
    expect(find.descendant(of: find.byType(PliedCordTexture), matching: find.byType(RepaintBoundary)), findsWidgets);
  });

  testWidgets('paused (offline) holds still but stays visible; resuming animates again', (tester) async {
    await tester.pumpWidget(_host(paused: true));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.binding.hasScheduledFrame, isFalse);
    expect(find.byType(CustomPaint), findsWidgets);

    await tester.pumpWidget(_host());
    await tester.pump(const Duration(seconds: 1));
    expect(tester.binding.hasScheduledFrame, isTrue);

    await tester.pumpWidget(_host(paused: true));
    await tester.pump(const Duration(seconds: 1));
    expect(tester.binding.hasScheduledFrame, isFalse);
  });

  testWidgets('with reduced motion it stays static', (tester) async {
    tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);
    await tester.pumpWidget(_host());
    await tester.pump(const Duration(seconds: 1));
    expect(tester.binding.hasScheduledFrame, isFalse);
  });

  testWidgets('it sits behind content and never takes taps', (tester) async {
    var taps = 0;
    await tester.pumpWidget(_host(onTap: () => taps++));
    await tester.tap(find.text('under the texture'));
    expect(taps, 1);
  });

  testWidgets('one loop travels exactly two tiles, so the end matches the start (no jump)', (tester) async {
    expect(CordPainter.travel, 24);
    final start = await _render(tester, 0);
    final end = await _render(tester, 1);
    final partway = await _render(tester, 0.1); // 2.4px: not a multiple of the 6px stroke spacing
    expect(end, start);
    expect(partway, isNot(start)); // it does move in between
  });
}
