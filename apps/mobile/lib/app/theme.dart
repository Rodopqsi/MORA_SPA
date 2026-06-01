import 'package:flutter/material.dart';

class MoraColors {
  static const Color ink = Color(0xFF2A1C24);
  static const Color cocoa = Color(0xFF9B3F5D);
  static const Color coral = Color(0xFFC65A7D);
  static const Color gold = Color(0xFFFDE6B8);
  static const Color mint = Color(0xFFC8F1E1);
  static const Color blush = Color(0xFFFFF4F7);
  static const Color cream = Color(0xFFFFFBFC);
  static const Color sand = Color(0xFFFDE6EF);
  static const Color plum = Color(0xFFE7C7F6);
  static const Color rose = Color(0xFFF9D9E6);
  static const Color success = Color(0xFF2B8A3E);
  static const Color warning = Color(0xFFD97706);
  static const Color muted = Color(0xFF6F5A63);
  static const Color border = Color(0xFFF0D6E0);
}

LinearGradient get moraHeroGradient => const LinearGradient(
      colors: [Color(0xFFFFFCFD), MoraColors.sand, MoraColors.rose],
      begin: Alignment.topLeft,
      end: Alignment.bottomRight,
    );

ThemeData buildMoraTheme() {
  const scheme = ColorScheme(
    brightness: Brightness.light,
    primary: MoraColors.cocoa,
    onPrimary: Colors.white,
    secondary: MoraColors.mint,
    onSecondary: Colors.white,
    error: Color(0xFFB3261E),
    onError: Colors.white,
    surface: MoraColors.cream,
    onSurface: MoraColors.ink,
  );

  final base = ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: MoraColors.blush,
  );

  return base.copyWith(
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      foregroundColor: MoraColors.ink,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        color: MoraColors.ink,
      ),
    ),
    textTheme: base.textTheme.copyWith(
      displaySmall: const TextStyle(
        fontSize: 32,
        fontWeight: FontWeight.w700,
        height: 1.05,
        color: MoraColors.ink,
      ),
      headlineMedium: const TextStyle(
        fontSize: 26,
        fontWeight: FontWeight.w700,
        height: 1.1,
        color: MoraColors.ink,
      ),
      titleLarge: const TextStyle(
        fontSize: 21,
        fontWeight: FontWeight.w700,
        color: MoraColors.ink,
      ),
      titleMedium: const TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w700,
        color: MoraColors.ink,
      ),
      bodyLarge: const TextStyle(
        fontSize: 15,
        height: 1.45,
        color: MoraColors.ink,
      ),
      bodyMedium: const TextStyle(
        fontSize: 14,
        height: 1.45,
        color: MoraColors.ink,
      ),
      bodySmall: const TextStyle(
        fontSize: 12,
        height: 1.4,
        color: MoraColors.muted,
      ),
      labelLarge: const TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        letterSpacing: 0.2,
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white.withValues(alpha: 0.92),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(26),
        side: const BorderSide(color: MoraColors.border),
      ),
      margin: EdgeInsets.zero,
    ),
    chipTheme: base.chipTheme.copyWith(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      side: const BorderSide(color: MoraColors.border),
      selectedColor: MoraColors.cocoa,
      secondarySelectedColor: MoraColors.cocoa,
      labelStyle: const TextStyle(fontWeight: FontWeight.w700),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: MoraColors.rose,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      shadowColor: Colors.transparent,
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          color: states.contains(WidgetState.selected) ? MoraColors.cocoa : MoraColors.muted,
          fontWeight: states.contains(WidgetState.selected) ? FontWeight.w700 : FontWeight.w600,
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      labelStyle: const TextStyle(color: MoraColors.muted, fontWeight: FontWeight.w600),
      hintStyle: const TextStyle(color: MoraColors.muted),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: MoraColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: MoraColors.cocoa, width: 1.6),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: Color(0xFFB3261E)),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: Color(0xFFB3261E), width: 1.6),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: MoraColors.coral,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: MoraColors.cocoa,
        side: const BorderSide(color: MoraColors.cocoa),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: MoraColors.cocoa,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: MoraColors.ink,
      contentTextStyle: TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
    ),
    dividerTheme: const DividerThemeData(color: MoraColors.border),
  );
}

BoxDecoration sectionDecoration({Color? color}) {
  return BoxDecoration(
    color: color ?? Colors.white.withValues(alpha: 0.94),
    borderRadius: BorderRadius.circular(26),
    border: Border.all(color: MoraColors.border),
    boxShadow: const [
      BoxShadow(
        color: Color(0x14C65A7D),
        blurRadius: 24,
        offset: Offset(0, 12),
      ),
    ],
  );
}