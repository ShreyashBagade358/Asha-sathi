import 'package:flutter/material.dart';

import '../theme/asha_spacing.dart';
import '../theme/asha_typography.dart';

enum ASHAButtonVariant { primary, secondary, outline, danger }

class ASHAButton extends StatelessWidget {
  const ASHAButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = ASHAButtonVariant.primary,
    this.icon,
    this.fullWidth = true,
    this.loading = false,
    this.disabled = false,
    this.height = 56,
  });

  final String label;
  final VoidCallback? onPressed;
  final ASHAButtonVariant variant;
  final IconData? icon;
  final bool fullWidth;
  final bool loading;
  final bool disabled;
  final double height;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final effectiveHeight =
        height < ASHASpacing.touchTargetMin ? ASHASpacing.touchTargetMin : height;
    final isDisabled = disabled || loading;

    final Color background;
    final Color foreground;
    final BorderSide side;
    switch (variant) {
      case ASHAButtonVariant.primary:
        background = theme.colorScheme.primary;
        foreground = theme.colorScheme.onPrimary;
        side = BorderSide.none;
      case ASHAButtonVariant.secondary:
        background = theme.colorScheme.secondary;
        foreground = theme.colorScheme.onSecondary;
        side = BorderSide.none;
      case ASHAButtonVariant.danger:
        background = theme.colorScheme.error;
        foreground = theme.colorScheme.onError;
        side = BorderSide.none;
      case ASHAButtonVariant.outline:
        background = Colors.transparent;
        foreground = theme.colorScheme.primary;
        side = BorderSide(color: theme.colorScheme.outline);
    }

    final Color buttonBackground;
    final Color buttonForeground;
    if (isDisabled) {
      buttonBackground = theme.colorScheme.onSurface.withValues(alpha: 0.12);
      buttonForeground = theme.colorScheme.onSurface.withValues(alpha: 0.38);
    } else {
      buttonBackground = background;
      buttonForeground = foreground;
    }

    final style = ElevatedButton.styleFrom(
      backgroundColor: buttonBackground,
      foregroundColor: buttonForeground,
      minimumSize: Size(fullWidth ? double.infinity : 0, effectiveHeight),
      shape: StadiumBorder(side: isDisabled ? BorderSide.none : side),
      textStyle: ASHATypography.labelLG,
      padding: const EdgeInsets.symmetric(horizontal: ASHASpacing.stackLG),
      elevation: 0,
    );

    final Widget labelWidget;
    if (loading) {
      labelWidget = Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              valueColor: AlwaysStoppedAnimation<Color>(buttonForeground),
            ),
          ),
          const SizedBox(width: ASHASpacing.stackSM),
          Text(
            label,
            style: ASHATypography.labelLG.copyWith(color: buttonForeground),
          ),
        ],
      );
    } else {
      labelWidget = Row(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 20, color: buttonForeground),
            const SizedBox(width: ASHASpacing.stackSM),
          ],
          Text(
            label,
            style: ASHATypography.labelLG.copyWith(color: buttonForeground),
          ),
        ],
      );
    }

    return ElevatedButton(
      onPressed: isDisabled ? null : onPressed,
      style: style,
      child: labelWidget,
    );
  }
}
