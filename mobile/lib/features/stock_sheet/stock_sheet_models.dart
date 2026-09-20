import '../tension/tension_models.dart';

/// One line of the paper stock sheet.
class SheetRow {
  const SheetRow({
    required this.uuid,
    required this.materialCode,
    required this.batch,
    this.color = '',
    this.prodDate,
    this.chs,
    this.weight,
    this.position,
    this.remark = '',
  });

  /// Generated on the device; doubles as the upload's idempotency key and the row's handle on the server.
  final String uuid;
  final String color;
  final String materialCode;

  /// Free text: usually a TA… batch number, but the sheet also holds entries like "kupasan".
  final String batch;
  final DateTime? prodDate;
  final int? chs;
  final double? weight;
  final int? position;
  final String remark;

  SheetRow copyWith({String? color, String? materialCode, String? batch, DateTime? prodDate, bool clearDate = false, int? chs, bool clearChs = false, double? weight, bool clearWeight = false, int? position, bool clearPosition = false, String? remark}) => SheetRow(
        uuid: uuid,
        color: color ?? this.color,
        materialCode: materialCode ?? this.materialCode,
        batch: batch ?? this.batch,
        prodDate: clearDate ? null : prodDate ?? this.prodDate,
        chs: clearChs ? null : chs ?? this.chs,
        weight: clearWeight ? null : weight ?? this.weight,
        position: clearPosition ? null : position ?? this.position,
        remark: remark ?? this.remark,
      );

  /// Fields the server stores; the sheet's own fields are added by the controller.
  Map<String, dynamic> toFields() => {
        'color': color.isEmpty ? null : color,
        'material_code': materialCode,
        'batch': batch,
        'prod_date': prodDate == null ? null : _day(prodDate!),
        'chs': chs,
        'actual_weight': weight,
        'position': position,
        'remark': remark.isEmpty ? null : remark,
      };

  Map<String, dynamic> toJson() => {'uuid': uuid, ...toFields()};

  factory SheetRow.fromJson(Map<String, dynamic> j) => SheetRow(
        uuid: '${j['uuid']}',
        color: '${j['color'] ?? ''}',
        materialCode: '${j['material_code'] ?? ''}',
        batch: '${j['batch'] ?? ''}',
        prodDate: DateTime.tryParse('${j['prod_date']}'),
        chs: (j['chs'] as num?)?.toInt(),
        weight: (j['actual_weight'] as num?)?.toDouble(),
        position: (j['position'] as num?)?.toInt(),
        remark: '${j['remark'] ?? ''}',
      );
}

String _day(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String sheetDay(DateTime d) => _day(d);

/// The sheet being filled in on this device.
class ActiveSheet {
  const ActiveSheet({required this.uuid, required this.date, required this.leader, this.rows = const []});

  final String uuid;
  final DateTime date;
  final String leader;
  final List<SheetRow> rows;

  int get totalChs => rows.fold(0, (a, r) => a + (r.chs ?? 0));
  double get totalWeight => rows.fold(0.0, (a, r) => a + (r.weight ?? 0));

  ActiveSheet copyWith({DateTime? date, String? leader, List<SheetRow>? rows}) => ActiveSheet(uuid: uuid, date: date ?? this.date, leader: leader ?? this.leader, rows: rows ?? this.rows);

  Map<String, dynamic> toJson() => {'uuid': uuid, 'date': _day(date), 'leader': leader, 'rows': [for (final r in rows) r.toJson()]};

  factory ActiveSheet.fromJson(Map<String, dynamic> j) => ActiveSheet(
        uuid: '${j['uuid']}',
        date: DateTime.tryParse('${j['date']}') ?? DateTime.now(),
        leader: '${j['leader'] ?? ''}',
        rows: [if (j['rows'] is List) for (final r in j['rows'] as List) SheetRow.fromJson(asMap(r))],
      );
}
