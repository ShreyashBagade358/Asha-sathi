import 'package:asha_design_system/asha_design_system.dart';
import 'package:flutter/material.dart';

import 'patient_profile_model.dart';

/// ABHA-style card visual for the beneficiary.
class ABHACardWidget extends StatelessWidget {
  const ABHACardWidget({super.key, required this.profile});

  final PatientProfileModel profile;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [ASHAColors.abhaTealDark, ASHAColors.abhaTeal],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(ASHASpacing.borderRadiusXl),
      ),
      padding: const EdgeInsets.all(ASHASpacing.stackLG),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.health_and_safety_outlined,
                  color: Colors.white, size: 22),
              const SizedBox(width: ASHASpacing.stackSM),
              const Text(
                'Ayushman Bharat Health Account',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w600,
                  fontSize: 13,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(
                    horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.22),
                  borderRadius:
                      BorderRadius.circular(ASHASpacing.borderRadiusFull),
                ),
                child: Text(
                  profile.abhaStatus.toUpperCase(),
                  style: const TextStyle(
                      color: Colors.white, fontSize: 10, letterSpacing: 0.5),
                ),
              ),
            ],
          ),
          const SizedBox(height: ASHASpacing.stackLG),
          Row(
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: Colors.white.withValues(alpha: 0.25),
                child: Text(
                  profile.initials,
                  style: const TextStyle(color: Colors.white),
                ),
              ),
              const SizedBox(width: ASHASpacing.stackMD),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    profile.name,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  Text(
                    profile.dob.isEmpty
                        ? '${profile.village}, ${profile.district}'
                        : 'DOB ${profile.dob}',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: ASHASpacing.stackLG),
          Row(
            children: [
              const Icon(Icons.verified_outlined, color: Colors.white70, size: 16),
              const SizedBox(width: ASHASpacing.stackSM),
              Text(
                profile.abhaNumber.isEmpty
                    ? 'ABHA not linked'
                    : profile.abhaNumber,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  letterSpacing: 1.2,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Icon(
                Icons.contactless,
                color: Colors.white.withValues(alpha: 0.85),
                size: 28,
              ),
            ],
          ),
          const SizedBox(height: ASHASpacing.stackMD),
          Container(
            width: double.infinity,
            height: 1,
            color: Colors.white.withValues(alpha: 0.25),
          ),
          const SizedBox(height: ASHASpacing.stackSM),
          Text(
            'Your health data is secure. Shared only with your consent.',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 11),
          ),
        ],
      ),
    );
  }
}
