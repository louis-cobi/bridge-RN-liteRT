/**
 * API TypeScript unifiée pour le bridge LiteRT-LM (Android + iOS stub).
 */
import { EventEmitter, type EventSubscription } from 'expo-modules-core';
import { z } from 'zod';
import Native from './ExpoLiteRTModule';
import type { NativeGenerateResult } from './ExpoLiteRTModule';

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
  maxTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
};

export type LoadModelOptions = {
  modelPath: string;
  modelId?: string;
  useGpu?: boolean;
};

export type GenerateParams = {
  modelId: string;
  messages: Message[];
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
};

export type GenerateResult = {
  text: string;
  toolCalls: ToolCall[] | null;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
};

export type StreamCallbacks = {
  onToken?: (payload: { token: string; done: boolean; tokenCount?: number }) => void;
  onToolCall?: (payload: { toolCall: ToolCall }) => void;
  onError?: (err: Error) => void;
};

export type ImageContent = {
  type: 'image';
  imageBase64: string;
  mimeType: string;
};

export type Tool<T extends z.ZodTypeAny = z.ZodTypeAny> = {
  definition: ToolDefinition;
  parameterSchema: T;
  execute: (args: z.infer<T>) => Promise<string>;
};

export function defineTool<T extends z.ZodObject<z.ZodRawShape>>(config: {
  name: string;
  description: string;
  parameters: T;
  execute: (args: z.infer<T>) => Promise<string>;
}): Tool<T> {
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

/**
 * Le bridge Expo → Kotlin n’accepte que des POJO sérialisables (pas de proxies Zod, etc.).
 * Sans ça, generateStream peut lever « Cannot convert '[object Object]' to a Kotlin type ».
 */
function toNativeBridgePayload(payload: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(payload, (_k, v) => (v === undefined ? null : v))) as Record<
    string,
    unknown
  >;
}

/** Android File() n’accepte pas les URI file:// — normaliser avant le bridge natif. */
export function normalizeModelPath(modelPath: string): string {
  const p = modelPath.trim();
  if (p.startsWith('file://')) {
    return p.slice('file://'.length);
  }
  return p;
}

export async function loadModel(options: LoadModelOptions): Promise<ModelInfo> {
  const raw = await Native.loadModel({
    modelPath: normalizeModelPath(options.modelPath),
    modelId: options.modelId,
    useGpu: options.useGpu ?? false,
  });
  return {
    modelId: String(raw.modelId),
    name: String(raw.name),
    maxTokens: Number(raw.maxTokens ?? 4096),
    supportsVision: Boolean(raw.supportsVision),
    supportsTools: Boolean(raw.supportsTools),
  };
}

export async function unloadModel(modelId: string): Promise<void> {
  await Native.unloadModel(modelId);
}

export async function generateText(params: GenerateParams): Promise<GenerateResult> {
  MessageSchema.array().parse(params.messages);
  const raw: NativeGenerateResult = await Native.generateText(
    toNativeBridgePayload({
      modelId: params.modelId,
      messages: toNativeMessages(params.messages),
      tools: toNativeTools(params.tools),
      maxTokens: params.maxTokens ?? 512,
      temperature: params.temperature ?? 0.7,
      topP: params.topP ?? 0.9,
      stream: params.stream ?? false,
    })
  );
  const toolCalls = raw.toolCalls?.length
    ? raw.toolCalls.map((t) => ToolCallSchema.parse(t))
    : null;
  return {
    text: raw.text,
    toolCalls,
    promptTokens: raw.promptTokens,
    completionTokens: raw.completionTokens,
    durationMs: raw.durationMs,
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
      stream: true,
    })
  );

  const subs: EventSubscription[] = [];
  subs.push(
    emitter.addListener('onToken', (e: Record<string, unknown>) => {
      if (e.streamId !== streamId) return;
      callbacks.onToken?.({
        token: String(e.token ?? ''),
        done: Boolean(e.done),
        tokenCount: e.tokenCount as number | undefined,
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
    emitter.addListener('onError', () => {
      callbacks.onError?.(new Error('Erreur streaming LiteRT'));
    })
  );

  return () => {
    subs.forEach((s) => s.remove());
    void Native.cancelGeneration(streamId);
  };
}

export async function encodeImageForChat(uri: string): Promise<ImageContent> {
  const imagePath = uri.replace(/^file:\/\//, '');
  const imageBase64 = await Native.encodeImage(imagePath);
  return { type: 'image', imageBase64, mimeType: 'image/jpeg' };
}

export function addLiteRTListener(
  event: 'onModelLoadProgress' | 'onToken' | 'onToolCall' | 'onError',
  listener: (data: Record<string, unknown>) => void
): EventSubscription {
  return emitter.addListener(event, listener);
}

export { Native };
