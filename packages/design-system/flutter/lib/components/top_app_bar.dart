import 'package:flutter/material.dart';
import 'package:material_symbols_icons/material_symbols_icons.dart';

import '../theme/asha_spacing.dart';
import '../theme/asha_typography.dart';

class ASHATopAppBar extends StatelessWidget implements PreferredSizeWidget {
  const ASHATopAppBar({
    super.key,
    required this.title,
    this.onBack,
    this.onHelp,
    this.leading,
    this.actions = const [],
  });

  final String title;
  final VoidCallback? onBack;
  final VoidCallback? onHelp;
  final IconData? leading;
  final List<Widget> actions;

  @override
  Size get preferredSize => const Size.fromHeight(ASHASpacing.touchTargetMin);

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final onSurface = theme.colorScheme.onSurface;

    return Material(
      color: theme.colorScheme.surface,
      child: Container(
        height: ASHASpacing.touchTargetMin,
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(color: theme.colorScheme.surfaceContainer),
          ),
        ),
        child: Row(
          children: [
            if (onBack != null)
              _AppBarIconButton(
                icon: leading ?? Symbols.arrow_back,
                tooltip: 'Back',
                onPressed: onBack,
                color: onSurface,
              )
            else if (leading != null)
              _AppBarIconButton(
                icon: leading,
                color: onSurface,
              ),
            Expanded(
              child: Text(
                title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: ASHATypography.headlineMD.copyWith(color: onSurface),
              ),
            ),
            if (onHelp != null)
              _AppBarIconButton(
                icon: Symbols.help_outline,
                tooltip: 'Help',
                onPressed: onHelp,
                color: onSurface,
              ),
            ...actions,
          ],
        ),
      ),
    );
  }
}

class _AppBarIconButton extends StatelessWidget {
  const _AppBarIconButton({
    super.key,
    required this.icon,
    required this.color,
    this.onPressed,
    this.tooltip,
  });

  final IconData icon;
  final Color color;
  final VoidCallback? onPressed;
  final String? tooltip;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    final button = Material(
      color: Colors.transparent,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onPressed,
        hoverColor: theme.colorScheme.onSurface.withValues(alpha: 0.08),
        child: SizedBox(
          width: ASHASpacing.touchTargetMin,
          height: ASHASpacing.touchTargetMin,
          child: Icon(icon, size: 22, color: color),
        ),
      ),
    );

    if (tooltip == null) return button;
    return Tooltip(message: tooltip!, child: button);
  }
}
