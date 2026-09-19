import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// Centered card layout shared by the sign-in screens (web `auth-layout`).
class AuthLayout extends StatelessWidget {
  const AuthLayout({super.key, required this.title, required this.subtitle, required this.child});

  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                Center(
                  child: ClipRRect(borderRadius: BorderRadius.circular(Radii.lg), child: Image.asset('assets/images/logo.png', width: 48, height: 48)),
                ),
                const SizedBox(height: 20),
                Text(title, textAlign: TextAlign.center, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                Text(subtitle, textAlign: TextAlign.center, style: TextStyle(color: t.mutedForeground)),
                const SizedBox(height: 24),
                child,
              ]),
            ),
          ),
        ),
      ),
    );
  }
}
