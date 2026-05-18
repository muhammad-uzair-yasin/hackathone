import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontFamily } from '../theme';

interface Props {
  title: string;
  subtitle: string;
  kicker?: string;
  right?: React.ReactNode;
}

export default function ScreenHeader({ title, subtitle, kicker, right }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.textCol}>
        {kicker ? <Text style={styles.kicker}>{kicker}</Text> : null}
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  textCol: { flex: 1, paddingRight: 8 },
  right: { marginTop: 4 },
  kicker: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 0.5,
    color: '#2563EB',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.5,
    color: '#111827',
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    marginTop: 6,
  },
});
