import '../../core/csv_parse.dart';
import '../tension/tension_models.dart';

const kFeSides = ['AI', 'BI', 'AO', 'BO'];
const kFeRows = ['A', 'B', 'C', 'D', 'E'];

/// One finish-earlier bobbin: creel position plus meters run before it finished.
class FeEntry {
  FeEntry({int? id, this.side = '', this.row = '', this.column = '', this.meters = ''}) : id = id ?? _next++;

  static int _next = 1;

  /// Stable key so list rows keep their input state while others are added or removed.
  final int id;
  String side;
  String row;
  String column;

  /// Kept as text while editing; converted to a number on submit.
  String meters;

  factory FeEntry.fromJson(Map<String, dynamic> j) => FeEntry(side: '${j['creel_side'] ?? ''}', row: '${j['row_number'] ?? ''}', column: '${j['column_number'] ?? ''}', meters: j['meters_finish'] == null ? '' : fmtNum(asDouble(j['meters_finish']) ?? 0));

  /// First problem with this entry, or null when it can be submitted.
  String? get error {
    if (!kFeSides.contains(side)) return 'Side must be one of ${kFeSides.join(', ')}';
    if (!kFeRows.contains(row)) return 'Row must be A–E';
    final c = int.tryParse(column.trim());
    if (c == null || c < 1) return 'Column must be a positive number';
    final m = double.tryParse(meters.trim());
    if (m == null || m < 0) return 'Meters must be a number';
    return null;
  }

  Map<String, dynamic> toJson() => {'creel_side': side, 'row_number': row, 'column_number': column.trim(), 'meters_finish': double.parse(meters.trim())};
}

const feMetaFields = <(String key, String label)>[
  ('production_order', 'Production order'),
  ('style', 'Material description (style)'),
  ('machine_number', 'Machine number'),
  ('shift_group', 'Shift / group'),
];

/// Typed view of a finish-earlier record.
class FeRecord {
  FeRecord(this.raw);

  final Map<String, dynamic> raw;

  int get id => (raw['id'] as num).toInt();
  Map<String, dynamic> get metadata => asMap(raw['metadata']);
  String meta(String k) => '${metadata[k] ?? ''}';
  String get productionOrder => meta('production_order');
  int get total => (metadata['total_finish_earlier'] as num?)?.toInt() ?? 0;
  double get average => asDouble(metadata['average_meters_finish']) ?? 0;
  DateTime? get createdAt => DateTime.tryParse('${raw['created_at']}')?.toLocal();
  List<FeEntry> get entries => [if (raw['entries'] is List) for (final e in raw['entries'] as List) FeEntry.fromJson(asMap(e))];
}

/// CSV as the web produces it: a summary line, then a numbered table padded to at least 80 rows
/// (the paper form has 80). The web silently drops entries past row 80; this keeps them all.
String feCsv(Map<String, dynamic> metadata, List<Map<String, dynamic>> entries) {
  final rows = entries.length > 80 ? entries.length : 80;
  String m(String k) => csvEscape(metadata[k]);
  return [
    'Machine,Style,Production Order,Total Finish Earlier,Average Meters Finish',
    '${m('machine_number')},${m('style')},${m('production_order')},${m('total_finish_earlier')},${m('average_meters_finish')}',
    '',
    'No,Side,Row,Col,Meters',
    for (var i = 0; i < rows; i++)
      i < entries.length
          ? '${i + 1},${csvEscape(entries[i]['creel_side'])},${csvEscape(entries[i]['row_number'])},${csvEscape(entries[i]['column_number'])},${csvEscape(entries[i]['meters_finish'])}'
          : '${i + 1},,,,',
  ].join('\n');
}
