/**
 * In-app dialog — same look on phone, emulator, and Expo web (no browser alert/confirm).
 */
import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { FontFamily } from '../theme';

interface Props {
  visible: boolean;
  title: string;
  message?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryDestructive?: boolean;
  loading?: boolean;
  onPrimary: () => void;
  onSecondary?: () => void;
  onRequestClose?: () => void;
}

export default function AppDialog({
  visible,
  title,
  message,
  primaryLabel = 'OK',
  secondaryLabel,
  primaryDestructive = false,
  loading = false,
  onPrimary,
  onSecondary,
  onRequestClose,
}: Props) {
  const close = onRequestClose ?? onSecondary;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={close}
    >
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          <View style={styles.actions}>
            {secondaryLabel ? (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary]}
                onPress={onSecondary}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles.btnSecondaryText}>{secondaryLabel}</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[
                styles.btn,
                primaryDestructive ? styles.btnDanger : styles.btnPrimary,
                !secondaryLabel && styles.btnFull,
              ]}
              onPress={onPrimary}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" size="small" />
              ) : (
                <Text style={styles.btnPrimaryText}>{primaryLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  title: {
    fontFamily: FontFamily.semiBold,
    fontSize: 18,
    color: '#111827',
    marginBottom: 8,
  },
  message: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  btn: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  btnFull: {
    flex: 1,
  },
  btnSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  btnSecondaryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#374151',
  },
  btnPrimary: {
    backgroundColor: '#2563EB',
  },
  btnDanger: {
    backgroundColor: '#DC2626',
  },
  btnPrimaryText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: '#FFFFFF',
  },
});
