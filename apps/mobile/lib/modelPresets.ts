/**
 * Modèles au format .litertlm listés sur le Hub Hugging Face (filtre library=litert-lm).
 * URLs « resolve/main » : téléchargement direct du fichier LFS (comme l’app Gallery).
 *
 * @see https://huggingface.co/models?library=litert-lm
 */
export type ModelPreset = {
  id: string;
  label: string;
  description: string;
  approximateSizeGb: number;
  /** URL HTTPS directe vers le fichier .litertlm */
  url: string;
  /** Nom du fichier local sous documentDirectory/models/ */
  fileName: string;
};

export const MODEL_PRESETS: ModelPreset[] = [
  {
    id: 'qwen35-2b-q4',
    label: 'Qwen3.5 2B (int4, ~1,0 Go)',
    description:
      'Le plus léger de cette liste — repo paulsp94/Qwen3.5-2B-LiteRT-LM, fichier qwen35_2b_q4.litertlm.',
    approximateSizeGb: 1.0,
    url: 'https://huggingface.co/paulsp94/Qwen3.5-2B-LiteRT-LM/resolve/main/qwen35_2b_q4.litertlm',
    fileName: 'qwen35_2b_q4.litertlm',
  },
  {
    id: 'gemma4-e2b-litert-community',
    label: 'Gemma 4 E2B IT (~2,4 Go)',
    description:
      'Très téléchargé sur le Hub — litert-community/gemma-4-E2B-it-litert-lm (Apache-2.0).',
    approximateSizeGb: 2.4,
    url: 'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it.litertlm',
    fileName: 'gemma-4-E2B-it.litertlm',
  },
  {
    id: 'gemma3n-e2b-google-int4',
    label: 'Gemma 3n E2B IT int4 — Google (~3,4 Go)',
    description:
      'Modèle officiel google/gemma-3n-E2B-it-litert-lm (licence Gemma). Fichier gemma-3n-E2B-it-int4.litertlm.',
    approximateSizeGb: 3.4,
    url: 'https://huggingface.co/google/gemma-3n-E2B-it-litert-lm/resolve/main/gemma-3n-E2B-it-int4.litertlm',
    fileName: 'gemma-3n-E2B-it-int4.litertlm',
  },
];

export const HF_LITERT_LM_MODELS_URL = 'https://huggingface.co/models?library=litert-lm';
