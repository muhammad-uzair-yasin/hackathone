/**
 * Agent tab — radar pulses, scan beam, live grid (distinct from News globe).
 */
import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const AGENT_HERO = require('../../assets/agent-hero.png');

function RadarPulse({ delay, duration }: { delay: number; duration: number }) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(pulse, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, duration, pulse]);

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 1.55],
  });
  const opacity = pulse.interpolate({
    inputRange: [0, 0.15, 1],
    outputRange: [0.55, 0.35, 0],
  });

  return (
    <Animated.View
      style={[styles.radarRing, { opacity, transform: [{ scale }] }]}
      pointerEvents="none"
    />
  );
}

function DataTick({ index, active }: { index: number; active: boolean }) {
  const blink = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(index * 180 + (active ? 0 : 400)),
        Animated.timing(blink, {
          toValue: 1,
          duration: active ? 400 : 700,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 0,
          duration: active ? 400 : 700,
          useNativeDriver: true,
        }),
        Animated.delay(200),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, blink, index]);

  const opacity = blink.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });

  return (
    <Animated.View
      style={[
        styles.tick,
        { opacity, left: 12 + index * 22, top: 14 + (index % 3) * 8 },
      ]}
    />
  );
}

interface Props {
  isActive: boolean;
}

export default function AnimatedAgentHero({ isActive }: Props) {
  const breathe = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const borderGlow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: isActive ? 1400 : 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: isActive ? 1400 : 2800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    const scanLoop = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: isActive ? 2200 : 3600,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const borderLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(borderGlow, {
          toValue: 1,
          duration: isActive ? 800 : 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(borderGlow, {
          toValue: 0,
          duration: isActive ? 800 : 1600,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ])
    );
    breatheLoop.start();
    scanLoop.start();
    borderLoop.start();
    return () => {
      breatheLoop.stop();
      scanLoop.stop();
      borderLoop.stop();
    };
  }, [isActive, breathe, borderGlow, scan]);

  const imageScale = breathe.interpolate({
    inputRange: [0, 1],
    outputRange: [1, isActive ? 1.04 : 1.02],
  });
  const scanY = scan.interpolate({
    inputRange: [0, 1],
    outputRange: [-24, 196],
  });
  const borderColor = borderGlow.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', isActive ? '#3B82F6' : '#93C5FD'],
  });

  const pulseDuration = isActive ? 1800 : 2800;

  return (
    <Animated.View style={[styles.card, { borderColor }]} pointerEvents="none">
      <View style={styles.inner}>
        <RadarPulse delay={0} duration={pulseDuration} />
        <RadarPulse delay={pulseDuration / 3} duration={pulseDuration} />
        <RadarPulse delay={(pulseDuration / 3) * 2} duration={pulseDuration} />

        {[0, 1, 2, 3, 4].map((i) => (
          <DataTick key={i} index={i} active={isActive} />
        ))}

        <Animated.View style={[styles.imageWrap, { transform: [{ scale: imageScale }] }]}>
          <Image source={AGENT_HERO} style={styles.heroImg} resizeMode="cover" />
        </Animated.View>

        <Animated.View style={[styles.scanBeam, { transform: [{ translateY: scanY }] }]}>
          <LinearGradient
            colors={[
              'transparent',
              isActive ? 'rgba(59,130,246,0.55)' : 'rgba(59,130,246,0.28)',
              'transparent',
            ]}
            style={styles.scanGradient}
          />
        </Animated.View>

        <LinearGradient
          colors={['transparent', 'rgba(249,250,251,0.85)']}
          style={styles.bottomFade}
          pointerEvents="none"
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  inner: {
    height: 172,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  tick: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
    zIndex: 4,
  },
  imageWrap: {
    width: '108%',
    height: 200,
    marginTop: -6,
    zIndex: 2,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  scanBeam: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 48,
    zIndex: 3,
  },
  scanGradient: {
    flex: 1,
    width: '100%',
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
    zIndex: 5,
  },
});
