import 'dart:convert';
import 'dart:typed_data';

import 'package:file_picker/file_picker.dart';
import 'package:image_picker/image_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class PickedFile {
  const PickedFile(this.name, this.bytes);

  final String name;
  final Uint8List bytes;

  /// Text content; tolerant of stray bytes since spreadsheets often export odd encodings.
  String get text => utf8.decode(bytes, allowMalformed: true);
}

/// Native file chooser limited to [extensions]. A provider so tests can supply a fake.
typedef PickFile = Future<PickedFile?> Function(List<String> extensions);

final pickFileProvider = Provider<PickFile>((_) => (extensions) async {
      final f = await FilePicker.pickFile(type: FileType.custom, allowedExtensions: extensions);
      return f == null ? null : PickedFile(f.name, await f.readAsBytes());
    });

/// Opens the camera and returns the photo, or null if cancelled. Overridable in tests.
typedef TakePhoto = Future<PickedFile?> Function();

final takePhotoProvider = Provider<TakePhoto>((_) => () async {
      final x = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 85, maxWidth: 2400);
      return x == null ? null : PickedFile(x.name, await x.readAsBytes());
    });

/// File types the OCR endpoints accept (server limit: 20 MB).
const kOcrExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
const kMaxUploadBytes = 20 * 1024 * 1024;

/// Returns why [f] can't be uploaded for OCR, or null if it's fine.
String? validateOcrUpload(PickedFile f) {
  if (!kOcrExtensions.contains(f.name.split('.').last.toLowerCase())) return 'Unsupported file type. Use a PDF or image (PNG, JPG, WEBP).';
  if (f.bytes.length > kMaxUploadBytes) return 'That file is over 20 MB.';
  return null;
}

String mimeTypeFor(String name) => switch (name.split('.').last.toLowerCase()) {
      'pdf' => 'application/pdf',
      'png' => 'image/png',
      'webp' => 'image/webp',
      _ => 'image/jpeg',
    };
