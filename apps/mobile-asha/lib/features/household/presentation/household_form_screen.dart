import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../data/household_model.dart';

class HouseholdFormScreen extends ConsumerStatefulWidget {
  const HouseholdFormScreen({super.key});

  @override
  ConsumerState<HouseholdFormScreen> createState() => _HouseholdFormScreenState();
}

class _HouseholdFormScreenState extends ConsumerState<HouseholdFormScreen> {
  final _villageController = TextEditingController();
  final _addressController = TextEditingController();
  final _landmarkController = TextEditingController();

  bool _consent = false;
  final _selectedAmenities = <String>{};
  bool _saving = false;

  static const _amenityOptions = [
    'Electricity',
    'Drinking water',
    'Toilet',
    'Gas/LPG',
    'Motorcycle',
    'Smartphone',
    'Ration card',
    'Pucca house',
  ];

  Future<void> _save() async {
    if (_villageController.text.trim().isEmpty) {
      _showSnack('Village is required');
      return;
    }
    setState(() => _saving = true);
    final now = DateTime.now().toIso8601String();
    final model = HouseholdModel(
      hhid: 'HH-${DateTime.now().millisecondsSinceEpoch}',
      villageId: _villageController.text.trim(),
      address: _addressController.text.trim().isEmpty
          ? null
          : _addressController.text.trim(),
      landmark: _landmarkController.text.trim().isEmpty
          ? null
          : _landmarkController.text.trim(),
      amenities: _selectedAmenities.toList(),
      consentGiven: _consent,
      createdAt: now,
      updatedAt: now,
    );
    await ref.read(householdRepositoryProvider).save(model);
    if (!mounted) return;
    setState(() => _saving = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Household saved locally')),
    );
    context.pushReplacementNamed(
      AppRoutes.householdDetail,
      pathParameters: {'id': model.hhid},
    );
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(msg)));
  }

  @override
  void dispose() {
    _villageController.dispose();
    _addressController.dispose();
    _landmarkController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Add Household',
        onBack: () => context.pop(),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.marginMobile),
          children: [
            ASHATextField(
              label: 'Village *',
              hint: 'e.g. Khadki',
              controller: _villageController,
              prefixIcon: Icon(Icons.location_city_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Address',
              hint: 'House no., street, area',
              controller: _addressController,
              prefixIcon: Icon(Icons.home_outlined),
              maxLines: 2,
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              label: 'Landmark',
              hint: 'Near temple / water tank',
              controller: _landmarkController,
              prefixIcon: Icon(Icons.flag_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            Text('Amenities available', style: ASHATypography.labelLG),
            const SizedBox(height: ASHASpacing.stackSM),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _amenityOptions.map((a) {
                final selected = _selectedAmenities.contains(a);
                return FilterChip(
                  selected: selected,
                  onSelected: (v) => setState(() {
                    if (v) {
                      _selectedAmenities.add(a);
                    } else {
                      _selectedAmenities.remove(a);
                    }
                  }),
                  label: Text(a),
                  selectedColor: ASHAColors.primaryContainer,
                  checkmarkColor: ASHAColors.primary,
                  side: BorderSide(
                    color: selected
                        ? ASHAColors.primary
                        : ASHAColors.outlineVariant,
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHACard(
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'I have obtained consent for survey & data collection',
                      style: ASHATypography.bodyMD,
                    ),
                  ),
                  Switch(
                    value: _consent,
                    onChanged: (v) => setState(() => _consent = v),
                    activeColor: ASHAColors.primary,
                  ),
                ],
              ),
            ),
            const SizedBox(height: ASHASpacing.stackLG),
            ASHAButton(
              label: _saving ? 'Saving…' : 'Save Household',
              onPressed: _saving ? null : _save,
              loading: _saving,
              fullWidth: true,
              height: ASHASpacing.touchTargetMin,
            ),
          ],
        ),
      ),
    );
  }
}
