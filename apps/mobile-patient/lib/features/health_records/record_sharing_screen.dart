import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'health_record_model.dart';
import 'health_records_repository.dart';

/// Generate a shareable link with an optional expiry for one record.
class RecordSharingScreen extends ConsumerStatefulWidget {
  const RecordSharingScreen({super.key, required this.recordId});

  final String recordId;

  @override
  ConsumerState<RecordSharingScreen> createState() => _RecordSharingScreenState();
}

class _RecordSharingScreenState extends ConsumerState<RecordSharingScreen> {
  HealthRecordModel? _record;
  bool _loading = true;
  bool _generating = false;
  String? _link;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final record =
        await ref.read(healthRecordsRepositoryProvider).fetchById(widget.recordId);
    if (mounted) setState(() {
      _record = record;
      _loading = false;
    });
  }

  Future<void> _generateLink() async {
    setState(() => _generating = true);
    final link =
        await ref.read(healthRecordsRepositoryProvider).requestShareLink(widget.recordId);
    if (mounted) setState(() {
      _link = link;
      _generating = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final record = _record;

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Share Record',
        onBack: () => context.pop(),
      ),
      body: _loading || record == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(ASHASpacing.gutter),
              children: [
                ASHACard(
                  title: record.title,
                  subtitle: '${record.typeLabel} · ${formatDate(record.recordedAt ?? DateTime.now())}',
                  child: const Text(
                    'Sharing a record grants a time-limited, read-only view to the recipient. You control the expiry and can revoke access anytime.',
                    style: ASHATypography.bodyMD,
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(title: 'Share with'),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: Column(
                    children: [
                      _ChannelTile(
                        icon: Icons.phone_android,
                        label: 'SMS',
                        subtitle: 'Send the secure link by text message',
                        onTap: () => _confirmGenerated('SMS'),
                      ),
                      _ChannelTile(
                        icon: Icons.chat_outlined,
                        label: 'WhatsApp',
                        subtitle: 'Share the link on WhatsApp',
                        onTap: () => _confirmGenerated('WhatsApp'),
                      ),
                      _ChannelTile(
                        icon: Icons.medical_information_outlined,
                        label: 'Doctor / PHC',
                        subtitle: 'Grant access to a health provider',
                        onTap: () => _confirmGenerated('PHC'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHAButton(
                  label: _link == null ? 'Generate share link' : 'Regenerate link',
                  icon: Icons.link,
                  loading: _generating,
                  onPressed: _generateLink,
                ),
                if (_link != null) ...[
                  const SizedBox(height: ASHASpacing.stackMD),
                  ASHACard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Share link', style: ASHATypography.titleMedium),
                        const SizedBox(height: ASHASpacing.stackSM),
                        SelectableText(_link!, style: ASHATypography.bodyMD),
                        const SizedBox(height: ASHASpacing.stackSM),
                        StatusChip(
                          status: StatusChipType.success,
                          label: 'Valid for 24 hours',
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
    );
  }

  void _confirmGenerated(String channel) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$channel share is ready after generating a link')),
    );
  }
}

class _ChannelTile extends StatelessWidget {
  const _ChannelTile({
    required this.icon,
    required this.label,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          children: [
            Icon(icon, color: theme.colorScheme.primary),
            const SizedBox(width: ASHASpacing.stackMD),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: ASHATypography.titleMedium),
                  Text(subtitle, style: ASHATypography.bodySmall.copyWith(
                      color: theme.colorScheme.onSurfaceVariant)),
                ],
              ),
            ),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}
