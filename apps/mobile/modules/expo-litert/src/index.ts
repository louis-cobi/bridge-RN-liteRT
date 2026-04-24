import { EventEmitter, type EventSubscription } from 'expo-modules-core';
import { z } from 'zod';
import Native from './ExpoLiteRTModule';

const emitter = new EventEmitter(Native);

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: z.string(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

const ContentPartSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({
    type: z.literal('image'),
    imageBase64: z.string(),
    mimeType: z.string().optional(),
  }),
]);

export const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([z.string(), z.array(ContentPartSchema)]),
  toolCallId: z.string().optional(),
  name: z.string().optional(),
  toolCalls: z.array(ToolCallSchema).optional(),
});

export type Message = z.infer<typeof MessageSchema>;

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(z.string(), z.any()),
    required: z.array(z.string()).optional(),
  }),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export type ModelInfo = {
  modelId: string;
  name: string;
  path?: string;
  maxTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsMtp?: boolean;
};

export type LoadModelOptions = {
  modelPath: string;
  modelId?: string;
  useGpu?: boolean;
  useNpu?: boolean;
  enableMtp?: boolean;
  maxTokens?: number;
  maxImages?: number;
};

export type GenerateParams = {
  modelId: string;
  messages: Message[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  channels?: string[];
  autoExecuteTools?: boolean;
};

export type GenerateResult = {
  text: string;
  toolCalls: ToolCall[] | null;
  thinking?: string | null;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  maxTokensRequested: number;
};

export type StreamCallbacks = {
  onToken?: (payload: { token: string; done: boolean; tokenCount?: number; channel?: string }) => void;
  onToolCall?: (payload: { toolCall: ToolCall }) => void;
  onError?: (err: Error) => void;
};

export type DownloadProgress = {
  progress: number;
  status: string;
  downloadedSize?: number;
  totalSize?: number;
};

export type DownloadResult = {
  localPath: string;
  fileName: string;
  size: number;
};

export type DownloadOptions = {
  repoId?: string;
  fileName?: string;
  token?: string;
};

export type ImageContent = {
  type: 'image';
  imageBase64: string;
  mimeType: string;
};

export type ModelFile = {
  name: string;
  path: string;
  size: number;
};

export function defineTool<T extends z.ZodObject<z.ZodRawShape>>(config: {
  name: string;
  description: string;
  parameters: T;
  execute: (args: z.infer<T>) => Promise<string>;
}) {
  const json = config.parameters.toJSONSchema() as Record<string, unknown>;
  const properties = (json.properties ?? {}) as Record<string, unknown>;
  const required = Array.isArray(json.required) ? (json.required as string[]) : undefined;
  const definition: ToolDefinition = {
    name: config.name,
    description: config.description,
    parameters: {
      type: 'object',
      properties,
      required,
    },
  };
  return {
    definition,
    parameterSchema: config.parameters,
    execute: config.execute,
  };
}

function toNativeMessages(messages: Message[]): Record<string, unknown>[] {
  return messages.map((m) => {
    const base: Record<string, unknown> = {
      role: m.role,
      content: m.content,
    };
    if (m.toolCallId) base.toolCallId = m.toolCallId;
    if (m.name) base.name = m.name;
    if (m.toolCalls) base.toolCalls = m.toolCalls;
    return base;
  });
}

function toNativeTools(tools: ToolDefinition[] | undefined): Record<string, unknown>[] {
  if (!tools?.length) return [];
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

export function normalizeModelPath(modelPath: string): string {
  const p = modelPath.trim();
  if (p.startsWith('file://')) {
    return p.slice('file://'.length);
  }
  return p;
}

export async function downloadModel(
  options: DownloadOptions = {},
  onProgress?: (progress: DownloadProgress) => void
): Promise<DownloadResult> {
  const sub = onProgress
    ? emitter.addListener('onDownloadProgress', (e: Record<string, unknown>) => {
        onProgress({
          progress: Number(e.progress ?? 0),
          status: String(e.status ?? ''),
          downloadedSize: e.downloadedSize as number | undefined,
          totalSize: e.totalSize as number | undefined,
        });
      })
    : undefined;

  try {
    const result = await Native.downloadModel({
      repoId: options.repoId ?? 'litert-community/gemma-4-E2B-it-litert-lm',
      fileName: options.fileName ?? 'gemma-4-E2B-it-litert-lm.litertlm',
      token: options.token,
    });
    return {
      localPath: String(result.localPath),
      fileName: String(result.fileName),
      size: Number(result.size),
    };
  } finally {
    sub?.remove();
  }
}

export async function loadModel(options: LoadModelOptions): Promise<ModelInfo> {
  const raw = await Native.loadModel({
    modelPath: normalizeModelPath(options.modelPath),
    modelId: options.modelId,
    useGpu: options.useGpu ?? false,
    useNpu: options.useNpu ?? false,
    enableMtp: options.enableMtp ?? false,
    maxTokens: options.maxTokens,
    maxImages: options.maxImages,
  });
  return {
    modelId: String(raw.modelId),
    name: String(raw.name),
    path: String(raw.path ?? ''),
    maxTokens: Number(raw.maxTokens ?? 4096),
    supportsVision: Boolean(raw.supportsVision),
    supportsTools: Boolean(raw.supportsTools),
    supportsMtp: Boolean(raw.supportsMtp),
  };
}

export async function unloadModel(modelId: string): Promise<void> {
  await Native.unloadModel(modelId);
}

export async function unloadAllModels(): Promise<void> {
  await Native.unloadAllModels();
}

export async function generateText(params: GenerateParams): Promise<GenerateResult> {
  MessageSchema.array().parse(params.messages);
  const raw: NativeGenerateResult = await Native.generateText({
    modelId: params.modelId,
    requestJson: JSON.stringify({
      messages: toNativeMessages(params.messages),
      tools: toNativeTools(params.tools),
      maxTokens: params.maxTokens ?? 512,
      temperature: params.temperature ?? 0.7,
      topP: params.topP ?? 0.9,
    }),
    autoExecuteTools: params.autoExecuteTools ?? false,
  });
  const toolCalls = raw.toolCalls?.length
    ? raw.toolCalls.map((t) => ToolCallSchema.parse(t))
    : null;
  return {
    text: raw.text,
    toolCalls,
    thinking: raw.thinking as string | null,
    promptTokens: raw.promptTokens,
    completionTokens: raw.completionTokens,
    durationMs: raw.durationMs,
    maxTokensRequested: raw.maxTokensRequested,
  };
}

export async function generateStream(
  params: GenerateParams,
  callbacks: StreamCallbacks
): Promise<() => void> {
  MessageSchema.array().parse(params.messages);
  const streamId = await Native.generateStream(
    params.modelId,
    JSON.stringify({
      messages: toNativeMessages(params.messages),
      tools: toNativeTools(params.tools),
      maxTokens: params.maxTokens ?? 512,
      temperature: params.temperature ?? 0.7,
      topP: params.topP ?? 0.9,
    }),
    params.autoExecuteTools ?? false
  );

  const subs: EventSubscription[] = [];
  subs.push(
    emitter.addListener('onToken', (e: Record<string, unknown>) => {
      if (e.streamId !== streamId) return;
      callbacks.onToken?.({
        token: String(e.token ?? ''),
        done: Boolean(e.done),
        tokenCount: e.tokenCount as number | undefined,
        channel: e.channel as string | undefined,
      });
    })
  );
  subs.push(
    emitter.addListener('onToolCall', (e: Record<string, unknown>) => {
      if (e.streamId !== streamId) return;
      const tc = e.toolCall as Record<string, unknown> | undefined;
      if (tc) {
        callbacks.onToolCall?.({
          toolCall: ToolCallSchema.parse({
            id: String(tc.id ?? 'call'),
            name: String(tc.name),
            arguments: String(tc.arguments ?? '{}'),
          }),
        });
      }
    })
  );
  subs.push(
    emitter.addListener('onError', (e: Record<string, unknown>) => {
      if (e.streamId !== streamId) return;
      const msg = typeof e.message === 'string' && e.message ? e.message : 'Erreur streaming LiteRT';
      callbacks.onError?.(new Error(msg));
    })
  );

  return () => {
    subs.forEach((s) => s.remove());
    void Native.cancelGeneration(streamId);
  };
}

export async function cancelGeneration(streamId: string): Promise<void> {
  await Native.cancelGeneration(streamId);
}

export async function encodeImageForChat(uri: string): Promise<ImageContent> {
  const imagePath = uri.replace(/^file:\/\//, '');
  const imageBase64 = await Native.encodeImage(imagePath);
  return { type: 'image', imageBase64, mimeType: 'image/jpeg' };
}

export async function encodeImageBase64(base64Data: string): Promise<string> {
  return await Native.encodeImageBase64(base64Data);
}

export async function getModelInfo(modelId: string): Promise<ModelInfo> {
  const raw = await Native.getModelInfo(modelId);
  return {
    modelId: String(raw.modelId),
    name: String(raw.name),
    path: String(raw.path ?? ''),
    maxTokens: Number(raw.maxTokens ?? 4096),
    supportsVision: Boolean(raw.supportsVision),
    supportsTools: Boolean(raw.supportsTools),
    supportsMtp: Boolean(raw.supportsMtp),
  };
}

export async function listLoadedModels(): Promise<ModelInfo[]> {
  const raw = await Native.listLoadedModels();
  return raw.map((r: Record<string, unknown>) => ({
    modelId: String(r.modelId),
    name: String(r.name),
    maxTokens: Number(r.maxTokens ?? 4096),
    supportsVision: Boolean(r.supportsVision),
    supportsTools: Boolean(r.supportsTools),
    supportsMtp: Boolean(r.supportsMtp),
  }));
}

export async function getModelsDir(): Promise<string> {
  return await Native.getModelsDir();
}

export async function listModelFiles(): Promise<ModelFile[]> {
  const raw = await Native.listModelFiles();
  return raw.map((r: Record<string, unknown>) => ({
    name: String(r.name),
    path: String(r.path),
    size: Number(r.size),
  }));
}

export async function deleteModelFile(filePath: string): Promise<void> {
  await Native.deleteModelFile(filePath);
}

export function addLiteRTListener(
  event: 'onModelLoadProgress' | 'onDownloadProgress' | 'onToken' | 'onToolCall' | 'onError',
  listener: (data: Record<string, unknown>) => void
): EventSubscription {
  return emitter.addListener(event, listener);
}

export { Native };