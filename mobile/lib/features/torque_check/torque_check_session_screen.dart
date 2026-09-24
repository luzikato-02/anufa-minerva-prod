import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import '../../core/api/api_exception.dart';
import '../../core/ui/app_alert.dart';
import '../../core/ui/app_button.dart';
import '../../core/ui/app_card.dart';
import '../../core/ui/app_text_field.dart';
import '../shared/minerva_scaffold.dart';
import 'torque_check_controller.dart';

/// The front door for Torque Check: start a fresh sheet, or resume one already in progress on another
/// device by its session ID. Reached on a first/direct visit to the record screen (nothing loaded yet) or
/// explicitly via "Change session" there — once a sheet is active, normal navigation goes straight there.
class TorqueCheckSessionScreen extends ConsumerStatefulWidget {
  const TorqueCheckSessionScreen({super.key});

  @override
  ConsumerState<TorqueCheckSessionScreen> createState() => _TorqueCheckSessionScreenState();
}

class _TorqueCheckSessionScreenState extends ConsumerState<TorqueCheckSessionScreen> {
  final _sessionId = TextEditingController();
  bool _loading = false;
  String? _sessionError;

  @override
  void initState() {
    super.initState();
    // Loads whatever is already active on this device, purely so "Start new sheet" can warn before discarding it.
    Future.microtask(() => ref.read(torqueCheckProvider.notifier).open());
  }

  @override
  void dispose() {
    _sessionId.dispose();
    super.dispose();
  }

  Future<void> _startNew() async {
    final current = ref.read(torqueCheckProvider);
    if (current != null && current.filledCount > 0) {
      final ok = await confirmDialog(context, title: 'Start a new sheet?', message: 'The ${current.filledCount} readings on the current sheet are already saved. You will begin an empty sheet.', confirmLabel: 'Start new sheet');
      if (!ok || !mounted) return;
    }
    await ref.read(torqueCheckProvider.notifier).startNew();
    if (mounted) context.go('/torque-check');
  }

  Future<void> _loadSession() async {
    final id = _sessionId.text.trim();
    if (id.isEmpty) return setState(() => _sessionError = 'Enter a session ID.');
    setState(() {
      _loading = true;
      _sessionError = null;
    });
    try {
      await ref.read(torqueCheckProvider.notifier).loadSession(id);
      if (mounted) context.go('/torque-check');
    } on ApiException catch (e) {
      if (mounted) setState(() => _sessionError = e.message);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return MinervaScaffold(
      title: 'Torque Check',
      body: ListView(padding: const EdgeInsets.all(16), children: [
        AppCard(
          title: 'Start a new sheet',
          description: 'Begin a fresh torque check.',
          child: AppButton(label: 'Start new sheet', icon: LucideIcons.filePlus, onPressed: _startNew),
        ),
        const SizedBox(height: 16),
        AppCard(
          title: 'Resume a session',
          description: 'Have a session ID from another device? Enter it to keep recording into that sheet.',
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            if (_sessionError != null) ...[AppAlert(message: _sessionError!), const SizedBox(height: 12)],
            Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
              Expanded(child: AppTextField(label: 'Session ID', controller: _sessionId, hint: 'e.g. 483920', keyboardType: TextInputType.number, onSubmitted: (_) => _loadSession())),
              const SizedBox(width: 8),
              AppButton(label: 'Load', loading: _loading, onPressed: _loadSession),
            ]),
          ]),
        ),
      ]),
    );
  }
}
