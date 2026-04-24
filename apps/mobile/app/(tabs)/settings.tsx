import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Button,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useModelSettings } from '../../context/ModelContext';
import { useLiteRT } from '../../hooks/useLiteRT';
import { theme } from '../../lib/theme';
import { documentDirectory } from 'expo-file-system/legacy';
import { downloadLitertlmFile, getModelsDirectory } from '../../lib/downloadLitertModel';
import { HF_LITERT_LM_MODELS_URL, MODEL_PRESETS, type ModelPreset } from '../../lib/modelPresets';

export default function SettingsScreen() {
  const { settings, setSettings } = useModelSettings();
  const { loadModel, isLoading, error, modelInfo, loadProgress } = useLiteRT();
  const [selectedPresetId, setSelectedPresetId] = useState(MODEL_PRESETS[0]?.id ?? '');
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    ratio: number;
    label: string;
  } | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const selectedPreset = useMemo(
    () => MODEL_PRESETS.find((p) => p.id === selectedPresetId) ?? MODEL_PRESETS[0],
    [selectedPresetId]
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.pad}>
      <Text style={styles.sectionTitle}>Télécharger un modèle (.litertlm)</Text>
      <Text style={styles.hint}>
        Fichiers hébergés sur Hugging Face (format LiteRT-LM). Connexion Wi‑Fi recommandée ; tailles
        indicatives (~1–3,4 Go).
      </Text>
      <Pressable onPress={() => Linking.openURL(HF_LITERT_LM_MODELS_URL)}>
        <Text style={styles.link}>Catalogue Hub : modèles « litert-lm »</Text>
      </Pressable>

      {MODEL_PRESETS.map((p: ModelPreset) => {
        const on = p.id === selectedPreset?.id;
        return (
          <Pressable
            key={p.id}
            onPress={() => setSelectedPresetId(p.id)}
            style={[styles.presetCard, on && styles.presetCardSelected]}
          >
            <Text style={styles.presetLabel}>{p.label}</Text>
            <Text style={styles.presetDesc}>{p.description}</Text>
          </Pressable>
        );
      })}

      <Text style={styles.meta}>Dossier local : {getModelsDirectory()}/</Text>

      <Button
        title={
          isDownloading
            ? 'Téléchargement…'
            : `Télécharger : ${selectedPreset?.fileName ?? '…'}`
        }
        color={theme.accent}
        onPress={async () => {
          if (!selectedPreset) return;
          setDownloadError(null);
          setDownloadProgress({ ratio: 0, label: 'Démarrage…' });
          setIsDownloading(true);
          try {
            const { fsPath } = await downloadLitertlmFile({
              url: selectedPreset.url,
              fileName: selectedPreset.fileName,
              onProgress: (ev) => {
                const pct = Math.round(ev.ratio * 100);
                const mb =
                  ev.totalBytes > 0
                    ? `${(ev.bytesWritten / 1e6).toFixed(0)} / ${(ev.totalBytes / 1e6).toFixed(0)} Mo`
                    : `${(ev.bytesWritten / 1e6).toFixed(0)} Mo`;
                setDownloadProgress({
                  ratio: ev.ratio,
                  label: ev.totalBytes > 0 ? `${pct}% — ${mb}` : mb,
                });
              },
            });
            setSettings({ modelPath: fsPath });
            setDownloadProgress({ ratio: 1, label: 'Terminé — chemin mis à jour' });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setDownloadError(msg);
            setDownloadProgress(null);
          } finally {
            setIsDownloading(false);
          }
        }}
        disabled={isDownloading || !selectedPreset}
      />
      {isDownloading && (
        <View style={styles.rowCenter}>
          <ActivityIndicator color={theme.accent} />
        </View>
      )}
      {downloadProgress && <Text style={styles.meta}>{downloadProgress.label}</Text>}
      {downloadError && <Text style={styles.err}>{downloadError}</Text>}

      <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Chemin modèle (.litertlm)</Text>
      <TextInput
        style={styles.input}
        placeholder="/chemin/vers/modele.litertlm"
        placeholderTextColor={theme.muted}
        value={settings.modelPath}
        onChangeText={(modelPath) => setSettings({ modelPath })}
      />
      <Text style={styles.hint}>
        Ex. dossier téléchargé : {documentDirectory}models/…
      </Text>
      <Button
        title={isLoading ? 'Chargement…' : 'Charger le modèle'}
        color={theme.accent}
        onPress={async () => {
          const info = await loadModel({
            modelPath: settings.modelPath,
            useGpu: settings.useGpu,
          });
          setSettings({ modelId: info.modelId });
        }}
        disabled={isLoading || !settings.modelPath}
      />
      {loadProgress && (
        <Text style={styles.meta}>
          {loadProgress.status} ({Math.round(loadProgress.progress * 100)}%)
        </Text>
      )}
      {error && <Text style={styles.err}>{error.message}</Text>}
      {modelInfo && (
        <Text style={styles.meta}>
          Chargé : {modelInfo.name} ({modelInfo.modelId})
        </Text>
      )}

      <Text style={[styles.label, { marginTop: 20 }]}>Température</Text>
      <Text style={styles.meta}>{settings.temperature.toFixed(2)}</Text>
      <Button title="+0.1" onPress={() => setSettings({ temperature: Math.min(2, settings.temperature + 0.1) })} />
      <Button title="-0.1" onPress={() => setSettings({ temperature: Math.max(0, settings.temperature - 0.1) })} />

      <Text style={[styles.label, { marginTop: 16 }]}>Top-P</Text>
      <Text style={styles.meta}>{settings.topP.toFixed(2)}</Text>
      <Button title="+0.05" onPress={() => setSettings({ topP: Math.min(1, settings.topP + 0.05) })} />
      <Button title="-0.05" onPress={() => setSettings({ topP: Math.max(0, settings.topP - 0.05) })} />

      <Text style={[styles.label, { marginTop: 16 }]}>Max tokens</Text>
      <Text style={styles.meta}>{settings.maxTokens}</Text>
      <Button title="+128" onPress={() => setSettings({ maxTokens: Math.min(4096, settings.maxTokens + 128) })} />
      <Button title="-128" onPress={() => setSettings({ maxTokens: Math.max(128, settings.maxTokens - 128) })} />

      <View style={styles.row}>
        <Text style={styles.label}>GPU</Text>
        <Button
          title={settings.useGpu ? 'Oui' : 'Non'}
          onPress={() => setSettings({ useGpu: !settings.useGpu })}
        />
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Streaming</Text>
        <Button
          title={settings.streaming ? 'Oui' : 'Non'}
          onPress={() => setSettings({ streaming: !settings.streaming })}
        />
      </View>

      <Text style={[styles.label, { marginTop: 16 }]}>System prompt</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        multiline
        value={settings.systemPrompt}
        onChangeText={(systemPrompt) => setSettings({ systemPrompt })}
        placeholderTextColor={theme.muted}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  pad: { padding: 16, gap: 8, paddingBottom: 48 },
  sectionTitle: { color: theme.text, fontWeight: '700', fontSize: 16 },
  label: { color: theme.text, fontWeight: '600' },
  hint: { color: theme.muted, fontSize: 11 },
  link: { color: theme.accent, textDecorationLine: 'underline', fontSize: 13, marginBottom: 8 },
  presetCard: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: theme.surface,
  },
  presetCardSelected: { borderColor: theme.accent, borderWidth: 2 },
  presetLabel: { color: theme.text, fontWeight: '600' },
  presetDesc: { color: theme.muted, fontSize: 12, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 8,
    padding: 10,
    color: theme.text,
    backgroundColor: theme.surface,
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  meta: { color: theme.muted, fontSize: 12 },
  err: { color: '#f87171' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCenter: { alignItems: 'center', paddingVertical: 4 },
});
