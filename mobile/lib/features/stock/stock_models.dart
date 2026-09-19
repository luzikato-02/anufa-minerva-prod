import '../tension/tension_models.dart';

/// A batch to be found during a stock take. The uploaded CSV may use snake_case or the
/// spreadsheet's original headers, so both are accepted (mirrors the server's `normalizeBatchKeys`).
class StockBatch {
  const StockBatch({required this.batchNumber, required this.materialCode, required this.materialDescription, this.weight, this.bobbinQty});

  final String batchNumber;
  final String materialCode;
  final String materialDescription;
  final String? weight;
  final String? bobbinQty;

  factory StockBatch.fromRaw(Map<String, dynamic> j) {
    String pick(List<String> keys) {
      for (final k in keys) {
        final v = j[k];
        if (v != null && '$v'.isNotEmpty) return '$v';
      }
      return '';
    }

    final w = pick(['weight', 'Weight']);
    final b = pick(['bobbin_qty', 'Bobbin Qty']);
    return StockBatch(
      batchNumber: pick(['batch_number', 'Batch Number']),
      materialCode: pick(['material_code', 'Material Code']),
      materialDescription: pick(['material_description', 'Material Desciption', 'Material Description']),
      weight: w.isEmpty ? null : w,
      bobbinQty: b.isEmpty ? null : b,
    );
  }

  Map<String, dynamic> toJson() => {'batch_number': batchNumber, 'material_code': materialCode, 'material_description': materialDescription, 'weight': weight, 'bobbin_qty': bobbinQty};
}

/// Typed view of a stock-take session record.
class StockSession {
  StockSession(this.raw);

  final Map<String, dynamic> raw;

  int get id => (raw['id'] as num).toInt();
  String get sessionId => '${raw['session_id'] ?? raw['id']}';
  Map<String, dynamic> get metadata => asMap(raw['metadata']);
  String get leader => '${metadata['session_leader'] ?? ''}';
  String get status => '${metadata['session_status'] ?? ''}';
  bool get completed => status.toLowerCase() == 'completed';
  int get totalBatches => (metadata['total_batches'] as num?)?.toInt() ?? 0;
  int get totalMaterials => (metadata['total_materials'] as num?)?.toInt() ?? 0;
  int get checked => (metadata['total_checked_batches'] as num?)?.toInt() ?? 0;
  double get progress => totalBatches == 0 ? 0 : checked / totalBatches;
  DateTime? get createdAt => DateTime.tryParse('${raw['created_at']}')?.toLocal();

  List<StockBatch> get batches => [if (raw['indv_batch_data'] is List) for (final b in raw['indv_batch_data'] as List) StockBatch.fromRaw(asMap(b))];

  Set<String> get recordedNumbers => {
        if (raw['recorded_batches'] is List) for (final r in raw['recorded_batches'] as List) '${asMap(r)['batch_number']}',
      };

  /// Per-batch combined table the server builds (`stock_take_summary`).
  List<Map<String, dynamic>> get summary => [if (raw['stock_take_summary'] is List) for (final r in raw['stock_take_summary'] as List) asMap(r)];
}

/// Metadata for a new session built from an uploaded CSV (web `handleSubmit`).
Map<String, dynamic> newSessionPayload({required List<Map<String, String>> rows, required String leader}) => {
      'indv_batch_data': rows,
      'metadata': {
        'total_batches': rows.length,
        'total_materials': rows.map((r) => StockBatch.fromRaw(r).materialCode.trim()).toSet().length,
        'total_checked_batches': 0,
        'session_leader': leader,
        'session_status': 'In Progress',
      },
    };
