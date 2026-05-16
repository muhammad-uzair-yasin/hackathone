import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { Colors, Typography, BorderRadius } from '../theme';

export type TabName = 'Dashboard' | 'AIEngine' | 'Outcomes' | 'Fleet';

interface Tab {
  name: TabName;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { name: 'Dashboard', label: 'Dashboard', icon: '⊞' },
  { name: 'AIEngine', label: 'AI Engine', icon: '🧠' },
  { name: 'Outcomes', label: 'Outcomes', icon: '📊' },
  { name: 'Fleet', label: 'Fleet', icon: '🚚' },
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
            <Text style={[styles.icon, isActive && styles.iconActive]}>
              {tab.icon}
            </Text>
            <Text style={[styles.label, isActive && styles.labelActive]}>
              {tab.label}
            </Text>
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
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.md,
  },
  tabActive: {
    backgroundColor: `${Colors.primaryContainer}22`,
    transform: [{ scale: 1.08 }],
  },
  icon: {
    fontSize: 22,
    marginBottom: 3,
  },
  iconActive: {
    // brighter when active
  },
  label: {
    ...Typography.labelSM,
    color: Colors.outline,
    textAlign: 'center',
  },
  labelActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
