import React, { useState } from 'react';
import { LayoutAnimation, Pressable, StyleSheet, Text, UIManager, View } from 'react-native';
import { theme } from '../lib/theme';

if (UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Props = {
  name: string;
  argsJson: string;
  result?: string;
  pending?: boolean;
};

export function ToolCallBubble({ name, argsJson, result, pending }: Props) {
  const [open, setOpen] = useState(true);
  return (
    <Pressable
      onPress={() => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setOpen(!open);
      }}
      style={styles.wrap}
    >
      <Text style={styles.header}>
        {pending ? '⏳ ' : '🔧 '}
        {name}
      </Text>
      {open && (
        <View>
          <Text style={styles.code}>{argsJson}</Text>
          {result != null && <Text style={styles.result}>{result}</Text>}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginVertical: 4,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#1a1525',
    borderWidth: 1,
    borderColor: theme.accent + '55',
  },
  header: {
    color: theme.accent,
    fontWeight: '600',
  },
  code: {
    marginTop: 6,
    color: theme.muted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  result: {
    marginTop: 8,
    color: theme.text,
    fontSize: 12,
  },
});
