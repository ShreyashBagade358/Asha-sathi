import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Placeholder outbreak map — a real map (e.g. flutter_map + GeoJSON) can be
/// wired here once a tile backend is configured. Displays a fake marker grid
/// to communicate the concept offline.
class DiseaseOutbreakMapScreen extends StatelessWidget {
  const DiseaseOutbreakMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: ASHATopAppBar(
        title: 'Outbreak Map',
        onBack: () => context.pop(),
        onHelp: () => ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Disease case density in your area.')),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Container(
                width: double.infinity,
                color: ASHAColors.surfaceContainerLowest,
                child: CustomPaint(
                  painter: _OutbreakGridPainter(),
                  child: const SizedBox.expand(),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(ASHASpacing.marginMobile),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Legend', style: ASHATypography.headlineMD),
                  const SizedBox(height: ASHASpacing.stackSM),
                  const Row(
                    children: [
                      _LegendDot(color: ASHAColors.error),
                      SizedBox(width: 8),
                      Text('High density'),
                      SizedBox(width: 24),
                      _LegendDot(color: ASHAColors.tertiary),
                      SizedBox(width: 8),
                      Text('Moderate'),
                    ],
                  ),
                  const SizedBox(height: ASHASpacing.stackMD),
                  ASHACard(
                    title: 'Map integration',
                    subtitle:
                        'Connect a tile server (e.g. openstreetmap) to render live case pins. Clusters will appear here offline.',
                    child: const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _LegendDot extends StatelessWidget {
  const _LegendDot({required this.color});

  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 12,
      height: 12,
      decoration: BoxDecoration(color: color, shape: BoxShape.circle),
    );
  }
}

class _OutbreakGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final grid = Paint()
      ..color = ASHAColors.outlineVariant.withValues(alpha: 0.4)
      ..strokeWidth = 1;
    const step = 40.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), grid);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), grid);
    }

    final cases = [
      (const Offset(90, 110), ASHAColors.error, 22.0),
      (const Offset(150, 60), ASHAColors.tertiary, 14.0),
      (const Offset(230, 180), ASHAColors.error, 18.0),
      (const Offset(300, 90), ASHAColors.tertiary, 12.0),
      (const Offset(60, 220), ASHAColors.tertiary, 10.0),
      (const Offset(260, 250), ASHAColors.error, 20.0),
    ];
    for (final (pos, color, r) in cases) {
      canvas.drawCircle(pos, r, Paint()..color = color.withValues(alpha: 0.25));
      canvas.drawCircle(pos, 6, Paint()..color = color);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
