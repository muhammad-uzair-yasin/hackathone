import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Colors, Typography, BorderRadius } from '../theme';

export type TabName = 'News' | 'Fleet' | 'Agent' | 'Outcome';

interface Tab {
  name: TabName;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { name: 'News', label: 'News', icon: '📰' },
  { name: 'Fleet', label: 'Fleet', icon: '🚚' },
  { name: 'Agent', label: 'Agent', icon: '🧠' },
  { name: 'Outcome', label: 'Outcome', icon: '✓' },
];

interface Props {
  activeTab: TabName;
  onTabPress: (tab: TabName) => void;
}

export default function BottomTabBar({ activeTab, onTabPress }: Props) {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.name;
        return (
          <TouchableOpacity
            key={tab.name}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabPress(tab.name)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{tab.icon}</Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  tabActive: { backgroundColor: `${Colors.primaryContainer}22` },
  icon: { fontSize: 20, marginBottom: 2 },
  label: { ...Typography.labelSM, color: Colors.outline },
  labelActive: { color: Colors.primary, fontWeight: '700' },
});
