import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../shared/minerva_scaffold.dart';

/// Settings pages with a tab strip (web `settings/layout`).
class SettingsShell extends StatelessWidget {
  const SettingsShell({super.key, required this.current, required this.child});

  final String current;
  final Widget child;

  static const tabs = {
    'profile': 'Profile',
    'password': 'Password',
    'two-factor': 'Two-Factor',
    'appearance': 'Appearance',
  };

  @override
  Widget build(BuildContext context) {
    return MinervaScaffold(
      title: 'Settings',
      body: Column(children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
          child: Row(children: [
            for (final e in tabs.entries)
              Padding(
                padding: const EdgeInsets.only(right: 8),
                child: ChoiceChip(
                  label: Text(e.value),
                  selected: e.key == current,
                  onSelected: (_) => context.go('/settings/${e.key}'),
                ),
              ),
          ]),
        ),
        Expanded(child: ListView(padding: const EdgeInsets.all(16), children: [child])),
      ]),
    );
  }
}

void showToast(BuildContext context, String message) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
