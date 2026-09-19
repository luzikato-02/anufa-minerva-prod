import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/api/api_exception.dart';
import '../../core/auth/auth_controller.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_text_field.dart';
import 'auth_layout.dart';

/// 2FA step after password login: 6-digit authenticator code or a recovery code.
class TwoFactorScreen extends ConsumerStatefulWidget {
  const TwoFactorScreen({super.key, required this.challenge});

  final String challenge;

  @override
  ConsumerState<TwoFactorScreen> createState() => _TwoFactorScreenState();
}

class _TwoFactorScreenState extends ConsumerState<TwoFactorScreen> {
  final _input = TextEditingController();
  bool _recovery = false;
  bool _busy = false;
  ApiException? _error;

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final value = _input.text.trim();
    if (_busy || value.isEmpty) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(authProvider.notifier).completeTwoFactor(
            widget.challenge,
            code: _recovery ? null : value,
            recoveryCode: _recovery ? value : null,
          );
    } on ApiException catch (e) {
      if (mounted) setState(() => _error = e);
      // An expired challenge cannot be retried: send the user back to log in.
      if (e.fieldErrors.containsKey('challenge') && mounted) context.go('/login');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthLayout(
      title: _recovery ? 'Recovery code' : 'Authentication code',
      subtitle: _recovery ? 'Enter one of your emergency recovery codes' : 'Enter the 6-digit code from your authenticator app',
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        if (_error != null) ...[AppAlert(message: _error!.message), const SizedBox(height: 16)],
        AppTextField(
          key: ValueKey(_recovery),
          controller: _input,
          autofocus: true,
          keyboardType: _recovery ? TextInputType.text : TextInputType.number,
          inputFormatters: _recovery ? null : [FilteringTextInputFormatter.digitsOnly, LengthLimitingTextInputFormatter(6)],
          textAlign: _recovery ? TextAlign.start : TextAlign.center,
          hint: _recovery ? 'Recovery code' : '000000',
          onSubmitted: (_) => _submit(),
        ),
        const SizedBox(height: 16),
        AppButton(label: 'Continue', expand: true, loading: _busy, onPressed: _submit),
        const SizedBox(height: 8),
        AppButton(
          label: _recovery ? 'Use authentication code' : 'Use a recovery code',
          variant: AppButtonVariant.link,
          onPressed: () => setState(() {
            _recovery = !_recovery;
            _input.clear();
            _error = null;
          }),
        ),
        AppButton(label: 'Back to log in', variant: AppButtonVariant.ghost, onPressed: () => context.go('/login')),
      ]),
    );
  }
}
