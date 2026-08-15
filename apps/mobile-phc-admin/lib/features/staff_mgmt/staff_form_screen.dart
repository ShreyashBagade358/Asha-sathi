import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'staff_model.dart';
import 'staff_repository.dart';

/// Create / edit form: assign role, village and supervisor.
class StaffFormScreen extends ConsumerStatefulWidget {
  const StaffFormScreen({super.key, this.initial});

  final StaffModel? initial;

  @override
  ConsumerState<StaffFormScreen> createState() => _StaffFormScreenState();
}

class _StaffFormScreenState extends ConsumerState<StaffFormScreen> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _nameController;
  late final TextEditingController _phoneController;
  late final TextEditingController _householdsController;

  String _role = 'asha';
  String _village = '';
  String _supervisorId = '';
  bool _saving = false;

  List<StaffModel> _supervisors = const [];
  bool _loadingSupervisors = true;

  static const _villages = [
    'Sultanganj Village',
    'Nathnagar Village',
    'Kharik Bazaar',
    'Sabour Village',
    'Bhagalpur',
  ];

  @override
  void initState() {
    super.initState();
    final initial = widget.initial;
    _nameController = TextEditingController(text: initial?.name ?? '');
    _phoneController = TextEditingController(text: initial?.phone ?? '');
    _householdsController =
        TextEditingController(text: initial?.catchmentHouseholds.toString() ?? '');
    _role = initial?.role ?? 'asha';
    _village = initial?.village ?? _villages.first;
    _supervisorId = initial?.supervisorId ?? '';
    _loadSupervisors();
  }

  Future<void> _loadSupervisors() async {
    final all = await ref.read(staffRepositoryProvider).fetchStaff();
    final supervisors = all.where((s) => s.role == 'anm' || s.role == 'health_supervisor').toList();
    if (mounted) {
      setState(() {
        _supervisors = supervisors;
        _loadingSupervisors = false;
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _householdsController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    final staff = StaffModel(
      id: widget.initial?.id ?? 'new-${DateTime.now().millisecondsSinceEpoch}',
      name: _nameController.text.trim(),
      role: _role,
      phone: _phoneController.text.trim(),
      phcId: widget.initial?.phcId ?? 'phc-bhagalpur-01',
      village: _village,
      supervisorId: _supervisorId,
      supervisorName: _supervisorId.isEmpty
          ? ''
          : _supervisors
              .where((s) => s.id == _supervisorId)
              .map((s) => s.name)
              .firstOrNull ?? '',
      catchmentHouseholds: int.tryParse(_householdsController.text) ?? 0,
      performanceScore: widget.initial?.performanceScore ?? 0,
      status: widget.initial?.status ?? 'active',
    );
    try {
      await ref.read(staffRepositoryProvider).saveStaff(staff);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Staff saved successfully')),
      );
      context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Save failed: $e'), backgroundColor: Theme.of(context).colorScheme.error),
      );
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: widget.initial == null ? 'Add Staff' : 'Edit Staff',
        onBack: () => context.pop(),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(ASHASpacing.gutter),
          children: [
            ASHATextField(
              controller: _nameController,
              label: 'Full name',
              hint: 'e.g. Sunita Devi',
              validator: (v) => (v ?? '').trim().isEmpty ? 'Name is required' : null,
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              controller: _phoneController,
              label: 'Mobile number',
              keyboardType: TextInputType.phone,
              prefixIcon: const Icon(Icons.phone_android),
              validator: (v) {
                final digits = (v ?? '').replaceAll(RegExp(r'[^0-9]'), '');
                return digits.length == 10 ? null : 'Enter a valid 10-digit number';
              },
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            _FormLabel('Role'),
            DropdownButtonFormField<String>(
              initialValue: _role,
              decoration: _decoration(),
              items: [
                for (final role in staffRoles.where((r) => r != 'all'))
                  DropdownMenuItem(value: role, child: Text(role.replaceAll('_', ' ').toUpperCase())),
              ],
              onChanged: (value) => setState(() => _role = value ?? _role),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            _FormLabel('Village / catchment'),
            DropdownButtonFormField<String>(
              initialValue: _village,
              decoration: _decoration(),
              items: [
                for (final v in _villages)
                  DropdownMenuItem(value: v, child: Text(v)),
              ],
              onChanged: (value) => setState(() => _village = value ?? _village),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            ASHATextField(
              controller: _householdsController,
              label: 'Catchment households',
              keyboardType: TextInputType.number,
              prefixIcon: const Icon(Icons.home_work_outlined),
            ),
            const SizedBox(height: ASHASpacing.stackMD),
            _FormLabel('Supervisor (ANM / Health Supervisor)'),
            DropdownButtonFormField<String>(
              initialValue: _supervisorId.isEmpty ? null : _supervisorId,
              hint: Text(_loadingSupervisors ? 'Loading…' : 'Select supervisor'),
              decoration: _decoration(),
              items: [
                for (final s in _supervisors)
                  DropdownMenuItem(
                    value: s.id,
                    child: Text('${s.name} · ${s.roleLabel}'),
                  ),
              ],
              onChanged: (value) => setState(() => _supervisorId = value ?? ''),
            ),
            const SizedBox(height: ASHASpacing.stackXL),
            ASHAButton(
              label: 'Save Staff',
              icon: Icons.check,
              loading: _saving,
              onPressed: _save,
            ),
          ],
        ),
      ),
    );
  }

  InputDecoration _decoration() {
    final theme = Theme.of(context);
    return InputDecoration(
      filled: true,
      fillColor: theme.colorScheme.surfaceContainerLowest,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
        borderSide: BorderSide(color: theme.colorScheme.outline),
      ),
    );
  }
}

class _FormLabel extends StatelessWidget {
  const _FormLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(text, style: ASHATypography.labelLG),
    );
  }
}
