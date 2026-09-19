import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/auth/session.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import 'settings_shell.dart';

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  late final _name = TextEditingController(text: ref.read(sessionProvider).name);
  late final _email = TextEditingController(text: ref.read(sessionProvider).email);
  bool _busy = false;
  ApiException? _error;

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final res = await ref.read(dioProvider).patch('/account/profile', data: {'name': _name.text.trim(), 'email': _email.text.trim()});
      ref.read(authProvider.notifier).replaceSession(Session.fromJson(Map<String, dynamic>.from(res.data as Map)));
      if (mounted) showToast(context, 'Profile saved');
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _delete() async {
    final password = await _askPassword(context, 'Delete account', 'This permanently deletes your account. Enter your password to confirm.');
    if (password == null) return;
    try {
      await ref.read(dioProvider).delete('/account', data: {'password': password});
      await ref.read(authProvider.notifier).logout();
    } catch (e) {
      if (mounted) showToast(context, ApiException.from(e).message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(sessionProvider);
    return SettingsShell(
      current: 'profile',
      child: Column(children: [
        AppCard(
          title: 'Profile information',
          description: 'Update your name and email address',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_error != null && _error!.fieldErrors.isEmpty) ...[AppAlert(message: _error!.message), const SizedBox(height: 12)],
            AppTextField(label: 'Name', controller: _name, error: _error?.field('name')),
            const SizedBox(height: 12),
            AppTextField(label: 'Email address', controller: _email, keyboardType: TextInputType.emailAddress, error: _error?.field('email')),
            if (session.username != null) ...[
              const SizedBox(height: 12),
              AppTextField(label: 'Username', controller: TextEditingController(text: session.username), enabled: false),
            ],
            const SizedBox(height: 16),
            AppButton(label: 'Save', loading: _busy, onPressed: _save),
          ]),
        ),
        const SizedBox(height: 16),
        AppCard(
          title: 'Delete account',
          description: 'Delete your account and all of its resources',
          child: AppButton(label: 'Delete account', variant: AppButtonVariant.destructive, onPressed: _delete),
        ),
      ]),
    );
  }
}

/// Modal password prompt used for sensitive actions (replaces the web `password.confirm` step).
Future<String?> _askPassword(BuildContext context, String title, String message) {
  final controller = TextEditingController();
  return showDialog<String>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
      content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(message),
        const SizedBox(height: 12),
        AppTextField(controller: controller, obscure: true, autofocus: true, hint: 'Password'),
      ]),
      actions: [
        AppButton(label: 'Cancel', variant: AppButtonVariant.outline, onPressed: () => Navigator.pop(ctx)),
        AppButton(label: 'Confirm', onPressed: () => Navigator.pop(ctx, controller.text)),
      ],
    ),
  );
}

Future<String?> askPassword(BuildContext context, String title, String message) => _askPassword(context, title, message);
