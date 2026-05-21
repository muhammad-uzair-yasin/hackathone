/**
 * Logistics Agent — Mobile app
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

import BottomTabBar, { TabName } from './src/components/BottomTabBar';
import { useAgentStream } from './src/hooks/useAgentStream';
import NewsInputScreen from './src/screens/NewsInputScreen';
import FleetScreen from './src/screens/FleetScreen';
import ShipmentDetailScreen from './src/screens/ShipmentDetailScreen';
import AgentScreen from './src/screens/AgentScreen';
import OutcomeVisualization from './src/screens/OutcomeVisualization';
import DriverReportScreen from './src/screens/DriverReportScreen';
import PredictionScreen from './src/screens/PredictionScreen';
import AppDialog from './src/components/AppDialog';
import type { Shipment } from './src/types/shipment';
import { Colors } from './src/theme';
import { setupNotifications, sendShipmentAlert } from './src/services/NotificationService';

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [activeTab, setActiveTab] = useState<TabName>('News');
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);
  const [fleetRefreshKey, setFleetRefreshKey] = useState(0);
  const [newsResetToken, setNewsResetToken] = useState(0);
  const [dialog, setDialog] = useState<{ title: string; message: string } | null>(null);

  const {
    isAnalyzing,
    reasoningOpen,
    setReasoningOpen,
    traceOpen,
    setTraceOpen,
    statusLine,
    todos,
    activities,
    timeline,
    pipelinePhase,
    progress,
    outcomeBefore,
    outcomeAfter,
    routeBeforeStops,
    routeAfterStops,
    summaryDoc,
    loadSummary,
    affectedId,
    error,
    isResetting,
    runAnalysis,
    resetDemo,
    toggleActivity,
    subagentNotices,
    dismissSubagentNotice,
  } = useAgentStream();

  const handleResetDemo = async () => {
    const result = await resetDemo();
    if (result === true) {
      setNewsResetToken((t) => t + 1);
      setFleetRefreshKey((k) => k + 1);
      setDialog({
        title: 'Demo reset',
        message: 'Fleet data and agent state restored. Pick an alert and run again.',
      });
    } else {
      setDialog({ title: 'Reset failed', message: result });
    }
  };

  const handleRunAgent = (text: string) => {
    runAnalysis(text, () => setActiveTab('Agent'));
  };

  // Set up push notifications once on app start
  useEffect(() => {
    void setupNotifications();
  }, []);

  // Navigate to Agent tab when agent starts
  useEffect(() => {
    if (activeTab === 'Outcome' && pipelinePhase === 'complete') {
      void loadSummary();
    }
  }, [activeTab, pipelinePhase, loadSummary]);

  if (!fontsLoaded) {
    return (
      <View style={styles.fontLoader}>
        <ActivityIndicator size="large" color={Colors.accentPurple} />
      </View>
    );
  }

  if (detailShipment) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.pageBackground} />
        <ShipmentDetailScreen
          shipment={detailShipment}
          onClose={() => setDetailShipment(null)}
        />
      </SafeAreaView>
    );
  }

  const renderScreen = () => {
    switch (activeTab) {
      case 'News':
        return (
          <NewsInputScreen
            onRunAgent={handleRunAgent}
            isAnalyzing={isAnalyzing}
            onResetDemo={handleResetDemo}
            isResetting={isResetting}
            resetToken={newsResetToken}
          />
        );
      case 'Fleet':
        return (
          <FleetScreen
            onSelectShipment={setDetailShipment}
            highlightId={affectedId}
            refreshKey={fleetRefreshKey}
          />
        );
      case 'Agent':
        return (
          <AgentScreen
            isAnalyzing={isAnalyzing}
            statusLine={statusLine}
            todos={todos}
            activities={activities}
            timeline={timeline}
            pipelinePhase={pipelinePhase}
            progress={progress}
            reasoningOpen={reasoningOpen}
            traceOpen={traceOpen}
            onToggleMaster={() => setReasoningOpen((o) => !o)}
            onToggleTrace={() => setTraceOpen((o) => !o)}
            onToggleActivity={toggleActivity}
            summaryMarkdown={summaryDoc?.markdown}
            summaryFile={summaryDoc?.file}
            error={error}
            subagentNotices={subagentNotices}
            onDismissSubagentNotice={dismissSubagentNotice}
          />
        );
      case 'Outcome':
        return (
          <OutcomeVisualization
            pipelineComplete={pipelinePhase === 'complete'}
            summaryMarkdown={summaryDoc?.markdown}
            summaryFile={summaryDoc?.file}
            onRefreshSummary={loadSummary}
            beforeStops={routeBeforeStops}
            afterStops={routeAfterStops}
            beforeState={
              outcomeBefore
                ? {
                    shipmentId: outcomeBefore.shipmentId,
                    cargo: outcomeBefore.cargo,
                    route: outcomeBefore.route,
                    destination: outcomeBefore.destination,
                    status: outcomeBefore.status,
                    temp: '—',
                  }
                : undefined
            }
            afterState={
              outcomeAfter
                ? {
                    shipmentId: outcomeAfter.shipmentId,
                    cargo: outcomeAfter.cargo,
                    route: outcomeAfter.route,
                    destination: outcomeAfter.destination,
                    status: outcomeAfter.status,
                    temp: '—',
                  }
                : undefined
            }
          />
        );
      case 'Report':
        return (
          <DriverReportScreen
            onRunAgent={(text) => {
              handleRunAgent(text);
              setActiveTab('Agent');
            }}
          />
        );
      case 'Predict':
        return <PredictionScreen />;
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.pageBackground} />
      <View style={styles.body}>{renderScreen()}</View>
      <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} />

      <AppDialog
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        primaryLabel="OK"
        onPrimary={() => setDialog(null)}
        onRequestClose={() => setDialog(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fontLoader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.pageBackground,
  },
  root: { flex: 1, backgroundColor: Colors.pageBackground },
  body: { flex: 1 },
});
