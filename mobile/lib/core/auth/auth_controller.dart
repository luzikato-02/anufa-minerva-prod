import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import '../sync/sync_queue.dart';
import 'session.dart';

/// Result of the first login step: either signed in, or a 2FA challenge is pending.
class LoginOutcome {
  const LoginOutcome.signedIn() : challenge = null;
  const LoginOutcome.twoFactor(String this.challenge);
  final String? challenge;
  bool get needsTwoFactor => challenge != null;
}

/// True when the last sign-out was forced by an expired/revoked token rather than chosen by the user.
/// The login screen reads it to explain why the user is back there.
class SessionExpiredNotifier extends Notifier<bool> {
  @override
  bool build() => false;
  void set(bool v) => state = v;
}

final sessionExpiredProvider = NotifierProvider<SessionExpiredNotifier, bool>(SessionExpiredNotifier.new);

/// `null` = signed out. `loading` on cold start while the stored token is validated.
class AuthController extends AsyncNotifier<Session?> {
  /// The most recent signed-in session, so screens still on the stack can finish the frame in which the user is
  /// signed out (a 401) without reading a missing session, before the router sends them to login.
  Session? lastSession;

  Dio get _dio => ref.read(dioProvider);

  @override
  Future<Session?> build() async {
    ref.read(unauthorizedHandlerProvider).onUnauthorized = _expire;
    final token = await ref.read(tokenStoreProvider).read();
    if (token == null) return null;
    try {
      return await _fetchMe();
    } catch (e) {
      final err = ApiException.from(e);
      if (err.isOffline) rethrow; // keep the token; caller can retry
      await ref.read(tokenStoreProvider).clear();
      if (err.isUnauthorized) ref.read(sessionExpiredProvider.notifier).set(true);
      return null;
    }
  }

  Future<Session> _fetchMe() async {
    final res = await _dio.get('/auth/me');
    return Session.fromJson(Map<String, dynamic>.from(res.data as Map));
  }

  Future<LoginOutcome> login(String login, String password) async {
    try {
      final res = await _dio.post('/auth/login', data: {'login': login, 'password': password, 'device_name': 'Minerva mobile'});
      final data = Map<String, dynamic>.from(res.data as Map);
      if (data['two_factor'] == true) return LoginOutcome.twoFactor(data['challenge'] as String);
      await _accept(data);
      return const LoginOutcome.signedIn();
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<void> completeTwoFactor(String challenge, {String? code, String? recoveryCode}) async {
    try {
      final res = await _dio.post('/auth/two-factor-challenge', data: {
        'challenge': challenge,
        'code': ?code,
        'recovery_code': ?recoveryCode,
      });
      await _accept(Map<String, dynamic>.from(res.data as Map));
    } catch (e) {
      throw ApiException.from(e);
    }
  }

  Future<void> _accept(Map<String, dynamic> data) async {
    await ref.read(tokenStoreProvider).write(data['token'] as String);
    ref.read(sessionExpiredProvider.notifier).set(false);
    state = AsyncData(Session.fromJson(data));
    // Entries held back by an expired session go out now that there is a token again.
    unawaited(ref.read(syncQueueProvider.notifier).flush());
  }

  /// Re-reads the user (after profile / 2FA changes).
  Future<void> refresh() async => state = AsyncData(await _fetchMe());

  void replaceSession(Session s) => state = AsyncData(s);

  Future<void> logout() async {
    try {
      await _dio.post('/auth/logout');
    } catch (_) {/* token may already be invalid; still sign out locally */}
    await _clearLocal();
  }

  /// A request came back 401 with a token attached: flag it so the login screen can say why.
  Future<void> _expire() async {
    if (state.value == null) return; // several in-flight requests can 401 together
    ref.read(sessionExpiredProvider.notifier).set(true);
    await _clearLocal();
  }

  Future<void> _clearLocal() async {
    await ref.read(tokenStoreProvider).clear();
    state = const AsyncData(null);
  }
}

final authProvider = AsyncNotifierProvider<AuthController, Session?>(AuthController.new);

/// Current session; only valid inside authenticated routes.
final sessionProvider = Provider<Session>((ref) {
  final controller = ref.read(authProvider.notifier);
  final current = ref.watch(authProvider).value;
  if (current != null) return controller.lastSession = current;
  return controller.lastSession!;
});
