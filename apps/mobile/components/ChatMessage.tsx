import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Message } from 'expo-litert';
import { theme } from '../lib/theme';
import { ToolCallBubble } from './ToolCallBubble';

type Props = { message: Message };

export function ChatMessage({ message }: Props) {
  if (message.role === 'system') {
    return (
      <View style={styles.rowSystem}>
        <Text style={styles.systemText}>{String(message.content)}</Text>
      </View>
    );
  }

  if (message.role === 'tool') {
    return (
      <View style={styles.rowTool}>
        <View style={styles.toolResult}>
          <Text style={styles.toolLabel}>Outil · {message.name ?? '…'}</Text>
          <Text style={styles.toolBody}>{String(message.content)}</Text>
        </View>
      </View>
    );
  }

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';
  const textStyle = isUser ? styles.textUser : styles.text;

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {Array.isArray(message.content) ? (
          message.content.map((part, i) =>
            part.type === 'text' ? (
              <Text key={i} style={textStyle}>
                {part.text}
              </Text>
            ) : (
              <Image
                key={i}
                source={{ uri: `data:${part.mimeType ?? 'image/jpeg'};base64,${part.imageBase64}` }}
                style={styles.img}
              />
            )
          )
        ) : (
          <Text style={textStyle}>{message.content}</Text>
        )}
        {isAssistant && message.toolCalls?.map((tc) => (
          <ToolCallBubble
            key={tc.id}
            name={tc.name}
            argsJson={tc.arguments}
            pending={false}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginVertical: 4,
    paddingHorizontal: 12,
    flexDirection: 'row',
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  rowSystem: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    alignItems: 'center',
  },
  systemText: { color: theme.muted, fontSize: 12, textAlign: 'center' },
  rowTool: { paddingHorizontal: 12, marginVertical: 2, alignItems: 'flex-start' },
  toolResult: {
    maxWidth: '92%',
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#12101a',
    borderWidth: 1,
    borderColor: theme.border,
  },
  toolLabel: { color: theme.muted, fontSize: 11, marginBottom: 6 },
  toolBody: { color: theme.text, fontSize: 13, fontFamily: 'monospace' },
  bubble: {
    maxWidth: '88%',
    padding: 12,
    borderRadius: 14,
  },
  bubbleUser: {
    backgroundColor: theme.accent,
  },
  bubbleAssistant: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  text: {
    color: theme.text,
    fontSize: 15,
    lineHeight: 22,
  },
  textUser: {
    color: '#f8fafc',
    fontSize: 15,
    lineHeight: 22,
  },
  img: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 6,
  },
});
