/// Convenience re-export of the ASHA design system theme.
///
/// App code imports this file when it needs `ASHATheme` so the theme source
/// of truth remains the shared `asha_design_system` package.
library;

export 'package:asha_design_system/asha_design_system.dart'
    show ASHATheme, ASHAColors, ASHASpacing, ASHATypography;
