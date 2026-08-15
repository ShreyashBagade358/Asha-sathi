import 'package:flutter/material.dart';
import 'package:freezed_annotation/freezed_annotation.dart';

part 'facility_model.freezed.dart';
part 'facility_model.g.dart';

/// A healthcare facility in the PHC hierarchy:
/// `phc` -> `sub_center` -> `village`.
@freezed
abstract class FacilityModel with _$FacilityModel {
  const factory FacilityModel({
    required String id,
    required String name,
    @Default('phc') String type,
    @JsonKey(name: 'parent_id') String? parentId,
    @Default('') String district,
    @Default('') String block,
    @Default(0) int population,
    @Default(0) int ashaCount,
    @Default(0) int anmCount,
    @Default('') String contactPhone,
    @Default('') String address,
    @Default('active') String status,
    @Default(false) bool isLive,
  }) = _FacilityModel;

  factory FacilityModel.fromJson(Map<String, dynamic> json) =>
      _$FacilityModelFromJson(json);

  /// Human-readable label for the facility type.
  String get typeLabel {
    switch (type) {
      case 'phc':
        return 'PHC';
      case 'sub_center':
        return 'Sub-centre';
      case 'village':
        return 'Village';
      default:
        return capitalize(type);
    }
  }

  IconData get icon {
    switch (type) {
      case 'phc':
        return Icons.local_hospital;
      case 'sub_center':
        return Icons.medical_services_outlined;
      default:
        return Icons.village_outlined;
    }
  }
}

String capitalize(String input) {
  if (input.isEmpty) return input;
  return input[0].toUpperCase() + input.substring(1);
}
