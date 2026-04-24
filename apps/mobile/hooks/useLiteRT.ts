import { useCallback, useState } from 'react';
import {
  addLiteRTListener,
  loadModel as nativeLoad,
  type LoadModelOptions,
  type ModelInfo,
} from 'expo-litert';

export function useLiteRT() {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loadProgress, setLoadProgress] = useState<{ progress: number; status: string } | null>(
    null
  );

  const loadModel = useCallback(async (options: LoadModelOptions) => {
    setIsLoading(true);
    setError(null);
    setLoadProgress(null);
    const sub = addLiteRTListener('onModelLoadProgress', (e) => {
      setLoadProgress({
        progress: Number(e.progress ?? 0),
        status: String(e.status ?? ''),
      });
    });
    try {
      const info = await nativeLoad(options);
      setModelInfo(info);
      setIsReady(true);
      return info;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      setIsReady(false);
      throw err;
    } finally {
      sub.remove();
      setIsLoading(false);
    }
  }, []);

  return { loadModel, isLoading, isReady, error, modelInfo, loadProgress };
}
