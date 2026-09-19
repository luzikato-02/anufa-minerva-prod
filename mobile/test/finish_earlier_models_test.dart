import 'package:anufa_minerva_mobile/features/finish_earlier/fe_models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('entry validation', () {
    FeEntry e({String side = 'AI', String row = 'A', String col = '12', String m = '350'}) => FeEntry(side: side, row: row, column: col, meters: m);

    test('accepts a good entry and serialises meters as a number', () {
      expect(e().error, isNull);
      expect(e(m: ' 350.5 ').toJson(), {'creel_side': 'AI', 'row_number': 'A', 'column_number': '12', 'meters_finish': 350.5});
    });

    test('flags each kind of bad value with a specific message', () {
      expect(e(side: 'XX').error, contains('Side'));
      expect(e(side: '').error, contains('Side'));
      expect(e(row: 'F').error, contains('Row'));
      expect(e(row: 'a').error, contains('Row')); // OCR may return lowercase; must be fixed in review
      expect(e(col: '0').error, contains('Column'));
      expect(e(col: 'x').error, contains('Column'));
      expect(e(m: '').error, contains('Meters'));
      expect(e(m: '-1').error, contains('Meters'));
    });

    test('ids are unique so list rows keep their state', () => expect(FeEntry().id, isNot(FeEntry().id)));
  });

  test('record parses entries and tolerates missing fields', () {
    final r = FeRecord({
      'id': 3,
      'metadata': {'production_order': 'PO1', 'total_finish_earlier': 2, 'average_meters_finish': 200.0},
      'entries': [
        {'creel_side': 'AO', 'row_number': 'B', 'column_number': '5', 'meters_finish': 100},
        {'creel_side': 'BI'},
      ],
      'created_at': '2026-09-18T03:00:00Z',
    });
    expect(r.productionOrder, 'PO1');
    expect(r.entries.first.meters, '100');
    expect(r.entries[1].meters, '');
    expect(r.entries[1].error, isNotNull);
    expect(FeRecord({'id': 1, 'metadata': [], 'entries': null}).entries, isEmpty);
  });

  group('csv', () {
    final meta = {'machine_number': 'M1', 'style': 'Cable, X', 'production_order': 'PO1', 'total_finish_earlier': 2, 'average_meters_finish': 200};

    test('matches the web layout and pads to 80 numbered rows', () {
      final lines = feCsv(meta, [
        {'creel_side': 'AI', 'row_number': 'A', 'column_number': '1', 'meters_finish': 100},
        {'creel_side': 'BO', 'row_number': 'C', 'column_number': '9', 'meters_finish': 300},
      ]).split('\n');
      expect(lines[0], 'Machine,Style,Production Order,Total Finish Earlier,Average Meters Finish');
      expect(lines[1], 'M1,"Cable, X",PO1,2,200');
      expect(lines[3], 'No,Side,Row,Col,Meters');
      expect(lines[4], '1,AI,A,1,100');
      expect(lines[5], '2,BO,C,9,300');
      expect(lines[6], '3,,,,');
      expect(lines.length, 4 + 80);
    });

    test('keeps every entry when there are more than 80', () {
      final many = [for (var i = 0; i < 95; i++) {'creel_side': 'AI', 'row_number': 'A', 'column_number': '${i + 1}', 'meters_finish': i}];
      final lines = feCsv(meta, many).split('\n');
      expect(lines.length, 4 + 95);
      expect(lines.last, '95,AI,A,95,94');
    });
  });
}
