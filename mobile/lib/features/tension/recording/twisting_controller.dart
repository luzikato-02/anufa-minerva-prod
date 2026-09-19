import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/sync/sync_queue.dart';
import 'twisting_draft.dart';

/// Holds the in-progress twisting session and mirrors it to device storage after every change,
/// so an app kill, crash or lost signal never loses readings (web: localStorage).
class TwistingController extends Notifier<TwistingDraft> {
  static const _key = 'twisting-draft-v1';
  bool _loaded = false;

  @override
  TwistingDraft build() {
    _restore();
    return const TwistingDraft();
  }

  Future<void> _restore() async {
    try {
      final raw = (await SharedPreferences.getInstance()).getString(_key);
      if (raw != null && ref.mounted && !_touched) state = TwistingDraft.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {/* corrupt draft: start fresh */}
    _loaded = true;
  }

  bool _touched = false;

  void _set(TwistingDraft d) {
    _touched = true;
    state = d;
    _save();
  }

  Future<void> _save() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(state.toJson()));
  }

  bool get loaded => _loaded;

  void setField(String k, String v) => _set(state.setField(k, v));
  void press(String k) => _set(state.press(k));
  void backspace() => _set(state.backspace());
  void clearDisplay() => _set(state.clearDisplay());
  void submitValue() => _set(state.submit());
  void deleteStored() => _set(state.deleteStored());
  void next() => _set(state.next());
  void previous() => _set(state.previous());
  void goTo(int n) => _set(state.goTo(n));
  void toggleType() => _set(state.toggleType());
  void addProblem(int spindle, String text) => _set(state.addProblem(spindle, text));
  void removeProblem(int id) => _set(state.removeProblem(id));

  /// Clears the form only (keeps readings), like the web "Clear Form".
  void clearForm() => _set(state.copyWith(form: {}));

  /// Wipes the whole session, including readings and problems.
  Future<void> reset() async {
    _touched = true;
    state = const TwistingDraft();
    await (await SharedPreferences.getInstance()).remove(_key);
  }

  /// Uploads the session; queues it on the device if there's no connection.
  /// The record's queue id is the server idempotency key, so a retry can't duplicate it.
  Future<SubmitResult> finish({required bool clearAfter}) async {
    final draft = state;
    final label = 'Twisting · ${draft.field('itemNumber').isEmpty ? 'no item' : draft.field('itemNumber')} · machine ${draft.field('machineNumber')}';
    final result = await ref.read(syncQueueProvider.notifier).submit(method: 'POST', path: '/tension-records', data: draft.toRecord(), label: label);
    if (clearAfter) await reset();
    return result;
  }
}

final twistingControllerProvider = NotifierProvider<TwistingController, TwistingDraft>(TwistingController.new);
