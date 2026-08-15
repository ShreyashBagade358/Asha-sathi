import 'package:freezed_annotation/freezed_annotation.dart';

part 'pending_verification_model.freezed.dart';
part 'pending_verification_model.g.dart';

/// A beneficiary data entry synced from an ASHA that needs PHC approval.
@freezed
abstract class PendingVerificationModel with _$PendingVerificationModel {
  const factory PendingVerificationModel({
    required String id,
    required String beneficiaryName,
    @Default('maternal') String category,
    @Default('') String submittedBy,
    @Default('') String ashaPhone,
    @Default('') String facilityId,
    @Default('pending') String status,
    @Default('') String note,
    @Default({}) Map<String, dynamic> dataEntries,
    DateTime? submittedAt,
  }) = _PendingVerificationModel;

  factory PendingVerificationModel.fromJson(Map<String, dynamic> json) =>
      _$PendingVerificationModelFromJson(json);

  /// User-facing label for the entry category.
  String get categoryLabel {
    switch (category) {
      case 'maternal':
        return 'Maternal';
      case 'child':
        return 'Child';
      case 'ncd':
        return 'NCD';
      default:
        return category.toUpperCase();
    }
  }
}
