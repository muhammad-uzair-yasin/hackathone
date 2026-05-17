import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import GlassCard from './GlassCard';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';

interface Props {
  markdown: string;
  fileName?: string;
  defaultOpen?: boolean;
}

/** Lightweight markdown-ish view (no extra deps) */
function MarkdownBody({ text }: { text: string }) {
  const lines = text.split('\n');

  return (
    <View>
      {lines.map((line, i) => {
        const trimmed = line.trimEnd();
        if (!trimmed) return <View key={i} style={{ height: 8 }} />;

        if (trimmed.startsWith('### ')) {
          return (
            <Text key={i} style={styles.h3}>
              {trimmed.slice(4)}
            </Text>
          );
        }
        if (trimmed.startsWith('## ')) {
          return (
            <Text key={i} style={styles.h2}>
              {trimmed.slice(3)}
            </Text>
          );
        }
        if (trimmed.startsWith('# ')) {
          return (
            <Text key={i} style={styles.h1}>
              {trimmed.slice(2)}
            </Text>
          );
        }
        if (trimmed.startsWith('- ')) {
          return (
            <Text key={i} style={styles.bullet}>
              {'• '}
              {stripBold(trimmed.slice(2))}
            </Text>
          );
        }

        return (
          <Text key={i} style={styles.p}>
            {stripBold(trimmed)}
          </Text>
        );
      })}
    </View>
  );
}

function stripBold(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, '$1');
}

/** Displays the agent run summary from summary.md (not reason.md). */
export default function ReasonMarkdownPanel({
  markdown,
  fileName = 'summary.md',
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <GlassCard style={styles.wrap}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen((o) => !o)} activeOpacity={0.8}>
        <View>
          <Text style={styles.label}>Why the route changed</Text>
          <Text style={styles.file}>{fileName}</Text>
        </View>
        <Text style={styles.chevron}>{open ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      {open ? (
        <ScrollView style={styles.scroll} nestedScrollEnabled>
          <MarkdownBody text={markdown} />
        </ScrollView>
      ) : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 0, marginBottom: Spacing.md, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: `${Colors.primary}10`,
  },
  label: { ...Typography.labelMD, color: Colors.primary, textTransform: 'uppercase' },
  file: { ...Typography.bodySM, color: Colors.onSurfaceVariant, marginTop: 2 },
  chevron: { color: Colors.outline, fontSize: 12 },
  scroll: { maxHeight: 420, paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  h1: { ...Typography.headlineSM, color: Colors.onSurface, marginTop: Spacing.sm, marginBottom: Spacing.xs },
  h2: { ...Typography.bodyMD, fontWeight: '700', color: Colors.onSurface, marginTop: Spacing.md, marginBottom: 4 },
  h3: { ...Typography.labelMD, fontWeight: '700', color: Colors.primary, marginTop: Spacing.sm, marginBottom: 2 },
  p: { ...Typography.bodySM, color: Colors.onSurface, lineHeight: 20, marginBottom: 4 },
  bullet: { ...Typography.bodySM, color: Colors.onSurfaceVariant, lineHeight: 20, marginLeft: 4, marginBottom: 2 },
});
