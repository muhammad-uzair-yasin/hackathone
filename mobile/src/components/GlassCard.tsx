import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { Colors, BorderRadius } from '../theme';

interface Props {
  children: React.ReactNode;
  style?: ViewStyle;
  borderLeftColor?: string;
  variant?: 'glass' | 'neumorphic' | 'inset';
}

export default function GlassCard({ children, style, borderLeftColor, variant = 'glass' }: Props) {
  return (
    <View
      style={[
        styles.base,
        variant === 'glass' && styles.glass,
        variant === 'neumorphic' && styles.neumorphic,
        variant === 'inset' && styles.inset,
        borderLeftColor && { borderLeftWidth: 4, borderLeftColor },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  glass: {
    backgroundColor: Colors.glassBackground,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  neumorphic: {
    backgroundColor: Colors.surfaceBright,
    shadowColor: '#d1d9e6',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 8,
  },
  inset: {
    backgroundColor: Colors.surfaceBright,
    shadowColor: '#d1d9e6',
    shadowOffset: { width: -4, height: -4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 0,
  },
});
