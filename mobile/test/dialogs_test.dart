import 'package:anufa_minerva_mobile/core/theme/app_theme.dart';
import 'package:anufa_minerva_mobile/features/tension/recording/recording_widgets.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('the go-to-number dialog hugs its content instead of stretching to the screen height', (tester) async {
    tester.view.physicalSize = const Size(780, 1688); // 390x844 dp
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(MaterialApp(
      theme: buildTheme(Brightness.light),
      home: Builder(builder: (context) => Scaffold(body: TextButton(onPressed: () => askNumber(context, title: 'Go to spindle', current: 2, max: 84), child: const Text('open')))),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Go to spindle'), findsOneWidget);
    // The AlertDialog widget itself spans the overlay; the visible card is its Material.
    final card = find.descendant(of: find.byType(AlertDialog), matching: find.byType(Material)).first;
    expect(tester.getSize(card).height, lessThan(320)); // ~250 now; the stretched field made it fill the screen
  });

  testWidgets('an out-of-range number is explained under the field and the dialog stays open', (tester) async {
    tester.view.physicalSize = const Size(780, 1688);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    int? result = -1;
    await tester.pumpWidget(MaterialApp(
      theme: buildTheme(Brightness.light),
      home: Builder(builder: (context) => Scaffold(body: TextButton(onPressed: () async => result = await askNumber(context, title: 'Go to spindle', confirmLabel: 'Go to spindle', current: 2, max: 84), child: const Text('open')))),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    await tester.enterText(find.byType(TextField), '999');
    await tester.tap(find.text('Go to spindle').last); // the button; the title has the same words
    await tester.pumpAndSettle();
    expect(find.text('Enter a number from 1 to 84'), findsOneWidget);
    expect(result, -1); // still open

    await tester.enterText(find.byType(TextField), '12');
    await tester.tap(find.text('Go to spindle').last);
    await tester.pumpAndSettle();
    expect(result, 12);
  });
}
