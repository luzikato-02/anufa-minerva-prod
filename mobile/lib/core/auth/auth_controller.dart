import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';
import 'session.dart';

/// Result of the first login step: either signed in, or a 2FA challenge is pending.
class LoginOutcome {
  const LoginOutcome.signedIn() : challenge = null;
  const LoginOutcome.twoFactor(String this.challenge);
  final String? challenge;
  bool get needsTwoFactor => challenge != null;
}

/// `null` = signed out. `loading` on cold start while the stored token is validated.
class AuthController extends AsyncNotifier<Session?> {
  Dio get _dio => ref.read(dioProvider);

  @override
  Future<Session?> build() async {
    ref.read(unauthorizedHandlerProvider).onUnauthorized = _clearLocal;
    final token = await ref.read(tokenStoreProvider).read();
    if (token == null) return null;
    try {
      return await _fetchMe();
    } catch (e) {
      final err = ApiException.from(e);
      if (err.isOffline) rethrow; // keep the token; caller can retry
      await ref.read(tokenStoreProvider).clear();
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
    state = AsyncData(Session.fromJson(data));
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

  Future<void> _clearLocal() async {
    await ref.read(tokenStoreProvider).clear();
    state = const AsyncData(null);
  }
}

final authProvider = AsyncNotifierProvider<AuthController, Session?>(AuthController.new);

/// Current session; only valid inside authenticated routes.
final sessionProvider = Provider<Session>((ref) => ref.watch(authProvider).requireValue!);
