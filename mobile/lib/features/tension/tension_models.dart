/// PHP encodes empty arrays as `[]`, so any "map" column may arrive as a list.
Map<String, dynamic> asMap(Object? v) => v is Map ? Map<String, dynamic>.from(v) : <String, dynamic>{};

double? asDouble(Object? v) => v is num ? v.toDouble() : double.tryParse('$v');

/// Drops a pointless `.0` so readings show as entered (`31`, not `31.0`).
String fmtNum(double? v) => v == null ? '' : (v == v.roundToDouble() ? v.toInt().toString() : v.toString());

/// One measured position: a spindle (twisting) or side/row/column (weaving).
class TensionPoint {
  TensionPoint({required this.key, required this.label, required this.max, required this.min, this.problem});

  /// Path in `measurement_data`: `[spindle]` or `[side, row, col]`.
  final List<String> key;
  final String label;
  final double? max;
  final double? min;
  final Map<String, dynamic>? problem;

  String? get problemStatus => problem == null ? null : (problem!['status'] as String? ?? 'open');
}

/// Typed view over a tension record JSON (`twisting` or `weaving`).
class TensionRecord {
  TensionRecord(this.raw);

  final Map<String, dynamic> raw;

  int get id => (raw['id'] as num).toInt();
  String get type => raw['record_type'] as String? ?? 'twisting';
  bool get isWeaving => type == 'weaving';
  Map<String, dynamic> get form => asMap(raw['form_data']);
  Map<String, dynamic> get metadata => asMap(raw['metadata']);
  DateTime? get createdAt => DateTime.tryParse('${raw['created_at']}')?.toLocal();
  String? get operator => metadata['operator'] as String?;
  String? get itemNumber => metadata['item_number'] as String?;
  String? get machine => (form['machineNumber'] ?? metadata['machine_number'])?.toString();
  int get completed => (metadata['completed_measurements'] as num?)?.toInt() ?? 0;
  int get total => (metadata['total_measurements'] as num?)?.toInt() ?? 0;
  int get progress => (metadata['progress_percentage'] as num?)?.toInt() ?? 0;
  String? get status => metadata['status'] as String?;
  double? get spec => asDouble(form['specTens']);
  double? get tolerance => asDouble(form['tensPlus']);

  List<Map<String, dynamic>> get problems => [
        if (raw['problems'] is List) for (final p in raw['problems'] as List) asMap(p),
      ];
  int get openProblems => problems.where((p) => (p['status'] ?? 'open') == 'open').length;

  List<TensionPoint> get points {
    final data = raw['measurement_data'];
    final out = <TensionPoint>[];
    if (data is! Map) return out;
    if (!isWeaving) {
      final probs = {for (final p in problems) if (p['spindleNumber'] != null) '${p['spindleNumber']}': p};
      final keys = data.keys.map((k) => '$k').toList()..sort((a, b) => (int.tryParse(a) ?? 0).compareTo(int.tryParse(b) ?? 0));
      for (final k in keys) {
        final v = asMap(data[k]);
        out.add(TensionPoint(key: [k], label: k, max: asDouble(v['max']), min: asDouble(v['min']), problem: probs[k]));
      }
      return out;
    }
    final probs = {for (final p in problems) if (p['position'] != null) '${p['position']}': p};
    for (final side in data.keys) {
      final rows = data[side];
      if (rows is! Map) continue;
      for (final row in rows.keys) {
        final cols = rows[row];
        if (cols is! Map) continue;
        for (final col in cols.keys) {
          final v = asMap(cols[col]);
          final label = '$side-$row-Col$col';
          out.add(TensionPoint(key: ['$side', '$row', '$col'], label: label, max: asDouble(v['max']), min: asDouble(v['min']), problem: probs[label]));
        }
      }
    }
    return out;
  }
}
