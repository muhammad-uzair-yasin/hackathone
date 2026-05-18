import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Page } from '../theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  borderLeftColor?: string;
}

/** White bordered card — matches News screen */
export default function GlassCard({ children, style, borderLeftColor }: Props) {
  return (
    <View
      style={[
        styles.card,
        borderLeftColor ? { borderLeftWidth: 3, borderLeftColor } : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Page.cardBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Page.border,
    overflow: 'hidden',
  },
});
