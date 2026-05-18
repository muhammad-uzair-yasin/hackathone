import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../theme';

export default function ScenarioIllustration() {
  return (
    <View style={styles.wrap}>
      <View style={styles.glow} />
      <LinearGradient
        colors={['#A78BFA', '#818CF8', '#60A5FA']}
        start={{ x: 0.2, y: 1 }}
        end={{ x: 0.9, y: 0 }}
        style={styles.platform}
      />
      <View style={styles.docBack} />
      <View style={styles.docFront}>
        <View style={styles.docLine} />
        <View style={[styles.docLine, { width: '72%' }]} />
        <View style={[styles.docLine, { width: '88%', marginBottom: 0 }]} />
      </View>
      <View style={styles.sparkle}>
        <Ionicons name="sparkles" size={11} color={Colors.accentPurple} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 76,
    height: 76,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  glow: {
    position: 'absolute',
    bottom: 0,
    width: 64,
    height: 32,
    borderRadius: 32,
    backgroundColor: '#8B5CF6',
    opacity: 0.12,
  },
  platform: {
    position: 'absolute',
    bottom: 6,
    width: 58,
    height: 12,
    borderRadius: 6,
    transform: [{ skewX: '-10deg' }],
  },
  docBack: {
    position: 'absolute',
    bottom: 20,
    right: 6,
    width: 30,
    height: 36,
    borderRadius: 5,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    transform: [{ rotate: '6deg' }],
  },
  docFront: {
    position: 'absolute',
    bottom: 18,
    left: 8,
    width: 38,
    height: 46,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 7,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  docLine: {
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#E0E7FF',
    marginBottom: 5,
    width: '100%',
  },
  sparkle: {
    position: 'absolute',
    top: 4,
    right: 2,
  },
});
