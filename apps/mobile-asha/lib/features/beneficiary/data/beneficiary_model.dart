import 'package:freezed_annotation/freezed_annotation.dart';

part 'beneficiary_model.freezed.dart';
part 'beneficiary_model.g.dart';

/// A registered beneficiary (woman/individual) under the ASHA worker's care.
@freezed
abstract class BeneficiaryModel with _$BeneficiaryModel {
  const factory BeneficiaryModel({
    @Default('') String beneficiaryId,
    String? householdId,
    String? abhaId,
    @Default('') String fullName,
    @Default('female') String gender,
    String? dob,
    String? phone,
    String? maritalStatus,
    String? bloodGroup,
    @Default(false) bool isPregnant,
    String? villageId,
    String? photoPath,
    String? createdAt,
    String? updatedAt,
  }) = _BeneficiaryModel;

  factory BeneficiaryModel.fromJson(Map<String, dynamic> json) =>
      _$BeneficiaryModelFromJson(json);
}
