import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import 'settings_shell.dart';

class PasswordPage extends ConsumerStatefulWidget {
  const PasswordPage({super.key});

  @override
  ConsumerState<PasswordPage> createState() => _PasswordPageState();
}

class _PasswordPageState extends ConsumerState<PasswordPage> {
  final _current = TextEditingController();
  final _new = TextEditingController();
  final _confirm = TextEditingController();
  bool _busy = false;
  ApiException? _error;

  @override
  void dispose() {
    _current.dispose();
    _new.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(dioProvider).put('/account/password', data: {
        'current_password': _current.text,
        'password': _new.text,
        'password_confirmation': _confirm.text,
      });
      _current.clear();
      _new.clear();
      _confirm.clear();
      if (mounted) showToast(context, 'Password updated');
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SettingsShell(
      current: 'password',
      child: AppCard(
        title: 'Update password',
        description: 'Use a long, random password to stay secure',
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          AppTextField(label: 'Current password', controller: _current, obscure: true, error: _error?.field('current_password')),
          const SizedBox(height: 12),
          AppTextField(label: 'New password', controller: _new, obscure: true, error: _error?.field('password')),
          const SizedBox(height: 12),
          AppTextField(label: 'Confirm password', controller: _confirm, obscure: true),
          const SizedBox(height: 16),
          Align(alignment: Alignment.centerLeft, child: AppButton(label: 'Save password', loading: _busy, onPressed: _save)),
        ]),
      ),
    );
  }
}
