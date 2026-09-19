import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_text_field.dart';
import 'auth_layout.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _login = TextEditingController();
  final _password = TextEditingController();
  bool _busy = false;
  bool _showPassword = false;
  ApiException? _error;

  @override
  void dispose() {
    _login.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final outcome = await ref.read(authProvider.notifier).login(_login.text.trim(), _password.text);
      if (!mounted) return;
      if (outcome.needsTwoFactor) context.go('/two-factor', extra: outcome.challenge);
      // signed in: router redirect takes over
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthLayout(
      title: 'Log in to your account',
      subtitle: 'Enter your email or username and password',
      child: AutofillGroup(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          if (_error != null && _error!.fieldErrors.isEmpty) ...[AppAlert(message: _error!.message), const SizedBox(height: 16)],
          AppTextField(
            label: 'Email or username',
            controller: _login,
            autofocus: true,
            keyboardType: TextInputType.emailAddress,
            textInputAction: TextInputAction.next,
            autofillHints: const [AutofillHints.username],
            error: _error?.field('login'),
          ),
          const SizedBox(height: 16),
          AppTextField(
            label: 'Password',
            controller: _password,
            obscure: !_showPassword,
            textInputAction: TextInputAction.done,
            autofillHints: const [AutofillHints.password],
            onSubmitted: (_) => _submit(),
            error: _error?.field('password'),
            suffix: IconButton(
              icon: Icon(_showPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
              onPressed: () => setState(() => _showPassword = !_showPassword),
            ),
          ),
          Align(
            alignment: Alignment.centerRight,
            child: AppButton(label: 'Forgot password?', variant: AppButtonVariant.link, size: AppButtonSize.sm, onPressed: () => context.push('/forgot-password')),
          ),
          const SizedBox(height: 8),
          AppButton(label: 'Log in', expand: true, loading: _busy, onPressed: _submit),
        ]),
      ),
    );
  }
}
