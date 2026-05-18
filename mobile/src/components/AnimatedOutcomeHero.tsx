/**
 * Outcome tab — subtle motion + route pulse when fleet updated (no image fades).
 */
import React, { useEffect, useRef } from 'react';
import { View, Image, StyleSheet, Animated, Easing } from 'react-native';

const OUTCOME_HERO = require('../../assets/outcome-hero.png');

interface Props {
  celebrate?: boolean;
}

export default function AnimatedOutcomeHero({ celebrate = false }: Props) {
  const roll = useRef(new Animated.Value(0)).current;
  const routePulse = useRef(new Animated.Value(0)).current;

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
    rollLoop.start();
    routeLoop.start();
    return () => {
      rollLoop.stop();
      routeLoop.stop();
    };
  }, [celebrate, roll, routePulse]);

  const truckX = roll.interpolate({
    inputRange: [0, 1],
    outputRange: [-4, 4],
  });
  const truckScale = roll.interpolate({
    inputRange: [0, 1],
    outputRange: [1, celebrate ? 1.02 : 1.01],
  });
  const routeWidth = routePulse.interpolate({
    inputRange: [0, 1],
    outputRange: ['28%', '88%'],
  });
  const routeOpacity = routePulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.35, 0.9, 0.35],
  });

  return (
    <View style={styles.card} pointerEvents="none">
      <View style={styles.inner}>
        <Animated.View
          style={[styles.imageWrap, { transform: [{ translateX: truckX }, { scale: truckScale }] }]}
        >
          <Image source={OUTCOME_HERO} style={styles.heroImg} resizeMode="cover" />
        </Animated.View>

        <Animated.View style={[styles.routeTrack, { opacity: routeOpacity }]}>
          <Animated.View
            style={[
              styles.routeFill,
              { width: routeWidth, backgroundColor: celebrate ? '#10B981' : '#3B82F6' },
            ]}
          />
        </Animated.View>
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  inner: {
    width: '100%',
    height: 210,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  imageWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  heroImg: {
    width: '100%',
    height: '100%',
  },
  routeTrack: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
    zIndex: 2,
  },
  routeFill: {
    height: '100%',
    borderRadius: 2,
  },
});
