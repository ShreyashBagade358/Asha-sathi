import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'scheme_model.dart';
import 'schemes_repository.dart';

/// Government schemes with eligibility highlights.
class SchemesScreen extends ConsumerStatefulWidget {
  const SchemesScreen({super.key});

  @override
  ConsumerState<SchemesScreen> createState() => _SchemesScreenState();
}

class _SchemesScreenState extends ConsumerState<SchemesScreen> {
  List<SchemeModel> _schemes = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final schemes = await ref.read(schemesRepositoryProvider).fetchSchemes();
    if (mounted) setState(() {
      _schemes = schemes;
      _loading = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final eligibleCount = _schemes.where((s) => s.eligible).length;

    return Scaffold(
      appBar: ASHATopAppBar(title: 'Government Schemes'),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(ASHASpacing.gutter),
                children: [
                  ASHACard(
                    child: Row(
                      children: [
                        Icon(Icons.volunteer_activism_outlined,
                            color: theme.colorScheme.primary),
                        const SizedBox(width: ASHASpacing.stackMD),
                        Expanded(
                          child: Text(
                            '$eligibleCount of ${_schemes.length} schemes available for you',
                            style: ASHATypography.bodyMD,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: ASHASpacing.stackMD),
                  for (final scheme in _schemes) ...[
                    _SchemeTile(
                      scheme: scheme,
                      onTap: () => context.push('/schemes/${scheme.id}'),
                    ),
                    const SizedBox(height: ASHASpacing.stackSM),
                  ],
                ],
              ),
            ),
    );
  }
}

class _SchemeTile extends StatelessWidget {
  const _SchemeTile({required this.scheme, required this.onTap});

  final SchemeModel scheme;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ASHACard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(scheme.name, style: ASHATypography.titleMedium)),
              StatusChip(
                status: scheme.eligible
                    ? StatusChipType.success
                    : StatusChipType.neutral,
                label: scheme.eligible ? 'Eligible' : 'Not eligible',
                compact: true,
              ),
            ],
          ),
          const SizedBox(height: ASHASpacing.stackSM),
          Text(
            scheme.description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: ASHATypography.bodySmall.copyWith(
              color: theme.colorScheme.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: ASHASpacing.stackSM),
          Text(
            scheme.department,
            style: ASHATypography.labelMD.copyWith(
              color: theme.colorScheme.primary,
            ),
          ),
        ],
      ),
    );
  }
}
