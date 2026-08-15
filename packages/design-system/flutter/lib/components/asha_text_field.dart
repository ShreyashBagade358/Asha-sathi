import 'package:flutter/material.dart';

import '../theme/asha_spacing.dart';
import '../theme/asha_typography.dart';

class ASHATextField extends StatelessWidget {
  const ASHATextField({
    super.key,
    this.label,
    this.hint,
    this.controller,
    this.keyboardType,
    this.validator,
    this.errorText,
    this.obscureText = false,
    this.prefixIcon,
    this.onChanged,
    this.maxLines = 1,
  });

  final String? label;
  final String? hint;
  final TextEditingController? controller;
  final TextInputType? keyboardType;
  final String? Function(String?)? validator;
  final String? errorText;
  final bool obscureText;
  final Widget? prefixIcon;
  final ValueChanged<String>? onChanged;
  final int? maxLines;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      obscureText: obscureText,
      prefixIcon: prefixIcon,
      onChanged: onChanged,
      maxLines: maxLines,
      validator: errorText == null ? validator : null,
      autovalidateMode: errorText != null
          ? AutovalidateMode.always
          : AutovalidateMode.disabled,
      decoration: InputDecoration(
        labelText: label,
        hintText: hint,
        errorText: errorText,
        filled: true,
        fillColor: theme.colorScheme.surfaceContainerLowest,
        labelStyle: ASHATypography.bodyMD.copyWith(
          color: theme.colorScheme.onSurfaceVariant,
        ),
        hintStyle: ASHATypography.bodyMD.copyWith(
          color: theme.colorScheme.outline,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
          borderSide: BorderSide(color: theme.colorScheme.outline),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
          borderSide: BorderSide(color: theme.colorScheme.outline),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
          borderSide: BorderSide(color: theme.colorScheme.primary, width: 2),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
          borderSide: BorderSide(color: theme.colorScheme.error),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusMd),
          borderSide: BorderSide(color: theme.colorScheme.error, width: 2),
        ),
      ),
    );
  }
}
