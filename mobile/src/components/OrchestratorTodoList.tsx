import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography, Spacing, BorderRadius } from '../theme';
import type { OrchestratorTodo } from '../types/agent';

function todoIcon(status: OrchestratorTodo['status']): string {
  if (status === 'completed') return '✓';
  if (status === 'in_progress') return '◉';
  return '○';
}

interface Props {
  todos: OrchestratorTodo[];
  waiting?: boolean;
}

export default function OrchestratorTodoList({ todos, waiting }: Props) {
  if (!todos.length && !waiting) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Orchestrator plan</Text>
      {!todos.length && waiting ? (
        <Text style={styles.waiting}>Planning steps…</Text>
      ) : (
        todos.map((t) => (
          <View key={t.id} style={styles.row}>
            <Text
              style={[
                styles.icon,
                t.status === 'completed' && styles.iconDone,
                t.status === 'in_progress' && styles.iconActive,
              ]}
            >
              {todoIcon(t.status)}
            </Text>
            <Text
              style={[
                styles.content,
                t.status === 'completed' && styles.contentDone,
                t.status === 'in_progress' && styles.contentActive,
              ]}
            >
              {t.content}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: Colors.surfaceContainerLow,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: `${Colors.outlineVariant}44`,
  },
  title: { ...Typography.labelMD, color: Colors.outline, marginBottom: Spacing.sm },
  waiting: { ...Typography.bodySM, color: Colors.onSurfaceVariant, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, marginBottom: Spacing.xs },
  icon: { fontSize: 12, color: Colors.outline, marginTop: 2, width: 16 },
  iconActive: { color: Colors.primary },
  iconDone: { color: '#059669' },
  content: { ...Typography.bodySM, color: Colors.onSurface, flex: 1 },
  contentActive: { color: Colors.primary, fontWeight: '600' },
  contentDone: { color: Colors.onSurfaceVariant, textDecorationLine: 'line-through' },
});
