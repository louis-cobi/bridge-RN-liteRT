import React, { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { z } from 'zod';
import { theme } from '../lib/theme';

type Props = {
  onAdd: (def: { name: string; description: string; schemaText: string }) => void;
};

export function ToolsEditor({ onAdd }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaText, setSchemaText] = useState(
    JSON.stringify(
      {
        type: 'object',
        properties: { q: { type: 'string', description: 'requête' } },
        required: ['q'],
      },
      null,
      2
    )
  );
  const [err, setErr] = useState<string | null>(null);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Nom</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholderTextColor={theme.muted} />
      <Text style={styles.label}>Description</Text>
      <TextInput
        style={styles.input}
        value={description}
        onChangeText={setDescription}
        placeholderTextColor={theme.muted}
      />
      <Text style={styles.label}>Paramètres (JSON Schema)</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={schemaText}
        onChangeText={setSchemaText}
        placeholderTextColor={theme.muted}
      />
      {err && <Text style={styles.err}>{err}</Text>}
      <Button
        title="Valider et ajouter (JSON)"
        color={theme.accent}
        onPress={() => {
          try {
            const parsed = JSON.parse(schemaText);
            z
              .object({
                type: z.literal('object'),
                properties: z.record(z.string(), z.any()),
                required: z.array(z.string()).optional(),
              })
              .parse(parsed);
            setErr(null);
            onAdd({ name, description, schemaText });
          } catch (e) {
            setErr(e instanceof Error ? e.message : 'JSON invalide');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: theme.muted, fontSize: 12 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
    color: theme.text,
    backgroundColor: theme.surface,
  },
  multiline: { minHeight: 120, textAlignVertical: 'top', fontFamily: 'monospace', fontSize: 12 },
  err: { color: '#f87171' },
});
