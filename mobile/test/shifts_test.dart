import 'package:anufa_minerva_mobile/features/dashboard/shifts.dart';
import 'package:flutter_test/flutter_test.dart';

DateTime _at(int h, int m) => DateTime(2026, 9, 19, h, m);

void main() {
  group('greetingFor', () {
    const cases = {
      (3, 59): 'Good night',
      (4, 0): 'Good morning',
      (10, 59): 'Good morning',
      (11, 0): 'Good afternoon',
      (14, 59): 'Good afternoon',
      (15, 0): 'Good evening',
      (18, 59): 'Good evening',
      (19, 0): 'Good night',
      (23, 59): 'Good night',
      (0, 0): 'Good night',
    };
    cases.forEach((time, expected) {
      test('${time.$1.toString().padLeft(2, '0')}:${time.$2.toString().padLeft(2, '0')} is "$expected"', () {
        expect(greetingFor(_at(time.$1, time.$2), 'Ana'), '$expected, Ana');
      });
    });

    test('a missing name leaves just the greeting', () => expect(greetingFor(_at(9, 0), ''), 'Good morning'));
  });

  group('shiftAt', () {
    test('a shift includes its first minute and excludes its last', () {
      expect(shiftAt(_at(0, 0)).name, '1');
      expect(shiftAt(_at(7, 59)).name, '1');
      expect(shiftAt(_at(8, 0)).name, '2');
      expect(shiftAt(_at(15, 59)).name, '2');
      expect(shiftAt(_at(16, 0)).name, '3');
      expect(shiftAt(_at(23, 59)).name, '3'); // ends at 00:00, when shift 1 begins again
    });

    test('every minute of the day belongs to exactly one shift', () {
      for (var h = 0; h < 24; h++) {
        for (final m in [0, 1, 30, 59]) {
          final matches = kShifts.where((s) => shiftAt(_at(h, m), shifts: [s]) == s && ((h * 60 + m) - s.startHour * 60) % 1440 < s.lengthMinutes);
          expect(matches.length, 1, reason: '$h:$m');
        }
      }
    });

    test('formats its range', () {
      expect(kShifts[0].range, '00:00–08:00');
      expect(kShifts[1].range, '08:00–16:00');
      expect(kShifts[2].range, '16:00–00:00'); // ends at midnight
    });

    test('falls back to the first shift if the list leaves a gap', () {
      const gappy = [Shift('X', startHour: 8, endHour: 12)];
      expect(shiftAt(_at(20, 0), shifts: gappy).name, 'X');
    });
  });

  test('the context line names the date, shift and hours', () {
    expect(contextLine(DateTime(2026, 9, 19, 9, 30), kShifts[1]), 'Sat, 19 Sep · Shift 2 · 08:00–16:00');
    expect(contextLine(DateTime(2026, 9, 19, 2, 0), kShifts[0]), 'Sat, 19 Sep · Shift 1 · 00:00–08:00');
    expect(contextLine(DateTime(2026, 9, 19, 20, 0), kShifts[2]), 'Sat, 19 Sep · Shift 3 · 16:00–00:00');
  });
}
