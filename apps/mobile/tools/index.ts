import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import { defineTool, type Tool } from 'expo-litert';
import { createMMKV } from 'react-native-mmkv';
import { z } from 'zod';
import { evaluate } from 'mathjs';

const memoryStorage = createMMKV({ id: 'litert-memory' });
const REMINDERS_KEY = 'reminders_json';
const CONVO_KEY = 'convo_log';

function appendConvoLine(line: string) {
  const prev = memoryStorage.getString(CONVO_KEY) ?? '';
  memoryStorage.set(CONVO_KEY, `${prev}\n${line}`.slice(-8000));
}

export const toolCurrentDatetime = defineTool({
  name: 'current_datetime',
  description: 'Retourne la date et l’heure actuelles.',
  parameters: z.object({
    timezone: z.string().optional(),
    format: z.enum(['iso', 'human']).optional(),
  }),
  execute: async ({ format }) => {
    const d = new Date();
    if (format === 'human') {
      return d.toLocaleString();
    }
    return d.toISOString();
  },
});

export const toolCalculate = defineTool({
  name: 'calculate',
  description: 'Évalue une expression mathématique (mathjs, mode restreint).',
  parameters: z.object({
    expression: z.string(),
  }),
  execute: async ({ expression }) => {
    try {
      const v = evaluate(expression);
      return String(v);
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
    }
  },
});

export const toolGetDeviceInfo = defineTool({
  name: 'get_device_info',
  description: 'Infos appareil (plateforme, modèle, mémoire si dispo).',
  parameters: z.object({}),
  execute: async () => {
    return JSON.stringify({
      platform: Device.osName,
      model: Device.modelName,
      brand: Device.brand,
      totalMemory: Device.totalMemory,
    });
  },
});

export const toolReadClipboard = defineTool({
  name: 'read_clipboard',
  description: 'Lit le presse-papiers texte.',
  parameters: z.object({}),
  execute: async () => {
    const t = await Clipboard.getStringAsync();
    return t ?? '';
  },
});

export const toolCreateReminder = defineTool({
  name: 'create_reminder',
  description: 'Stocke un rappel fictif localement (mock).',
  parameters: z.object({
    title: z.string(),
    datetime: z.string(),
    notes: z.string().optional(),
  }),
  execute: async (args) => {
    const raw = memoryStorage.getString(REMINDERS_KEY);
    const list = raw ? (JSON.parse(raw) as unknown[]) : [];
    list.push(args);
    memoryStorage.set(REMINDERS_KEY, JSON.stringify(list));
    return JSON.stringify({ ok: true, id: list.length });
  },
});

export const toolSearchMemory = defineTool({
  name: 'search_memory',
  description: 'Recherche textuelle simple dans l’historique stocké (MMKV).',
  parameters: z.object({
    query: z.string(),
  }),
  execute: async ({ query }) => {
    const log = memoryStorage.getString(CONVO_KEY) ?? '';
    const lines = log.split('\n').filter(Boolean);
    const q = query.toLowerCase();
    const hits = lines.filter((l) => l.toLowerCase().includes(q)).slice(-3);
    return JSON.stringify({ matches: hits });
  },
});

export const toolFetchUrl = defineTool({
  name: 'fetch_url',
  description: 'Récupère une URL et extrait un extrait texte (basique).',
  parameters: z.object({
    url: z.string().url(),
    selector: z.string().optional(),
  }),
  execute: async ({ url }) => {
    try {
      const res = await fetch(url);
      const text = await res.text();
      return text.slice(0, 4000);
    } catch (e) {
      return JSON.stringify({ error: e instanceof Error ? e.message : String(e) });
    }
  },
});

export const nativeTools: Tool[] = [
  toolCurrentDatetime,
  toolCalculate,
  toolGetDeviceInfo,
  toolReadClipboard,
  toolCreateReminder,
  toolSearchMemory,
  toolFetchUrl,
];

export function logUserMessageForMemory(text: string) {
  appendConvoLine(`user: ${text}`);
}

export function logAssistantForMemory(text: string) {
  appendConvoLine(`assistant: ${text}`);
}
