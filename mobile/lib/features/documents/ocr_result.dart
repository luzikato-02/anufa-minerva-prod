import 'dart:convert';

import 'package:excel/excel.dart';

import '../tension/tension_models.dart';

class OcrPage {
  const OcrPage(this.index, this.markdown);

  final int index;
  final String markdown;
}

/// Result of `POST /document-intelligence/process` (Mistral OCR): markdown per page.
class OcrResult {
  OcrResult(this.raw) : pages = _pages(raw);

  final Map<String, dynamic> raw;
  final List<OcrPage> pages;

  static List<OcrPage> _pages(Map<String, dynamic> raw) {
    final list = raw['pages'];
    if (list is! List) return const [];
    return [for (var i = 0; i < list.length; i++) OcrPage((asMap(list[i])['index'] as num?)?.toInt() ?? i, '${asMap(list[i])['markdown'] ?? ''}')];
  }

  bool get isEmpty => pages.every((p) => p.markdown.trim().isEmpty);

  /// All pages joined with a horizontal rule (same as the web download).
  String toMarkdown() => pages.map((p) => p.markdown).join('\n\n---\n\n');

  String toJsonText() => const JsonEncoder.withIndent('  ').convert(raw);

  /// One sheet per page: markdown table rows become cells, every other line becomes a single-cell row
  /// (web `downloadExcel`).
  static List<List<String>> sheetRows(String markdown) {
    final rows = <List<String>>[];
    for (final line in markdown.split('\n')) {
      if (line.startsWith('|')) {
        if (RegExp(r'^\|[\s\-|:]+\|$').hasMatch(line)) continue; // |---|---| separator
        final cells = line.split('|');
        rows.add([for (final c in cells.sublist(1, cells.length > 1 ? cells.length - 1 : 1)) c.trim()]);
      } else {
        rows.add([line]);
      }
    }
    return rows;
  }

  List<int> toXlsx() {
    final book = Excel.createExcel();
    final defaultSheet = book.getDefaultSheet();
    for (final p in pages) {
      final sheet = book['Page ${p.index + 1}'];
      for (final row in sheetRows(p.markdown)) {
        sheet.appendRow([for (final c in row) TextCellValue(c)]);
      }
    }
    if (defaultSheet != null && pages.isNotEmpty) book.delete(defaultSheet);
    return book.encode() ?? const [];
  }
}
