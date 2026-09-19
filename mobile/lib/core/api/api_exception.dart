import 'package:dio/dio.dart';

/// Normalised API failure: a display message plus Laravel 422 field errors.
class ApiException implements Exception {
  ApiException(this.message, {this.status, this.fieldErrors = const {}});

  final String message;
  final int? status;
  final Map<String, String> fieldErrors;

  bool get isOffline => status == null;
  bool get isUnauthorized => status == 401;

  String? field(String name) => fieldErrors[name];

  factory ApiException.from(Object error) {
    if (error is ApiException) return error;
    if (error is DioException) {
      final code = error.response?.statusCode;
      final data = error.response?.data;
      if (code == null) {
        return ApiException('Cannot reach the server. Check your connection.');
      }
      final fields = <String, String>{};
      String? message;
      if (data is Map) {
        // Some endpoints (e.g. OCR) report failures under `error` instead of `message`.
        message = (data['message'] ?? data['error'])?.toString();
        final errors = data['errors'];
        if (errors is Map) {
          errors.forEach((k, v) => fields[k.toString()] = v is List && v.isNotEmpty ? v.first.toString() : v.toString());
          if (fields.isNotEmpty) message = fields.values.first;
        }
      }
      // Laravel's bare "Server Error" and proxy errors (no JSON body) say nothing the reader can act on.
      final generic = message == null || message.trim().toLowerCase() == 'server error';
      if (code >= 500 && generic) message = 'The server had a problem. Try again in a few minutes.';
      return ApiException(message ?? 'Request failed ($code)', status: code, fieldErrors: fields);
    }
    return ApiException(error.toString());
  }

  @override
  String toString() => message;
}
