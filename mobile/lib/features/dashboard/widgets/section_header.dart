import 'package:flutter/material.dart';

import '../../../core/ui/app_button.dart';

/// Title of a Home section, with an optional link on the trailing side.
class SectionHeader extends StatelessWidget {
  const SectionHeader({
    super.key,
    required this.title,
    this.actionLabel,
    this.onAction,
  });

  final String title;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Semantics(
            header: true,
            child: Text(
              title,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
            ),
          ),
        ),
        if (actionLabel != null)
          AppButton(
            variant: AppButtonVariant.secondary,
            size: AppButtonSize.sm,
            label: actionLabel,
            onPressed: onAction,
          ),
      ],
    );
  }
}
