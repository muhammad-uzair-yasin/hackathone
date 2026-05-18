import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FontFamily, pageStyles } from '../theme';
import type { OrchestratorTodo } from '../types/agent';

function TodoIcon({ status }: { status: OrchestratorTodo['status'] }) {
  if (status === 'completed') {
    return <Ionicons name="checkmark-circle" size={18} color="#059669" />;
  }
  if (status === 'in_progress') {
    return <Ionicons name="ellipse" size={18} color="#2563EB" />;
  }
  return <Ionicons name="ellipse-outline" size={18} color="#9CA3AF" />;
}

interface Props {
  todos: OrchestratorTodo[];
  waiting?: boolean;
}

export default function OrchestratorTodoList({ todos, waiting }: Props) {
  if (!todos.length && !waiting) return null;

  return (
    <View style={pageStyles.card}>
      <Text style={styles.title}>Orchestrator plan</Text>
      {!todos.length && waiting ? (
        <Text style={styles.waiting}>Planning steps…</Text>
      ) : (
        todos.map((t) => (
          <View key={t.id} style={styles.row}>
            <TodoIcon status={t.status} />
            <Text
              style={[
                styles.content,
                t.status === 'completed' && styles.done,
                t.status === 'in_progress' && styles.active,
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
  title: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14,
    color: '#111827',
    marginBottom: 12,
  },
  waiting: { fontFamily: FontFamily.regular, fontSize: 14, color: '#6B7280' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  content: { flex: 1, fontFamily: FontFamily.regular, fontSize: 14, lineHeight: 20, color: '#111827' },
  active: { fontFamily: FontFamily.semiBold, color: '#2563EB' },
  done: { color: '#6B7280', textDecorationLine: 'line-through' },
});
