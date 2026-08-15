import 'package:flutter/material.dart';

import '../theme/asha_spacing.dart';
import '../theme/asha_typography.dart';

class ASHACard extends StatelessWidget {
  const ASHACard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(ASHASpacing.stackMD),
    this.onTap,
    this.title,
    this.subtitle,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;
  final String? title;
  final String? subtitle;

  static const List<BoxShadow> _level1Shadow = [
    BoxShadow(
      color: Color(0x0D000000),
      offset: Offset(0, 1),
      blurRadius: 2,
    ),
    BoxShadow(
      color: Color(0x1A000000),
      offset: Offset(0, 1),
      blurRadius: 3,
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final radius = BorderRadius.circular(ASHASpacing.borderRadiusLg);
    final hasHeader = title != null || subtitle != null;

    final content = Padding(
      padding: padding,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (hasHeader) ...[
            if (title != null)
              Text(
                title!,
                style: ASHATypography.headlineMD.copyWith(
                  color: theme.colorScheme.onSurface,
                ),
              ),
            if (title != null && subtitle != null)
              const SizedBox(height: ASHASpacing.stackSM),
            if (subtitle != null)
              Text(
                subtitle!,
                style: ASHATypography.bodyMD.copyWith(
                  color: theme.colorScheme.onSurfaceVariant,
                ),
              ),
            const SizedBox(height: ASHASpacing.stackMD),
          ],
          child,
        ],
      ),
    );

    return Container(
      decoration: BoxDecoration(
        borderRadius: radius,
        boxShadow: _level1Shadow,
      ),
      child: Material(
        color: theme.colorScheme.surfaceContainerLowest,
        shape: RoundedRectangleBorder(
          borderRadius: radius,
          side: BorderSide(color: theme.colorScheme.outlineVariant),
        ),
        clipBehavior: Clip.antiAlias,
        child: onTap != null
            ? InkWell(onTap: onTap, child: content)
            : content,
      ),
    );
  }
}
