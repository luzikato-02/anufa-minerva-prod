import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/session.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/ui/form_sheet.dart';
import 'home_config.dart';

/// Home "Scan" button: choose what to scan. With only one option available it opens that screen directly.
Future<void> showScanOptions(BuildContext context, Session session) async {
  final options = scanOptionsFor(session);
  if (options.length == 1) {
    context.go(options.single.path);
    return;
  }
  final path = await showFormSheet<String>(
    context,
    title: 'Scan',
    description: 'Choose what to scan',
    builder: (ctx) => Column(children: [for (final o in options) _ScanOptionRow(option: o)]),
  );
  if (path != null && context.mounted) context.go(path);
}

class _ScanOptionRow extends StatelessWidget {
  const _ScanOptionRow({required this.option});
  final ScanOption option;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    final tint = TileTint.of(context, option.category);
    return Semantics(
      button: true,
      label: '${option.title}. ${option.description}',
      excludeSemantics: true,
      child: InkWell(
        borderRadius: BorderRadius.circular(Radii.lg),
        onTap: () => Navigator.pop(context, option.path),
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 64),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(color: tint.background, borderRadius: BorderRadius.circular(14)),
                child: Icon(option.icon, size: 24, color: tint.icon),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(option.title, style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w500)),
                  Text(option.description, style: TextStyle(fontSize: 13, color: t.mutedForeground)),
                ]),
              ),
            ]),
          ),
        ),
      ),
    );
  }
}
