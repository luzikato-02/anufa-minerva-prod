import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/theme/app_theme.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_badge.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import 'profile_page.dart' show askPassword;
import 'settings_shell.dart';

/// Enable / confirm / disable 2FA and manage recovery codes (web `settings/two-factor`).
class TwoFactorPage extends ConsumerStatefulWidget {
  const TwoFactorPage({super.key});

  @override
  ConsumerState<TwoFactorPage> createState() => _TwoFactorPageState();
}

class _TwoFactorPageState extends ConsumerState<TwoFactorPage> {
  Map<String, dynamic>? _setup; // secret + qr while confirming
  List<String>? _codes;
  final _code = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<T?> _run<T>(Future<T> Function() action) async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      return await action();
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e).message);
      return null;
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _enable() async {
    final pw = await askPassword(context, 'Confirm password', 'Enter your password to enable two-factor authentication.');
    if (pw == null) return;
    final res = await _run(() => ref.read(dioProvider).post('/account/two-factor/enable', data: {'password': pw}));
    if (res != null) setState(() => _setup = Map<String, dynamic>.from(res.data as Map));
  }

  Future<void> _confirm() async {
    final res = await _run(() => ref.read(dioProvider).post('/account/two-factor/confirm', data: {'code': _code.text.trim()}));
    if (res == null) return;
    _code.clear();
    await ref.read(authProvider.notifier).refresh();
    setState(() {
      _setup = null;
      _codes = List<String>.from((res.data as Map)['recovery_codes'] as List);
    });
  }

  Future<void> _disable() async {
    final pw = await askPassword(context, 'Disable two-factor', 'Enter your password to disable two-factor authentication.');
    if (pw == null) return;
    final res = await _run(() => ref.read(dioProvider).post('/account/two-factor/disable', data: {'password': pw}));
    if (res == null) return;
    await ref.read(authProvider.notifier).refresh();
    setState(() {
      _setup = null;
      _codes = null;
    });
  }

  Future<void> _codesAction({required bool regenerate}) async {
    final pw = await askPassword(context, 'Confirm password', 'Enter your password to ${regenerate ? 'regenerate' : 'view'} recovery codes.');
    if (pw == null) return;
    final dio = ref.read(dioProvider);
    final res = await _run(() => regenerate
        ? dio.put('/account/two-factor/recovery-codes', data: {'password': pw})
        : dio.post('/account/two-factor/recovery-codes', data: {'password': pw}));
    if (res != null) setState(() => _codes = List<String>.from((res.data as Map)['recovery_codes'] as List));
  }

  @override
  Widget build(BuildContext context) {
    final enabled = ref.watch(sessionProvider).twoFactorEnabled;
    final t = context.tokens;
    return SettingsShell(
      current: 'two-factor',
      child: Column(children: [
        if (_error != null) ...[AppAlert(message: _error!), const SizedBox(height: 12)],
        AppCard(
          title: 'Two-factor authentication',
          action: AppBadge(enabled ? 'Enabled' : 'Disabled', variant: enabled ? AppBadgeVariant.success : AppBadgeVariant.destructive),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_setup != null) ...[
              Text('Add this key to your authenticator app, then enter the 6-digit code it shows.', style: TextStyle(color: t.mutedForeground)),
              const SizedBox(height: 12),
              _SecretBox(secret: _setup!['secret'] as String),
              const SizedBox(height: 12),
              AppTextField(
                label: 'Code',
                controller: _code,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
              ),
              const SizedBox(height: 12),
              AppButton(label: 'Confirm', loading: _busy, onPressed: _confirm),
            ] else if (enabled) ...[
              Text('You will be prompted for a secure, random pin during login, which you can retrieve from your authenticator app.', style: TextStyle(color: t.mutedForeground)),
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: [
                AppButton(label: 'View recovery codes', variant: AppButtonVariant.outline, onPressed: _busy ? null : () => _codesAction(regenerate: false)),
                AppButton(label: 'Regenerate codes', variant: AppButtonVariant.outline, onPressed: _busy ? null : () => _codesAction(regenerate: true)),
                AppButton(label: 'Disable 2FA', variant: AppButtonVariant.destructive, onPressed: _busy ? null : _disable),
              ]),
            ] else ...[
              Text('When you enable two-factor authentication, you will be prompted for a secure pin during login.', style: TextStyle(color: t.mutedForeground)),
              const SizedBox(height: 12),
              Align(alignment: Alignment.centerLeft, child: AppButton(label: 'Enable 2FA', loading: _busy, onPressed: _enable)),
            ],
          ]),
        ),
        if (_codes != null) ...[
          const SizedBox(height: 16),
          AppCard(
            title: '2FA recovery codes',
            description: 'Store these in a password manager. Each code works once.',
            action: IconButton(
              icon: const Icon(Icons.copy, size: 18),
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: _codes!.join('\n')));
                if (context.mounted) showToast(context, 'Recovery codes copied');
              },
            ),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(color: t.muted, borderRadius: BorderRadius.circular(Radii.md)),
              child: SelectableText(_codes!.join('\n'), style: const TextStyle(fontFamily: 'monospace', fontSize: 13, height: 1.6)),
            ),
          ),
        ],
      ]),
    );
  }
}

class _SecretBox extends StatelessWidget {
  const _SecretBox({required this.secret});

  final String secret;

  @override
  Widget build(BuildContext context) {
    final t = context.tokens;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: t.muted, borderRadius: BorderRadius.circular(Radii.md)),
      child: Row(children: [
        Expanded(child: SelectableText(secret, style: const TextStyle(fontFamily: 'monospace', fontSize: 15, letterSpacing: 1))),
        IconButton(
          icon: const Icon(Icons.copy, size: 18),
          onPressed: () async {
            await Clipboard.setData(ClipboardData(text: secret));
            if (context.mounted) showToast(context, 'Key copied');
          },
        ),
      ]),
    );
  }
}
