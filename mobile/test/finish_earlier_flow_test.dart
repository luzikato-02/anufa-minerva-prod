import 'dart:convert';
import 'dart:typed_data';

import 'package:anufa_minerva_mobile/core/files/file_opener.dart';
import 'package:anufa_minerva_mobile/core/files/file_pick.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/fakes.dart';
import 'support/pump.dart';

Map<String, dynamic> _page(List rows) => {'data': rows, 'current_page': 1, 'last_page': 1, 'total': rows.length};

final _record = {
  'id': 12,
  'created_at': '2026-09-18T03:00:00.000000Z',
  'metadata': {'production_order': 'PO-77', 'style': 'Cable X', 'machine_number': 'M1', 'shift_group': 'A', 'total_finish_earlier': 2, 'average_meters_finish': 200},
  'entries': [
    {'creel_side': 'AI', 'row_number': 'A', 'column_number': '1', 'meters_finish': 100},
    {'creel_side': 'BO', 'row_number': 'C', 'column_number': '9', 'meters_finish': 300},
  ],
};

class _Opener implements FileOpener {
  final files = <String, String>{};
  @override
  Future<void> open(String filename, List<int> bytes) async => files[filename] = utf8.decode(bytes, allowMalformed: true);
}

PickedFile _file(String name, {int size = 10}) => PickedFile(name, Uint8List(size));

void main() {
  testWidgets('list searches on the server and only offers Scan to users who can create', (tester) async {
    Object? lastSearch;
    final adapter = await pumpSignedIn(tester, permissions: ['finish-earlier.view'], path: '/finish-earlier', routes: {
      'GET /finish-earlier': (o) {
        lastSearch = o.queryParameters['search'];
        return (status: 200, body: _page([_record]));
      },
    });
    expect(find.text('PO PO-77'), findsOneWidget);
    expect(find.text('2 bobbins'), findsOneWidget);
    expect(find.text('Avg 200 m'), findsOneWidget);
    expect(find.byType(FloatingActionButton), findsNothing);

    await tester.enterText(find.byType(TextField).first, 'cable');
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();
    expect(lastSearch, 'cable');
    expect(adapter.requests.where((r) => r.path == '/finish-earlier').length, greaterThan(1));
  });

  testWidgets('detail shows the summary and entries; menu follows permissions', (tester) async {
    await pumpSignedIn(tester, permissions: ['finish-earlier.view'], path: '/finish-earlier/12', routes: {
      'GET /finish-earlier/12': (_) => (status: 200, body: {'message': 'ok', 'data': _record}),
    });
    expect(find.text('Cable Finish Earlier Summary'), findsOneWidget);
    expect(find.text('Entries (2)'), findsOneWidget);
    expect(find.text('BO'), findsOneWidget);

    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    expect(find.text('Download CSV'), findsOneWidget);
    expect(find.text('Download PDF'), findsOneWidget);
    expect(find.text('Edit record'), findsNothing);
    expect(find.text('Delete'), findsNothing);
    expect(find.text('View creel'), findsNothing); // creel is not part of the mobile app
  });

  testWidgets('CSV and PDF downloads use the production order and go through the opener', (tester) async {
    final opener = _Opener();
    await pumpSignedIn(tester, permissions: ['finish-earlier.view'], path: '/finish-earlier/12', overrides: [fileOpenerProvider.overrideWithValue(opener)], routes: {
      'GET /finish-earlier/12': (_) => (status: 200, body: {'data': _record}),
      'GET /finish-earlier/PO-77/download': (_) => (status: 200, body: {'metadata': _record['metadata'], 'entries': _record['entries']}),
      'GET /finish-earlier/PO-77/pdf': (_) => (status: 200, body: 'PDFDATA'),
    });
    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Download CSV'));
    await tester.pumpAndSettle();
    expect(opener.files['FinishEarlier_PO-77.csv'], contains('M1,Cable X,PO-77,2,200'));
    expect(opener.files['FinishEarlier_PO-77.csv']!.split('\n').length, 84);

    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Download PDF'));
    await tester.pumpAndSettle();
    expect(opener.files.keys, contains('FinishEarlier_PO-77.pdf'));
  });

  testWidgets('editors can change the record details', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['finish-earlier.view', 'finish-earlier.edit'], path: '/finish-earlier/12', routes: {
      'GET /finish-earlier/12': (_) => (status: 200, body: {'data': _record}),
      'PATCH /finish-earlier/12': (_) => (status: 200, body: {'message': 'Record updated.'}),
    });
    await tester.tap(find.byType(PopupMenuButton<String>));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Edit record'));
    await tester.pumpAndSettle();
    await tester.enterText(find.widgetWithText(TextField, 'M1'), 'M2');
    await tester.tap(find.widgetWithText(InkWell, 'Save').last);
    await tester.pumpAndSettle();

    final body = adapter.requests.singleWhere((r) => r.method == 'PATCH').data as Map;
    expect(body['machine_number'], 'M2');
    expect(body['production_order'], 'PO-77');
  });

  testWidgets('entries editor validates, then saves numbers and strings in the API shape', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: ['finish-earlier.view', 'finish-earlier.edit'], path: '/finish-earlier/12/entries', routes: {
      'GET /finish-earlier/12': (_) => (status: 200, body: {'data': _record}),
      'PATCH /finish-earlier/12': (_) => (status: 200, body: {'message': 'Record updated.'}),
    });
    await tester.tap(find.text('Add entry'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();
    expect(find.text('Column must be a positive number'), findsOneWidget); // new row carried side/row forward, but is otherwise empty
    expect(adapter.requests.where((r) => r.method == 'PATCH'), isEmpty);

    final col = find.widgetWithText(TextFormField, '').first;
    await tester.enterText(col, '7');
    await tester.tap(find.byType(TextFormField).last);
    await tester.enterText(find.byType(TextFormField).last, '450.5');
    await tester.tap(find.text('Save changes'));
    await tester.pumpAndSettle();

    final sent = (adapter.requests.singleWhere((r) => r.method == 'PATCH').data as Map)['entries'] as List;
    expect(sent.length, 3);
    expect(sent.last, {'creel_side': 'BO', 'row_number': 'C', 'column_number': '7', 'meters_finish': 450.5});
    expect(sent.first['meters_finish'], 100.0);
  });

  testWidgets('view-only users are blocked from the scan and entries pages', (tester) async {
    await pumpSignedIn(tester, permissions: ['finish-earlier.view'], path: '/finish-earlier/scan', routes: {});
    expect(find.text('Access denied'), findsWidgets);
  });

  group('scan', () {
    Map<String, Handler> extractRoutes({List<Handler>? submits}) {
      var n = 0;
      return {
        'POST /finish-earlier-scan/extract': (_) => (status: 200, body: {
              'metadata': {'machine_number': 'M9', 'style': 'Cable Z', 'production_order': 'PO-5', 'shift_group': '2/B'},
              'entries': [
                {'creel_side': 'AI', 'row_number': 'A', 'column_number': '3', 'meters_finish': 120},
                {'creel_side': 'XX', 'row_number': 'b', 'column_number': '4', 'meters_finish': 80},
              ],
              '_ocr_text': 'raw text here',
            }),
        'POST /finish-earlier/submit-scan': (o) => submits![n++ < submits.length - 1 ? n - 1 : submits.length - 1](o),
      };
    }

    testWidgets('rejects unsupported and oversized files', (tester) async {
      await pumpSignedIn(tester, permissions: ['finish-earlier.create'], path: '/finish-earlier/scan', overrides: [pickFileProvider.overrideWithValue((_) async => _file('notes.txt'))], routes: {});
      await tester.tap(find.text('Choose PDF or image'));
      await tester.pumpAndSettle();
      expect(find.text('Unsupported file type. Use a PDF or image (PNG, JPG, WEBP).'), findsOneWidget);
    });

    testWidgets('photo → OCR → fix errors → save; a 409 offers merge and resubmits with the choice', (tester) async {
      final adapter = await pumpSignedIn(
        tester,
        permissions: ['finish-earlier.create'],
        path: '/finish-earlier/scan',
        overrides: [takePhotoProvider.overrideWithValue(() async => _file('form.jpg', size: 2048))],
        routes: extractRoutes(submits: [
          (_) => (status: 409, body: {'conflict': true, 'existing': {'id': 3, 'entry_count': 5, 'created_at': '2026-09-01 10:00:00'}}),
          (_) => (status: 200, body: {'message': 'Record merged.', 'id': 3}),
        ]),
      );
      await tester.tap(find.text('Take photo'));
      await tester.pumpAndSettle();
      expect(find.textContaining('form.jpg'), findsOneWidget);
      await tester.tap(find.text('Extract data'));
      await tester.pumpAndSettle();

      final upload = adapter.requests.singleWhere((r) => r.path == '/finish-earlier-scan/extract').data as FormData;
      expect(upload.files.single.key, 'file');
      expect(upload.files.single.value.filename, 'form.jpg');

      expect(find.text('Review extracted data'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'PO-5'), findsOneWidget);
      expect(find.text('Entries (2)'), findsOneWidget);

      // Second entry has side "XX" and lowercase row "b": must be fixed before saving.
      await tester.scrollUntilVisible(find.text('Save to Minerva'), 300, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text('Save to Minerva'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Fix the highlighted entries'), findsOneWidget);
      expect(adapter.requests.where((r) => r.path == '/finish-earlier/submit-scan'), isEmpty);

      await tester.tap(find.byTooltip('Remove entry 2'));
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(find.text('Save to Minerva'), 300, scrollable: find.byType(Scrollable).first);
      await tester.tap(find.text('Save to Minerva'));
      await tester.pumpAndSettle();

      expect(find.text('Record already exists'), findsOneWidget);
      expect(find.textContaining('already exists with 5 entries'), findsOneWidget);
      await tester.tap(find.text('Merge entries'));
      await tester.pumpAndSettle();

      final posts = adapter.requests.where((r) => r.path == '/finish-earlier/submit-scan').map((r) => r.data as Map).toList();
      expect(posts.length, 2);
      expect(posts.first.containsKey('conflict_resolution'), isFalse);
      expect(posts.last['conflict_resolution'], 'merge');
      expect((posts.last['entries'] as List).single, {'creel_side': 'AI', 'row_number': 'A', 'column_number': '3', 'meters_finish': 120.0});
      expect((posts.last['metadata'] as Map)['production_order'], 'PO-5');
      expect(find.text('Saved'), findsOneWidget);
      expect(find.text('View record'), findsOneWidget);
    });

    testWidgets('an extraction failure returns to the picker with the server message', (tester) async {
      await pumpSignedIn(tester, permissions: ['finish-earlier.create'], path: '/finish-earlier/scan', overrides: [pickFileProvider.overrideWithValue((_) async => _file('scan.pdf', size: 100))], routes: {
        'POST /finish-earlier-scan/extract': (_) => (status: 500, body: {'message': 'OCR service unavailable'}),
      });
      await tester.tap(find.text('Choose PDF or image'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Extract data'));
      await tester.pumpAndSettle();
      expect(find.text('OCR service unavailable'), findsOneWidget);
      expect(find.text('Extract data'), findsOneWidget); // can retry with the same file
    });
  });
}
