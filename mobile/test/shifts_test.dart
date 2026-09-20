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
      expect(shiftAt(_at(7, 0)).name, 'A');
      expect(shiftAt(_at(14, 59)).name, 'A');
      expect(shiftAt(_at(15, 0)).name, 'B');
      expect(shiftAt(_at(22, 59)).name, 'B');
      expect(shiftAt(_at(23, 0)).name, 'C');
    });

    test('the overnight shift covers both sides of midnight', () {
      expect(shiftAt(_at(23, 30)).name, 'C');
      expect(shiftAt(_at(0, 0)).name, 'C');
      expect(shiftAt(_at(3, 15)).name, 'C');
      expect(shiftAt(_at(6, 59)).name, 'C');
      expect(shiftAt(_at(7, 0)).name, 'A');
    });

    test('formats its range', () {
      expect(kShifts[0].range, '07:00–15:00');
      expect(kShifts[2].range, '23:00–07:00'); // overnight
    });

    test('falls back to the first shift if the list leaves a gap', () {
      const gappy = [Shift('X', startHour: 8, endHour: 12)];
      expect(shiftAt(_at(20, 0), shifts: gappy).name, 'X');
    });
  });

  group('shiftProgress', () {
    double p(int h, int m) => shiftProgress(_at(h, m), shiftAt(_at(h, m)));

    test('is 0 at the first minute and grows to just under 1', () {
      expect(p(7, 0), 0);
      expect(p(11, 0), closeTo(0.5, 1e-9)); // 4h of 8h
      expect(p(14, 59), closeTo(479 / 480, 1e-9));
    });

    test('a new shift starts again at 0', () {
      expect(p(15, 0), 0);
      expect(p(23, 0), 0);
    });

    test('overnight shift: 23:00 is 0, midnight is 1/8, 03:00 is 1/2, 06:59 is almost 1', () {
      expect(p(23, 0), 0);
      expect(p(0, 0), closeTo(1 / 8, 1e-9));
      expect(p(3, 0), closeTo(0.5, 1e-9));
      expect(p(6, 59), closeTo(479 / 480, 1e-9));
    });

    test('never leaves 0..1', () {
      for (var h = 0; h < 24; h++) {
        for (final m in [0, 1, 30, 59]) {
          expect(p(h, m), inInclusiveRange(0, 1));
        }
      }
    });
  });

  test('the context line names the date, shift and hours', () {
    expect(contextLine(DateTime(2026, 9, 19, 9, 30), kShifts[0]), 'Sat, 19 Sep · Shift A · 07:00–15:00');
    expect(contextLine(DateTime(2026, 9, 19, 2, 0), kShifts[2]), 'Sat, 19 Sep · Shift C · 23:00–07:00');
  });
}
