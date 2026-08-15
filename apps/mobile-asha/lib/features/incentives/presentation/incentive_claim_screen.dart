import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/incentive_models.dart';

/// Auto-generate monthly claims from activities, then submit.
class IncentiveClaimScreen extends ConsumerStatefulWidget {
  const IncentiveClaimScreen({super.key});

  @override
  ConsumerState<IncentiveClaimScreen> createState() => _IncentiveClaimScreenState();
}

class _IncentiveClaimScreenState extends ConsumerState<IncentiveClaimScreen> {
  String _month = '';
  List<IncentiveClaimModel>? _generated;
  bool _generating = false;
  bool _submitting = false;

  void _pickMonth() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year - 1, now.month),
      lastDate: now,
      initialDatePickerMode: DatePickerMode.year,
    );
    if (picked != null) {
      setState(() => _month = '${picked.year}-${picked.month.toString().padLeft(2, '0')}');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Claim Incentive',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            Text('Month', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            ASHACard(
              onTap: _pickMonth,
              title: _month.isEmpty ? 'Tap to select month' : _month,
              child: const Icon(Icons.calendar_month_outlined,
                  color: ASHAColors.primary),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHAButton(
              label: _generating ? 'Generating…' : 'Generate from activities',
              onPressed: _generating || _month.isEmpty
                  ? null
                  : () {
                      setState(() {
                        _generating = true;
                        _generated =
                            ref.read(incentiveRepositoryProvider).generateFromActivities(_month);
                      });
                      Future<void>.delayed(const Duration(milliseconds: 400), () {
                        if (!mounted) return;
                        setState(() => _generating = false);
                      });
                    },
              loading: _generating,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.auto_awesome_outlined,
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            if (_generated != null) ...[
              Text('Generated claims (${_generated!.length})',
                  style: ASHATypography.headlineMD),
              const SizedBox(height: ASHASpacing.stackSM),
              ..._generated!.map((c) => Padding(
                    padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                    child: ASHACard(
                      title: c.activityName,
                      subtitle: 'qty ${c.quantity}',
                      child: Text(
                        '₹${(c.amount ?? 0).toStringAsFixed(0)}',
                        style: ASHATypography.headlineMD.copyWith(
                          color: ASHAColors.primary,
                        ),
                      ),
                    ),
                  )),
              const SizedBox(height: ASHASpacing.stackMD),
              ASHAButton(
                label: _submitting ? 'Submitting…' : 'Submit Claims',
                onPressed: _submitting
                    ? null
                    : () async {
                        setState(() => _submitting = true);
                        final repo = ref.read(incentiveRepositoryProvider);
                        for (final c in _generated!) {
                          await repo.saveClaim(c.copyWith(status: 'submitted'));
                        }
                        if (!mounted) return;
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Claims submitted for approval')),
                        );
                        context.pushReplacementNamed(AppRoutes.incentives);
                      },
                loading: _submitting,
                fullWidth: true,
                height: ASHASpacing.touchTargetMin,
                icon: Icons.send_outlined,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
