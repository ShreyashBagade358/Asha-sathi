import { useCallback, useState } from 'react';
import { Alert, Image, Platform, View, Text, Pressable, StyleSheet, Modal } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalization } from '@/i18n/useLocalization';
import { useToast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { colors } from '@/theme';
import { cx } from '@/cx';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export interface PhotoCaptureProps {
  photos: string[];
  onPhotosChange: (photos: string[]) => void;
  maxPhotos?: number;
  label?: string;
  hint?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES = {
  xs: { width: 48, height: 48, iconSize: 18 },
  sm: { width: 64, height: 64, iconSize: 20 },
  md: { width: 88, height: 88, iconSize: 28 },
  lg: { width: 100, height: 100, iconSize: 32 },
};

export function PhotoCapture({ photos, onPhotosChange, maxPhotos = 5, label, hint, size = 'md' }: PhotoCaptureProps) {
  const { t } = useLocalization();
  const toast = useToast();
  const [localUris, setLocalUris] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const { width, height, iconSize } = SIZE_CLASSES[size];

  const pickImage = useCallback(async () => {
    if (photos.length + localUris.length >= maxPhotos) {
      toast.toast(t('photo.maxLimit', { max: maxPhotos }), 'error');
      return;
    }

    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      toast.toast(t('photo.permissionDenied'), 'error');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset && asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
        toast.toast(t('photo.tooLarge'), 'error');
        return;
      }
      if (asset && asset.uri) {
        setLocalUris((prev) => [...prev, asset.uri]);
        toast.toast(t('photo.added'), 'success');
      }
    }
  }, [photos.length, localUris.length, maxPhotos, toast, t]);

  const takePhoto = useCallback(async () => {
    if (photos.length + localUris.length >= maxPhotos) {
      toast.toast(t('photo.maxLimit', { max: maxPhotos }), 'error');
      return;
    }

    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      toast.toast(t('photo.cameraPermissionDenied'), 'error');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset && asset.fileSize && asset.fileSize > MAX_IMAGE_BYTES) {
        toast.toast(t('photo.tooLarge'), 'error');
        return;
      }
      if (asset && asset.uri) {
        setLocalUris((prev) => [...prev, asset.uri]);
        toast.toast(t('photo.added'), 'success');
      }
    }
  }, [photos.length, localUris.length, maxPhotos, toast, t]);

  const showActionSheet = () => {
    Alert.alert(
      t('photo.selectSource'),
      '',
      [
        { text: t('photo.camera'), onPress: takePhoto },
        { text: t('photo.gallery'), onPress: pickImage },
        { text: t('common.cancel'), style: 'cancel' },
      ],
      { cancelable: true }
    );
  };

  const removePhoto = (index: number) => {
    const isLocal = index >= photos.length;
    if (isLocal) {
      const localIndex = index - photos.length;
      setLocalUris((prev) => prev.filter((_, i) => i !== localIndex));
    } else {
      const newPhotos = photos.filter((_, i) => i !== index);
      onPhotosChange(newPhotos);
    }
  };

  const openPreview = (uri: string, index: number) => {
    setPreviewUri(uri);
    setPreviewIndex(index);
  };

  const closePreview = () => {
    setPreviewUri(null);
    setPreviewIndex(null);
  };

  const allPhotos = [...photos, ...localUris];

  return (
    <View style={styles.container}>
      <View style={styles.photosContainer}>
        {allPhotos.map((uri, index) => (
          <View key={index} style={styles.photoWrapper}>
            <Pressable onPress={() => openPreview(uri, index)} style={styles.photoTouchable}>
              <Image source={{ uri }} style={[styles.photo, { width, height }]} resizeMode="cover" />
              <View style={styles.removeButton}>
                <Icon name="x" size={16} color={colors.onPrimary} />
              </View>
            </Pressable>
            <Pressable onPress={() => removePhoto(index)} disabled={uploading} style={styles.removeOverlay} accessibilityLabel={t('photo.remove')}>
              <Icon name="trash" size={18} color={colors.error} />
            </Pressable>
          </View>
        ))}

        {allPhotos.length < maxPhotos && (
          <View style={styles.addButtonWrapper}>
            {allPhotos.length === 0 && (
              <>
                {label && <Text style={styles.label}>{label}</Text>}
                {hint && <Text style={styles.hint}>{hint}</Text>}
              </>
            )}
            <Pressable onPress={showActionSheet} disabled={uploading} style={[styles.addButton, { width, height }]} accessibilityLabel={t('photo.add')}>
              <Icon name="camera" size={iconSize} color={colors.onSurfaceVariant} />
            </Pressable>
          </View>
        )}
      </View>

      {(photos.length + localUris.length) > 0 && (
        <Text style={styles.countText}>
          {photos.length + localUris.length}/{maxPhotos} {t('photo.photosAdded')}
        </Text>
      )}

      {previewUri && previewIndex !== null && (
        <Modal visible={true} onRequestClose={closePreview} animationType="fade" transparent>
          <View style={styles.previewOverlay} onStartShouldSetResponder={() => true}>
            <View style={styles.previewContainer}>
              <Pressable onPress={closePreview} style={styles.previewCloseButton}>
                <Icon name="x" size={24} color={colors.onPrimary} />
              </Pressable>
              <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
              <Text style={styles.previewCounter}>{previewIndex + 1} / {allPhotos.length}</Text>
              <Pressable onPress={() => removePhoto(previewIndex)} style={styles.previewDeleteButton}>
                <Icon name="trash" size={24} color={colors.error} />
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  photosContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photoWrapper: {
    position: 'relative',
  },
  photoTouchable: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceContainer,
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceContainer,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  addButton: {
    borderWidth: 0,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  addButtonWrapper: {
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.onSurface,
  },
  hint: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
  },
  countText: {
    fontSize: 12,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContainer: {
    position: 'relative',
    width: '90%',
    height: '80%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCloseButton: {
    position: 'absolute',
    top: -40,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    maxHeight: '70%',
  },
  previewCounter: {
    position: 'absolute',
    bottom: -30,
    color: colors.onPrimary,
    fontSize: 14,
  },
  previewDeleteButton: {
    position: 'absolute',
    bottom: -60,
    right: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
});