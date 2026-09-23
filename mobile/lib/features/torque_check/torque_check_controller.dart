import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

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
  }

  Future<void> setHeader({DateTime? date, String? operatorName, String? machineNumber, String? side, int? creelTypeId}) async {
    state = state!.copyWith(date: date, operatorName: operatorName, machineNumber: machineNumber, side: side, creelTypeId: creelTypeId);
    await _save();
  }

  /// Starts a new sheet. Readings already entered are on the server or in the upload queue, so nothing is dropped.
  Future<void> startNew() async {
    state = _fresh();
    await _save();
  }

  Map<String, dynamic> _readingBody(TorqueReading r) => {
        'sheet_client_uuid': state!.uuid,
        'check_date': torqueCheckDay(state!.date),
        'operator_name': state!.operatorName,
        'machine_number': state!.machineNumber,
        'side': state!.side,
        'creel_type_id': state!.creelTypeId,
        ...r.toFields(),
      };

  /// Records (or corrects) one cell and uploads it, or queues it when offline. Every submit is a POST: the
  /// server upserts by grid position, so re-sending an already-filled cell (a retry or an edit) is always safe.
  Future<SubmitResult> submitReading(TorqueReading reading) async {
    final sheet = state!;
    final previous = sheet.readings[reading.position]; // null when this cell was blank before
    state = sheet.copyWith(readings: {...sheet.readings, reading.position: reading});
    await _save();
    final queue = ref.read(syncQueueProvider.notifier);
    try {
      if (_waiting(reading.uuid)) await queue.discard(reading.uuid);
      return await queue.submit(method: 'POST', path: '/torque-checks/readings', data: _readingBody(reading), label: 'Torque check · row ${reading.position}', id: reading.uuid);
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
