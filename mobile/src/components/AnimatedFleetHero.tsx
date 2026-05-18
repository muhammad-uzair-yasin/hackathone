/**
 * Fleet tab — convoy drift, corridor dots, highlight pulse when shipment selected.
 */
import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const FLEET_HERO = require('../../assets/fleet-hero.png');

function CorridorDot({ delay, left, top }: { delay: number; left: number; top: number }) {
  const blink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(blink, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 0,
          duration: 600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [blink, delay]);

  const opacity = blink.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.95] });
  const scale = blink.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] });

  return (
    <Animated.View
      style={[styles.dot, { left, top, opacity, transform: [{ scale }] }]}
      pointerEvents="none"
    />
  );
}

interface Props {
  highlighted?: boolean;
}

export default function AnimatedFleetHero({ highlighted = false }: Props) {
  const drift = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const driftLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, {
          toValue: 1,
          duration: highlighted ? 2400 : 3800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(drift, {
          toValue: 0,
          duration: highlighted ? 2400 : 3800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: highlighted ? 900 : 1500,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: highlighted ? 900 : 1500,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    const scanLoop = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: highlighted ? 2800 : 4200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    driftLoop.start();
    glowLoop.start();
    scanLoop.start();
    return () => {
      driftLoop.stop();
      glowLoop.stop();
      scanLoop.stop();
    };
  }, [drift, glow, highlighted, scan]);

  const translateX = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 6],
  });
  const scale = drift.interpolate({
    inputRange: [0, 1],
    outputRange: [1, highlighted ? 1.035 : 1.02],
  });
  const glowOpacity = glow.interpolate({
    inputRange: [0, 1],
    outputRange: [0, highlighted ? 0.28 : 0.12],
  });
  const scanX = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [-80, 360],
  });

  return (
    <View style={styles.card} pointerEvents="none">
      <Animated.View
        style={[
          styles.glow,
          { opacity: glowOpacity, backgroundColor: highlighted ? '#2563EB' : '#3B82F6' },
        ]}
      />

      <CorridorDot delay={0} left={28} top={52} />
      <CorridorDot delay={220} left={72} top={68} />
      <CorridorDot delay={440} left={118} top={44} />
      <CorridorDot delay={660} left={168} top={72} />

      <View style={styles.inner}>
        <Animated.View style={[styles.imageWrap, { transform: [{ translateX }, { scale }] }]}>
          <Image source={FLEET_HERO} style={styles.heroImg} resizeMode="cover" />
        </Animated.View>

        <Animated.View style={[styles.scanWrap, { transform: [{ translateX: scanX }] }]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.35)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.scan}
          />
        </Animated.View>

        <LinearGradient
          colors={['transparent', 'rgba(249,250,251,0.88)']}
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
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  inner: {
    height: 172,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#60A5FA',
    zIndex: 4,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 3,
  },
  imageWrap: {
    width: '112%',
    height: 200,
    marginTop: -8,
    zIndex: 2,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  scanWrap: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 72,
    zIndex: 3,
    opacity: 0.7,
  },
  scan: {
    flex: 1,
    width: '100%',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 44,
    zIndex: 5,
  },
});
