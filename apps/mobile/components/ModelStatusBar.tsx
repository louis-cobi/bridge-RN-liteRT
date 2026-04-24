import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../lib/theme';

type Props = {
  modelName?: string;
  tokensPerSec?: number;
  backendLabel?: string;
  status?: string;
};

export function ModelStatusBar({ modelName, tokensPerSec, backendLabel, status }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{modelName ?? 'Aucun modèle'}</Text>
      <Text style={styles.meta}>
        {tokensPerSec != null ? `${tokensPerSec.toFixed(1)} tok/s · ` : ''}
        {backendLabel ?? 'CPU'}
        {status ? ` · ${status}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  title: {
    color: theme.text,
    fontWeight: '600',
    fontSize: 15,
  },
  meta: {
    color: theme.muted,
    fontSize: 12,
    marginTop: 2,
  },
});
