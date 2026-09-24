import 'dart:async';
import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/sync/sync_queue.dart';
import '../tension/tension_models.dart';
import 'torque_check_models.dart';

/// The torque check sheet being filled in. It lives on the device, so a restart or a dead connection loses
/// nothing: every reading is uploaded (or queued) on its own the moment it is entered.
class TorqueCheckController extends Notifier<ActiveTorqueCheck?> {
  static const storageKey = 'torque-check-active';

  @override
  ActiveTorqueCheck? build() => null;

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    final s = state;
    if (s == null) {
      await prefs.remove(storageKey);
    } else {
      await prefs.setString(storageKey, jsonEncode(s.toJson()));
    }
  }

  ActiveTorqueCheck _fresh() => ActiveTorqueCheck(uuid: ref.read(syncQueueProvider.notifier).newId(), date: _today(), operatorName: ref.read(sessionProvider).name);

  DateTime _today() {
    final n = DateTime.now();
    return DateTime(n.year, n.month, n.day);
  }

  /// Restores this device's sheet, or starts an empty one.
  Future<void> open() async {
    if (state != null) return;
    final raw = (await SharedPreferences.getInstance()).getString(storageKey);
    try {
      state = raw == null ? _fresh() : ActiveTorqueCheck.fromJson(asMap(jsonDecode(raw)));
    } catch (_) {
      state = _fresh();
    }
    unawaited(_refreshSessionId());
  }

  /// A sheet started offline has no session id until the server has actually seen it. Best-effort: looks the
  /// sheet up by its own client uuid (which the scope also matches), so the id appears once connectivity
  /// allows the first cell to reach the server, even if that happened via a later automatic retry rather than
  /// the original submit. Failures (still offline, nothing saved yet) are silently ignored.
  Future<void> _refreshSessionId() async {
    final sheet = state;
    if (sheet == null || sheet.sessionId != null || sheet.filledCount == 0) return;
    try {
      final res = await ref.read(dioProvider).get('/torque-checks/session/${sheet.uuid}');
      final sessionId = asMap(asMap(res.data)['data'])['session_id'] as String?;
      if (sessionId != null && state?.sessionId == null) {
        state = state!.copyWith(sessionId: sessionId);
        await _save();
      }
    } catch (_) {
      // Offline, or the first cell hasn't reached the server yet — fine, try again next time.
    }
  }

  Future<void> setHeader({DateTime? date, String? operatorName, String? machineNumber, int? creelTypeId}) async {
    state = state!.copyWith(date: date, operatorName: operatorName, machineNumber: machineNumber, creelTypeId: creelTypeId);
    await _save();
  }

  /// Starts a new sheet. Readings already entered are on the server or in the upload queue, so nothing is dropped.
  Future<void> startNew() async {
    state = _fresh();
    await _save();
  }

  /// Loads an existing sheet by the session id it was assigned on its first reading (typed in by the operator
  /// to keep recording into it from this device), replacing whatever draft is active here.
  Future<void> loadSession(String sessionId) async {
    try {
      final res = await ref.read(dioProvider).get('/torque-checks/session/${Uri.encodeComponent(sessionId)}');
      state = ActiveTorqueCheck.fromServer(asMap(asMap(res.data)['data']), localUuid: ref.read(syncQueueProvider.notifier).newId());
      await _save();
    } catch (e) {
      final err = ApiException.from(e);
      throw err.status == 404 ? ApiException('Session "$sessionId" was not found.', status: 404) : err;
    }
  }

  Map<String, dynamic> _readingBody(TorqueReading r) => {
        if (state!.sessionId != null) 'session_id': state!.sessionId,
        'sheet_client_uuid': state!.uuid,
        'check_date': torqueCheckDay(state!.date),
        'operator_name': state!.operatorName,
        'machine_number': state!.machineNumber,
        'creel_type_id': state!.creelTypeId,
        ...r.toFields(),
      };

  /// Records (or corrects) one cell and uploads it, or queues it when offline. Every submit is a POST: the
  /// server upserts by grid position, so re-sending an already-filled cell (a retry or an edit) is always safe.
  /// The very first save assigns the sheet's session id, which the operator can then note down to resume on
  /// another device; [_refreshSessionId] picks it up once the server has actually seen the sheet.
  Future<SubmitResult> submitReading(TorqueReading reading) async {
    final sheet = state!;
    final previous = sheet.readings[reading.position]; // null when this cell was blank before
    state = sheet.copyWith(readings: {...sheet.readings, reading.position: reading});
    await _save();
    final queue = ref.read(syncQueueProvider.notifier);
    try {
      if (_waiting(reading.uuid)) await queue.discard(reading.uuid);
      final result = await queue.submit(method: 'POST', path: '/torque-checks/readings', data: _readingBody(reading), label: 'Torque check · row ${reading.position}', id: reading.uuid);
      await _save();
      unawaited(_refreshSessionId());
      return result;
    } catch (_) {
      // The server refused it (validation): put the cell back how it was.
      state = state!.copyWith(readings: {
        for (final e in state!.readings.entries) if (e.key != reading.position) e.key: e.value,
        if (previous != null) previous.position: previous,
      });
      await _save();
      rethrow;
    }
  }

  bool _waiting(String uuid) => ref.read(syncQueueProvider).ops.any((o) => o.id == uuid);

  Future<void> deleteReading(String position) async {
    final reading = state!.readings[position];
    if (reading == null) return;
    final waiting = _waiting(reading.uuid);
    state = state!.copyWith(readings: {for (final e in state!.readings.entries) if (e.key != position) e.key: e.value});
    await _save();
    final queue = ref.read(syncQueueProvider.notifier);
    if (waiting) {
      await queue.discard(reading.uuid); // never reached the server
    } else {
      await queue.submit(method: 'DELETE', path: '/torque-checks/readings/${reading.uuid}', data: const {}, label: 'Torque check · clear ${reading.position}');
    }
  }
}

final torqueCheckProvider = NotifierProvider<TorqueCheckController, ActiveTorqueCheck?>(TorqueCheckController.new);
