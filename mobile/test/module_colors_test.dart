import 'dart:math' as math;

import 'package:anufa_minerva_mobile/app/nav.dart';
import 'package:anufa_minerva_mobile/core/theme/app_theme.dart';
import 'package:anufa_minerva_mobile/features/dashboard/widgets/module_tile.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/pump.dart';

double _lin(double c) => c <= 0.04045 ? c / 12.92 : math.pow((c + 0.055) / 1.055, 2.4).toDouble();
double _luma(Color c) => 0.2126 * _lin(c.r) + 0.7152 * _lin(c.g) + 0.0722 * _lin(c.b);
double contrast(Color a, Color b) {
  final hi = math.max(_luma(a), _luma(b)), lo = math.min(_luma(a), _luma(b));
  return (hi + 0.05) / (lo + 0.05);
}

/// OKLCH hue in degrees.
double oklchHue(Color c) {
  final r = _lin(c.r), g = _lin(c.g), b = _lin(c.b);
  final l = math.pow(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b, 1 / 3);
  final m = math.pow(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b, 1 / 3);
  final s = math.pow(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b, 1 / 3);
  final a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
  final bb = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
  return (math.atan2(bb, a) * 180 / math.pi + 360) % 360;
}

double hueGap(Color a, Color b) {
  final d = (oklchHue(a) - oklchHue(b)).abs();
  return math.min(d, 360 - d);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  for (final (name, tokens) in [('light', AppTokens.light), ('dark', AppTokens.dark)]) {
    group('$name module colours', () {
      final tints = {'process': tokens.moduleProcess, 'inventory': tokens.moduleInventory, 'loom': tokens.moduleLoom};

      test('icon on its fill is comfortably readable (>= 4.5:1, above the 3:1 floor for icons)', () {
        tints.forEach((cat, tint) => expect(contrast(tint.icon, tint.fill), greaterThanOrEqualTo(4.5), reason: cat));
      });

      test('category hues stay at least 15 degrees from success, warning and destructive', () {
        final status = [tokens.success, tokens.warning, tokens.t.destructive, tokens.t.destructiveForeground];
        tints.forEach((cat, tint) {
          for (final s in status) {
            expect(hueGap(tint.fill, s), greaterThanOrEqualTo(15), reason: '$cat fill vs a status colour');
            expect(hueGap(tint.icon, s), greaterThanOrEqualTo(15), reason: '$cat icon vs a status colour');
          }
        });
      });

      test('categories are distinguishable from each other by hue', () {
        expect(hueGap(tokens.moduleProcess.fill, tokens.moduleInventory.fill), greaterThan(30));
        expect(hueGap(tokens.moduleProcess.fill, tokens.moduleLoom.fill), greaterThan(30));
        expect(hueGap(tokens.moduleInventory.fill, tokens.moduleLoom.fill), greaterThan(30));
      });
    });
  }

  test('a module keeps its category colour regardless of grid position; admin and documents are neutral', () {
    final byPath = {for (final g in navGroups) for (final i in g.items) i.path: i.category};
    expect(byPath['/twisting-tension'], ModuleCategory.process);
    expect(byPath['/weaving-tension'], ModuleCategory.process);
    expect(byPath['/stock-taking'], ModuleCategory.inventory);
    expect(byPath['/finish-earlier'], ModuleCategory.loom);
    expect(byPath['/finish-earlier/scan'], ModuleCategory.loom);
    for (final p in ['/users', '/activity-log', '/document-intelligence', '/dashboard']) {
      expect(byPath[p], ModuleCategory.general, reason: p);
    }
  });

  testWidgets('on Home, tiles of one category share a colour and differ from other categories and the neutral tile', (tester) async {
    await pumpSignedIn(
      tester,
      permissions: const ['tension-records.create', 'tension-records.view', 'stock-take.create', 'stock-take.view', 'finish-earlier.view', 'finish-earlier.create'],
      routes: const {},
      path: '/dashboard',
    );
    Color? fillOf(String label) {
      final tile = find.byWidgetPredicate((w) => w is ModuleTile && w.label == label);
      for (final c in tester.widgetList<Container>(find.descendant(of: tile, matching: find.byType(Container)))) {
        final d = c.decoration;
        if (d is BoxDecoration && d.color != null && d.borderRadius != null) return d.color;
      }
      return null;
    }

    final twisting = fillOf('Twisting Tension');
    expect(twisting, isNotNull);
    expect(fillOf('Weaving Tension'), twisting); // same category, same colour
    expect(fillOf('Tension Records'), twisting);
    expect(fillOf('Batch Stock Taking'), isNot(twisting));
    expect(fillOf('Finish Earlier Form'), isNot(twisting));
    expect(fillOf('Batch Stock Taking'), isNot(fillOf('Finish Earlier Form')));
    expect(fillOf('All modules'), isNot(twisting)); // neutral
  });
}
