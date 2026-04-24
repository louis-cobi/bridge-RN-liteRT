import { useCallback, useRef, useState } from 'react';
import {
  generateStream,
  generateText,
  type GenerateParams,
  type Message,
  type Tool,
  type ToolCall,
} from 'expo-litert';

const MAX_TOOL_ITER = 10;

export type ChatOptions = {
  modelId: string;
  tools?: Tool[];
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  streaming?: boolean;
  onToolCall?: (call: ToolCall) => Promise<string>;
};

export function useChat(options: ChatOptions) {
  const [messages, setMessages] = useState<Message[]>(() =>
    options.systemPrompt
      ? [{ role: 'system', content: options.systemPrompt }]
      : []
  );
  const [isGenerating, setIsGenerating] = useState(false);
  /** Dernière vitesse de génération (texte intégral ou streaming), tok/s. */
  const [tokensPerSec, setTokensPerSec] = useState<number | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  /** Résout l’attente de fin de stream (done, erreur, ou stop utilisateur). */
  const streamEndRef = useRef<(() => void) | null>(null);

  const runAssistant = useCallback(
    async (history: Message[]) => {
      const paramsBase: Omit<GenerateParams, 'messages'> = {
        modelId: options.modelId,
        tools: options.tools?.map((t) => t.definition),
        temperature: options.temperature ?? 0.7,
        topP: options.topP ?? 0.9,
        maxTokens: options.maxTokens ?? 512,
      };

      let iter = 0;
      let working = [...history];

      while (iter < MAX_TOOL_ITER) {
        iter += 1;
        const res = await generateText({
          ...paramsBase,
          messages: working,
        });

        if (res.toolCalls?.length && options.onToolCall) {
          const assistantMsg: Message = {
            role: 'assistant',
            content: res.text,
            toolCalls: res.toolCalls,
          };
          working = [...working, assistantMsg];
          setMessages(working);

          for (const call of res.toolCalls) {
            const result = await options.onToolCall(call);
            working.push({
              role: 'tool',
              toolCallId: call.id,
              name: call.name,
              content: result,
            });
          }
          setMessages(working);
          continue;
        }

        const assistantMsg: Message = {
          role: 'assistant',
          content: res.text,
        };
        working = [...working, assistantMsg];
        setMessages(working);
        if (res.durationMs > 0) {
          setTokensPerSec(res.completionTokens / (res.durationMs / 1000));
        }
        return;
      }

      setMessages([
        ...working,
        {
          role: 'assistant',
          content: 'Boucle d’outils interrompue (limite de sécurité).',
        },
      ]);
    },
    [options]
  );

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isGenerating) return;
      const hasTools = (options.tools?.length ?? 0) > 0;
      const useStream = Boolean(options.streaming) && !hasTools;

      const userMsg: Message = { role: 'user', content: text.trim() };
      const next = [...messages, userMsg];
      setMessages(next);
      setIsGenerating(true);
      try {
        if (useStream) {
          const assistantDraft: Message = { role: 'assistant', content: '' };
          setMessages([...next, assistantDraft]);

          const streamDone = new Promise<void>((resolve) => {
            streamEndRef.current = () => {
              streamEndRef.current = null;
              resolve();
            };
          });
          const t0 = Date.now();
          const finishStream = () => {
            stopRef.current = null;
            const end = streamEndRef.current;
            if (end) {
              streamEndRef.current = null;
              end();
            }
          };

          const cancel = await generateStream(
            {
              modelId: options.modelId,
              messages: next,
              tools: undefined,
              temperature: options.temperature ?? 0.7,
              topP: options.topP ?? 0.9,
              maxTokens: options.maxTokens ?? 512,
              stream: true,
            },
            {
              onToken: ({ token, done, tokenCount: tc }) => {
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last?.role === 'assistant') {
                    copy[copy.length - 1] = {
                      ...last,
                      content: (typeof last.content === 'string' ? last.content : '') + token,
                    };
                  }
                  return copy;
                });
                if (done) {
                  const ms = Date.now() - t0;
                  if (ms > 0 && tc != null && tc > 0) {
                    setTokensPerSec(tc / (ms / 1000));
                  }
                  finishStream();
                }
              },
              onError: () => {
                finishStream();
              },
            }
          );
          stopRef.current = cancel;
          await streamDone;
        } else {
          await runAssistant(next);
        }
      } finally {
        setIsGenerating(false);
      }
    },
    [messages, isGenerating, options, runAssistant]
  );

  const sendImage = useCallback(
    async (parts: Message['content']) => {
      if (isGenerating) return;
      const userMsg: Message = { role: 'user', content: parts };
      const next = [...messages, userMsg];
      setMessages(next);
      setIsGenerating(true);
      try {
        await runAssistant(next);
      } finally {
        setIsGenerating(false);
      }
    },
    [messages, isGenerating, runAssistant]
  );

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    const end = streamEndRef.current;
    if (end) {
      streamEndRef.current = null;
      end();
    }
    setIsGenerating(false);
  }, []);

  const clear = useCallback(() => {
    setMessages(
      options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []
    );
  }, [options.systemPrompt]);

  return {
    messages,
    sendMessage,
    sendImage,
    isGenerating,
    stop,
    clear,
    tokensPerSec,
  };
}

export async function executeRegisteredTool(
  tools: Tool[],
  call: ToolCall
): Promise<string> {
  const tool = tools.find((t) => t.definition.name === call.name);
  if (!tool) return JSON.stringify({ error: `Outil inconnu: ${call.name}` });
  try {
    const args = JSON.parse(call.arguments || '{}');
    const parsed = tool.parameterSchema.safeParse(args);
    if (!parsed.success) {
      return JSON.stringify({ error: parsed.error.message });
    }
    return await tool.execute(parsed.data);
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
  }
}
