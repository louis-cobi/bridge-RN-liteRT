import React, { useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useChat, executeRegisteredTool } from '../../hooks/useChat';
import { useToolRegistry } from '../../tools/toolRegistry';
import { useModelSettings } from '../../context/ModelContext';
import { ChatMessage } from '../../components/ChatMessage';
import { ModelStatusBar } from '../../components/ModelStatusBar';
import { encodeImageForChat } from 'expo-litert';
import { theme } from '../../lib/theme';
export default function ChatScreen() {
  const { settings } = useModelSettings();
  const { tools } = useToolRegistry();
  const [input, setInput] = React.useState('');
  const listRef = useRef<FlatList>(null);

  const { messages, sendMessage, sendImage, isGenerating, stop, clear } = useChat({
    modelId: settings.modelId ?? '',
    tools,
    systemPrompt: settings.systemPrompt,
    temperature: settings.temperature,
    topP: settings.topP,
    maxTokens: settings.maxTokens,
    streaming: settings.streaming,
    onToolCall: async (call) => executeRegisteredTool(tools, call),
  });

  const canSend = Boolean(settings.modelId) && !isGenerating;

  const onSend = async () => {
    if (!input.trim() || !canSend) return;
    await sendMessage(input);
    setInput('');
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={80}
    >
      <ModelStatusBar
        modelName={settings.modelId ? settings.modelPath.split('/').pop() : undefined}
        backendLabel={settings.useGpu ? 'GPU' : 'CPU'}
        status={settings.modelId ? 'prêt' : 'chargez un modèle'}
      />
      <FlatList
        ref={listRef}
        data={messages}
        inverted
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <ChatMessage message={item} />}
        contentContainerStyle={styles.list}
      />
      {isGenerating && (
        <View style={styles.typing}>
          <ActivityIndicator color={theme.accent} />
          <Text style={styles.typingText}>Génération…</Text>
        </View>
      )}
      <View style={styles.inputRow}>
        <Pressable
          style={styles.iconBtn}
          onPress={async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) return;
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ImagePicker.MediaTypeOptions.Images,
              quality: 0.8,
            });
            if (res.canceled || !settings.modelId) return;
            const uri = res.assets[0].uri;
            const img = await encodeImageForChat(uri);
            await sendImage([
              { type: 'text', text: 'Décris cette image.' },
              { type: 'image', imageBase64: img.imageBase64, mimeType: img.mimeType },
            ]);
          }}
        >
          <Text style={styles.iconTxt}>🖼</Text>
        </Pressable>
        <TextInput
          style={styles.input}
          placeholder="Message…"
          placeholderTextColor={theme.muted}
          value={input}
          onChangeText={setInput}
          multiline
          editable={Boolean(settings.modelId)}
        />
        {isGenerating ? (
          <Pressable style={styles.sendBtn} onPress={stop}>
            <Text style={styles.sendTxt}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.sendBtn} onPress={onSend} disabled={!canSend}>
            <Text style={styles.sendTxt}>Envoyer</Text>
          </Pressable>
        )}
        <Pressable onPress={clear}>
          <Text style={styles.clear}>Effacer</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  list: { paddingVertical: 12 },
  typing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  typingText: { color: theme.muted },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
    backgroundColor: theme.surface,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: theme.text,
  },
  sendBtn: {
    backgroundColor: theme.accent,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  sendTxt: { color: '#fff', fontWeight: '600' },
  iconBtn: { padding: 8 },
  iconTxt: { fontSize: 22 },
  clear: { color: theme.muted, fontSize: 12 },
});
