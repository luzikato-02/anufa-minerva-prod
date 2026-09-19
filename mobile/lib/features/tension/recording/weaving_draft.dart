import 'package:intl/intl.dart';

import '../tension_models.dart';
import 'twisting_draft.dart' show Reading;

const kCreelSides = ['AI', 'BI', 'AO', 'BO'];
const kCreelRows = ['A', 'B', 'C', 'D', 'E'];
const kCreelColumns = 120;

/// Parameter fields in web order: (key, label, numeric keyboard).
const weavingFormFields = <(String, String, bool)>[
  ('itemNumber', 'Item number', false),
  ('itemDescription', 'Item description', false),
  ('productionOrder', 'Production order', false),
  ('metersCheck', 'Meters check (m)', true),
  ('baleNumber', 'Bale number', false),
  ('colorCode', 'Color code', false),
  ('specTens', 'Spec tension (cN)', true),
  ('tensPlus', 'Tension deviation ± (cN)', true),
  ('machineNumber', 'Machine number', false),
  ('operator', 'Operator', false),
];

/// One creel position's reading with the time it was last edited (used to merge devices).
class Cell {
  const Cell({this.max, this.min, this.updatedAt});

  final double? max;
  final double? min;
  final String? updatedAt;

  Reading get reading => Reading(max: max, min: min);
  bool get complete => max != null && min != null;

  Map<String, dynamic> toJson() => {'max': max, 'min': min, if (updatedAt != null) 'updatedAt': updatedAt};

  factory Cell.fromJson(Map<String, dynamic> j) => Cell(max: asDouble(j['max']), min: asDouble(j['min']), updatedAt: j['updatedAt'] as String?);
}

class WeavingProblem {
  const WeavingProblem({required this.id, required this.position, required this.description, required this.timestamp});

  final int id;
  final String position;
  final String description;
  final DateTime timestamp;

  Map<String, dynamic> toJson() => {'id': id, 'position': position, 'description': description, 'timestamp': timestamp.toUtc().toIso8601String()};

  factory WeavingProblem.fromJson(Map<String, dynamic> j) => WeavingProblem(
        id: (j['id'] as num).toInt(),
        position: '${j['position'] ?? ''}',
        description: j['description'] as String? ?? '',
        timestamp: DateTime.tryParse('${j['timestamp']}') ?? DateTime.now(),
      );
}

class MergeSummary {
  const MergeSummary({this.localOnly = 0, this.serverOnly = 0, this.localWon = 0, this.serverWon = 0});

  final int localOnly;
  final int serverOnly;
  final int localWon;
  final int serverWon;

  bool get any => localOnly + serverOnly + localWon + serverWon > 0;
}

String cellKey(String side, String row, int col) => '$side|$row|$col';
String positionLabel(String side, String row, int col) => '$side-$row-Col$col';

/// Newest edit wins per position; cells without a timestamp count as oldest (web `mergeCreelData`).
(Map<String, Cell>, MergeSummary) mergeGrids(Map<String, Cell> local, Map<String, Cell> server) {
  final merged = <String, Cell>{};
  var localOnly = 0, serverOnly = 0, localWon = 0, serverWon = 0;
  for (final k in {...local.keys, ...server.keys}) {
    final l = local[k], s = server[k];
    if (l == null) {
      merged[k] = s!;
      serverOnly++;
    } else if (s == null) {
      merged[k] = l;
      localOnly++;
    } else if ((l.updatedAt ?? '0').compareTo(s.updatedAt ?? '0') >= 0) {
      merged[k] = l;
      localWon++;
    } else {
      merged[k] = s;
      serverWon++;
    }
  }
  return (merged, MergeSummary(localOnly: localOnly, serverOnly: serverOnly, localWon: localWon, serverWon: serverWon));
}

/// Flattens the server's `{side:{row:{col:{max,min}}}}`; tolerates PHP's `[]` for empty levels.
Map<String, Cell> gridFromServer(Object? data) {
  final out = <String, Cell>{};
  asMap(data).forEach((side, rows) {
    asMap(rows).forEach((row, cols) {
      asMap(cols).forEach((col, v) {
        final c = int.tryParse(col);
        if (c != null) out[cellKey(side, row, c)] = Cell.fromJson(asMap(v));
      });
    });
  });
  return out;
}

class WeavingDraft {
  const WeavingDraft({
    this.form = const {},
    this.grid = const {},
    this.problems = const [],
    this.display = '0',
    this.col = 1,
    this.sideIndex = 0,
    this.rowIndex = 0,
    this.isMax = true,
    this.sessionId,
    this.sessionPo,
  });

  final Map<String, String> form;
  final Map<String, Cell> grid;
  final List<WeavingProblem> problems;
  final String display;
  final int col;
  final int sideIndex;
  final int rowIndex;
  final bool isMax;

  /// Server session (in-progress record) this draft syncs to; null while offline-only.
  final int? sessionId;
  final String? sessionPo;

  String field(String key) => form[key] ?? '';
  String get side => kCreelSides[sideIndex];
  String get row => kCreelRows[rowIndex];
  String get position => positionLabel(side, row, col);
  Cell get current => grid[cellKey(side, row, col)] ?? const Cell();
  bool get hasReadings => grid.values.any((c) => c.max != null || c.min != null);
  bool get hasSession => sessionId != null;

  double get spec => double.tryParse(field('specTens')) ?? 0;
  double get tolerance => double.tryParse(field('tensPlus')) ?? 0;
  double get lowLimit => spec - tolerance;
  double get highLimit => spec + tolerance;
  bool inSpec(double? v) => v == null || spec <= 0 || (v >= lowLimit && v <= highLimit);

  WeavingDraft copyWith({
    Map<String, String>? form,
    Map<String, Cell>? grid,
    List<WeavingProblem>? problems,
    String? display,
    int? col,
    int? sideIndex,
    int? rowIndex,
    bool? isMax,
    Object? sessionId = _keep,
    Object? sessionPo = _keep,
  }) =>
      WeavingDraft(
        form: form ?? this.form,
        grid: grid ?? this.grid,
        problems: problems ?? this.problems,
        display: display ?? this.display,
        col: col ?? this.col,
        sideIndex: sideIndex ?? this.sideIndex,
        rowIndex: rowIndex ?? this.rowIndex,
        isMax: isMax ?? this.isMax,
        sessionId: identical(sessionId, _keep) ? this.sessionId : sessionId as int?,
        sessionPo: identical(sessionPo, _keep) ? this.sessionPo : sessionPo as String?,
      );

  static const _keep = Object();

  WeavingDraft setField(String k, String v) => copyWith(form: {...form, k: v});

  // ── Keypad (same rules as twisting) ────────────────────────────────────────

  WeavingDraft press(String key) {
    if (key == '.') return display.contains('.') ? this : copyWith(display: '$display.');
    if (display.length >= 8) return this;
    return copyWith(display: display == '0' ? key : '$display$key');
  }

  WeavingDraft backspace() => copyWith(display: display.length > 1 ? display.substring(0, display.length - 1) : '0');
  WeavingDraft clearDisplay() => copyWith(display: '0');
  WeavingDraft toggleType() => copyWith(isMax: !isMax);

  // ── Navigation ─────────────────────────────────────────────────────────────

  WeavingDraft goToCol(int n) => copyWith(col: n.clamp(1, kCreelColumns));
  WeavingDraft nextCol() => goToCol(col + 1);
  WeavingDraft previousCol() => goToCol(col - 1);
  WeavingDraft nextSide() => copyWith(sideIndex: (sideIndex + 1) % kCreelSides.length);
  WeavingDraft previousSide() => copyWith(sideIndex: (sideIndex - 1 + kCreelSides.length) % kCreelSides.length);
  WeavingDraft nextRow() => copyWith(rowIndex: (rowIndex + 1) % kCreelRows.length);
  WeavingDraft previousRow() => copyWith(rowIndex: (rowIndex - 1 + kCreelRows.length) % kCreelRows.length);

  // ── Recording ──────────────────────────────────────────────────────────────

  /// Stores the display as Max/Min for the current position, stamped for merging.
  /// Once both are known it moves to the next column, starting at Max again.
  WeavingDraft submit({DateTime? now}) {
    final value = double.tryParse(display.endsWith('.') ? display.substring(0, display.length - 1) : display);
    if (value == null) return this;
    final before = current;
    final otherKnown = isMax ? before.min != null : before.max != null;
    final cell = Cell(max: isMax ? value : before.max, min: isMax ? before.min : value, updatedAt: (now ?? DateTime.now()).toUtc().toIso8601String());
    final updated = {...grid, cellKey(side, row, col): cell};
    if (otherKnown && col < kCreelColumns) return copyWith(grid: updated, display: '0', col: col + 1, isMax: true);
    return copyWith(grid: updated, display: '0', isMax: !isMax);
  }

  /// Clears the selected side of the current position. The clear is stamped too, so it survives a merge.
  WeavingDraft deleteStored({DateTime? now}) {
    final before = current;
    final cell = Cell(max: isMax ? null : before.max, min: isMax ? before.min : null, updatedAt: (now ?? DateTime.now()).toUtc().toIso8601String());
    return copyWith(grid: {...grid, cellKey(side, row, col): cell});
  }

  // ── Problems ───────────────────────────────────────────────────────────────

  List<WeavingProblem> get problemsHere => [for (final p in problems) if (p.position == position) p];

  WeavingDraft addProblem(String description, {DateTime? now}) {
    final at = now ?? DateTime.now();
    return copyWith(problems: [...problems, WeavingProblem(id: at.microsecondsSinceEpoch, position: position, description: description.trim(), timestamp: at)]);
  }

  WeavingDraft removeProblem(int id) => copyWith(problems: [for (final p in problems) if (p.id != id) p]);

  // ── Server session ─────────────────────────────────────────────────────────

  WeavingDraft withSession(int id, String po) => copyWith(sessionId: id, sessionPo: po);

  /// Applies a server record when resuming: server form fills in, grids merge by timestamp,
  /// and problems are unioned by id (the web replaces them, which would drop unsynced local ones).
  (WeavingDraft, MergeSummary) resumedFrom(TensionRecord r) {
    final (merged, summary) = mergeGrids(grid, gridFromServer(r.raw['measurement_data']));
    final byId = {for (final p in problems) p.id: p};
    for (final p in r.problems) {
      final wp = WeavingProblem.fromJson({...p, 'position': p['position'] ?? ''});
      byId.putIfAbsent(wp.id, () => wp);
    }
    return (
      copyWith(
        form: {...form, for (final e in r.form.entries) e.key: '${e.value}'},
        grid: merged,
        problems: byId.values.toList()..sort((a, b) => a.timestamp.compareTo(b.timestamp)),
      ),
      summary,
    );
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  Map<String, dynamic> toJson() => {
        'form': form,
        'grid': {for (final e in grid.entries) e.key: e.value.toJson()},
        'problems': [for (final p in problems) p.toJson()],
        'display': display,
        'col': col,
        'sideIndex': sideIndex,
        'rowIndex': rowIndex,
        'isMax': isMax,
        'sessionId': sessionId,
        'sessionPo': sessionPo,
      };

  factory WeavingDraft.fromJson(Map<String, dynamic> j) => WeavingDraft(
        form: {for (final e in asMap(j['form']).entries) e.key: '${e.value}'},
        grid: {for (final e in asMap(j['grid']).entries) e.key: Cell.fromJson(asMap(e.value))},
        problems: [if (j['problems'] is List) for (final p in j['problems'] as List) WeavingProblem.fromJson(asMap(p))],
        display: j['display'] as String? ?? '0',
        col: (j['col'] as num?)?.toInt() ?? 1,
        sideIndex: (j['sideIndex'] as num?)?.toInt() ?? 0,
        rowIndex: (j['rowIndex'] as num?)?.toInt() ?? 0,
        isMax: j['isMax'] as bool? ?? true,
        sessionId: (j['sessionId'] as num?)?.toInt(),
        sessionPo: j['sessionPo'] as String?,
      );

  // ── Server record ──────────────────────────────────────────────────────────

  /// Nested `{side:{row:{col:{max,min,updatedAt}}}}`, all four sides always present (like the web).
  Map<String, dynamic> get measurementData {
    final out = <String, Map<String, Map<String, dynamic>>>{for (final s in kCreelSides) s: {}};
    for (final e in grid.entries) {
      final p = e.key.split('|');
      out.putIfAbsent(p[0], () => {}).putIfAbsent(p[1], () => {})[p[2]] = e.value.toJson();
    }
    return out;
  }

  /// Body for `POST /tension-records` or `PUT /tension-records/{id}`.
  /// [status] `completed` matters: the server treats records with no status as still resumable.
  Map<String, dynamic> toRecord({String status = 'in_progress', DateTime? now}) {
    final total = grid.length;
    final done = grid.values.where((c) => c.complete).length;
    return {
      'record_type': 'weaving',
      'csv_data': toCsv(now: now),
      'form_data': {for (final f in weavingFormFields) f.$1: field(f.$1)},
      'measurement_data': measurementData,
      'problems': [for (final p in problems) p.toJson()],
      'metadata': {
        'total_measurements': total,
        'completed_measurements': done,
        'progress_percentage': total == 0 ? 0 : (done / total * 100).round(),
        'operator': field('operator'),
        'machine_number': field('machineNumber'),
        'item_number': field('itemNumber'),
        'item_description': field('itemDescription'),
        'status': status,
      },
    };
  }

  List<MapEntry<String, Cell>> get _sortedCells {
    int side(String k) => kCreelSides.indexOf(k.split('|')[0]);
    int rowOf(String k) => kCreelRows.indexOf(k.split('|')[1]);
    int colOf(String k) => int.parse(k.split('|')[2]);
    return grid.entries.toList()
      ..sort((a, b) {
        final c = side(a.key).compareTo(side(b.key));
        if (c != 0) return c;
        final r = rowOf(a.key).compareTo(rowOf(b.key));
        return r != 0 ? r : colOf(a.key).compareTo(colOf(b.key));
      });
  }

  String toCsv({DateTime? now}) {
    final fmt = DateFormat('yyyy-MM-dd HH:mm:ss');
    String num(double? v) => v == null ? '' : fmtNum(v);
    return [
      'WEAVING TENSION DATA EXPORT',
      'Export Date: ${fmt.format(now ?? DateTime.now())}',
      '',
      '=== CONFIGURATION PARAMETERS ===',
      'Parameter,Value',
      'Item Number,${field('itemNumber')}',
      'Item Description,${field('itemDescription')}',
      'Production Order,${field('productionOrder')}',
      'Meters Check,${field('metersCheck')}',
      'Bale Number,${field('baleNumber')}',
      'Color Code,${field('colorCode')}',
      'Spec Tens,${field('specTens')}',
      'Tens ±,${field('tensPlus')}',
      'Machine Number,${field('machineNumber')}',
      'Operator,${field('operator')}',
      '',
      '=== TENSION MEASUREMENT DATA ===',
      'Position,Creel Side,Row,Column,Max Value,Min Value',
      for (final e in _sortedCells) () {
        final p = e.key.split('|');
        return '${positionLabel(p[0], p[1], int.parse(p[2]))},${p[0]},${p[1]},${p[2]},${num(e.value.max)},${num(e.value.min)}';
      }(),
      '',
      '=== PROBLEM REPORTS ===',
      'Position,Description,Timestamp',
      if (problems.isEmpty) 'No problems reported' else for (final p in problems) '${p.position},"${p.description.replaceAll('"', '""')}",${fmt.format(p.timestamp.toLocal())}',
    ].join('\n');
  }
}
