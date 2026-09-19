import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import 'tension_models.dart';

final tensionStatsProvider = FutureProvider.autoDispose<Map<String, dynamic>>((ref) async {
  try {
    final res = await ref.watch(dioProvider).get('/tension-statistics');
    return asMap((res.data as Map)['data']);
  } catch (e) {
    throw ApiException.from(e);
  }
});

final tensionRecordProvider = FutureProvider.autoDispose.family<TensionRecord, int>((ref, id) async {
  try {
    final res = await ref.watch(dioProvider).get('/tension-records/$id');
    return TensionRecord(asMap((res.data as Map)['data']));
  } catch (e) {
    throw ApiException.from(e);
  }
});
