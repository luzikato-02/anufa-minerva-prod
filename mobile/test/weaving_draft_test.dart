import 'package:anufa_minerva_mobile/features/tension/recording/weaving_draft.dart';
import 'package:anufa_minerva_mobile/features/tension/tension_models.dart';
import 'package:flutter_test/flutter_test.dart';

WeavingDraft _type(WeavingDraft d, String keys) => keys.split('').fold(d, (a, k) => a.press(k));
final _t0 = DateTime.utc(2026, 9, 18, 3, 0, 0);

void main() {
  group('navigation', () {
    test('sides and rows wrap around; columns clamp to 1..120', () {
      var d = const WeavingDraft();
      expect(d.position, 'AI-A-Col1');
      expect(d.previousSide().side, 'BO');
      expect(const WeavingDraft(sideIndex: 3).nextSide().side, 'AI');
      expect(d.previousRow().row, 'E');
      expect(const WeavingDraft(rowIndex: 4).nextRow().row, 'A');
      expect(d.previousCol().col, 1);
      expect(d.goToCol(999).col, 120);
      expect(d.goToCol(120).nextCol().col, 120);
    });
  });

  group('recording', () {
    test('max then min stamps the cell and advances one column, restarting at Max', () {
      var d = _type(const WeavingDraft(), '31').submit(now: _t0);
      expect(d.current.max, 31);
      expect(d.current.updatedAt, '2026-09-18T03:00:00.000Z');
      expect(d.isMax, isFalse);
      d = _type(d, '29').submit(now: _t0);
      expect(d.col, 2);
      expect(d.isMax, isTrue);
      expect(d.grid[cellKey('AI', 'A', 1)]!.min, 29);
    });

    test('positions are independent across side, row and column', () {
      var d = _type(const WeavingDraft(), '30').submit(now: _t0);
      d = d.nextSide().nextRow();
      expect(d.current.max, isNull);
      d = _type(d.copyWith(isMax: true), '40').submit(now: _t0);
      expect(d.grid.keys, containsAll([cellKey('AI', 'A', 1), cellKey('BI', 'B', 1)]));
    });

    test('deleting clears only the selected side and is stamped so it wins a merge', () {
      var d = _type(const WeavingDraft(), '31').submit(now: _t0);
      d = _type(d, '29').submit(now: _t0).previousCol().copyWith(isMax: false);
      final later = DateTime.utc(2026, 9, 18, 4);
      d = d.deleteStored(now: later);
      expect(d.current.min, isNull);
      expect(d.current.max, 31);
      expect(d.current.updatedAt, later.toIso8601String());
    });

    test('spec check', () {
      final d = const WeavingDraft().setField('specTens', '30').setField('tensPlus', '3');
      expect(d.inSpec(33), isTrue);
      expect(d.inSpec(33.1), isFalse);
      expect(const WeavingDraft().inSpec(1e6), isTrue);
    });
  });

  group('merging local and server data', () {
    Cell c(double max, String? at) => Cell(max: max, min: null, updatedAt: at);

    test('newest edit per position wins; equal timestamps favour local', () {
      final local = {'AI|A|1': c(10, '2026-01-02'), 'AI|A|2': c(20, '2026-01-01'), 'AI|A|3': c(30, '2026-01-01')};
      final server = {'AI|A|1': c(11, '2026-01-01'), 'AI|A|2': c(21, '2026-01-02'), 'AI|A|3': c(31, '2026-01-01'), 'BI|A|1': c(40, null)};
      final (m, s) = mergeGrids(local, server);
      expect(m['AI|A|1']!.max, 10); // local newer
      expect(m['AI|A|2']!.max, 21); // server newer
      expect(m['AI|A|3']!.max, 30); // tie -> local
      expect(m['BI|A|1']!.max, 40);
      expect((s.localWon, s.serverWon, s.localOnly, s.serverOnly), (2, 1, 0, 1));
    });

    test('cells without a timestamp lose to any stamped cell', () {
      final (m, _) = mergeGrids({'AI|A|1': c(1, null)}, {'AI|A|1': c(2, '2026-01-01')});
      expect(m['AI|A|1']!.max, 2);
    });

    test('resuming keeps unsynced local problems and adds server ones without duplicating', () {
      final local = const WeavingDraft().copyWith(problems: [
        WeavingProblem(id: 1, position: 'AI-A-Col1', description: 'local only', timestamp: _t0),
        WeavingProblem(id: 2, position: 'AI-A-Col2', description: 'both', timestamp: _t0),
      ]);
      final server = TensionRecord({
        'id': 5,
        'record_type': 'weaving',
        'form_data': {'productionOrder': 'PO1', 'specTens': 30},
        'measurement_data': {'AI': {'A': {'1': {'max': 30, 'min': 28, 'updatedAt': '2026-09-01T00:00:00Z'}}}},
        'problems': [
          {'id': 2, 'position': 'AI-A-Col2', 'description': 'both', 'timestamp': '2026-09-18T03:00:00Z'},
          {'id': 3, 'position': 'BO-C-Col9', 'description': 'server only', 'timestamp': '2026-09-18T05:00:00Z'},
        ],
        'metadata': {},
      });
      final (d, s) = local.resumedFrom(server);
      expect(d.problems.map((p) => p.id), [1, 2, 3]);
      expect(d.field('productionOrder'), 'PO1');
      expect(d.field('specTens'), '30');
      expect(d.grid[cellKey('AI', 'A', 1)]!.min, 28);
      expect(s.serverOnly, 1);
    });

    test('server payloads with PHP empty-array encoding parse to an empty grid', () {
      expect(gridFromServer([]), isEmpty);
      expect(gridFromServer({'AI': [], 'BI': {'A': []}}), isEmpty);
      final d = const WeavingDraft().resumedFrom(TensionRecord({'id': 1, 'record_type': 'weaving', 'measurement_data': [], 'form_data': [], 'metadata': [], 'problems': []})).$1;
      expect(d.grid, isEmpty);
    });
  });

  group('server record', () {
    WeavingDraft filled() {
      var d = const WeavingDraft().setField('operator', 'Budi').setField('machineNumber', 'W-3').setField('productionOrder', 'PO9');
      d = _type(d, '31').submit(now: _t0);
      d = _type(d, '29').submit(now: _t0); // AI-A-1 complete, now col 2
      d = _type(d, '33').submit(now: _t0); // AI-A-2 max only
      return d.addProblem('frayed "yarn"', now: _t0);
    }

    test('nested measurement data always lists all four sides, and counts partial cells as measured', () {
      final r = filled().toRecord(status: 'completed', now: _t0);
      final data = r['measurement_data'] as Map;
      expect(data.keys, ['AI', 'BI', 'AO', 'BO']);
      expect(data['BI'], isEmpty);
      expect(data['AI']['A']['1'], {'max': 31.0, 'min': 29.0, 'updatedAt': '2026-09-18T03:00:00.000Z'});
      expect(data['AI']['A']['2']['min'], isNull);
      final meta = r['metadata'] as Map;
      expect(meta['total_measurements'], 2);
      expect(meta['completed_measurements'], 1);
      expect(meta['progress_percentage'], 50);
      expect(meta['status'], 'completed');
      expect(meta['machine_number'], 'W-3');
    });

    test('record round-trips through TensionRecord.points (what the list/detail screens read)', () {
      final rec = TensionRecord({...filled().toRecord(now: _t0), 'id': 1});
      expect(rec.points.map((p) => p.label), ['AI-A-Col1', 'AI-A-Col2']);
      expect(rec.points.first.max, 31);
    });

    test('csv lists positions in creel order with escaped problems', () {
      final csv = filled().toCsv(now: _t0);
      expect(csv, contains('Position,Creel Side,Row,Column,Max Value,Min Value'));
      expect(csv, contains('AI-A-Col1,AI,A,1,31,29'));
      expect(csv, contains('AI-A-Col2,AI,A,2,33,'));
      expect(csv, contains('AI-A-Col2,"frayed ""yarn""",'));
      expect(csv.indexOf('AI-A-Col1'), lessThan(csv.indexOf('AI-A-Col2')));
    });
  });

  test('draft including session survives a JSON round trip', () {
    var d = _type(const WeavingDraft().withSession(42, 'PO9'), '31').submit(now: _t0).nextSide();
    final back = WeavingDraft.fromJson(d.toJson());
    expect(back.sessionId, 42);
    expect(back.sessionPo, 'PO9');
    expect(back.grid[cellKey('AI', 'A', 1)]!.max, 31);
    expect(back.side, 'BI');
    expect(back.isMax, isFalse);
  });
}
