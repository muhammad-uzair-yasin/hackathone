import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { FontFamily } from '../theme';

export type TabName = 'News' | 'Fleet' | 'Agent' | 'Outcome' | 'Report' | 'Predict';

const INACTIVE = '#9CA3AF';
const ACTIVE = '#2563EB';

const TABS: { name: TabName; label: string; icon: (a: boolean) => React.ReactNode }[] = [
  {
    name: 'News',
    label: 'News',
    icon: (a) => <Ionicons name="newspaper-outline" size={22} color={a ? ACTIVE : INACTIVE} />,
  },
  {
    name: 'Fleet',
    label: 'Fleet',
    icon: (a) => (
      <MaterialCommunityIcons name="truck-outline" size={22} color={a ? ACTIVE : INACTIVE} />
    ),
  },
  {
    name: 'Agent',
    label: 'Agent',
    icon: (a) => (
      <MaterialCommunityIcons name="head-cog-outline" size={22} color={a ? ACTIVE : INACTIVE} />
    ),
  },
  {
    name: 'Outcome',
    label: 'Outcome',
    icon: (a) => (
      <Ionicons name="checkmark-circle-outline" size={22} color={a ? ACTIVE : INACTIVE} />
    ),
  },
  {
    name: 'Report',
    label: 'Report',
    icon: (a) => (
      <Ionicons name="warning-outline" size={22} color={a ? '#DC2626' : INACTIVE} />
    ),
  },
  {
    name: 'Predict',
    label: 'Predict',
    icon: (a) => (
      <MaterialCommunityIcons name="shield-search" size={22} color={a ? '#7C3AED' : INACTIVE} />
    ),
  },
];

interface Props {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

export default function BottomTabBar({ activeTab, onTabPress }: Props) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const active = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={styles.tab}
            onPress={() => onTabPress(tab.name)}
            activeOpacity={0.7}
          >
            {tab.icon(active)}
            <Text style={[styles.label, active && styles.labelOn]}>{tab.label}</Text>
            {active ? <View style={styles.mark} /> : <View style={styles.markSpacer} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 26 : 12,
  },
  tab: { flex: 1, alignItems: 'center' },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 11,
    color: INACTIVE,
    marginTop: 4,
  },
  labelOn: { fontFamily: FontFamily.semiBold, color: ACTIVE },
  mark: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: ACTIVE,
    marginTop: 5,
  },
  markSpacer: { height: 7 },
});
