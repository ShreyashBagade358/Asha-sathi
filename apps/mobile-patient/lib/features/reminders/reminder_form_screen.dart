import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import 'reminder_model.dart';
import 'reminders_repository.dart';

/// Create a new medication / visit / vaccination reminder.
class ReminderFormScreen extends ConsumerStatefulWidget {
  const ReminderFormScreen({super.key});

  @override
  ConsumerState<ReminderFormScreen> createState() => _ReminderFormScreenState();
}

class _ReminderFormScreenState extends ConsumerState<ReminderFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _instructionsController = TextEditingController();

  String _type = 'medication';
  String _frequency = 'daily';
  DateTime _dueAt = DateTime.now().add(const Duration(hours: 1));
  bool _busy = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _instructionsController.dispose();
    super.dispose();
  }

  Future<void> _pickDateTime() async {
    final now = DateTime.now();
    final date = await showDatePicker(
      context: context,
      initialDate: _dueAt,
      firstDate: now,
      lastDate: now.add(const Duration(days: 365)),
    );
    if (date == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_dueAt),
    );
    if (time == null || !mounted) return;
    setState(() {
      _dueAt = DateTime(date.year, date.month, date.day, time.hour, time.minute);
    });
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _busy = true);
    final reminder = ReminderModel(
      id: 'rem-${DateTime.now().millisecondsSinceEpoch}',
      title: _titleController.text.trim(),
      type: _type,
      description: _descriptionController.text.trim(),
      instructions: _instructionsController.text.trim(),
      dueAt: _dueAt,
      status: 'pending',
      frequency: _frequency,
    );
    await ref.read(remindersRepositoryProvider).create(reminder);
    if (!mounted) return;
    setState(() => _busy = false);
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Reminder created')),
    );
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Scaffold(
      appBar: ASHATopAppBar(title: 'New Reminder', onBack: () => context.pop()),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(ASHASpacing.gutter),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ASHATextField(
                  label: 'Title',
                  hint: 'e.g. Iron & Folic Acid Tablet',
                  controller: _titleController,
                  prefixIcon: const Icon(Icons.alarm_outlined),
                  validator: (value) =>
                      (value ?? '').trim().isEmpty ? 'Enter a title' : null,
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHATextField(
                  label: 'Description',
                  hint: 'What should this reminder cover?',
                  controller: _descriptionController,
                  maxLines: 2,
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                const Text('Type', style: ASHATypography.titleMedium),
                const SizedBox(height: ASHASpacing.stackSM),
                Wrap(
                  spacing: ASHASpacing.stackSM,
                  runSpacing: ASHASpacing.stackSM,
                  children: [
                    for (final type in const [
                      'medication',
                      'visit',
                      'vaccination',
                      'screening',
                    ])
                      FilterChip(
                        label: Text(capitalize(type)),
                        selected: _type == type,
                        onSelected: (_) => setState(() => _type = type),
                      ),
                  ],
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                const Text('Frequency', style: ASHATypography.titleMedium),
                const SizedBox(height: ASHASpacing.stackSM),
                Wrap(
                  spacing: ASHASpacing.stackSM,
                  runSpacing: ASHASpacing.stackSM,
                  children: [
                    for (final frequency in const [
                      'daily',
                      'weekly',
                      'monthly',
                      'one_time',
                    ])
                      FilterChip(
                        label: Text(frequency.replaceAll('_', ' ')),
                        selected: _frequency == frequency,
                        onSelected: (_) => setState(() => _frequency = frequency),
                      ),
                  ],
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                InkWell(
                  onTap: _pickDateTime,
                  borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
                  child: TextFormField(
                    controller: TextEditingController(
                      text: DateFormat('dd MMM yyyy, hh:mm a').format(_dueAt),
                    ),
                    readOnly: true,
                    enabled: false,
                    decoration: InputDecoration(
                      labelText: 'Due date & time',
                      prefixIcon: const Icon(Icons.event_outlined),
                      filled: true,
                      fillColor: theme.colorScheme.surfaceContainerLowest,
                      border: OutlineInputBorder(
                        borderRadius:
                            BorderRadius.circular(ASHASpacing.borderRadiusMd),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: ASHASpacing.stackMD),
                ASHATextField(
                  label: 'Instructions (optional)',
                  hint: 'e.g. Take after breakfast',
                  controller: _instructionsController,
                  maxLines: 2,
                ),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHAButton(
                  label: 'Create Reminder',
                  icon: Icons.check,
                  loading: _busy,
                  onPressed: _save,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
