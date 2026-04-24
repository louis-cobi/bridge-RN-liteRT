import * as FileSystem from 'expo-file-system/legacy';

const MODELS_SUBDIR = 'models';

export type DownloadProgressPayload = {
  bytesWritten: number;
  totalBytes: number;
  ratio: number;
};

export function getModelsDirectory(): string {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error('documentDirectory indisponible');
  }
  return `${base}${MODELS_SUBDIR}`;
}

async function ensureModelsDir(): Promise<string> {
  const dir = getModelsDirectory();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

/**
 * Télécharge un .litertlm depuis une URL Hugging Face (resolve/.../fichier.litertlm)
 * vers documentDirectory/models/fileName.
 */
export async function downloadLitertlmFile(options: {
  url: string;
  fileName: string;
  onProgress?: (p: DownloadProgressPayload) => void;
}): Promise<{ localUri: string; fsPath: string }> {
  const dir = await ensureModelsDir();
  const dest = `${dir}/${options.fileName}`;

  const existing = await FileSystem.getInfoAsync(dest);
  if (existing.exists) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
  }

  const resumable = FileSystem.createDownloadResumable(
    options.url,
    dest,
    {
      headers: {
        Accept: '*/*',
        'User-Agent': 'LiteRT-RN/1.0 (Expo; model download)',
      },
    },
    (progress) => {
      const total = progress.totalBytesExpectedToWrite ?? 0;
      const written = progress.totalBytesWritten;
      options.onProgress?.({
        bytesWritten: written,
        totalBytes: total,
        ratio: total > 0 ? written / total : 0,
      });
    }
  );

  const result = await resumable.downloadAsync();
  if (!result?.uri) {
    throw new Error('Téléchargement terminé sans URI locale');
  }

  const fsPath = fileUriToFsPath(result.uri);
  return { localUri: result.uri, fsPath };
}

/** Chemin utilisable par File natif Android / chargement (sans préfixe file://). */
export function fileUriToFsPath(uri: string): string {
  const t = uri.trim();
  if (t.startsWith('file://')) {
    return t.slice('file://'.length);
  }
  return t;
}
