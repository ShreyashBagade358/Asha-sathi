import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/l10n/app_strings.dart';

/// Persisted app-wide preference: current locale.
final localeProvider = StateProvider<Locale?>((ref) => null);

/// Persisted app-wide preference: theme mode.
final themeModeProvider = StateProvider<ThemeMode>((ref) => ThemeMode.light);

/// Root shell with a 5-tab navigation bar. The router renders feature pages
/// into [child] beneath the navigation bar.
class HomeShell extends ConsumerStatefulWidget {
  const HomeShell({super.key, required this.child});

  final Widget child;

  @override
  ConsumerState<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends ConsumerState<HomeShell> {
  int _index = 0;

  void _onTap(int index) {
    setState(() => _index = index);
    switch (index) {
      case 0:
        context.go('/home/dashboard');
      case 1:
        context.go('/home/beneficiaries');
      case 2:
        context.go('/home/work-plan');
      case 3:
        context.go('/home/ai');
      case 4:
        context.go('/home/more');
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = AppStrings.t;
    return Scaffold(
      body: widget.child,
      bottomNavigationBar: ASHABottomNavBar(
        currentIndex: _index,
        onTap: _onTap,
        items: [
          BottomNavItem(icon: Icons.home_outlined, label: lang('home_tab')),
          BottomNavItem(
              icon: Icons.groups_outlined, label: lang('beneficiaries')),
          BottomNavItem(icon: Icons.task_alt_outlined, label: lang('work_plan')),
          BottomNavItem(
              icon: Icons.auto_awesome_outlined, label: lang('ai_assistant')),
          BottomNavItem(icon: Icons.more_horiz, label: lang('more')),
        ],
      ),
    );
  }
}
