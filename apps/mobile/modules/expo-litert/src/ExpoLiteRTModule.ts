import { requireNativeModule } from 'expo-modules-core';
import type { NativeModule } from 'expo-modules-core';

export type NativeGenerateResult = {
  text: string;
  toolCalls: Array<{ id: string; name: string; arguments: string }> | null;
  thinking?: string | null;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  maxTokensRequested: number;
};

export interface ExpoLiteRTNativeModule extends NativeModule {
  downloadModel(raw: Record<string, unknown>): Promise<Record<string, unknown>>;
  loadModel(raw: Record<string, unknown>): Promise<Record<string, unknown>>;
  unloadModel(modelId: string): Promise<void>;
  unloadAllModels(): Promise<void>;
  generateText(raw: Record<string, unknown>): Promise<NativeGenerateResult>;
  generateStream(modelId: string, requestJson: string, autoExecuteTools?: boolean): Promise<string>;
  cancelGeneration(streamId: string): Promise<void>;
  encodeImage(imagePath: string): Promise<string>;
  encodeImageBase64(base64Data: string): Promise<string>;
  getModelInfo(modelId: string): Promise<Record<string, unknown>>;
  listLoadedModels(): Promise<Record<string, unknown>[]>;
  getModelsDir(): Promise<string>;
  listModelFiles(): Promise<Record<string, unknown>[]>;
  deleteModelFile(filePath: string): Promise<void>;
}

export default requireNativeModule<ExpoLiteRTNativeModule>('expo-litert');