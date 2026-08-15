import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'facility_model.dart';
import 'facility_repository.dart';

/// Drill-down browser over the PHC -> sub-centre -> village hierarchy.
class FacilityListScreen extends ConsumerStatefulWidget {
  const FacilityListScreen({super.key});

  @override
  ConsumerState<FacilityListScreen> createState() => _FacilityListScreenState();
}

class _FacilityListScreenState extends ConsumerState<FacilityListScreen> {
  List<FacilityModel> _all = [];
  List<FacilityModel> _current = [];
  final List<String> _crumb = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final all = await ref.read(facilityRepositoryProvider).fetchFacilities();
      _all = all;
      _showLevel(all.where((f) => f.type == 'phc').toList());
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _showLevel(List<FacilityModel> level) {
    setState(() => _current = level);
  }

  void _drill(FacilityModel facility) {
    final children = _all.where((f) => f.parentId == facility.id).toList();
    if (children.isEmpty) {
      context.push('/facility/${facility.id}');
      return;
    }
    setState(() {
      _crumb.add(facility.name);
      _current = children;
    });
  }

  void _goUp() {
    if (_crumb.isEmpty) {
      _showLevel(_all.where((f) => f.type == 'phc').toList());
      return;
    }
    setState(() => _crumb.removeLast());
    if (_crumb.isEmpty) {
      _showLevel(_all.where((f) => f.type == 'phc').toList());
    } else {
      final parentName = _crumb.last;
      final parent = _all.where((f) => f.name == parentName).firstOrNull;
      if (parent != null) {
        _showLevel(_all.where((f) => f.parentId == parent.id).toList());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: _crumb.isEmpty ? 'Facilities' : _crumb.last,
        onBack: _crumb.isEmpty ? null : _goUp,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _all.isEmpty
              ? ASHAErrorScreen(
                  type: ErrorScreenType.network,
                  onPrimary: _load,
                  onSecondary: () => context.pop(),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(ASHASpacing.gutter),
                    itemCount: _current.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final facility = _current[index];
                      final hasChildren = _all.any((f) => f.parentId == facility.id);
                      return _FacilityTile(
                        facility: facility,
                        hasChildren: hasChildren,
                        onTap: () => _drill(facility),
                        onViewDetails: () => context.push('/facility/${facility.id}'),
                      );
                    },
                  ),
                ),
    );
  }
}

class _FacilityTile extends StatelessWidget {
  const _FacilityTile({
    required this.facility,
    required this.hasChildren,
    required this.onTap,
    required this.onViewDetails,
  });

  final FacilityModel facility;
  final bool hasChildren;
  final VoidCallback onTap;
  final VoidCallback onViewDetails;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ASHACard(
      onTap: onTap,
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
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
                Text(facility.name, style: ASHATypography.titleMedium),
                const SizedBox(height: 4),
                Row(
                  children: [
                    StatusChip(
                      status: statusChipTypeFrom(facility.status),
                      label: facility.typeLabel,
                      compact: true,
                    ),
                    const SizedBox(width: ASHASpacing.stackSM),
                    Text(
                      '${facility.ashaCount} ASHAs',
                      style: ASHATypography.bodySmall.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (hasChildren)
            const Icon(Icons.chevron_right)
          else
            IconButton(
              icon: const Icon(Icons.info_outline),
              tooltip: 'View details',
              onPressed: onViewDetails,
            ),
        ],
      ),
    );
  }
}
