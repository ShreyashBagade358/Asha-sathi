import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'staff_model.dart';
import 'staff_repository.dart';

/// Profile, catchment and performance view for one staff member.
class StaffDetailScreen extends ConsumerStatefulWidget {
  const StaffDetailScreen({super.key, required this.staffId});

  final String staffId;

  @override
  ConsumerState<StaffDetailScreen> createState() => _StaffDetailScreenState();
}

class _StaffDetailScreenState extends ConsumerState<StaffDetailScreen> {
  StaffModel? _staff;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final staff = await ref.read(staffRepositoryProvider).fetchById(widget.staffId);
    if (mounted) setState(() {
      _staff = staff;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final staff = _staff;

    return Scaffold(
      appBar: ASHATopAppBar(title: staff?.name ?? 'Staff', onBack: () => context.pop()),
      body: _loading || staff == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(ASHASpacing.gutter),
              children: [
                ASHACard(
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 34,
                        backgroundColor: theme.colorScheme.primaryContainer,
                        child: Text(initials(staff.name), style: ASHATypography.headlineLG),
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      Text(staff.name, style: ASHATypography.titleLarge),
                      const SizedBox(height: 4),
                      StatusChip(
                        status: statusChipTypeFrom(staff.status),
                        label: staff.roleLabel,
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      if (staff.phone.isNotEmpty)
                        Text(staff.phone, style: ASHATypography.bodyLG),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(title: 'Assignment'),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: Column(
                    children: [
                      _InfoRow(icon: Icons.village_outlined, label: 'Village', value: staff.village.isEmpty ? 'PHC attached' : staff.village),
                      _InfoRow(icon: Icons.assignment_ind_outlined, label: 'Supervisor', value: staff.supervisorName.isEmpty ? 'Not assigned' : staff.supervisorName),
                      _InfoRow(icon: Icons.home_work_outlined, label: 'Catchment', value: '${staff.catchmentHouseholds} households'),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(title: 'Performance'),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHACard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Performance score', style: ASHATypography.titleMedium),
                          Text(
                            '${staff.performanceScore.toStringAsFixed(0)} / 100',
                            style: ASHATypography.titleMedium.copyWith(
                              color: theme.colorScheme.primary,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: ASHASpacing.stackSM),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusFull),
                        child: LinearProgressIndicator(
                          value: staff.performanceScore.clamp(0, 100) / 100,
                          minHeight: 10,
                        ),
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      StatusChip(
                        status: staff.performanceScore >= 80
                            ? StatusChipType.success
                            : staff.performanceScore >= 60
                                ? StatusChipType.warning
                                : StatusChipType.danger,
                        label: staff.performanceScore >= 80
                            ? 'Meets targets'
                            : staff.performanceScore >= 60
                                ? 'Needs support'
                                : 'At risk',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHAButton(
                  label: 'Edit Profile',
                  icon: Icons.edit_outlined,
                  variant: ASHAButtonVariant.outline,
                  onPressed: () => context.push('/staff/new', extra: staff),
                ),
              ],
            ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, size: 20, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: ASHATypography.bodySmall.copyWith(
                    color: theme.colorScheme.onSurfaceVariant)),
                Text(value, style: ASHATypography.bodyMD),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
