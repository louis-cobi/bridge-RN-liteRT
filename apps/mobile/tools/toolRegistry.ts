import { useCallback, useMemo, useState } from 'react';
import { createMMKV } from 'react-native-mmkv';
import type { Tool, ToolDefinition } from 'expo-litert';
import { nativeTools } from './index';

const storage = createMMKV({ id: 'litert-tool-registry' });
const KEY = 'enabled_tool_names';

function loadEnabled(): Set<string> {
  const raw = storage.getString(KEY);
  if (!raw) {
    return new Set(nativeTools.map((t) => t.definition.name));
  }
  try {
    const arr = JSON.parse(raw) as string[];
    return new Set(arr);
  } catch {
    return new Set(nativeTools.map((t) => t.definition.name));
  }
}

function saveEnabled(set: Set<string>) {
  storage.set(KEY, JSON.stringify([...set]));
}

let customToolsStore: Tool[] = [];

export function useToolRegistry() {
  const [enabled, setEnabled] = useState<Set<string>>(() => loadEnabled());
  const [customRev, setCustomRev] = useState(0);

  const allTools = useMemo(
    () => [...nativeTools, ...customToolsStore],
    [customRev]
  );

  const tools = useMemo(
    () => allTools.filter((t) => enabled.has(t.definition.name)),
    [allTools, enabled]
  );

  const enableTool = useCallback((name: string) => {
    setEnabled((prev) => {
      const n = new Set(prev);
      n.add(name);
      saveEnabled(n);
      return n;
    });
  }, []);

  const disableTool = useCallback((name: string) => {
    setEnabled((prev) => {
      const n = new Set(prev);
      n.delete(name);
      saveEnabled(n);
      return n;
    });
  }, []);

  const addCustomTool = useCallback(
    (tool: Tool) => {
      customToolsStore = [...customToolsStore, tool];
      setCustomRev((r) => r + 1);
      setEnabled((prev) => {
        const n = new Set(prev);
        n.add(tool.definition.name);
        saveEnabled(n);
        return n;
      });
    },
    []
  );

  return { tools, enableTool, disableTool, addCustomTool, allTools };
}

export function toolDefinitionFromJson(
  name: string,
  description: string,
  schema: ToolDefinition['parameters']
): ToolDefinition {
  return { name, description, parameters: schema };
}

export function __resetCustomToolsForTests() {
  customToolsStore = [];
}
