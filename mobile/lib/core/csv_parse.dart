/// Splits one CSV line, honouring quoted fields with commas and `""` escapes
/// (port of the web `parseCSVLine`).
List<String> parseCsvLine(String line) {
  final result = <String>[];
  final current = StringBuffer();
  var inQuotes = false;
  for (var i = 0; i < line.length; i++) {
    final ch = line[i];
    if (ch == '"' && i + 1 < line.length && line[i + 1] == '"') {
      current.write('"');
      i++;
    } else if (ch == '"') {
      inQuotes = !inQuotes;
    } else if (ch == ',' && !inQuotes) {
      result.add(current.toString().trim());
      current.clear();
    } else {
      current.write(ch);
    }
  }
  result.add(current.toString().trim());
  return result;
}

/// Parses CSV text with a header row into one map per data row. Blank lines are skipped and a
/// UTF-8 BOM (common in Excel exports) is removed so the first header still matches.
List<Map<String, String>> parseCsvRecords(String text) {
  final lines = text.replaceFirst('﻿', '').trim().split(RegExp(r'\r?\n')).where((l) => l.trim().isNotEmpty).toList();
  if (lines.isEmpty) return [];
  final headers = parseCsvLine(lines.first);
  return [
    for (final line in lines.skip(1))
      () {
        final values = parseCsvLine(line);
        return {for (var i = 0; i < headers.length; i++) headers[i]: i < values.length ? values[i] : ''};
      }(),
  ];
}

/// Quotes a field for CSV output when needed.
String csvEscape(Object? v) {
  final s = v == null ? '' : '$v';
  return s.contains(RegExp(r'[",\n\r]')) ? '"${s.replaceAll('"', '""')}"' : s;
}
