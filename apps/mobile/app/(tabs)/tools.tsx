import React from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useToolRegistry } from '../../tools/toolRegistry';
import { ToolsEditor } from '../../components/ToolsEditor';
import { theme } from '../../lib/theme';
import type { Tool } from 'expo-litert';
import { z } from 'zod';

export default function ToolsScreen() {
  const { allTools, tools, enableTool, disableTool, addCustomTool } = useToolRegistry();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.pad}>
      <Text style={styles.h}>Outils natifs</Text>
      {allTools.map((t) => {
        const on = tools.some((x) => x.definition.name === t.definition.name);
        return (
          <View key={t.definition.name} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{t.definition.name}</Text>
              <Text style={styles.desc}>{t.definition.description}</Text>
            </View>
            <Switch
              value={on}
              onValueChange={(v) => (v ? enableTool(t.definition.name) : disableTool(t.definition.name))}
            />
          </View>
        );
      })}
      <Text style={[styles.h, { marginTop: 24 }]}>Ajouter un outil (stub)</Text>
      <ToolsEditor
        onAdd={({ name, description, schemaText }) => {
          const schema = JSON.parse(schemaText) as Tool['definition']['parameters'];
          const stub: Tool = {
            definition: { name, description, parameters: schema },
            parameterSchema: z.record(z.string(), z.any()),
            execute: async () =>
              JSON.stringify({ message: 'Handler personnalisé non branché (stub).' }),
          };
          addCustomTool(stub);
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  pad: { padding: 16, paddingBottom: 48 },
  h: { color: theme.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  name: { color: theme.text, fontWeight: '600' },
  desc: { color: theme.muted, fontSize: 12, marginTop: 2 },
});
