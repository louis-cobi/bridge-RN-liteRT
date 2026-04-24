import React, { createContext, useContext, useMemo, useState } from 'react';
import { createMMKV } from 'react-native-mmkv';

const s = createMMKV({ id: 'litert-settings' });

export type ModelSettings = {
  modelPath: string;
  modelId: string | null;
  temperature: number;
  topP: number;
  maxTokens: number;
  useGpu: boolean;
  streaming: boolean;
  systemPrompt: string;
};

const defaults: ModelSettings = {
  modelPath: '',
  modelId: null,
  temperature: 0.7,
  topP: 0.9,
  maxTokens: 512,
  useGpu: false,
  streaming: true,
  systemPrompt: 'Tu es un assistant utile et concis.',
};

function load(): ModelSettings {
  const raw = s.getString('settings');
  if (!raw) return defaults;
  try {
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

function save(v: ModelSettings) {
  s.set('settings', JSON.stringify(v));
}

const Ctx = createContext<{
  settings: ModelSettings;
  setSettings: (p: Partial<ModelSettings>) => void;
} | null>(null);

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSt] = useState<ModelSettings>(() => load());

  const setSettings = (p: Partial<ModelSettings>) => {
    setSt((prev) => {
      const n = { ...prev, ...p };
      save(n);
      return n;
    });
  };

  const v = useMemo(() => ({ settings, setSettings }), [settings]);
  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useModelSettings() {
  const x = useContext(Ctx);
  if (!x) throw new Error('ModelProvider manquant');
  return x;
}
