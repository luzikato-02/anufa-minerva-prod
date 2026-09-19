import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../auth/token_store.dart';
import '../config/env.dart';

final tokenStoreProvider = Provider<TokenStore>((_) => TokenStore());

/// Called when any request returns 401 with a token attached (expired/revoked).
class UnauthorizedHandler {
  void Function()? onUnauthorized;
}

final unauthorizedHandlerProvider = Provider<UnauthorizedHandler>((_) => UnauthorizedHandler());

final dioProvider = Provider<Dio>((ref) {
  final store = ref.watch(tokenStoreProvider);
  final dio = Dio(BaseOptions(
    baseUrl: '$kApiBaseUrl/api/v1',
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 60),
    headers: {'Accept': 'application/json'},
  ));
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await store.read();
      if (token != null) options.headers['Authorization'] = 'Bearer $token';
      handler.next(options);
    },
    onError: (e, handler) async {
      if (e.response?.statusCode == 401 && e.requestOptions.headers.containsKey('Authorization')) {
        ref.read(unauthorizedHandlerProvider).onUnauthorized?.call();
      }
      handler.next(e);
    },
  ));
  return dio;
});
