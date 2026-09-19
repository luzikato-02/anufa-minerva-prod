import 'package:anufa_minerva_mobile/core/api/api_exception.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

DioException _fail(int code, Object? body) => DioException(
      requestOptions: RequestOptions(),
      response: Response(requestOptions: RequestOptions(), statusCode: code, data: body),
    );

void main() {
  const friendly = 'The server had a problem. Try again in a few minutes.';

  test("Laravel's bare 'Server Error' becomes an instruction", () {
    expect(ApiException.from(_fail(500, {'message': 'Server Error'})).message, friendly);
  });

  test('a proxy error with no JSON body says the same, not "Request failed (502)"', () {
    expect(ApiException.from(_fail(502, '<html>Bad Gateway</html>')).message, friendly);
    expect(ApiException.from(_fail(503, null)).message, friendly);
  });

  test('a specific server message is kept', () {
    expect(ApiException.from(_fail(500, {'message': 'OCR quota exceeded'})).message, 'OCR quota exceeded');
  });

  test('client errors keep their existing wording', () {
    expect(ApiException.from(_fail(404, null)).message, 'Request failed (404)');
  });
}
