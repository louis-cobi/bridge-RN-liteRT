import { requireNativeModule } from 'expo-modules-core';
import type { NativeModule } from 'expo-modules-core';

export type NativeGenerateResult = {
  text: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }> | null;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  maxTokensRequested?: number;
};

export interface ExpoLiteRTNativeModule extends NativeModule {
  loadModel(raw: Record<string, unknown>): Promise<Record<string, unknown>>;
  unloadModel(modelId: string): Promise<void>;
  generateText(raw: Record<string, unknown>): Promise<NativeGenerateResult>;
  /** Corps messages/outils en JSON — évite les limites du bridge sur les objets imbriqués (Android). */
  generateStream(modelId: string, requestJson: string): Promise<string>;
  cancelGeneration(streamId: string): Promise<void>;
  encodeImage(imagePath: string): Promise<string>;
  getModelInfo(modelId: string): Promise<Record<string, unknown>>;
  listLoadedModels(): Promise<Record<string, unknown>[]>;
}

export default requireNativeModule<ExpoLiteRTNativeModule>('expo-litert');
