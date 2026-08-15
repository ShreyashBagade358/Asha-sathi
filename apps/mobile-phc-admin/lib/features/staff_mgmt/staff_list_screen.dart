import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'staff_model.dart';
import 'staff_repository.dart';

/// Staff directory with role filter and search.
class StaffListScreen extends ConsumerStatefulWidget {
  const StaffListScreen({super.key});

  @override
  ConsumerState<StaffListScreen> createState() => _StaffListScreenState();
}

class _StaffListScreenState extends ConsumerState<StaffListScreen> {
  List<StaffModel> _staff = [];
  bool _loading = true;
  String _roleFilter = 'all';
  String _query = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final staff = await ref.read(staffRepositoryProvider).fetchStaff();
    if (mounted) setState(() => _staff = staff);
    if (mounted) setState(() => _loading = false);
  }

  List<StaffModel> get _filtered {
    final q = _query.trim().toLowerCase();
    return _staff.where((s) {
      final matchesRole = _roleFilter == 'all' || s.role == _roleFilter;
      final matchesQuery = q.isEmpty ||
          s.name.toLowerCase().contains(q) ||
          s.village.toLowerCase().contains(q) ||
          s.phone.contains(q);
      return matchesRole && matchesQuery;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _filtered;
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Staff Management',
        actions: [
          IconButton(
            icon: const Icon(Icons.person_add_alt),
            tooltip: 'Add staff',
            onPressed: () => context.push('/staff/new'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/staff/new'),
        icon: const Icon(Icons.person_add_alt),
        label: const Text('Add Staff'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                ASHASpacing.gutter, ASHASpacing.stackMD, ASHASpacing.gutter, 0),
            child: ASHATextField(
              hint: 'Search by name, village or phone',
              prefixIcon: const Icon(Icons.search),
              onChanged: (value) => setState(() => _query = value),
            ),
          ),
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: ASHASpacing.gutter),
              children: [
                for (final role in staffRoles)
                  Padding(
                    padding: const EdgeInsets.only(right: ASHASpacing.stackSM),
                    child: FilterChip(
                      label: Text(role == 'all' ? 'All' : role.replaceAll('_', ' ')),
                      selected: _roleFilter == role,
                      onSelected: (_) => setState(() => _roleFilter = role),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: ASHASpacing.stackSM),
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : filtered.isEmpty
                    ? const ASHAEmptyState(
                        icon: Icons.person_off_outlined,
                        title: 'No staff found',
                        message: 'Try a different role or search term.',
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(ASHASpacing.gutter),
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final staff = filtered[index];
                          return _StaffTile(
                            staff: staff,
                            onTap: () => context.push('/staff/${staff.id}'),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}

class _StaffTile extends StatelessWidget {
  const _StaffTile({required this.staff, required this.onTap});

  final StaffModel staff;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ASHACard(
      onTap: onTap,
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: theme.colorScheme.primaryContainer,
            child: Text(initials(staff.name), style: ASHATypography.titleMedium),
          ),
          const SizedBox(width: ASHASpacing.stackMD),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(staff.name, style: ASHATypography.titleMedium),
                const SizedBox(height: 2),
                Text(
                  '${staff.roleLabel} · ${staff.village.isEmpty ? 'PHC' : staff.village}',
                  style: ASHATypography.bodySmall.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: ASHASpacing.stackSM),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              StatusChip(
                status: statusChipTypeFrom(staff.status),
                label: staff.status,
                compact: true,
              ),
              const SizedBox(height: 4),
              Text(
                '${staff.performanceScore.toStringAsFixed(0)}%',
                style: ASHATypography.labelMD.copyWith(
                  color: theme.colorScheme.primary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
