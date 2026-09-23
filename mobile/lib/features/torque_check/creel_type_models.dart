import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../tension/tension_models.dart';

/// A category of creel with its own acceptable torque range, managed on the Creel Type Settings screen.
class CreelType {
  const CreelType({required this.id, required this.name, required this.torqueMin, required this.torqueMax, this.sheetCount = 0});

  final int id;
  final String name;
  final double torqueMin;
  final double torqueMax;
  final int sheetCount;

  bool inRange(double v) => v >= torqueMin && v <= torqueMax;

  factory CreelType.fromJson(Map<String, dynamic> j) => CreelType(
        id: (j['id'] as num).toInt(),
        name: '${j['name']}',
        torqueMin: (j['torque_min'] as num).toDouble(),
        torqueMax: (j['torque_max'] as num).toDouble(),
        sheetCount: (j['torque_check_sheets_count'] as num?)?.toInt() ?? 0,
      );
}

final creelTypesProvider = FutureProvider.autoDispose<List<CreelType>>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get('/creel-types');
    return [for (final j in asMap(res.data)['data'] as List) CreelType.fromJson(asMap(j))];
  } catch (e) {
    throw ApiException.from(e);
  }
});
