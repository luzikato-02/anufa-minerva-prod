import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/sync/sync_queue.dart';
import '../tension/tension_models.dart';
import 'stock_models.dart';

enum LookupKind { notFound, alreadyRecorded, ready }

class LookupResult {
  const LookupResult(this.kind, this.message, [this.batch]);

  final LookupKind kind;
  final String message;
  final StockBatch? batch;
}

class StockRecordingState {
  const StockRecordingState({this.sessionId, this.batches = const [], this.recorded = const {}, this.offlineCopy = false});

  /// Public session id (e.g. 123456) the operator typed.
  final String? sessionId;
  final List<StockBatch> batches;

  /// Batch numbers already found (server-side plus ones queued on this device).
  final Set<String> recorded;

  /// True when the batch list came from the device cache because the server was unreachable.
  final bool offlineCopy;

  bool get loaded => sessionId != null;
  int get total => batches.length;

  StockRecordingState copyWith({Set<String>? recorded}) => StockRecordingState(sessionId: sessionId, batches: batches, recorded: recorded ?? this.recorded, offlineCopy: offlineCopy);
}

/// Stock-take scanning: validates batches against the session, using the server when online
/// and the on-device copy when not, and queues recordings so nothing is lost offline.
class StockRecordingController extends Notifier<StockRecordingState> {
  static const _cachePrefix = 'stock-session-';
  static const lastSessionKey = 'stock-last-session';

  @override
  StockRecordingState build() => const StockRecordingState();

  Future<void> _cache() async {
    final s = state;
    if (s.sessionId == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('$_cachePrefix${s.sessionId}', jsonEncode({'batches': [for (final b in s.batches) b.toJson()], 'recorded': s.recorded.toList()}));
    await prefs.setString(lastSessionKey, s.sessionId!);
  }

  Future<String?> lastSessionId() async => (await SharedPreferences.getInstance()).getString(lastSessionKey);

  /// Loads a session by its public id. Falls back to this device's copy if the server is unreachable.
  Future<void> loadSession(String id) async {
    id = id.trim();
    try {
      final res = await ref.read(dioProvider).get('/stock-take-records/session/${Uri.encodeComponent(id)}');
      final session = StockSession(asMap((res.data as Map)['data']));
      final cached = await _readCache(id);
      state = StockRecordingState(sessionId: id, batches: session.batches, recorded: {...session.recordedNumbers, ...?cached?.recorded});
      await _cache();
    } catch (e) {
      final err = ApiException.from(e);
      if (!err.isOffline) throw err.status == 404 ? ApiException('Session "$id" was not found.', status: 404) : err;
      final cached = await _readCache(id);
      if (cached == null) throw ApiException('Cannot reach the server, and session "$id" has not been opened on this device before.');
      state = StockRecordingState(sessionId: id, batches: cached.batches, recorded: cached.recorded, offlineCopy: true);
    }
  }

  Future<StockRecordingState?> _readCache(String id) async {
    final raw = (await SharedPreferences.getInstance()).getString('$_cachePrefix$id');
    if (raw == null) return null;
    final j = jsonDecode(raw) as Map<String, dynamic>;
    return StockRecordingState(sessionId: id, batches: [for (final b in j['batches'] as List) StockBatch.fromRaw(asMap(b))], recorded: {...(j['recorded'] as List).map((e) => '$e')});
  }

  void leaveSession() => state = const StockRecordingState();

  StockBatch? _find(String n) => state.batches.where((b) => b.batchNumber == n).firstOrNull;

  /// Server first (sees other devices' scans); local copy when offline.
  Future<LookupResult> lookup(String batchNumber) async {
    final n = batchNumber.trim();
    try {
      final res = await ref.read(dioProvider).get('/stock-take-records/check-batch', queryParameters: {'record_key': state.sessionId, 'batch': n});
      final d = asMap(res.data);
      if (d['exists'] != true) return LookupResult(LookupKind.notFound, '${d['message'] ?? 'Batch not found in this session'}');
      final batch = StockBatch.fromRaw(asMap(d['batch_data']));
      if (d['already_recorded'] == true) {
        state = state.copyWith(recorded: {...state.recorded, n});
        return LookupResult(LookupKind.alreadyRecorded, '${d['message'] ?? 'Batch already recorded.'}');
      }
      // A scan queued on this device may not be on the server yet.
      if (state.recorded.contains(n)) return const LookupResult(LookupKind.alreadyRecorded, 'Batch already recorded (waiting to upload).');
      return LookupResult(LookupKind.ready, '${d['message'] ?? 'Batch found and ready to record.'}', batch);
    } catch (e) {
      final err = ApiException.from(e);
      if (err.isOffline) return _localLookup(n, offline: true);
      // check-batch answers 404 only when the session itself no longer exists.
      if (err.status == 404) throw ApiException('Session "${state.sessionId}" was not found.', status: 404);
      throw err;
    }
  }

  LookupResult _localLookup(String n, {bool offline = false}) {
    final suffix = offline ? ' (offline copy)' : '';
    final batch = _find(n);
    if (batch == null) return LookupResult(LookupKind.notFound, 'Batch not found in this session$suffix');
    if (state.recorded.contains(n)) return LookupResult(LookupKind.alreadyRecorded, 'Batch already found. Move to the next batch.$suffix');
    return LookupResult(LookupKind.ready, 'Batch found and ready to record.$suffix', batch);
  }

  /// Sends (or queues) a found batch. Marked recorded locally either way so it can't be scanned twice.
  Future<SubmitResult> record({
    required StockBatch batch,
    required double weight,
    required int bobbins,
    int? line,
    String row = '',
    String explanation = '',
    required String userName,
    DateTime? now,
  }) async {
    final result = await ref.read(syncQueueProvider.notifier).submit(
      method: 'POST',
      path: '/stock-take-records/record-batch',
      label: 'Stock take ${state.sessionId} · batch ${batch.batchNumber}',
      data: {
        'session_id': state.sessionId,
        'batch_number': batch.batchNumber,
        'material_code': batch.materialCode,
        'material_description': batch.materialDescription,
        'actual_weight': weight,
        'total_bobbins': bobbins,
        'line_position': line,
        'row_position': row,
        'explanation': explanation.trim(),
        'found_by': userName,
        'found_at': (now ?? DateTime.now()).toUtc().toIso8601String(),
      },
    );
    state = state.copyWith(recorded: {...state.recorded, batch.batchNumber});
    await _cache();
    return result;
  }
}

final stockRecordingProvider = NotifierProvider<StockRecordingController, StockRecordingState>(StockRecordingController.new);
