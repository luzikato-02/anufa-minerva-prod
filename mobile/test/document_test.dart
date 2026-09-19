import 'dart:convert';
import 'dart:typed_data';

import 'package:anufa_minerva_mobile/core/api/api_exception.dart';
import 'package:anufa_minerva_mobile/core/files/file_pick.dart';
import 'package:anufa_minerva_mobile/core/files/file_sharer.dart';
import 'package:anufa_minerva_mobile/features/documents/ocr_result.dart';
import 'package:dio/dio.dart';
import 'package:excel/excel.dart';
import 'package:flutter_test/flutter_test.dart';

import 'support/pump.dart';

const _md1 = '# Delivery note\n\nCustomer: PT Anufa\n\n| Item | Qty |\n|---|---|\n| Yarn 1100 | 40 |\n| Tape | 12 |\n';
final _ocr = {
  'model': 'mistral-ocr-latest',
  'pages': [
    {'index': 0, 'markdown': _md1},
    {'index': 1, 'markdown': 'Signed by ops'},
  ],
};

class _Sharer implements FileSharer {
  final shared = <String, List<int>>{};
  final mimes = <String, String?>{};
  @override
  Future<void> share(String filename, List<int> bytes, {String? mimeType}) async {
    shared[filename] = bytes;
    mimes[filename] = mimeType;
  }
}

void main() {
  group('OcrResult', () {
    final r = OcrResult(Map<String, dynamic>.from(_ocr));

    test('pages, markdown joining and emptiness', () {
      expect(r.pages.length, 2);
      expect(r.toMarkdown(), '$_md1\n\n---\n\nSigned by ops');
      expect(r.isEmpty, isFalse);
      expect(OcrResult({'pages': [{'index': 0, 'markdown': '  '}]}).isEmpty, isTrue);
      expect(OcrResult({}).pages, isEmpty);
    });

    test('json export keeps the whole server payload', () {
      expect(jsonDecode(r.toJsonText()), _ocr);
    });

    test('sheet rows split table cells and skip the separator, other lines stay whole', () {
      expect(OcrResult.sheetRows(_md1), [
        ['# Delivery note'],
        [''],
        ['Customer: PT Anufa'],
        [''],
        ['Item', 'Qty'],
        ['Yarn 1100', '40'],
        ['Tape', '12'],
        [''],
      ]);
      expect(OcrResult.sheetRows('|a|b|\n| :-- | --: |'), [['a', 'b']]);
    });

    test('xlsx has one sheet per page, named Page N, with the table cells in place', () {
      final book = Excel.decodeBytes(r.toXlsx());
      expect(book.tables.keys.toList(), ['Page 1', 'Page 2']); // default Sheet1 removed
      final rows = book['Page 1'].rows.map((row) => row.map((c) => c?.value?.toString() ?? '').toList()).toList();
      expect(rows.any((row) => row.take(2).join('|') == 'Yarn 1100|40'), isTrue);
      expect(book['Page 2'].rows.first.first?.value.toString(), 'Signed by ops');
    });
  });

  group('upload validation', () {
    test('type and size', () {
      expect(validateOcrUpload(PickedFile('a.PDF', Uint8List(5))), isNull);
      expect(validateOcrUpload(PickedFile('a.webp', Uint8List(5))), isNull);
      expect(validateOcrUpload(PickedFile('a.docx', Uint8List(5))), contains('Unsupported'));
      expect(validateOcrUpload(PickedFile('big.png', Uint8List(kMaxUploadBytes + 1))), contains('20 MB'));
      expect(mimeTypeFor('x.jpeg'), 'image/jpeg');
      expect(mimeTypeFor('x.PDF'), 'application/pdf');
    });

    test('ApiException reads the `error` key that OCR endpoints use', () {
      final e = DioException(requestOptions: RequestOptions(), response: Response(requestOptions: RequestOptions(), statusCode: 500, data: {'error': 'Mistral said no'}));
      expect(ApiException.from(e).message, 'Mistral said no');
    });
  });

  testWidgets('pick → extract → pages render with tables; raw toggle; export goes to the share sheet', (tester) async {
    final sharer = _Sharer();
    final adapter = await pumpSignedIn(
      tester,
      permissions: [],
      path: '/document-intelligence',
      overrides: [
        pickFileProvider.overrideWithValue((_) async => PickedFile('delivery note.pdf', Uint8List(4096))),
        fileSharerProvider.overrideWithValue(sharer),
      ],
      routes: {'POST /document-intelligence/process': (_) => (status: 200, body: _ocr)},
    );
    await tester.tap(find.text('Choose PDF or image'));
    await tester.pumpAndSettle();
    expect(find.textContaining('delivery note.pdf'), findsOneWidget);
    await tester.tap(find.text('Extract text'));
    await tester.pumpAndSettle();

    final upload = adapter.requests.singleWhere((r) => r.path == '/document-intelligence/process').data as FormData;
    expect(upload.files.single.value.filename, 'delivery note.pdf');
    expect(upload.files.single.value.contentType.toString(), 'application/pdf');

    expect(find.text('2 pages extracted from delivery note'), findsOneWidget);
    expect(find.text('PAGE 1'), findsOneWidget);
    expect(find.text('Customer: PT Anufa'), findsOneWidget);
    expect(find.text('Yarn 1100'), findsOneWidget); // rendered as a real table cell

    await tester.tap(find.text('Raw').first);
    await tester.pumpAndSettle();
    expect(find.textContaining('|---|---|'), findsOneWidget);

    await tester.tap(find.text('Markdown'));
    await tester.pumpAndSettle();
    expect(utf8.decode(sharer.shared['delivery note.md']!), contains('Signed by ops'));
    await tester.tap(find.text('Excel'));
    await tester.pumpAndSettle();
    expect(sharer.shared.keys, contains('delivery note.xlsx'));
    expect(sharer.mimes['delivery note.xlsx'], contains('spreadsheetml'));
  });

  testWidgets('server failures show the message and keep the file so it can be retried', (tester) async {
    await pumpSignedIn(tester, permissions: [], path: '/document-intelligence', overrides: [pickFileProvider.overrideWithValue((_) async => PickedFile('a.png', Uint8List(10)))], routes: {
      'POST /document-intelligence/process': (_) => (status: 500, body: {'error': 'OCR quota exceeded'}),
    });
    await tester.tap(find.text('Choose PDF or image'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Extract text'));
    await tester.pumpAndSettle();
    expect(find.text('OCR quota exceeded'), findsOneWidget);
    expect(find.text('Extract text'), findsOneWidget);
  });

  testWidgets('offline shows a connection message', (tester) async {
    final adapter = await pumpSignedIn(tester, permissions: [], path: '/document-intelligence', overrides: [pickFileProvider.overrideWithValue((_) async => PickedFile('a.png', Uint8List(10)))], routes: {});
    await tester.tap(find.text('Choose PDF or image'));
    await tester.pumpAndSettle();
    adapter.offline = true;
    await tester.tap(find.text('Extract text'));
    await tester.pumpAndSettle();
    expect(find.textContaining('Cannot reach the server'), findsOneWidget);
  });

  testWidgets('a blank document is reported rather than shown as empty pages', (tester) async {
    await pumpSignedIn(tester, permissions: [], path: '/document-intelligence', overrides: [pickFileProvider.overrideWithValue((_) async => PickedFile('a.png', Uint8List(10)))], routes: {
      'POST /document-intelligence/process': (_) => (status: 200, body: {'pages': [{'index': 0, 'markdown': ''}]}),
    });
    await tester.tap(find.text('Choose PDF or image'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Extract text'));
    await tester.pumpAndSettle();
    expect(find.text('No text was found in this document.'), findsOneWidget);
  });
}
