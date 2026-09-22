import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

/// A work shift as whole hours on a 24-hour clock. `endHour <= startHour` means it ends on the next day.
class Shift {
  const Shift(this.name, {required this.startHour, required this.endHour});

  final String name;
  final int startHour;
  final int endHour;

  int get lengthMinutes {
    final hours = (endHour - startHour) % 24;
    return (hours == 0 ? 24 : hours) * 60;
  }

  String get range => '${_hh(startHour)}:00–${_hh(endHour)}:00';
}

String _hh(int h) => h.toString().padLeft(2, '0');

/// The plant's three 8-hour shifts. Shift 3 ends at 00:00, the start of the next day.
const kShifts = [
  Shift('1', startHour: 0, endHour: 8),
  Shift('2', startHour: 8, endHour: 16),
  Shift('3', startHour: 16, endHour: 0),
];

int _minutesSinceStart(DateTime now, Shift s) => ((now.hour * 60 + now.minute) - s.startHour * 60) % (24 * 60);

/// The shift running at [now]. A shift includes its start minute and excludes its end minute.
Shift shiftAt(DateTime now, {List<Shift> shifts = kShifts}) {
  for (final s in shifts) {
    if (_minutesSinceStart(now, s) < s.lengthMinutes) return s;
  }
  return shifts.first; // the shifts do not cover the whole day
}

/// "Good morning, Ana": 04:00-10:59 morning, 11:00-14:59 afternoon, 15:00-18:59 evening, otherwise night.
String greetingFor(DateTime now, String firstName) {
  final h = now.hour;
  final part = h >= 4 && h < 11
      ? 'Good morning'
      : h >= 11 && h < 15
          ? 'Good afternoon'
          : h >= 15 && h < 19
              ? 'Good evening'
              : 'Good night';
  return firstName.isEmpty ? part : '$part, $firstName';
}

/// "Sat, 19 Sep · Shift 1 · 00:00–08:00"
String contextLine(DateTime now, Shift shift) => '${DateFormat('EEE, d MMM').format(now)} · Shift ${shift.name} · ${shift.range}';

/// The current time, refreshed once a minute (not every frame). Tests override this with a fixed time.
final clockProvider = StreamProvider.autoDispose<DateTime>((ref) {
  final controller = StreamController<DateTime>()..add(DateTime.now());
  final timer = Timer.periodic(const Duration(minutes: 1), (_) => controller.add(DateTime.now()));
  ref.onDispose(() {
    timer.cancel(); // an async* generator would leave its inner timer running after dispose
    controller.close();
  });
  return controller.stream;
});
