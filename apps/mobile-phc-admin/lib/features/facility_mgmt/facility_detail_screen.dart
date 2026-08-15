import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'facility_model.dart';
import 'facility_repository.dart';

/// Detail view for a PHC / sub-centre / village: staff, coverage, contacts.
class FacilityDetailScreen extends ConsumerStatefulWidget {
  const FacilityDetailScreen({super.key, required this.facilityId});

  final String facilityId;

  @override
  ConsumerState<FacilityDetailScreen> createState() => _FacilityDetailScreenState();
}

class _FacilityDetailScreenState extends ConsumerState<FacilityDetailScreen> {
  FacilityModel? _facility;
  List<FacilityModel> _children = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final repo = ref.read(facilityRepositoryProvider);
    final facility = await repo.fetchById(widget.facilityId);
    final children = facility == null ? <FacilityModel>[] : await repo.childrenOf(facility.id);
    if (mounted) {
      setState(() {
        _facility = facility;
        _children = children;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final facility = _facility;

    return Scaffold(
      appBar: ASHATopAppBar(title: facility?.name ?? 'Facility', onBack: () => context.pop()),
      body: _loading || facility == null
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(ASHASpacing.gutter),
              children: [
                ASHACard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: BoxDecoration(
                              color: theme.colorScheme.primaryContainer,
                              borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
                            ),
                            child: Icon(facility.icon, color: theme.colorScheme.primary),
                          ),
                          const SizedBox(width: ASHASpacing.stackMD),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(facility.name, style: ASHATypography.titleLarge),
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    StatusChip(
                                      status: statusChipTypeFrom(facility.status),
                                      label: facility.status == 'active' ? 'Live' : 'Inactive',
                                      compact: true,
                                    ),
                                    const SizedBox(width: ASHASpacing.stackSM),
                                    Text(facility.typeLabel,
                                        style: ASHATypography.bodySmall),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: ASHASpacing.stackMD),
                      _InfoRow(icon: Icons.place_outlined, text: '${facility.block}, ${facility.district}'),
                      if (facility.address.isNotEmpty)
                        _InfoRow(icon: Icons.home_outlined, text: facility.address),
                      if (facility.contactPhone.isNotEmpty)
                        _InfoRow(icon: Icons.phone_outlined, text: facility.contactPhone),
                    ],
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                Row(
                  children: [
                    Expanded(
                      child: _StatCard(
                        icon: Icons.groups_outlined,
                        label: 'Population',
                        value: '${facility.population}',
                      ),
                    ),
                    const SizedBox(width: ASHASpacing.stackSM),
                    Expanded(
                      child: _StatCard(
                        icon: Icons.female_outlined,
                        label: 'ASHAs',
                        value: '${facility.ashaCount}',
                      ),
                    ),
                    const SizedBox(width: ASHASpacing.stackSM),
                    Expanded(
                      child: _StatCard(
                        icon: Icons.healing_outlined,
                        label: 'ANMs',
                        value: '${facility.anmCount}',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHASectionHeader(
                  title: facility.type == 'village' ? 'Nearby units' : 'Coverage units',
                  subtitle: '${_children.length} unit(s) below this level',
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                if (_children.isEmpty)
                  ASHACard(
                    child: Text('No sub-units recorded for this facility.',
                        style: ASHATypography.bodyMD),
                  )
                else
                  ..._children.map(
                    (child) => Padding(
                      padding: const EdgeInsets.only(bottom: ASHASpacing.stackSM),
                      child: ASHACard(
                        onTap: () => context.push('/facility/${child.id}'),
                        child: Row(
                          children: [
                            Icon(child.icon, color: theme.colorScheme.primary),
                            const SizedBox(width: ASHASpacing.stackMD),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(child.name, style: ASHATypography.titleMedium),
                                  Text(
                                    '${child.population} people · ${child.ashaCount} ASHAs',
                                    style: ASHATypography.bodySmall.copyWith(
                                      color: theme.colorScheme.onSurfaceVariant,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right),
                          ],
                        ),
                      ),
                    ),
                  ),
                const SizedBox(height: ASHASpacing.stackLG),
                Text('Staff & contacts',
                    style: ASHATypography.titleMedium,
                    textAlign: TextAlign.center),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHAButton(
                  label: 'Manage Staff',
                  icon: Icons.badge_outlined,
                  variant: ASHAButtonVariant.outline,
                  onPressed: () => context.push('/staff'),
                ),
              ],
            ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.icon, required this.label, required this.value});

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ASHACard(
      padding: const EdgeInsets.all(ASHASpacing.stackMD),
      child: Column(
        children: [
          Icon(icon, color: theme.colorScheme.primary),
          const SizedBox(height: ASHASpacing.stackSM),
          Text(value, style: ASHATypography.headlineMD),
          const SizedBox(height: 2),
          Text(
            label,
            style: ASHATypography.bodySmall.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 18, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(width: ASHASpacing.stackSM),
          Expanded(child: Text(text, style: ASHATypography.bodyMD)),
        ],
      ),
    );
  }
}
