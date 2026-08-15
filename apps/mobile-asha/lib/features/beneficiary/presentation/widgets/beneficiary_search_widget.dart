import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';

/// Reusable search field for beneficiary lists. Reports query changes via
/// [onChanged].
class BeneficiarySearchWidget extends StatelessWidget {
  const BeneficiarySearchWidget({super.key, required this.onChanged});

  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return ASHATextField(
      label: 'Search',
      hint: 'Search by name, ID or phone',
      prefixIcon: const Icon(Icons.search),
      onChanged: (v) => onChanged(v ?? ''),
    );
  }
}
