import 'package:freezed_annotation/freezed_annotation.dart';

part 'abha_record_model.freezed.dart';
part 'abha_record_model.g.dart';

/// ABHA (Ayushman Bharat Health Account) linkage record.
@freezed
abstract class ABHARecordModel with _$ABHARecordModel {
  const factory ABHARecordModel({
    @Default('') String abhaId,
    String? beneficiaryId,
    String? abhaNumber,
    String? healthId,
    @Default('unlinked') String status,
    @Default('none') String linkingMethod,
    @Default(false) bool consentGranted,
    String? createdAt,
    String? updatedAt,
  }) = _ABHARecordModel;

  factory ABHARecordModel.fromJson(Map<String, dynamic> json) =>
      _$ABHARecordModelFromJson(json);
}
