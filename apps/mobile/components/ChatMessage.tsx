import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { Message } from 'expo-litert';
import { theme } from '../lib/theme';
import { ToolCallBubble } from './ToolCallBubble';

type Props = { message: Message };

export function ChatMessage({ message }: Props) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        {Array.isArray(message.content) ? (
          message.content.map((part, i) =>
            part.type === 'text' ? (
              <Text key={i} style={styles.text}>
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
          <Text style={styles.text}>{message.content}</Text>
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
  img: {
    width: 200,
    height: 200,
    borderRadius: 8,
    marginTop: 6,
  },
});
