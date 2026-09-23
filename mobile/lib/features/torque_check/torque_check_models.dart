import '../tension/tension_models.dart';

const kTorqueColumns = ['A', 'B', 'C', 'D', 'E'];
const kTorqueMaxRow = 105;
const kTorqueSides = ['Ai', 'Ao', 'Bi', 'Bo'];

/// One cell of the torque grid: a fixed position (row 1-105, column A-E) and its reading.
class TorqueReading {
  const TorqueReading({required this.uuid, required this.rowNo, required this.columnLetter, required this.value, this.note = ''});

  /// Generated on the device; doubles as the upload's idempotency key and the reading's handle on the server.
  final String uuid;
  final int rowNo;
  final String columnLetter;
  final double value;
  final String note;

  String get position => '$rowNo$columnLetter';

  TorqueReading copyWith({double? value, String? note}) => TorqueReading(uuid: uuid, rowNo: rowNo, columnLetter: columnLetter, value: value ?? this.value, note: note ?? this.note);

  Map<String, dynamic> toFields() => {'row_no': rowNo, 'column_letter': columnLetter, 'value': value, 'note': note.isEmpty ? null : note};

  Map<String, dynamic> toJson() => {'uuid': uuid, ...toFields()};

  factory TorqueReading.fromJson(Map<String, dynamic> j) => TorqueReading(
        uuid: '${j['uuid']}',
        rowNo: (j['row_no'] as num).toInt(),
        columnLetter: '${j['column_letter']}',
        value: (j['value'] as num).toDouble(),
        note: '${j['note'] ?? ''}',
      );
}

String _day(DateTime d) => '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

String torqueCheckDay(DateTime d) => _day(d);

/// The torque check sheet being filled in on this device.
class ActiveTorqueCheck {
  const ActiveTorqueCheck({required this.uuid, required this.date, required this.operatorName, this.machineNumber = '', this.side = 'Ai', this.creelTypeId, this.sessionId, this.readings = const {}});

  final String uuid;
  final DateTime date;
  final String operatorName;
  final String machineNumber;
  final String side;
  final int? creelTypeId;

  /// Set once the first cell is saved (or immediately, when resumed by typing an existing session id).
  /// The screen shows a session picker until this is known.
  final String? sessionId;

  /// Keyed by "$rowNo$columnLetter" for O(1) lookup; only filled cells have an entry.
  final Map<String, TorqueReading> readings;

  int get filledCount => readings.length;

  ActiveTorqueCheck copyWith({DateTime? date, String? operatorName, String? machineNumber, String? side, int? creelTypeId, String? sessionId, Map<String, TorqueReading>? readings}) => ActiveTorqueCheck(
        uuid: uuid,
        date: date ?? this.date,
        operatorName: operatorName ?? this.operatorName,
        machineNumber: machineNumber ?? this.machineNumber,
        side: side ?? this.side,
        creelTypeId: creelTypeId ?? this.creelTypeId,
        sessionId: sessionId ?? this.sessionId,
        readings: readings ?? this.readings,
      );

  Map<String, dynamic> toJson() => {
        'uuid': uuid,
        'date': _day(date),
        'operatorName': operatorName,
        'machineNumber': machineNumber,
        'side': side,
        'creelTypeId': creelTypeId,
        'sessionId': sessionId,
        'readings': [for (final r in readings.values) r.toJson()],
      };

  factory ActiveTorqueCheck.fromJson(Map<String, dynamic> j) => ActiveTorqueCheck(
        uuid: '${j['uuid']}',
        date: DateTime.tryParse('${j['date']}') ?? DateTime.now(),
        operatorName: '${j['operatorName'] ?? ''}',
        machineNumber: '${j['machineNumber'] ?? ''}',
        side: '${j['side'] ?? kTorqueSides[0]}',
        creelTypeId: (j['creelTypeId'] as num?)?.toInt(),
        sessionId: j['sessionId'] as String?,
        readings: {
          if (j['readings'] is List)
            for (final reading in [for (final r in j['readings'] as List) TorqueReading.fromJson(asMap(r))]) reading.position: reading,
        },
      );

  /// From the server's sheet+readings response (`show` or `session/{id}`), for resuming on another device.
  /// Server readings carry a numeric id, reused as the "uuid" here since the reading routes accept either.
  factory ActiveTorqueCheck.fromServer(Map<String, dynamic> j, {required String localUuid}) => ActiveTorqueCheck(
        uuid: localUuid,
        date: DateTime.tryParse('${j['check_date']}') ?? DateTime.now(),
        operatorName: '${j['operator_name'] ?? ''}',
        machineNumber: '${j['machine_number'] ?? ''}',
        side: '${j['side'] ?? kTorqueSides[0]}',
        creelTypeId: (j['creel_type_id'] as num?)?.toInt() ?? (j['creel_type'] is Map ? (asMap(j['creel_type'])['id'] as num?)?.toInt() : null),
        sessionId: j['session_id'] as String?,
        readings: {
          if (j['readings'] is List)
            for (final reading in [for (final r in j['readings'] as List) TorqueReading.fromJson({...asMap(r), 'uuid': asMap(r)['id']})]) reading.position: reading,
        },
      );
}
