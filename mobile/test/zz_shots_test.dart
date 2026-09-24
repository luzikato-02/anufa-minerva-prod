// TEMPORARY: renders the real screens to PNG for the design preview. Not part of the app or the suite.
import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:anufa_minerva_mobile/app/router.dart';
import 'package:anufa_minerva_mobile/core/api/api_client.dart';
import 'package:anufa_minerva_mobile/features/tension/recording/recording_widgets.dart' show NumberStepper, Numpad;
import 'package:anufa_minerva_mobile/features/dashboard/shifts.dart' show clockProvider;
import 'package:anufa_minerva_mobile/main.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'support/fakes.dart';

const _out = String.fromEnvironment('SHOTS_DIR', defaultValue: '/tmp/shots');
const _fontsDir = String.fromEnvironment('FONTS_DIR', defaultValue: '');
const _widthDp = int.fromEnvironment('WIDTH_DP', defaultValue: 390);
const _heightDp = int.fromEnvironment('HEIGHT_DP', defaultValue: 844);
const _scale = String.fromEnvironment('TEXT_SCALE', defaultValue: '1.0');
final _boundaryKey = GlobalKey();

const _allPerms = [
  'tension-records.create',
  'tension-records.view',
  'tension-records.edit',
  'stock-take.create',
  'stock-take.view',
  'finish-earlier.view',
  'finish-earlier.create',
  'finish-earlier.edit',
  'machine-maintenance.view',
  'torque-checks.create',
  'torque-checks.view',
  'creel-types.view',
  'users.view',
  'activity-log.view',
];

final _queue = <Map<String, dynamic>>[
  {
    'id': 'a1',
    'method': 'POST',
    'path': '/tension-records',
    'data': {},
    'label': 'Twisting record · Machine T-04',
    'createdAt': '2026-09-17T09:41:00',
    'attempts': 1,
    'error': null,
    'failed': false,
  },
  {
    'id': 'a2',
    'method': 'POST',
    'path': '/stock-take-records/record-batch',
    'data': {},
    'label': 'Stock batch B1',
    'createdAt': '2026-09-17T09:12:00',
    'attempts': 3,
    'error': 'Batch already recorded in this session',
    'failed': true,
  },
];

Map<String, dynamic> _page(List rows) => {'data': rows, 'current_page': 1, 'last_page': 1, 'total': rows.length};

final _twistingRec = {
  'id': 7,
  'record_type': 'twisting',
  'created_at': '2026-09-17T03:00:00.000000Z',
  'form_data': {'machineNumber': 'T-01', 'dtexNumber': '1100', 'specTens': 40, 'tensPlus': 5},
  'metadata': {'operator': 'Ana', 'item_number': 'ITM-1', 'yarn_code': 'Y9', 'completed_measurements': 2, 'total_measurements': 2, 'progress_percentage': 100},
  'measurement_data': {'2': {'max': 44, 'min': 38}, '1': {'max': 41, 'min': 39}},
  'problems': [
    {'id': 'p1', 'spindleNumber': 2, 'description': 'Loose thread', 'status': 'open', 'timestamp': '2026-09-17T03:10:00Z'},
  ],
};
final _weavingRec = {
  'id': 9,
  'record_type': 'weaving',
  'created_at': '2026-09-17T03:00:00.000000Z',
  'form_data': {'machineNumber': 'W-3', 'productionOrder': 'PO123', 'specTens': 30, 'tensPlus': 3},
  'metadata': {'operator': 'Budi', 'item_number': 'FAB-1', 'status': 'in_progress', 'completed_measurements': 1, 'total_measurements': 4, 'progress_percentage': 25},
  'measurement_data': {
    'AI': {'A': {'1': {'max': 31, 'min': 29}}},
  },
  'problems': [],
};
final _sessionBody = {
  'success': true,
  'data': {
    'id': 4,
    'session_id': '123456',
    'indv_batch_data': [
      {'batch_number': 'B1', 'material_code': 'M1', 'material_description': 'Yarn', 'weight': '12.5', 'bobbin_qty': '4'},
      {'Batch Number': 'B2', 'Material Code': 'M2', 'Material Desciption': 'Tape'},
    ],
    'recorded_batches': [],
    'metadata': {'total_batches': 2, 'total_checked_batches': 0, 'total_materials': 2, 'session_leader': 'Ana', 'session_status': 'In Progress'},
  },
};


List<Map<String, dynamic>> _problemRows() => [
      for (final (i, r) in [
        (7, 'twisting', 2, null, 'Loose thread near the guide, tension drops on every second pass', 'ITM-1', 'T-01'),
        (9, 'weaving', null, 'AI-A-Col3', 'Broken end at the creel, replaced and rechecked', 'FAB-1', 'W-3'),
        (7, 'twisting', 12, null, 'Uneven twist on the outer spindles after the last doff', 'ITM-1', 'T-01'),
        (11, 'twisting', 31, null, 'Yarn snagging at the ring', 'ITM-4', 'T-04'),
        (12, 'weaving', null, 'BO-C-Col88', 'Tension out of range for three columns in a row', 'FAB-2', 'W-1'),
        (13, 'twisting', 5, null, 'Traveller worn, replaced', 'ITM-9', 'T-02'),
        (14, 'weaving', null, 'AO-B-Col12', 'Knot in the warp, cut and rejoined', 'FAB-3', 'W-2'),
      ].indexed)
        {
          'record_id': r.$1, 'problem_id': 'p$i', 'record_type': r.$2, 'spindle_number': r.$3, 'position': r.$4, 'description': r.$5,
          'item_number': r.$6, 'machine_number': r.$7, 'status': 'open', 'timestamp': '2026-09-17T0${i}:10:00Z', 'record_created_at': '2026-09-17T0${i}:00:00Z',
        },
    ];

Map<String, dynamic> _trend(String type) {
  final problems = type == 'twisting' ? [0, 1, 0, 2, 3, 0, 1, 0, 0, 4, 2, 1, 0, 2] : [1, 0, 0, 1, 0, 2, 0, 0, 1, 0, 0, 3, 1, 0];
  final measurements = type == 'twisting' ? [120, 180, 90, 210, 260, 40, 0, 150, 230, 280, 300, 190, 170, 240] : [60, 0, 110, 95, 140, 20, 0, 80, 120, 105, 160, 130, 90, 75];
  return {
    'status': 'success',
    'data': {
      'type': type,
      'days': [
        for (var i = 0; i < 14; i++) {'date': '2026-09-${(4 + i).toString().padLeft(2, '0')}', 'problems': problems[i], 'measurements': measurements[i]},
      ],
    },
  };
}

Map<String, Handler> _baseRoutes() => {
      'GET /dashboard': (_) => (
            status: 200,
            body: {
              'tension': {'total': 12, 'twisting': 7, 'weaving': 5, 'open_problems': 3},
              'stockTake': {'total': 4, 'in_progress': 1, 'completed': 3, 'completion': 75},
              'users': null,
              'finishEarlier': {'total': 12, 'this_week': 4},
            }
          ),
      'GET /tension-statistics': (_) => (status: 200, body: {'status': 'success', 'data': {'total_records': 12, 'twisting_records': 7, 'weaving_records': 5, 'twisting_problems': 2, 'weaving_problems': 1}}),
      'GET /tension-records': (o) => (status: 200, body: _page(o.queryParameters['type'] == 'twisting' ? [_twistingRec] : [_weavingRec])),
      'GET /tension-problems': (_) => (status: 200, body: _page(_problemRows())),
      'GET /tension-trends': (o) => (status: 200, body: _trend('${o.queryParameters['type']}')),
      'POST /tension-records': (_) => (status: 500, body: {'message': 'Server error'}),
      'POST /stock-take-records/record-batch': (_) => (status: 500, body: {'message': 'Server error'}),
      'GET /tension-records/7': (_) => (status: 200, body: {'status': 'success', 'data': _twistingRec}),
      'POST /tension-records/start-session': (_) => (status: 201, body: {'status': 'success', 'data': {'id': 90}}),
      'PUT /tension-records/90': (_) => (status: 200, body: {'status': 'success', 'data': {'id': 90}}),
      'GET /tension-records/session/PO5': (_) => (status: 404, body: {'status': 'error'}),
      'GET /stock-take-records/session/123456': (_) => (status: 200, body: _sessionBody),
      'GET /stock-take-records/check-batch': (o) => (
            status: 200,
            body: {'exists': true, 'already_recorded': false, 'message': 'Batch is valid', 'batch_data': (_sessionBody['data'] as Map)['indv_batch_data'][0]}
          ),
    };

class _Shots {
  _Shots(this.tester, this.mode);
  final WidgetTester tester;
  final String mode;

  static final _phone = Size(_widthDp * 2.0, _heightDp * 2.0);
  static final _tall = Size(_widthDp * 2.0, 3600);

  Future<void> _capture(String name) async {
    await tester.pump(const Duration(milliseconds: 400));
    Object? ex;
    final seen = <String>{};
    while ((ex = tester.takeException()) != null) {
      final first = ex.toString().split('\n').first;
      if (seen.add(first)) print('LAYOUT-ERROR [$name-$mode] $first');
    }
    final boundary = _boundaryKey.currentContext!.findRenderObject()! as RenderRepaintBoundary;
    final bytes = await tester.runAsync(() async {
      final image = await boundary.toImage(pixelRatio: 2);
      final data = await image.toByteData(format: ui.ImageByteFormat.png);
      return data!.buffer.asUint8List();
    });
    File('$_out/$name-$mode.png')
      ..createSync(recursive: true)
      ..writeAsBytesSync(bytes!);
  }

  /// Captures at true phone size (390x844 dp); interactions run on a tall viewport so lazy lists build fully.
  /// [scrolled] adds a second capture after scrolling to the bottom, for screens longer than the viewport.
  Future<void> shot(String name, {bool scrolled = false, double dy = 0}) async {
    tester.view.physicalSize = _phone;
    await tester.pump(const Duration(milliseconds: 300));
    if (dy != 0) {
      await tester.drag(find.byType(ListView).first, Offset(0, -dy));
      await tester.pump(const Duration(milliseconds: 500));
    }
    await _capture(name);
    if (scrolled) {
      final list = find.byType(ListView);
      if (list.evaluate().isNotEmpty) {
        await tester.drag(list.first, const Offset(0, -3000));
        await tester.pump(const Duration(milliseconds: 600));
        await _capture('$name-b');
      }
    }
    tester.view.physicalSize = _tall;
    await tester.pump(const Duration(milliseconds: 300));
  }

  static final _seen = <String>{};

  Future<void> boot({List<String> perms = _allPerms, Map<String, Handler> routes = const {}, String path = '/dashboard', List<Map<String, dynamic>>? queue, bool signedIn = true}) async {
    final dark = mode == 'dark';
    FlutterError.onError = (d) {
      final line = d.toString().split('\n').where((l) => l.contains('overflowed') || l.contains('file:')).take(3).join(' | ');
      if (_seen.add(line)) {
        // ignore: avoid_print
        print('OVFDETAIL: ${line.replaceAll('file:///home/anufaroot/projects/anufa-minerva-prod/mobile/', '')}');
      }
    };
    tester.view.physicalSize = _tall;
    tester.view.devicePixelRatio = 2;
    tester.view.padding = const FakeViewPadding(top: 56, bottom: 48);
    tester.view.viewPadding = const FakeViewPadding(top: 56, bottom: 48);
    tester.platformDispatcher.platformBrightnessTestValue = dark ? Brightness.dark : Brightness.light;
    tester.platformDispatcher.textScaleFactorTestValue = double.parse(_scale);
    tester.platformDispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(disableAnimations: true); // a still frame of the texture
    final adapter = FakeAdapter({
      'GET /auth/me': (_) => (status: 200, body: sessionJson(permissions: perms)),
      ..._baseRoutes(),
      ...routes,
    });
    await tester.pumpWidget(RepaintBoundary(
      key: _boundaryKey,
      child: ProviderScope(
      key: UniqueKey(),
      overrides: [clockProvider.overrideWith((ref) => Stream.value(DateTime(2026, 9, 19, 9, 30))), ...overridesFor(adapter, MemoryTokenStore(signedIn ? 't' : null), queue: MemoryQueueStorage(queue == null ? [] : [for (final q in queue) Map<String, dynamic>.from(q)])),
      ],
      child: const MinervaApp(),
    )));
    await tester.pumpAndSettle();
    ProviderScope.containerOf(tester.element(find.byType(MaterialApp))).read(routerProvider).go(path);
    await tester.pumpAndSettle();
  }

  Future<void> tapText(String t, {bool last = false}) async {
    await tester.tap(last ? find.text(t).last : find.text(t).first);
    await tester.pumpAndSettle();
  }

  Future<void> keys(String digits) async {
    for (final d in digits.split('')) {
      await tester.tap(find.descendant(of: find.byType(Numpad), matching: find.widgetWithText(InkWell, d)).first);
      await tester.pump();
    }
  }
}

Future<void> _loadFonts() async {
  Future<void> load(String family, List<String> assets) async {
    final l = FontLoader(family);
    for (final a in assets) {
      l.addFont(rootBundle.load(a));
    }
    await l.load();
  }

  if (_fontsDir.isEmpty) {
    await load('Instrument Sans', ['assets/fonts/InstrumentSans-Regular.ttf', 'assets/fonts/InstrumentSans-Medium.ttf', 'assets/fonts/InstrumentSans-SemiBold.ttf']);
  } else {
    // Test-only copies of the bundled fonts with U+00B1 added (the shipped font lacks it; phones fall back to the system font).
    final sans = FontLoader('Instrument Sans');
    for (final w in ['Regular', 'Medium', 'SemiBold']) {
      sans.addFont(Future.value(ByteData.sublistView(File('$_fontsDir/InstrumentSans-$w.ttf').readAsBytesSync())));
    }
    await sans.load();
  }
  await load('packages/lucide_icons_flutter/Lucide', ['packages/lucide_icons_flutter/assets/lucide.ttf']);
  await load('MaterialIcons', ['fonts/MaterialIcons-Regular.otf']);
  // Instrument Sans has no U+00B1 (+/-); phones fall back to the system font for it, so register one for the same purpose.
  final fb = FontLoader('FallbackSans')..addFont(Future.value(ByteData.sublistView(File('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf').readAsBytesSync())));
  await fb.load();
  // The app asks for the platform's `monospace` face (Droid Sans Mono on Android); DejaVu Sans Mono is the closest available stand-in.
  final mono = FontLoader('monospace');
  for (final f in ['DejaVuSansMono.ttf', 'DejaVuSansMono-Bold.ttf']) {
    final bytes = File('/usr/share/fonts/truetype/dejavu/$f').readAsBytesSync();
    mono.addFont(Future.value(ByteData.sublistView(bytes)));
  }
  await mono.load();
}

void main() {
  setUpAll(() async {
    TestWidgetsFlutterBinding.ensureInitialized();
    await _loadFonts();
  });
  setUp(() => SharedPreferences.setMockInitialValues({}));

  for (final mode in ['light', 'dark']) {
    testWidgets('shots $mode: auth + home + landings', (tester) async {
      addTearDown(tester.view.reset);
      final s = _Shots(tester, mode);
      await s.boot(signedIn: false, path: '/login');
      await s.shot('01-login');
      await s.tapText('Forgot password?');
      await s.shot('02-forgot-password');

      await s.boot(queue: _queue);
      await s.shot('03-home');
      await s.boot();
      await s.shot('04-home-synced');
      await tester.tap(find.widgetWithText(InkWell, 'Scan').first);
      await tester.pumpAndSettle();
      await s.shot('80-home-scan-sheet');
      await s.boot();
      await s.shot('83-home-problems', dy: 560);
      await s.shot('84-home-trends', dy: 1100);
      await tester.tap(find.widgetWithText(InkWell, 'Weaving').last);
      await tester.pumpAndSettle();
      await s.shot('85-home-trends-weaving', dy: 1100);
      await s.shot('86-home-bottom', scrolled: true);
      await s.boot();
      await tester.drag(find.byType(PageView), const Offset(-200, 0));
      await tester.pumpAndSettle();
      await s.shot('81-home-stat-stock');
      await tester.drag(find.byType(PageView), const Offset(-200, 0));
      await tester.pumpAndSettle();
      await s.shot('82-home-stat-finish');
      await s.boot();
      await s.tapText('All modules');
      await s.shot('05-drawer');
      await s.boot(path: '/record');
      await s.shot('06-record');
      await s.boot(path: '/records');
      await s.shot('07-records');
      await s.boot(path: '/more');
      await s.shot('08-more');
    });
  }
  for (final mode in ['light', 'dark']) {
    testWidgets('shots $mode: records, sync, settings', (tester) async {
      addTearDown(tester.view.reset);
      final s = _Shots(tester, mode);
      await s.boot(path: '/tension-records');
      await s.shot('10-tension-records-twisting');
      await s.tapText('Weaving');
      await s.shot('11-tension-records-weaving');
      await s.tapText('Problems');
      await s.shot('12-tension-records-problems');
      await s.boot(path: '/tension-records');
      await tester.tap(find.text('ITM-1'));
      await tester.pumpAndSettle();
      await s.shot('13-tension-detail');
      await s.boot(path: '/tension-records');
      await tester.tap(find.byTooltip('Open navigation menu'));
      await tester.pumpAndSettle();
      await s.shot('14-drawer-module-screen');
      await s.boot(path: '/sync', queue: _queue);
      await s.shot('15-sync-queue');
      await s.boot(path: '/sync');
      await s.shot('16-sync-empty');
      await s.boot(path: '/settings/profile');
      await s.shot('17-settings-profile');
      await s.boot(path: '/settings/password');
      await s.shot('18-settings-password');
      await s.boot(path: '/settings/appearance');
      await s.shot('19-settings-appearance');
      await s.boot(path: '/liner-material-io/record');
      await s.shot('20-placeholder-module');
    });
  }

  for (final mode in ['light', 'dark']) {
    testWidgets('shots $mode: twisting flow', (tester) async {
      addTearDown(tester.view.reset);
      final s = _Shots(tester, mode);
      await s.boot(path: '/twisting-tension');
      await s.shot('30-twisting-params-empty', scrolled: true);
      final f = find.byType(TextField);
      for (final e in {0: 'Ana Operator', 1: 'ITM-1', 2: 'Y9', 3: 'T-04', 4: '1000', 5: '1100', 6: '600', 7: '40', 8: '5', 9: '8000'}.entries) {
        await tester.enterText(f.at(e.key), e.value);
      }
      await tester.pumpAndSettle();
      await s.shot('31-twisting-params', scrolled: true);
      await s.tapText('Start recording');
      await s.shot('32-twisting-numpad-empty', scrolled: true);
      await s.keys('44.5');
      await s.shot('33-twisting-numpad-typing');
      await s.tapText('Submit Max');
      await s.tapText('Min');
      await s.keys('33');
      await s.tapText('Submit Min');
      await tester.tap(find.byTooltip('Previous spindle'));
      await tester.pumpAndSettle();
      await s.shot('34-twisting-numpad-out-of-spec', scrolled: true);
      await tester.tap(find.byTooltip('Next spindle'));
      await tester.pumpAndSettle();
      await s.tapText('Finish');
      await s.shot('35-twisting-finish-dialog');
      await s.tapText('Cancel');
      await tester.tap(find.descendant(of: find.byType(NumberStepper), matching: find.byWidgetPredicate((w) => w is Text && RegExp(r'^\d+$').hasMatch(w.data ?? ''))));
      await tester.pumpAndSettle();
      await s.shot('36-twisting-go-to-spindle');
      await s.tapText('Cancel');
      await tester.tap(find.textContaining('Report problem for spindle '));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField).first, 'Loose thread near the guide');
      await tester.pumpAndSettle();
      await s.shot('37-twisting-problem');
    });
  }

  for (final mode in ['light', 'dark']) {
    testWidgets('shots $mode: weaving flow', (tester) async {
      addTearDown(tester.view.reset);
      final s = _Shots(tester, mode);
      await s.boot(path: '/weaving-tension');
      await s.shot('40-weaving-select');
      await tester.enterText(find.byType(TextField).first, 'PO5');
      await tester.tap(find.text('Create new session'));
      await tester.pumpAndSettle();
      await s.shot('41-weaving-params-empty', scrolled: true);
      final f = find.byType(TextField);
      for (final e in {0: 'FAB-1', 1: 'Belt fabric', 3: '1000', 4: 'BL-22', 5: 'C-104', 6: '30', 7: '3', 8: 'W-3', 9: 'Budi'}.entries) {
        await tester.enterText(f.at(e.key), e.value);
      }
      await tester.pumpAndSettle();
      await s.shot('42-weaving-params', scrolled: true);
      await s.tapText('Start recording');
      await s.shot('43-weaving-numpad-empty', scrolled: true);
      await s.keys('31');
      await s.tapText('Submit Max');
      await s.tapText('Min');
      await s.keys('26');
      await s.tapText('Submit Min');
      await tester.tap(find.byTooltip('Previous column'));
      await tester.pumpAndSettle();
      await s.shot('44-weaving-numpad-out-of-spec', scrolled: true);
      await tester.tap(find.byTooltip('Next column'));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Report problem for'));
      await tester.pumpAndSettle();
      await s.shot('45-weaving-problem');
    });
  }

  for (final mode in ['light', 'dark']) {
    testWidgets('shots $mode: stock flow', (tester) async {
      addTearDown(tester.view.reset);
      final s = _Shots(tester, mode);
      await s.boot(path: '/stock-taking');
      await s.shot('50-stock-session-select');
      await tester.enterText(find.byType(TextField).first, '123456');
      await tester.tap(find.text('Load session'));
      await tester.pumpAndSettle();
      await s.shot('51-stock-scan', scrolled: true);
      await tester.enterText(find.byType(TextField).last, 'B1');
      await tester.tap(find.text('Check batch'));
      await tester.pumpAndSettle();
      await s.shot('52-stock-record-sheet');
    });
  }
  for (final mode in ['light', 'dark']) {
    testWidgets('shots $mode: stock sheet', (tester) async {
      addTearDown(tester.view.reset);
      final s = _Shots(tester, mode);
      // The front door: nothing active yet, so it's the chooser, not the form.
      await s.boot(path: '/stock-sheet/session');
      await s.shot('89-stock-sheet-session');

      final rows = [
        {'uuid': 'r1', 'color': 'White orange green', 'material_code': 'TY022002756', 'batch': 'TA0092565', 'prod_date': '2026-09-06', 'chs': 28, 'actual_weight': 146.8, 'position': 30, 'remark': 'ex WV'},
        {'uuid': 'r2', 'color': 'Pink blue yellow', 'material_code': 'TY0220004540', 'batch': 'kupasan', 'prod_date': '2026-08-14', 'chs': 20, 'actual_weight': 76, 'position': 44, 'remark': 'ex WV'},
        {'uuid': 'r3', 'color': 'Grey violet', 'material_code': 'TY022003416', 'batch': 'TA0092514', 'chs': 23, 'actual_weight': 82, 'position': 40},
      ];
      SharedPreferences.setMockInitialValues({'stock-sheet-active': jsonEncode({'uuid': 's1', 'date': '2026-09-19', 'leader': 'Ana Operator', 'rows': rows})});
      await s.boot(path: '/stock-sheet');
      await s.shot('90-sheet-record', scrolled: true);
      await tester.tap(find.text('kupasan'));
      await tester.pumpAndSettle();
      await s.shot('91-sheet-edit');
      final sheet = {
        'id': 4, 'sheet_date': '2026-09-19', 'leader': 'Ana Operator',
        'rows': [for (var i = 0; i < rows.length; i++) {...rows[i], 'id': i + 1, 'line_no': i + 1}],
      };
      Map<String, dynamic> page(List l) => {'data': l, 'current_page': 1, 'last_page': 1, 'total': l.length};
      await s.boot(path: '/stock-sheets', routes: {
        'GET /stock-sheets': (_) => (status: 200, body: page([{'id': 4, 'sheet_date': '2026-09-19', 'leader': 'Ana Operator', 'rows_count': 3, 'total_chs': 71, 'total_weight': '304.80'}, {'id': 3, 'sheet_date': '2026-09-18', 'leader': 'Budi', 'rows_count': 41, 'total_chs': 812, 'total_weight': '9120.50'}])),
      });
      await s.shot('92-sheets-list');
      await s.boot(path: '/stock-sheets/4', routes: {'GET /stock-sheets/4': (_) => (status: 200, body: {'status': 'success', 'data': sheet})});
      await s.shot('93-sheet-detail');
    });
  }
  for (final mode in ['light', 'dark']) {
    testWidgets('shots $mode: torque check', (tester) async {
      addTearDown(tester.view.reset);
      final s = _Shots(tester, mode);
      Map<String, dynamic> page(List l) => {'data': l, 'current_page': 1, 'last_page': 1, 'total': l.length};
      final types = {'status': 'success', 'data': [
        {'id': 1, 'name': 'Standard Creel', 'torque_min': 6.0, 'torque_max': 8.0, 'torque_check_sheets_count': 2},
      ]};
      // The front door: nothing active yet, so it's the chooser, not the grid.
      await s.boot(path: '/torque-check/session');
      await s.shot('109-torque-check-session');

      final readings = [
        {'id': 1, 'side': 'Ai', 'row_no': 1, 'column_letter': 'A', 'value': 6.0, 'note': null},
        {'id': 2, 'side': 'Ai', 'row_no': 1, 'column_letter': 'B', 'value': 7.0, 'note': null},
        {'id': 3, 'side': 'Ai', 'row_no': 14, 'column_letter': 'A', 'value': 8.5, 'note': 'Felt aus kotor (Ganti baru)'},
        {'id': 4, 'side': 'Bo', 'row_no': 1, 'column_letter': 'A', 'value': 7.0, 'note': null},
      ];
      // A sheet already active on this device (as if the operator had just resumed it), so the grid renders
      // with real readings instead of bouncing back to the session chooser.
      SharedPreferences.setMockInitialValues({'torque-check-active': jsonEncode({
        'uuid': 'demo', 'date': '2026-09-22', 'operatorName': 'Supanto', 'machineNumber': '2704', 'creelTypeId': 1, 'sessionId': '483920',
        'readings': [for (final r in readings) {'uuid': 'tr${r['id']}', 'side': r['side'], 'row_no': r['row_no'], 'column_letter': r['column_letter'], 'value': r['value'], 'note': r['note']}],
      })});
      await s.boot(path: '/torque-check', routes: {'GET /creel-types': (_) => (status: 200, body: types)});
      await s.shot('110-torque-record', scrolled: true);
      final sheet = {
        'id': 4, 'check_date': '2026-09-22', 'operator_name': 'Supanto', 'machine_number': '2704',
        'creel_type': {'id': 1, 'name': 'Standard Creel'}, 'readings': readings,
      };
      await s.boot(path: '/torque-checks', routes: {
        'GET /torque-checks': (_) => (status: 200, body: page([
              {'id': 4, 'check_date': '2026-09-22', 'operator_name': 'Supanto', 'machine_number': '2704', 'sides_recorded': ['Ai', 'Bo'], 'readings_count': 4, 'out_of_range_count': 1, 'creel_type': {'name': 'Standard Creel'}},
            ])),
      });
      await s.shot('111-torque-list');
      await s.boot(path: '/torque-checks/4', routes: {'GET /torque-checks/4': (_) => (status: 200, body: {'status': 'success', 'data': sheet})});
      await s.shot('112-torque-detail', scrolled: true);
      await s.boot(path: '/creel-type-settings', routes: {'GET /creel-types': (_) => (status: 200, body: types)});
      await s.shot('113-creel-type-settings');
    });
  }
  for (final mode in ['light', 'dark']) {
    testWidgets('shots $mode: remaining modules', (tester) async {
      addTearDown(tester.view.reset);
      final s = _Shots(tester, mode);
      final manage = [..._allPerms, 'users.manage', 'machine-maintenance.manage'];
      final stockDetail = {
        ...(_sessionBody['data'] as Map<String, dynamic>),
        'created_at': '2026-09-18T03:00:00.000000Z',
        'metadata': {'total_batches': 2, 'total_checked_batches': 1, 'total_materials': 2, 'session_leader': 'Ana', 'session_status': 'In Progress'},
        'stock_take_summary': [
          {'batch_number': 'B1', 'material_code': 'M1', 'material_description': 'Yarn, fine', 'is_recorded': true, 'actual_weight': 12.5, 'total_bobbins': 4, 'line_position': 3, 'row_position': 'A', 'timestamp_found': '2026-09-18T04:00:00Z', 'user_found': 'Ana'},
          {'batch_number': 'B2', 'material_code': 'M2', 'material_description': 'Tape', 'is_recorded': false},
        ],
      };
      final stock = <String, Handler>{
        'GET /stock-take-statistics': (_) => (status: 200, body: {'status': 'success', 'data': {'total_sessions': 3, 'in_progress_sessions': 1, 'completed_sessions': 2, 'total_batches': 40, 'total_checked_batches': 30, 'overall_completion': 75}}),
        'GET /stock-take-records': (_) => (status: 200, body: _page([stockDetail])),
        'GET /stock-take-records/4': (_) => (status: 200, body: {'status': 'success', 'data': stockDetail}),
      };
      await s.boot(path: '/stock-take-records', routes: stock);
      await s.shot('60-stock-records');
      await tester.tap(find.textContaining('123456').first);
      await tester.pumpAndSettle();
      await s.shot('61-stock-detail', scrolled: true);

      final feRecord = {
        'id': 12,
        'created_at': '2026-09-18T03:00:00.000000Z',
        'metadata': {'production_order': 'PO-77', 'style': 'Cable X', 'machine_number': 'M1', 'shift_group': 'A', 'total_finish_earlier': 2, 'average_meters_finish': 200},
        'entries': [
          {'creel_side': 'AI', 'row_number': 'A', 'column_number': '1', 'meters_finish': 100},
          {'creel_side': 'BO', 'row_number': 'C', 'column_number': '9', 'meters_finish': 300},
        ],
      };
      final fe = <String, Handler>{
        'GET /finish-earlier': (_) => (status: 200, body: _page([feRecord])),
        'GET /finish-earlier/12': (_) => (status: 200, body: {'message': 'ok', 'data': feRecord}),
      };
      await s.boot(path: '/finish-earlier', routes: fe);
      await s.shot('62-finish-earlier-records');
      await s.boot(path: '/finish-earlier/12', routes: fe);
      await s.shot('63-finish-earlier-detail', scrolled: true);
      await s.boot(path: '/finish-earlier/12/entries', routes: fe);
      await s.shot('64-finish-earlier-entries', scrolled: true);
      await s.boot(path: '/finish-earlier/scan', routes: fe);
      await s.shot('65-finish-earlier-scan');

      await s.boot(perms: manage, path: '/machine-maintenance', routes: {
        'GET /machine-types': (_) => (status: 200, body: [
              {'id': 1, 'type_name': 'Twister A', 'total_spindles': 120, 'rpm_min': 100, 'rpm_max': 900, 'min_runtime_hours': null, 'max_runtime_hours': null, 'description': null, 'machine_definitions_count': 2},
            ]),
        'GET /machine-definitions': (_) => (status: 200, body: [
              {'id': 5, 'machine_number': 'T-01', 'machine_type_id': 1, 'is_active': true, 'notes': null, 'machine_type': {'id': 1, 'type_name': 'Twister A', 'total_spindles': 120}},
            ]),
      });
      await s.shot('66-machine-maintenance');
      await s.boot(perms: manage, path: '/users', routes: {
        'GET /users': (_) => (status: 200, body: _page([
              {'id': 2, 'name': 'Budi Santoso', 'username': 'budi', 'email': 'budi@anufa.my.id', 'status': 'active', 'roles': [{'id': 1, 'name': 'supervisor'}]},
            ])),
        'GET /user-management-statistics': (_) => (status: 200, body: {'total_users': 9, 'total_roles': 3, 'total_permissions': 22, 'unassigned_users': 1}),
      });
      await s.shot('67-users');
      await s.boot(path: '/activity-log', routes: {
        'GET /activity-log': (_) => (status: 200, body: _page([
              {'id': 1, 'event': 'role_assignment', 'description': "Roles updated for user 'Budi'", 'created_at': '2026-09-18T03:00:00.000000Z', 'causer': {'id': 1, 'name': 'Ana Operator'}},
              {'id': 2, 'event': 'login', 'description': 'User logged in', 'created_at': '2026-09-18T02:00:00.000000Z', 'causer': null},
            ])),
      });
      await s.shot('68-activity-log');
      await s.boot(path: '/document-intelligence');
      await s.shot('69-document-intelligence');
      await s.boot(path: '/settings/two-factor');
      await s.shot('70-settings-two-factor');
    });
  }
}
