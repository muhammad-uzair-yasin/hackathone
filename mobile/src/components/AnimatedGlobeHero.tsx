/**
 * News tab — orbital satellites, aurora glow, shimmer (judge-facing polish).
 */
import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const GLOBE_IMAGE = require('../../assets/news-globe.png');

function useLoop(
  duration: number,
  delay = 0,
  easing: (value: number) => number = Easing.inOut(Easing.sin)
) {
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration, easing, useNativeDriver: true }),
      ])
    );
    const timer = setTimeout(() => anim.start(), delay);
    return () => {
      clearTimeout(timer);
      anim.stop();
    };
  }, [delay, duration, easing, value]);

  return value;
}

function OrbitSatellite({
  radius,
  dotSize,
  color,
  duration,
  delay,
}: {
  radius: number;
  dotSize: number;
  color: string;
  duration: number;
  delay: number;
}) {
  const spin = useLoop(duration, delay);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={styles.orbitSpin} pointerEvents="none">
      <Animated.View
        style={[
          styles.orbitArm,
          { width: radius * 2, height: radius * 2, transform: [{ rotate }] },
        ]}
      >
        <View
          style={[
            styles.orbitDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: color,
              left: radius - dotSize / 2,
              shadowColor: color,
            },
          ]}
        />
      </Animated.View>
    </Animated.View>
  );
}

export default function AnimatedGlobeHero() {
  const float = useLoop(3200);
  const auroraA = useLoop(4200, 0);
  const auroraB = useLoop(5100, 600);
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerLoop = Animated.loop(
      Animated.timing(shimmer, {
        toValue: 1,
        duration: 2800,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    shimmerLoop.start();
    return () => shimmerLoop.stop();
  }, [shimmer]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [6, -14] });
  const scale = float.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const glowScaleA = auroraA.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] });
  const glowScaleB = auroraB.interpolate({ inputRange: [0, 1], outputRange: [1.05, 0.88] });
  const glowOpacityA = auroraA.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] });
  const glowOpacityB = auroraB.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.08] });
  const shimmerX = shimmer.interpolate({ inputRange: [0, 1], outputRange: [-120, 320] });

  return (
    <View style={styles.layer} pointerEvents="none">
      <Animated.View
        style={[styles.aurora, styles.auroraBlue, { opacity: glowOpacityA, transform: [{ scale: glowScaleA }] }]}
      />
      <Animated.View
        style={[styles.aurora, styles.auroraCyan, { opacity: glowOpacityB, transform: [{ scale: glowScaleB }] }]}
      />

      <View style={styles.stage}>
        <OrbitSatellite radius={118} dotSize={7} color="#60A5FA" duration={9000} delay={0} />
        <OrbitSatellite radius={92} dotSize={5} color="#2563EB" duration={6500} delay={400} />
        <OrbitSatellite radius={132} dotSize={6} color="#38BDF8" duration={11000} delay={800} />

        <Animated.View style={[styles.figure, { transform: [{ translateY }, { scale }] }]}>
          <Image source={GLOBE_IMAGE} style={styles.globeImg} resizeMode="contain" />
        </Animated.View>

        <Animated.View style={[styles.shimmerWrap, { transform: [{ translateX: shimmerX }] }]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shimmer}
          />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    top: -20,
    right: -56,
    width: 300,
    height: 300,
    zIndex: 0,
    overflow: 'visible',
  },
  aurora: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: 36,
    right: 20,
  },
  auroraBlue: { backgroundColor: '#3B82F6' },
  auroraCyan: { backgroundColor: '#22D3EE', right: 48, top: 52 },
  stage: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitSpin: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  orbitArm: {
    position: 'absolute',
  },
  orbitDot: {
    position: 'absolute',
    top: 0,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
    elevation: 4,
  },
  figure: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  globeImg: {
    width: '100%',
    height: '100%',
  },
  shimmerWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
    opacity: 0.85,
  },
  shimmer: {
    flex: 1,
    width: '100%',
  },
});
