import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_text_field.dart';
import 'auth_layout.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  const ForgotPasswordScreen({super.key});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _email = TextEditingController();
  bool _busy = false;
  String? _sent;
  ApiException? _error;

  @override
  void dispose() {
    _email.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final Response res = await ref.read(dioProvider).post('/auth/forgot-password', data: {'email': _email.text.trim()});
      if (mounted) setState(() => _sent = (res.data as Map)['message'] as String);
    } catch (e) {
      if (mounted) setState(() => _error = ApiException.from(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthLayout(
      title: 'Forgot password',
      subtitle: 'Enter your email to receive a password reset link',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_sent != null) ...[AppAlert(message: _sent!, destructive: false), const SizedBox(height: 16)],
        if (_error != null) ...[AppAlert(message: _error!.message), const SizedBox(height: 16)],
        AppTextField(
          label: 'Email address',
          controller: _email,
          keyboardType: TextInputType.emailAddress,
          error: _error?.field('email'),
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: 16),
        AppButton(label: 'Email password reset link', expand: true, loading: _busy, onPressed: _submit),
        const SizedBox(height: 8),
        AppButton(label: 'Back to log in', variant: AppButtonVariant.link, onPressed: () => context.pop()),
      ]),
    );
  }
}
