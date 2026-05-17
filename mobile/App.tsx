/**
 * BioRoute Cold-Chain — Mobile app (multi-screen)
 *
 * News  → user picks alert input
 * Fleet → routes & shipment detail
 * Agent → live todos + agents (SSE)
 * Outcome → before / after fleet state + summary.md
 */
import React, { useEffect, useState } from 'react';
import { Alert, SafeAreaView, StatusBar, StyleSheet, View } from 'react-native';

import BottomTabBar, { TabName } from './src/components/BottomTabBar';
import { useAgentStream } from './src/hooks/useAgentStream';
import NewsInputScreen from './src/screens/NewsInputScreen';
import FleetScreen from './src/screens/FleetScreen';
import ShipmentDetailScreen from './src/screens/ShipmentDetailScreen';
import AgentScreen from './src/screens/AgentScreen';
import OutcomeVisualization from './src/screens/OutcomeVisualization';
import type { Shipment } from './src/types/shipment';
import { Colors } from './src/theme';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabName>('News');
  const [detailShipment, setDetailShipment] = useState<Shipment | null>(null);
  const [fleetRefreshKey, setFleetRefreshKey] = useState(0);
  const [newsResetToken, setNewsResetToken] = useState(0);

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
    const ok = await resetDemo();
    if (ok) {
      setNewsResetToken((t) => t + 1);
      setFleetRefreshKey((k) => k + 1);
      Alert.alert('Demo reset', 'Fleet data and agent state restored. Pick an alert and run again.');
    }
  };

  const handleRunAgent = (text: string) => {
    runAnalysis(text, () => setActiveTab('Agent'));
  };

  useEffect(() => {
    if (activeTab === 'Outcome' && pipelinePhase === 'complete') {
      void loadSummary();
    }
  }, [activeTab, pipelinePhase, loadSummary]);

  if (detailShipment) {
    return (
      <SafeAreaView style={styles.root}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
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
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      <View style={styles.body}>{renderScreen()}</View>
      <BottomTabBar activeTab={activeTab} onTabPress={setActiveTab} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  body: { flex: 1 },
});
