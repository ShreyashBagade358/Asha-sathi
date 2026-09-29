import 'dart:io';

import 'package:asha_design_system/asha_design_system.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/navigation/router.dart';
import '../../../core/providers/providers.dart';
import '../../../core/utils/formatters.dart';
import '../data/child_models.dart';

final _growthRecordsProvider = FutureProvider.family<List<GrowthRecordModel>, String>(
  (ref, childId) => ref.watch(childRepositoryProvider).growthRecords(childId),
);

final _pendingPhotosProvider = FutureProvider.family<Set<String>, String>(
  (ref, childId) => ref.watch(growthPhotoSyncProvider).pendingRecordIds(childId),
);

/// Growth chart screen: real weight/height measurements from the offline-first
/// repository, a new-measurement form with baby photo capture (uploaded
/// through the offline photo queue) and a progress timeline with thumbnails.
class GrowthChartScreen extends ConsumerStatefulWidget {
  const GrowthChartScreen({super.key, required this.childId});

  final String childId;

  @override
  ConsumerState<GrowthChartScreen> createState() => _GrowthChartScreenState();
}

class _GrowthChartScreenState extends ConsumerState<GrowthChartScreen> {
  final _weightController = TextEditingController();
  final _heightController = TextEditingController();
  final _muacController = TextEditingController();
  bool _showForm = false;
  bool _capturing = false;
  XFile? _pickedPhoto;

  @override
  void dispose() {
    _weightController.dispose();
    _heightController.dispose();
    _muacController.dispose();
    super.dispose();
  }

  void _refresh() {
    ref.invalidate(_growthRecordsProvider(widget.childId));
    ref.invalidate(_pendingPhotosProvider(widget.childId));
  }

  Future<void> _pickPhoto() async {
    setState(() => _capturing = true);
    try {
      final image = await ImagePicker().pickImage(
        source: ImageSource.camera,
        maxWidth: 1600,
        maxHeight: 1600,
        imageQuality: 85,
      );
      if (image != null) {
        setState(() => _pickedPhoto = image);
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not capture photo.')),
        );
      }
    } finally {
      if (mounted) setState(() => _capturing = false);
    }
  }

  Future<void> _addMeasurement() async {
    final child = await ref.read(childRepositoryProvider).getById(widget.childId);
    final now = DateTime.now();
    final dob = tryParseDate(child?.dob);
    final record = GrowthRecordModel(
      recordId: 'G-${now.microsecondsSinceEpoch}',
      childId: widget.childId,
      measuredOn: now.toIso8601String(),
      ageMonths: ageFromDob(dob, now: now).totalMonths,
      weightKg: double.tryParse(_weightController.text),
      heightCm: double.tryParse(_heightController.text),
      muacCm: double.tryParse(_muacController.text),
      createdAt: now.toIso8601String(),
      updatedAt: now.toIso8601String(),
    );
    await ref.read(childRepositoryProvider).saveGrowthRecord(record);

    if (_pickedPhoto != null) {
      await ref.read(growthPhotoSyncProvider).enqueue(
            childId: widget.childId,
            recordId: record.recordId,
            localPath: _pickedPhoto!.path,
          );
    }

    await ref.read(syncEngineProvider).pushLocalChanges().catchError((_) {});

    if (!mounted) return;
    setState(() {
      _showForm = false;
      _pickedPhoto = null;
      _weightController.clear();
      _heightController.clear();
      _muacController.clear();
    });
    _refresh();
  }

  @override
  Widget build(BuildContext context) {
    final recordsAsync = ref.watch(_growthRecordsProvider(widget.childId));
    final pendingAsync = ref.watch(_pendingPhotosProvider(widget.childId));

    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Growth Chart',
        onBack: () => context.pop(),
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Weight plotted against age. Add measurements and photos regularly.'),
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh',
            onPressed: _refresh,
          ),
        ],
      ),
      body: SafeArea(
        child: recordsAsync.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => buildErrorScreen(ErrorScreenType.network),
          data: (records) {
            final sorted = [...records]
              ..sort((a, b) => (a.measuredOn ?? '').compareTo(b.measuredOn ?? ''));
            final pendingIds = pendingAsync.valueOrNull ?? const <String>{};
            return ListView(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              children: [
                _buildLatestCard(sorted),
                const SizedBox(height: ASHASpacing.stackLG),
                _buildPhotoStrip(sorted),
                const SizedBox(height: ASHASpacing.stackLG),
                ASHAButton(
                  label: _showForm ? 'Hide form' : 'Record new measurement',
                  onPressed: () => setState(() => _showForm = !_showForm),
                  variant: ASHAButtonVariant.outline,
                  fullWidth: true,
                  height: 48,
                  icon: Icons.add_chart_outlined,
                ),
                if (_showForm) ...[
                  const SizedBox(height: ASHASpacing.stackMD),
                  _buildMeasurementForm(pendingIds),
                ],
                const SizedBox(height: ASHASpacing.stackLG),
                Text('Progress Timeline', style: ASHATypography.headlineMD),
                const SizedBox(height: ASHASpacing.stackSM),
                if (sorted.isEmpty)
                  ASHACard(
                    title: 'No measurements yet',
                    subtitle: 'Record the first weight to begin tracking growth.',
                    child: const SizedBox.shrink(),
                  )
                else
                  ...sorted.reversed.map((r) =>
                      _buildTimelineTile(r, pendingIds.contains(r.recordId))),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildLatestCard(List<GrowthRecordModel> sorted) {
    if (sorted.isEmpty) {
      return ASHACard(
        title: 'Weight for Age',
        subtitle: 'No measurements recorded yet',
        child: const SizedBox.shrink(),
      );
    }
    final latest = sorted.last;
    return ASHACard(
      title: 'Weight for Age',
      subtitle: 'Latest ${latest.weightKg ?? 0} kg at ${latest.ageMonths ?? 0} months',
      child: SizedBox(
        height: 220,
        child: CustomPaint(
          size: const Size(double.infinity, 220),
          painter: _GrowthChartPainter(
            records: sorted,
            values: (r) => r.weightKg ?? 0,
            color: ASHAColors.primary,
          ),
        ),
      ),
    );
  }

  /// Horizontal strip of baby photos captured at growth check-ups.
  Widget _buildPhotoStrip(List<GrowthRecordModel> sorted) {
    final photos = sorted.where((r) => r.photoUrl != null).toList();
    if (photos.isEmpty) {
      return ASHACard(
        title: 'Photo History',
        subtitle: 'Photos captured at growth check-ups will appear here.',
        child: const SizedBox.shrink(),
      );
    }
    return ASHACard(
      title: 'Photo History',
      child: SizedBox(
        height: 96,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: photos.length,
          separatorBuilder: (_, __) => const SizedBox(width: ASHASpacing.stackSM),
          itemBuilder: (context, index) {
            final photo = photos[index];
            return ClipRRect(
              borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
              child: CachedNetworkImage(
                imageUrl: photo.photoUrl!,
                width: 96,
                height: 96,
                fit: BoxFit.cover,
                placeholder: (_, __) => Container(
                  width: 96,
                  height: 96,
                  color: ASHAColors.primary.withValues(alpha: 0.12),
                  child: const Center(
                    child: SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    ),
                  ),
                ),
                errorWidget: (_, __, ___) => Container(
                  width: 96,
                  height: 96,
                  color: ASHAColors.surfaceContainer,
                  child: const Icon(Icons.broken_image_outlined),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildMeasurementForm(Set<String> pendingIds) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: ASHATextField(
                label: 'Weight (kg)',
                controller: _weightController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                prefixIcon: Icon(Icons.monitor_weight_outlined),
              ),
            ),
            const SizedBox(width: ASHASpacing.stackSM),
            Expanded(
              child: ASHATextField(
                label: 'Height (cm)',
                controller: _heightController,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                prefixIcon: Icon(Icons.height_outlined),
              ),
            ),
          ],
        ),
        const SizedBox(height: ASHASpacing.stackMD),
        ASHATextField(
          label: 'MUAC (cm)',
          controller: _muacController,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          prefixIcon: Icon(Icons.straighten_outlined),
        ),
        const SizedBox(height: ASHASpacing.stackMD),
        if (_pickedPhoto != null)
          ASHACard(
            title: 'Photo attached',
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
                  child: Image.file(
                    File(_pickedPhoto!.path),
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                  ),
                ),
                const SizedBox(width: ASHASpacing.stackMD),
                Expanded(
                  child: Text(
                    'Baby photo queued for upload when back online.',
                    style: ASHATypography.bodyMD,
                  ),
                ),
              ],
            ),
          )
        else
          ASHAButton(
            label: _capturing ? 'Opening camera…' : 'Take baby photo',
            onPressed: _capturing ? null : _pickPhoto,
            variant: ASHAButtonVariant.outline,
            fullWidth: true,
            height: 48,
            icon: Icons.camera_alt_outlined,
          ),
        if (pendingIds.isNotEmpty) ...[
          const SizedBox(height: ASHASpacing.stackSM),
          StatusChip(
            status: StatusChipType.warning,
            label: '${pendingIds.length} photo(s) pending upload',
          ),
        ],
        const SizedBox(height: ASHASpacing.stackMD),
        ASHAButton(
          label: 'Add measurement',
          onPressed: _addMeasurement,
          fullWidth: true,
          height: 48,
        ),
      ],
    );
  }

  Widget _buildTimelineTile(GrowthRecordModel record, bool photoPending) {
    final dateText = formatDate(tryParseDate(record.measuredOn));
    final children = <Widget>[
      Row(
        children: [
          Expanded(
            child: Text(
              '${record.ageMonths ?? 0} months',
              style: ASHATypography.headlineMD,
            ),
          ),
          if (photoPending)
            const StatusChip(status: StatusChipType.warning, label: 'Photo pending'),
        ],
      ),
      const SizedBox(height: ASHASpacing.stackSM),
      Text(
        '${record.weightKg ?? 0} kg · ${record.heightCm ?? 0} cm'
        '${record.muacCm != null ? ' · MUAC ${record.muacCm} cm' : ''} · $dateText',
        style: ASHATypography.bodyMD,
      ),
    ];

    if (record.photoUrl != null) {
      children.add(const SizedBox(height: ASHASpacing.stackMD));
      children.add(
        ClipRRect(
          borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
          child: CachedNetworkImage(
            imageUrl: record.photoUrl!,
            height: 160,
            width: double.infinity,
            fit: BoxFit.cover,
            placeholder: (_, __) => Container(
              height: 160,
              color: ASHAColors.surfaceContainer,
              child: const Center(child: CircularProgressIndicator(strokeWidth: 2)),
            ),
            errorWidget: (_, __, ___) => Container(
              height: 160,
              color: ASHAColors.surfaceContainer,
              child: const Icon(Icons.broken_image_outlined),
            ),
          ),
        ),
      );
    }

    return ASHACard(
      title: 'Check-up · $dateText',
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: children),
    );
  }
}

class _GrowthChartPainter extends CustomPainter {
  _GrowthChartPainter({
    required this.records,
    required this.values,
    required this.color,
  });

  final List<GrowthRecordModel> records;
  final double Function(GrowthRecordModel) values;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (records.length < 2) return;
    final paint = Paint()
      ..color = color
      ..strokeWidth = 3
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final points = records.map((r) {
      final x = ((r.ageMonths ?? 0) / 36).clamp(0.0, 1.0) * size.width;
      final y = size.height - (values(r) / 15).clamp(0.0, 1.0) * size.height;
      return Offset(x, y);
    }).toList();

    final path = Path()..moveTo(points.first.dx, points.first.dy);
    for (final p in points.skip(1)) {
      path.lineTo(p.dx, p.dy);
    }
    canvas.drawPath(path, paint);

    final dotPaint = Paint()..color = color;
    for (final p in points) {
      canvas.drawCircle(p, 4, dotPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _GrowthChartPainter oldDelegate) => true;
}