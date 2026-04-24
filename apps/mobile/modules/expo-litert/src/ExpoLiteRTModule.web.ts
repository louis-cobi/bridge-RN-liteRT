import type { ExpoLiteRTNativeModule } from './ExpoLiteRTModule';

const notAvailable = async () => {
  throw new Error('expo-litert: module natif indisponible sur le web');
};

export default {
  loadModel: notAvailable,
  unloadModel: notAvailable,
  generateText: notAvailable,
  generateStream: notAvailable,
  cancelGeneration: notAvailable,
  encodeImage: notAvailable,
  getModelInfo: notAvailable,
  listLoadedModels: async () => [],
  addListener: () => ({ remove: () => {} }),
  removeListeners: () => {},
} as unknown as ExpoLiteRTNativeModule;
