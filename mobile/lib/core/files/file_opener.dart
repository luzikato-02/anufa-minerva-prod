import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import '../api/api_client.dart';
import '../api/api_exception.dart';

/// Saves downloaded bytes and hands them to the OS viewer. Swapped for a fake in tests.
abstract class FileOpener {
  Future<void> open(String filename, List<int> bytes);
}

class DeviceFileOpener implements FileOpener {
  @override
  Future<void> open(String filename, List<int> bytes) async {
    final dir = await getTemporaryDirectory();
    final safe = filename.replaceAll(RegExp(r'[^\w\-.]'), '_');
    final file = await File('${dir.path}/$safe').writeAsBytes(bytes, flush: true);
    final result = await OpenFilex.open(file.path);
    if (result.type != ResultType.done) {
      throw ApiException('No app available to open $safe (${result.message}).');
    }
  }
}

final fileOpenerProvider = Provider<FileOpener>((_) => DeviceFileOpener());

/// Fetches API exports (CSV/PDF) and opens them.
class FileDownloader {
  FileDownloader(this._dio, this._opener);

  final Dio _dio;
  final FileOpener _opener;

  Future<void> download(String path, String filename, {Map<String, dynamic>? query}) async {
    try {
      final res = await _dio.get<List<int>>(path, queryParameters: query, options: Options(responseType: ResponseType.bytes));
      await _opener.open(filename, res.data ?? const []);
    } catch (e) {
      throw ApiException.from(e);
    }
  }
}

final fileDownloaderProvider = Provider<FileDownloader>((ref) => FileDownloader(ref.watch(dioProvider), ref.watch(fileOpenerProvider)));
