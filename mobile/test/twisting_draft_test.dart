import 'package:anufa_minerva_mobile/features/tension/recording/twisting_draft.dart';
import 'package:flutter_test/flutter_test.dart';

TwistingDraft _type(TwistingDraft d, String keys) => keys.split('').fold(d, (acc, k) => acc.press(k));

void main() {
  group('keypad', () {
    test('digits replace the initial zero; only one decimal point; length capped', () {
      var d = _type(const TwistingDraft(), '4');
      expect(d.display, '4');
      d = _type(d, '2.5.1');
      expect(d.display, '42.51');
      expect(_type(const TwistingDraft(), '123456789').display, '12345678');
      expect(const TwistingDraft().press('.').display, '0.');
    });

    test('backspace and clear', () {
      var d = _type(const TwistingDraft(), '123').backspace();
      expect(d.display, '12');
      expect(d.backspace().backspace().display, '0');
      expect(d.clearDisplay().display, '0');
    });
  });

  group('recording flow', () {
    test('max then min for a spindle stores both and advances to the next spindle on Max', () {
      var d = _type(const TwistingDraft(), '44').submit();
      expect(d.current.max, 44);
      expect(d.isMax, isFalse);
      expect(d.spindle, 1);
      d = _type(d, '38').submit();
      expect(d.readings[1]!.min, 38);
      expect(d.spindle, 2);
      expect(d.isMax, isTrue);
      expect(d.display, '0');
    });

    test('re-entering a value on a completed spindle advances again; spindle 84 does not overflow', () {
      var d = const TwistingDraft().goTo(84);
      d = _type(d, '40').submit();
      d = _type(d, '39').submit();
      expect(d.spindle, 84);
      expect(d.next().spindle, 84);
      expect(const TwistingDraft().previous().spindle, 1);
      expect(const TwistingDraft().goTo(500).spindle, 84);
    });

    test('submit accepts zero and a trailing decimal point', () {
      expect(const TwistingDraft().press('.').press('.').submit().current.max, 0.0); // "0." -> 0
      expect(const TwistingDraft().submit().current.max, 0); // "0" is a valid reading
    });

    test('delete only clears the selected side of the current spindle', () {
      var d = _type(const TwistingDraft(), '44').submit();
      d = _type(d, '38').submit().goTo(1);
      final removed = d.copyWith(isMax: false).deleteStored();
      expect(removed.readings[1]!.min, isNull);
      expect(removed.readings[1]!.max, 44);
    });
  });

  group('spec check', () {
    final d = const TwistingDraft().setField('specTens', '40').setField('tensPlus', '5');

    test('limits are spec ± tolerance and boundaries are inside', () {
      expect(d.lowLimit, 35);
      expect(d.highLimit, 45);
      expect(d.inSpec(35), isTrue);
      expect(d.inSpec(45), isTrue);
      expect(d.inSpec(45.1), isFalse);
      expect(d.inSpec(null), isTrue);
    });

    test('without a spec nothing is flagged', () => expect(const TwistingDraft().inSpec(9999), isTrue));
  });

  group('server record', () {
    TwistingDraft filled() {
      var d = const TwistingDraft().setField('operator', 'Ana').setField('itemNumber', 'ITM-1').setField('machineNumber', 'T-01').setField('yarnCode', 'Y9').setField('specTens', '40');
      d = _type(d, '44').submit();
      d = _type(d, '38').submit(); // spindle 1 complete
      d = _type(d, '41').submit(); // spindle 2 max only
      return d.addProblem(2, 'Loose "thread", check', now: DateTime.utc(2026, 9, 18, 3));
    }

    test('measurement data, counts and metadata match what the web app saves', () {
      final r = filled().toRecord(now: DateTime.utc(2026, 9, 18, 3));
      expect(r['record_type'], 'twisting');
      expect(r['measurement_data'], {'1': {'max': 44.0, 'min': 38.0}, '2': {'max': 41.0, 'min': null}});
      final meta = r['metadata'] as Map;
      expect(meta['total_measurements'], 2);
      expect(meta['completed_measurements'], 1);
      expect(meta['progress_percentage'], 50);
      expect(meta['machine_number'], 'T-01');
      expect((r['problems'] as List).single['spindleNumber'], 2);
      expect((r['form_data'] as Map)['specTens'], '40');
    });

    test('empty spindles are omitted and an empty draft has 0% progress', () {
      final d = const TwistingDraft().goTo(5);
      expect(d.toRecord()['measurement_data'], isEmpty);
      expect((d.toRecord()['metadata'] as Map)['progress_percentage'], 0);
      expect(d.hasReadings, isFalse);
    });

    test('csv has the web layout with escaped problem text', () {
      final csv = filled().toCsv(now: DateTime.utc(2026, 9, 18, 3));
      expect(csv, contains('=== TENSION MEASUREMENT DATA ==='));
      expect(csv, contains('1,44,38'));
      expect(csv, contains('2,41,'));
      expect(csv, contains('2,"Loose ""thread"", check",'));
      expect(const TwistingDraft().toCsv(), contains('No problems reported'));
    });
  });

  test('draft survives a JSON round trip (device storage)', () {
    var d = const TwistingDraft().setField('operator', 'Ana');
    d = _type(d, '44').submit();
    d = d.addProblem(1, 'x', now: DateTime.utc(2026, 1, 1)).goTo(7);
    final back = TwistingDraft.fromJson(d.toJson());
    expect(back.field('operator'), 'Ana');
    expect(back.readings[1]!.max, 44);
    expect(back.problems.single.description, 'x');
    expect(back.spindle, 7);
    expect(back.isMax, isFalse);
  });
}
