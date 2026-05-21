import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '../theme';
import type { SubagentStartNotice } from '../types/subagentNotice';

const AGENT_ICONS: Record<string, string> = {
  'hazard-detector': '⚠️',
  'shipment-analyzer': '🚚',
  'impact-analyzer': '📊',
  'action-planner': '🗺️',
};

const TOAST_LIFETIME_MS = 4200;

interface ToastItemProps {
  notice: SubagentStartNotice;
  index: number;
  onDismiss: (id: string) => void;
}

function ToastItem({ notice, index, onDismiss }: ToastItemProps) {
  const slide = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();

    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slide, {
          toValue: 80,
          duration: 240,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 240,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) onDismiss(notice.id);
      });
    }, TOAST_LIFETIME_MS);

    return () => clearTimeout(timer);
  }, [notice.id, onDismiss, opacity, slide]);

  const icon = AGENT_ICONS[notice.agentId] || '🤖';

  return (
    <Animated.View
      style={[
        styles.toast,
        {
          opacity,
          transform: [{ translateX: slide }],
          marginTop: index > 0 ? Spacing.sm : 0,
        },
      ]}
    >
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={styles.badge}>Subagent started</Text>
        <Text style={styles.title} numberOfLines={1}>
          {notice.label}
        </Text>
      </View>
      <View style={styles.pulse} />
    </Animated.View>
  );
}

interface Props {
  notices: SubagentStartNotice[];
  onDismiss: (id: string) => void;
}

/** Top-right notification stack when a subagent begins work. */
export default function SubagentStartToast({ notices, onDismiss }: Props) {
  if (!notices.length) return null;

  return (
    <View style={styles.stack} pointerEvents="box-none">
      {notices.map((notice, index) => (
        <ToastItem key={notice.id} notice={notice} index={index} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.md,
    left: Spacing.xl,
    alignItems: 'flex-end',
    zIndex: 100,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 300,
    minWidth: 220,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: `${Colors.primary}40`,
    ...Shadows.cardStrong,
    gap: Spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${Colors.primary}18`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 18 },
  copy: { flex: 1 },
  badge: {
    ...Typography.labelSM,
    color: Colors.primary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    ...Typography.bodySM,
    fontWeight: '700',
    color: Colors.onSurface,
  },
  pulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
});
