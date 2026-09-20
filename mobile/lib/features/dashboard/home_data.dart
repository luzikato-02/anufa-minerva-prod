import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';

/// One open problem reported on a tension record, as the Home carousel shows it.
class ReportedProblem {
  const ReportedProblem({
    required this.recordId,
    required this.problemId,
    required this.recordType,
    required this.where,
    required this.description,
    required this.reportedAt,
    this.itemNumber,
    this.machineNumber,
  });

  final int recordId;
  final String problemId;
  final String recordType; // twisting | weaving
  final String where; // "Spindle 12" or a creel position such as "AI-A-Col3"
  final String description;
  final DateTime? reportedAt;
  final String? itemNumber;
  final String? machineNumber;

  String get typeLabel => recordType.isEmpty
      ? ''
      : '${recordType[0].toUpperCase()}${recordType.substring(1)}';

  /// "Twisting · ITM-1 · Machine T-01", skipping what the record does not have.
  String get context => [
    if (typeLabel.isNotEmpty) typeLabel,
    if (itemNumber != null && itemNumber!.isNotEmpty) itemNumber!,
    if (machineNumber != null && machineNumber!.isNotEmpty)
      'Machine $machineNumber',
  ].join(' · ');

  factory ReportedProblem.fromJson(Map<String, dynamic> j) {
    final spindle = j['spindle_number'];
    return ReportedProblem(
      recordId: (j['record_id'] as num).toInt(),
      problemId: '${j['problem_id']}',
      recordType: '${j['record_type'] ?? ''}',
      where: spindle != null
          ? 'Spindle $spindle'
          : '${j['position'] ?? 'Unknown position'}',
      description: '${j['description'] ?? ''}',
      reportedAt: DateTime.tryParse(
        '${j['timestamp'] ?? j['record_created_at']}',
      )?.toLocal(),
      itemNumber: j['item_number']?.toString(),
      machineNumber: j['machine_number']?.toString(),
    );
  }
}

/// The newest open problems across twisting and weaving. The API sorts by record date, newest first.
final recentProblemsProvider =
    FutureProvider.autoDispose<List<ReportedProblem>>((ref) async {
      try {
        final res = await ref
            .watch(dioProvider)
            .get(
              '/tension-problems',
              queryParameters: {'status': 'open', 'per_page': 7},
            );
        final rows = (res.data as Map)['data'] as List;
        return [
          for (final r in rows)
            ReportedProblem.fromJson(Map<String, dynamic>.from(r as Map)),
        ];
      } catch (e) {
        throw ApiException.from(e);
      }
    });

class TrendDay {
  const TrendDay(
    this.date, {
    required this.problems,
    required this.measurements,
  });
  final DateTime date;
  final int problems;
  final int measurements;
}

/// Daily counts for one record type, oldest day first, ending today.
class TensionTrend {
  const TensionTrend(this.days);
  final List<TrendDay> days;

  int get totalProblems => days.fold(0, (sum, d) => sum + d.problems);
  int get totalMeasurements => days.fold(0, (sum, d) => sum + d.measurements);

  factory TensionTrend.fromJson(Map<String, dynamic> data) => TensionTrend([
    for (final d in data['days'] as List)
      TrendDay(
        DateTime.parse('${d['date']}'),
        problems: (d['problems'] as num).toInt(),
        measurements: (d['measurements'] as num).toInt(),
      ),
  ]);
}

/// 14 days of problems reported and measurements recorded. Days are the phone's calendar days (sent as a UTC offset).
final tensionTrendProvider = FutureProvider.autoDispose
    .family<TensionTrend, String>((ref, type) async {
      try {
        final res = await ref
            .watch(dioProvider)
            .get(
              '/tension-trends',
              queryParameters: {
                'type': type,
                'days': 14,
                'tz_offset': DateTime.now().timeZoneOffset.inMinutes,
              },
            );
        return TensionTrend.fromJson(
          Map<String, dynamic>.from((res.data as Map)['data'] as Map),
        );
      } catch (e) {
        throw ApiException.from(e);
      }
    });
