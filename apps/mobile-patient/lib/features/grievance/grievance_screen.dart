import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'grievance_repository.dart';

/// Raise a new grievance.
class GrievanceScreen extends ConsumerStatefulWidget {
  const GrievanceScreen({super.key});

  @override
  ConsumerState<GrievanceScreen> createState() => _GrievanceScreenState();
}

class _GrievanceScreenState extends ConsumerState<GrievanceScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _category = 'service';
  bool _busy = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    final grievance = await ref.read(grievanceRepositoryProvider).submit(
          title: _titleController.text.trim(),
          category: _category,
          description: _descriptionController.text.trim(),
        );
    if (!mounted) return;
    setState(() => _busy = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Grievance submitted')),
    );
    context.push('/grievance/status/${grievance.id}');
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Raise a Grievance',
        actions: [
          IconButton(
            icon: const Icon(Icons.history),
            tooltip: 'My grievances',
            onPressed: () => context.push('/grievance/list'),
          ),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(ASHASpacing.gutter),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Your complaint is forwarded to the concerned block health authority. You can track its status with the reference number.',
                  style: ASHATypography.bodySmall.copyWith(
                    color: theme.colorScheme.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHATextField(
                  label: 'Subject',
                  hint: 'Short title of your complaint',
                  controller: _titleController,
                  prefixIcon: const Icon(Icons.title),
                  validator: (value) =>
                      (value ?? '').trim().isEmpty ? 'Enter a subject' : null,
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                const Text('Category', style: ASHATypography.titleMedium),
                const SizedBox(height: ASHASpacing.stackSM),
                Wrap(
                  spacing: ASHASpacing.stackSM,
                  runSpacing: ASHASpacing.stackSM,
                  children: [
                    for (final category in const [
                      'service',
                      'supply',
                      'entitlement',
                      'technology',
                      'behavior',
                      'other',
                    ])
                      FilterChip(
                        label: Text(capitalize(category)),
                        selected: _category == category,
                        onSelected: (_) => setState(() => _category = category),
                      ),
                  ],
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHATextField(
                  label: 'Description',
                  hint: 'Describe the issue in detail',
                  controller: _descriptionController,
                  maxLines: 4,
                  validator: (value) => (value ?? '').trim().length < 10
                      ? 'Describe the issue in at least 10 characters'
                      : null,
                ),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHAButton(
                  label: 'Submit Grievance',
                  icon: Icons.send_outlined,
                  loading: _busy,
                  onPressed: _submit,
                ),
                const SizedBox(height: ASHASpacing.stackSM),
                ASHAButton(
                  label: 'View my grievances',
                  icon: Icons.history,
                  variant: ASHAButtonVariant.outline,
                  onPressed: () => context.push('/grievance/list'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
