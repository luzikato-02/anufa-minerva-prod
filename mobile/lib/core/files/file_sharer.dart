import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

/// Hands generated files to the OS share sheet (save to Drive, email, chat…).
/// Better than "open with" for formats like .md/.xlsx that may have no viewer installed.
abstract class FileSharer {
  Future<void> share(String filename, List<int> bytes, {String? mimeType});
}

class DeviceFileSharer implements FileSharer {
  @override
  Future<void> share(String filename, List<int> bytes, {String? mimeType}) async {
    final dir = await getTemporaryDirectory();
    final file = await File('${dir.path}/${filename.replaceAll(RegExp(r'[^\w\-.]'), '_')}').writeAsBytes(bytes, flush: true);
    await SharePlus.instance.share(ShareParams(files: [XFile(file.path, mimeType: mimeType)], subject: filename));
  }
}

final fileSharerProvider = Provider<FileSharer>((_) => DeviceFileSharer());
