/**
 * Outcome tab — motion streaks, route pulse, success glow when fleet updated.
 */
import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const OUTCOME_HERO = require('../../assets/outcome-hero.png');

function SpeedStreak({ delay, top }: { delay: number; top: number }) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(slide, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(slide, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, slide]);

  const translateX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [120, -40],
  });
  const opacity = slide.interpolate({
    inputRange: [0, 0.2, 0.8, 1],
    outputRange: [0, 0.7, 0.5, 0],
  });

  return (
    <Animated.View
      style={[styles.streak, { top, opacity, transform: [{ translateX }] }]}
      pointerEvents="none"
    />
  );
}

interface Props {
  celebrate?: boolean;
}

export default function AnimatedOutcomeHero({ celebrate = false }: Props) {
  const roll = useRef(new Animated.Value(0)).current;
  const routePulse = useRef(new Animated.Value(0)).current;
  const successGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const rollLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(roll, {
          toValue: 1,
          duration: celebrate ? 2200 : 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(roll, {
          toValue: 0,
          duration: celebrate ? 2200 : 3600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const routeLoop = Animated.loop(
      Animated.timing(routePulse, {
        toValue: 1,
        duration: celebrate ? 1600 : 2800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(successGlow, {
          toValue: 1,
          duration: celebrate ? 700 : 1400,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(successGlow, {
          toValue: 0,
          duration: celebrate ? 700 : 1400,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    rollLoop.start();
    routeLoop.start();
    glowLoop.start();
    return () => {
      rollLoop.stop();
      routeLoop.stop();
      glowLoop.stop();
    };
  }, [celebrate, roll, routePulse, successGlow]);

  const truckX = roll.interpolate({
    inputRange: [0, 1],
    outputRange: [-6, 8],
  });
  const truckScale = roll.interpolate({
    inputRange: [0, 1],
    outputRange: [1, celebrate ? 1.03 : 1.015],
  });
  const routeWidth = routePulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['28%', '88%'],
  });
  const routeOpacity = routePulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.9, 0.35],
  });
  const glowOpacity = successGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, celebrate ? 0.32 : 0.14],
  });

  return (
    <View style={styles.card} pointerEvents="none">
      <Animated.View
        style={[
          styles.successGlow,
          { opacity: glowOpacity, backgroundColor: celebrate ? '#10B981' : '#3B82F6' },
        ]}
      />

      <SpeedStreak delay={0} top={48} />
      <SpeedStreak delay={300} top={72} />
      <SpeedStreak delay={600} top={96} />

      <View style={styles.inner}>
        <Animated.View style={[styles.routeTrack, { opacity: routeOpacity }]}>
          <Animated.View
            style={[
              styles.routeFill,
              { width: routeWidth, backgroundColor: celebrate ? '#10B981' : '#3B82F6' },
            ]}
          />
        </Animated.View>

        <Animated.View style={[styles.truckWrap, { transform: [{ translateX: truckX }, { scale: truckScale }] }]}>
          <Image source={OUTCOME_HERO} style={styles.heroImg} resizeMode="cover" />
        </Animated.View>

        <LinearGradient
          colors={['transparent', 'rgba(249,250,251,0.9)']}
          style={styles.bottomFade}
          pointerEvents="none"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  successGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  inner: {
    height: 172,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    justifyContent: 'flex-end',
  },
  streak: {
    position: 'absolute',
    left: 0,
    width: 56,
    height: 2,
    borderRadius: 1,
    backgroundColor: '#93C5FD',
    zIndex: 1,
  },
  routeTrack: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    zIndex: 2,
  },
  routeFill: {
    height: '100%',
    borderRadius: 2,
  },
  truckWrap: {
    width: '112%',
    height: 200,
    marginLeft: '-6%',
    marginBottom: -12,
    zIndex: 3,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 48,
    zIndex: 4,
  },
});
