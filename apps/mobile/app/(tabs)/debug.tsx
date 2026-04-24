import React, { useState } from 'react';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';
import { generateText, loadModel, type Message } from 'expo-litert';
import { useModelSettings } from '../../context/ModelContext';
import { theme } from '../../lib/theme';

export default function DebugScreen() {
  const { settings } = useModelSettings();
  const [logs, setLogs] = useState<string[]>([]);

  const log = (m: string) => setLogs((p) => [`${new Date().toISOString()} ${m}`, ...p].slice(0, 80));

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.pad}>
      <Button
        title="Test loadModel"
        onPress={async () => {
          try {
            if (!settings.modelPath) {
              log('modelPath vide');
              return;
            }
            const i = await loadModel({ modelPath: settings.modelPath, useGpu: settings.useGpu });
            log(`ModelInfo: ${JSON.stringify(i)}`);
          } catch (e) {
            log(String(e));
          }
        }}
      />
      <Button
        title="Test generateText"
        onPress={async () => {
          try {
            if (!settings.modelId) {
              log('modelId manquant');
              return;
            }
            const messages: Message[] = [
              { role: 'user', content: 'Dis bonjour en une phrase.' },
            ];
            const r = await generateText({ modelId: settings.modelId, messages });
            log(`Réponse: ${r.text.slice(0, 200)}…`);
          } catch (e) {
            log(String(e));
          }
        }}
      />
      <Button
        title="Test image encode"
        onPress={async () => {
          log('Sélectionnez une image via le chat (ce bouton est un placeholder).');
        }}
      />
      <View style={styles.logBox}>
        {logs.map((l, i) => (
          <Text key={i} style={styles.logLine}>
            {l}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  pad: { padding: 12, gap: 10, paddingBottom: 40 },
  logBox: {
    marginTop: 12,
    padding: 8,
    backgroundColor: theme.surface,
    borderRadius: 8,
    maxHeight: 400,
  },
  logLine: { color: theme.muted, fontSize: 11, fontFamily: 'monospace', marginBottom: 4 },
});
