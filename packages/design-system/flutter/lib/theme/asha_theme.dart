import 'package:flutter/material.dart';

import 'asha_colors.dart';
import 'asha_spacing.dart';
import 'asha_typography.dart';

class ASHATheme {
  ASHATheme._();

  static ThemeData get lightTheme => _buildTheme(
        colorScheme: ColorScheme.fromSeed(seedColor: ASHAColors.primary).copyWith(
          primary: ASHAColors.primary,
          onPrimary: ASHAColors.onPrimary,
          primaryContainer: ASHAColors.primaryContainer,
          onPrimaryContainer: ASHAColors.onPrimaryContainer,
          secondary: ASHAColors.secondary,
          onSecondary: ASHAColors.onSecondary,
          secondaryContainer: ASHAColors.secondaryContainer,
          onSecondaryContainer: ASHAColors.onSecondaryContainer,
          tertiary: ASHAColors.tertiary,
          onTertiary: ASHAColors.onTertiary,
          tertiaryContainer: ASHAColors.tertiaryContainer,
          onTertiaryContainer: ASHAColors.onTertiaryContainer,
          error: ASHAColors.error,
          onError: ASHAColors.onError,
          errorContainer: ASHAColors.errorContainer,
          onErrorContainer: ASHAColors.onErrorContainer,
          surface: ASHAColors.surface,
          onSurface: ASHAColors.onSurface,
          onSurfaceVariant: ASHAColors.onSurfaceVariant,
          outline: ASHAColors.outline,
          outlineVariant: ASHAColors.outlineVariant,
          background: ASHAColors.background,
          onBackground: ASHAColors.onBackground,
          inverseSurface: ASHAColors.inverseSurface,
          inverseOnSurface: ASHAColors.inverseOnSurface,
          inversePrimary: ASHAColors.inversePrimary,
          surfaceContainerLowest: ASHAColors.surfaceContainerLowest,
          surfaceContainerLow: ASHAColors.surfaceContainerLow,
          surfaceContainer: ASHAColors.surfaceContainer,
          surfaceContainerHigh: ASHAColors.surfaceContainerHigh,
          surfaceContainerHighest: ASHAColors.surfaceContainerHighest,
        ),
      );

  static ThemeData get darkTheme => _buildTheme(
        colorScheme: ColorScheme.fromSeed(
          seedColor: ASHAColors.primary,
          brightness: Brightness.dark,
        ).copyWith(
          primary: ASHAColors.inversePrimary,
          onPrimary: ASHAColors.primary,
          primaryContainer: ASHAColors.primary,
          onPrimaryContainer: ASHAColors.onPrimaryContainer,
          surface: ASHAColors.inverseSurface,
          onSurface: ASHAColors.inverseOnSurface,
          background: ASHAColors.inverseSurface,
          onBackground: ASHAColors.inverseOnSurface,
          inverseSurface: ASHAColors.surface,
          inverseOnSurface: ASHAColors.onSurface,
          inversePrimary: ASHAColors.inversePrimary,
        ),
      );

  static ThemeData _buildTheme({required ColorScheme colorScheme}) {
    final base = ThemeData(
      useMaterial3: true,
      colorScheme: colorScheme,
      fontFamily: ASHATypography.fontFamily,
    );

    final textTheme = base.textTheme
        .copyWith(
          displayLarge: ASHATypography.headlineLG,
          headlineMedium: ASHATypography.headlineMD,
          bodyLarge: ASHATypography.bodyLG,
          bodyMedium: ASHATypography.bodyMD,
          labelLarge: ASHATypography.labelLG,
          labelMedium: ASHATypography.labelMD,
        )
        .apply(
          bodyColor: colorScheme.onSurface,
          displayColor: colorScheme.onSurface,
        );

    final outlineInputBorder = OutlineInputBorder(
      borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
    );

    return base.copyWith(
      scaffoldBackgroundColor: colorScheme.surface,
      textTheme: textTheme,
      cardTheme: CardThemeData(
        elevation: 0,
        color: colorScheme.surfaceContainerLowest,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusLg),
          side: BorderSide(color: colorScheme.outline.withValues(alpha: 0.3)),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(Size(double.infinity, 56)),
          shape: const WidgetStatePropertyAll(StadiumBorder()),
          backgroundColor: WidgetStatePropertyAll(colorScheme.primary),
          foregroundColor: WidgetStatePropertyAll(colorScheme.onPrimary),
          textStyle: const WidgetStatePropertyAll(ASHATypography.labelLG),
          elevation: const WidgetStatePropertyAll(0),
          padding: const WidgetStatePropertyAll(
            EdgeInsets.symmetric(horizontal: ASHASpacing.stackLG),
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: ButtonStyle(
          minimumSize: const WidgetStatePropertyAll(Size(0, ASHASpacing.touchTargetMin)),
          shape: const WidgetStatePropertyAll(StadiumBorder()),
          side: WidgetStatePropertyAll(BorderSide(color: colorScheme.outline)),
          backgroundColor: const WidgetStatePropertyAll(Colors.transparent),
          foregroundColor: WidgetStatePropertyAll(colorScheme.primary),
          textStyle: const WidgetStatePropertyAll(ASHATypography.labelLG),
          elevation: const WidgetStatePropertyAll(0),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: colorScheme.surfaceContainerLowest,
        border: outlineInputBorder.copyWith(
          borderSide: BorderSide(color: colorScheme.outline),
        ),
        enabledBorder: outlineInputBorder.copyWith(
          borderSide: BorderSide(color: colorScheme.outline),
        ),
        focusedBorder: outlineInputBorder.copyWith(
          borderSide: BorderSide(color: colorScheme.primary, width: 2),
        ),
        errorBorder: outlineInputBorder.copyWith(
          borderSide: BorderSide(color: colorScheme.error),
        ),
        focusedErrorBorder: outlineInputBorder.copyWith(
          borderSide: BorderSide(color: colorScheme.error, width: 2),
        ),
        labelStyle: ASHATypography.bodyMD.copyWith(
          color: colorScheme.onSurfaceVariant,
        ),
      ),
      navigationBarTheme: NavigationBarThemeData(
        backgroundColor: colorScheme.surface,
        indicatorColor: colorScheme.primaryContainer,
        iconTheme: WidgetStateProperty.resolveWith(
          (states) => IconThemeData(
            color: states.contains(WidgetState.selected)
                ? colorScheme.primary
                : colorScheme.onSurfaceVariant,
          ),
        ),
        labelTextStyle: WidgetStateProperty.resolveWith(
          (states) => ASHATypography.labelMD.copyWith(
            color: states.contains(WidgetState.selected)
                ? colorScheme.primary
                : colorScheme.onSurfaceVariant,
          ),
        ),
        labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
      ),
    );
  }
}
