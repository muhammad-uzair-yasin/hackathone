import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassCard from './GlassCard';
import { FontFamily, Page } from '../theme';

interface Props {
  markdown: string;
  fileName?: string;
  defaultOpen?: boolean;
}

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

export default function ReasonMarkdownPanel({
  markdown,
  fileName = 'summary.md',
  defaultOpen = true,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <GlassCard style={styles.wrap}>
      <TouchableOpacity style={styles.header} onPress={() => setOpen((o) => !o)} activeOpacity={0.7}>
        <View style={styles.headerLeft}>
          <Ionicons name="document-text-outline" size={18} color={Page.primary} />
          <View>
            <Text style={styles.label}>Run summary</Text>
            <Text style={styles.file}>{fileName}</Text>
          </View>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#9CA3AF" />
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
  wrap: { marginBottom: 16, padding: 0 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Page.border,
    gap: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  label: { fontFamily: FontFamily.semiBold, fontSize: 14, color: '#111827' },
  file: { fontFamily: FontFamily.regular, fontSize: 12, color: '#6B7280', marginTop: 2 },
  scroll: { maxHeight: 400, padding: 16 },
  h1: { fontFamily: FontFamily.bold, fontSize: 17, color: '#111827', marginBottom: 6 },
  h2: { fontFamily: FontFamily.semiBold, fontSize: 15, color: '#111827', marginTop: 12, marginBottom: 4 },
  h3: { fontFamily: FontFamily.semiBold, fontSize: 13, color: Page.primary, marginTop: 8 },
  p: { fontFamily: FontFamily.regular, fontSize: 14, color: '#374151', lineHeight: 21, marginBottom: 4 },
  bullet: { fontFamily: FontFamily.regular, fontSize: 14, color: '#6B7280', lineHeight: 21, marginLeft: 4 },
});
