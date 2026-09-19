import 'package:intl/intl.dart';

import '../tension_models.dart';

const kTwistingSpindles = 84;
const _maxDisplayLength = 8;

/// Parameter form fields in the order of the web form: (key, label, numeric keyboard).
const twistingFormFields = <(String, String, bool)>[
  ('operator', 'Operator', false),
  ('itemNumber', 'Item number', false),
  ('yarnCode', 'Yarn material code', false),
  ('machineNumber', 'Machine number', false),
  ('metersCheck', 'Meters check (m)', true),
  ('dtexNumber', 'Density (Dtex)', true),
  ('tpm', 'Table twist (TPM)', true),
  ('specTens', 'Spec tension (cN)', true),
  ('tensPlus', 'Tension deviation ± (cN)', true),
  ('rpm', 'Cycle speed (RPM)', true),
];

class Reading {
  const Reading({this.max, this.min});

  final double? max;
  final double? min;

  bool get isEmpty => max == null && min == null;
  bool get complete => max != null && min != null;

  Reading with_({required bool isMax, required double? value}) => isMax ? Reading(max: value, min: min) : Reading(max: max, min: value);

  Map<String, dynamic> toJson() => {'max': max, 'min': min};
  factory Reading.fromJson(Map<String, dynamic> j) => Reading(max: asDouble(j['max']), min: asDouble(j['min']));
}

class ProblemReport {
  const ProblemReport({required this.id, required this.spindle, required this.description, required this.timestamp});

  final int id;
  final int spindle;
  final String description;
  final DateTime timestamp;

  /// Shape the server stores (`spindleNumber`, ISO timestamp), matching the web app.
  Map<String, dynamic> toJson() => {'id': id, 'spindleNumber': spindle, 'description': description, 'timestamp': timestamp.toUtc().toIso8601String()};

  factory ProblemReport.fromJson(Map<String, dynamic> j) => ProblemReport(
        id: (j['id'] as num).toInt(),
        spindle: (j['spindleNumber'] as num).toInt(),
        description: j['description'] as String? ?? '',
        timestamp: DateTime.tryParse('${j['timestamp']}') ?? DateTime.now(),
      );
}

/// Everything an operator has entered so far. Immutable; every action returns a new draft.
class TwistingDraft {
  const TwistingDraft({this.form = const {}, this.readings = const {}, this.problems = const [], this.display = '0', this.spindle = 1, this.isMax = true});

  final Map<String, String> form;
  final Map<int, Reading> readings;
  final List<ProblemReport> problems;
  final String display;
  final int spindle;
  final bool isMax;

  String field(String key) => form[key] ?? '';
  Reading get current => readings[spindle] ?? const Reading();

  double get spec => double.tryParse(field('specTens')) ?? 0;
  double get tolerance => double.tryParse(field('tensPlus')) ?? 0;
  double get lowLimit => spec - tolerance;
  double get highLimit => spec + tolerance;

  /// No value yet counts as in spec (nothing to flag). Without a spec every value passes.
  bool inSpec(double? v) => v == null || spec <= 0 || (v >= lowLimit && v <= highLimit);

  bool get hasReadings => readings.values.any((r) => !r.isEmpty);

  TwistingDraft copyWith({Map<String, String>? form, Map<int, Reading>? readings, List<ProblemReport>? problems, String? display, int? spindle, bool? isMax}) =>
      TwistingDraft(form: form ?? this.form, readings: readings ?? this.readings, problems: problems ?? this.problems, display: display ?? this.display, spindle: spindle ?? this.spindle, isMax: isMax ?? this.isMax);

  TwistingDraft setField(String key, String value) => copyWith(form: {...form, key: value});

  // ── Keypad ──────────────────────────────────────────────────────────────────

  TwistingDraft press(String key) {
    if (key == '.') {
      if (display.contains('.')) return this;
      return copyWith(display: '$display.');
    }
    if (display.length >= _maxDisplayLength) return this;
    return copyWith(display: display == '0' ? key : '$display$key');
  }

  TwistingDraft backspace() => copyWith(display: display.length > 1 ? display.substring(0, display.length - 1) : '0');

  TwistingDraft clearDisplay() => copyWith(display: '0');

  TwistingDraft goTo(int n) => copyWith(spindle: n.clamp(1, kTwistingSpindles));

  TwistingDraft next() => goTo(spindle + 1);
  TwistingDraft previous() => goTo(spindle - 1);

  TwistingDraft toggleType() => copyWith(isMax: !isMax);

  /// Stores the displayed number as this spindle's Max or Min, flips to the other, and
  /// moves to the next spindle once both are known (web behaviour).
  TwistingDraft submit() {
    final value = double.tryParse(display.endsWith('.') ? display.substring(0, display.length - 1) : display);
    if (value == null) return this;
    final before = current;
    final otherKnown = isMax ? before.min != null : before.max != null;
    final updated = {...readings, spindle: before.with_(isMax: isMax, value: value)};
    if (otherKnown && spindle < kTwistingSpindles) {
      return copyWith(readings: updated, display: '0', spindle: spindle + 1, isMax: true);
    }
    return copyWith(readings: updated, display: '0', isMax: !isMax);
  }

  /// Clears the stored Max or Min (whichever is selected) for the current spindle.
  TwistingDraft deleteStored() => copyWith(readings: {...readings, spindle: current.with_(isMax: isMax, value: null)});

  // ── Problems ────────────────────────────────────────────────────────────────

  List<ProblemReport> problemsFor(int n) => [for (final p in problems) if (p.spindle == n) p];

  TwistingDraft addProblem(int spindleNo, String description, {DateTime? now}) {
    final at = now ?? DateTime.now();
    return copyWith(problems: [...problems, ProblemReport(id: at.microsecondsSinceEpoch, spindle: spindleNo, description: description.trim(), timestamp: at)]);
  }

  TwistingDraft removeProblem(int id) => copyWith(problems: [for (final p in problems) if (p.id != id) p]);

  // ── Persistence ─────────────────────────────────────────────────────────────

  Map<String, dynamic> toJson() => {
        'form': form,
        'readings': {for (final e in readings.entries) '${e.key}': e.value.toJson()},
        'problems': [for (final p in problems) p.toJson()],
        'display': display,
        'spindle': spindle,
        'isMax': isMax,
      };

  factory TwistingDraft.fromJson(Map<String, dynamic> j) => TwistingDraft(
        form: {for (final e in asMap(j['form']).entries) e.key: '${e.value}'},
        readings: {for (final e in asMap(j['readings']).entries) int.parse(e.key): Reading.fromJson(asMap(e.value))},
        problems: [if (j['problems'] is List) for (final p in j['problems'] as List) ProblemReport.fromJson(asMap(p))],
        display: j['display'] as String? ?? '0',
        spindle: (j['spindle'] as num?)?.toInt() ?? 1,
        isMax: j['isMax'] as bool? ?? true,
      );

  // ── Server record ───────────────────────────────────────────────────────────

  /// Body for `POST /tension-records`, equal in shape to the web app's `prepareTwistingDataForDatabase`.
  /// Spindles with neither value are left out.
  Map<String, dynamic> toRecord({DateTime? now}) {
    final kept = Map.fromEntries(readings.entries.where((e) => !e.value.isEmpty).toList()..sort((a, b) => a.key.compareTo(b.key)));
    final total = kept.length;
    final done = kept.values.where((r) => r.complete).length;
    final formData = {for (final f in twistingFormFields) f.$1: field(f.$1)};
    return {
      'record_type': 'twisting',
      'csv_data': toCsv(now: now),
      'form_data': formData,
      'measurement_data': {for (final e in kept.entries) '${e.key}': e.value.toJson()},
      'problems': [for (final p in problems) p.toJson()],
      'metadata': {
        'total_measurements': total,
        'completed_measurements': done,
        'progress_percentage': total == 0 ? 0 : (done / total * 100).round(),
        'operator': field('operator'),
        'machine_number': field('machineNumber'),
        'item_number': field('itemNumber'),
        'yarn_code': field('yarnCode'),
      },
    };
  }

  String toCsv({DateTime? now}) {
    final fmt = DateFormat('yyyy-MM-dd HH:mm:ss');
    String num(double? v) => v == null ? '' : fmtNum(v);
    final rows = <String>[
      'TWISTING TENSION DATA EXPORT',
      'Export Date: ${fmt.format(now ?? DateTime.now())}',
      '',
      '=== CONFIGURATION PARAMETERS ===',
      'Parameter,Value',
      'Operator,${field('operator')}',
      'Item Number,${field('itemNumber')}',
      'Meters Check,${field('metersCheck')}',
      'Dtex Number,${field('dtexNumber')}',
      'TPM,${field('tpm')}',
      'Spec Tens,${field('specTens')}',
      'Tens ±,${field('tensPlus')}',
      'RPM,${field('rpm')}',
      'Machine Number,${field('machineNumber')}',
      'Yarn Code,${field('yarnCode')}',
      '',
      '=== TENSION MEASUREMENT DATA ===',
      'Spindle Number,Max Value,Min Value',
      for (final e in (readings.entries.where((e) => !e.value.isEmpty).toList()..sort((a, b) => a.key.compareTo(b.key)))) '${e.key},${num(e.value.max)},${num(e.value.min)}',
      '',
      '=== PROBLEM REPORTS ===',
      'Spindle Number,Description,Timestamp',
      if (problems.isEmpty) 'No problems reported' else for (final p in problems) '${p.spindle},"${p.description.replaceAll('"', '""')}",${fmt.format(p.timestamp.toLocal())}',
    ];
    return rows.join('\n');
  }
}
