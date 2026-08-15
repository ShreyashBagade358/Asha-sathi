import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/abha_record_model.dart';

/// ABHA data-sharing consent screen (explains what is shared and why).
class ABHAConsentScreen extends ConsumerStatefulWidget {
  const ABHAConsentScreen({super.key, this.record});

  final ABHARecordModel? record;

  @override
  ConsumerState<ABHAConsentScreen> createState() => _ABHAConsentScreenState();
}

class _ABHAConsentScreenState extends ConsumerState<ABHAConsentScreen> {
  bool _checked = false;
  bool _saving = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'ABHA Consent',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            ASHACard(
              title: 'Data-sharing consent',
              subtitle: 'The beneficiary agrees to share their health records with',
              child: const Icon(Icons.lock_outline, color: ASHAColors.primary),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            const _Bullet('Their treating doctors & hospitals'),
            const _Bullet('Government health programmes (RCH, NCD, IDSP)'),
            const _Bullet('ASHA Sathi for care coordination'),
            const SizedBox(height: ASHASpacing.stackMD),
            Text(
              'Records shared: ANC, immunisation, prescriptions, lab results and referrals. Consent can be withdrawn at any time.',
              style: ASHATypography.bodyMD.copyWith(
                color: ASHAColors.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            CheckboxListTile(
              value: _checked,
              onChanged: (v) => setState(() => _checked = v ?? false),
              title: const Text('Beneficiary has agreed to share data'),
              activeColor: ASHAColors.primary,
              contentPadding: EdgeInsets.zero,
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Grant Consent',
              onPressed: _checked && !_saving
                  ? () async {
                      setState(() => _saving = true);
                      final record = widget.record;
                      if (record != null) {
                        await ref
                            .read(abhaRepositoryProvider)
                            .grantConsent(record.abhaId);
                      }
                      if (!mounted) return;
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Consent granted')),
                      );
                      context.pop();
                    }
                  : null,
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
              icon: Icons.check_circle_outline,
            ),
          ],
        ),
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          const Icon(Icons.check_circle_outline,
              size: 20, color: ASHAColors.primary),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: ASHATypography.bodyMD)),
        ],
      ),
    );
  }
}
