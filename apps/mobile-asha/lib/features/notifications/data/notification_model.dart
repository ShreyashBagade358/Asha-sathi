import 'package:freezed_annotation/freezed_annotation.dart';

part 'notification_model.freezed.dart';
part 'notification_model.g.dart';

/// Push / in-app notification shown in the notification centre.
///
/// [type] is one of `reminder`, `alert`, `campaign`, `training` or `system`.
/// [actionUrl] mirrors a named route so tapping a notification navigates the
/// worker to the relevant screen.
@freezed
abstract class AppNotificationModel with _$AppNotificationModel {
  const factory AppNotificationModel({
    @Default('') String notificationId,
    @Default('') String title,
    @Default('') String body,
    @Default('system') String type,
    @Default(false) bool read,
    String? createdAt,
    String? actionUrl,
  }) = _AppNotificationModel;

  factory AppNotificationModel.fromJson(Map<String, dynamic> json) =>
      _$AppNotificationModelFromJson(json);
}
