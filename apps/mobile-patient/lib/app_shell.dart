import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Root shell hosting the three primary tabs.
class AppShell extends StatelessWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: ASHABottomNavBar(
        currentIndex: navigationShell.currentIndex,
        onTap: _onDestinationSelected,
        items: const [
          BottomNavItem(icon: Icons.home_outlined, label: 'Home'),
          BottomNavItem(icon: Icons.folder_shared_outlined, label: 'Records'),
          BottomNavItem(icon: Icons.menu, label: 'More'),
        ],
      ),
    );
  }
}
