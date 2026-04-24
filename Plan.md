# 🧠 LiteRT × React Native — Plan Complet
## Bridge Kotlin/Swift + Chat IA Multimodal (Gemma 4 Quantized)

> **Ce document est un prompt maître structuré en phases.**  
> Chaque phase peut être donnée telle quelle à un assistant IA (Claude, Copilot…) pour implémenter le code correspondant.

---

## 🗺️ Vue d'ensemble du projet

```
litert-rn/
├── apps/
│   └── mobile/                    ← App Expo (bare workflow)
│       ├── app/                   ← Expo Router (tabs)
│       ├── components/            ← Chat UI, Tool Viewer, etc.
│       └── hooks/                 ← useLiteRT, useChat, useTools
├── modules/
│   └── expo-litert/               ← Expo Module natif
│       ├── android/               ← Bridge Kotlin
│       ├── ios/                   ← Bridge Swift
│       └── src/                   ← API JS/TS unifiée
└── scripts/
    └── download-model.sh          ← Téléchargement Gemma 4 quantized
```

**Stack :**
- **Expo SDK 52+** (bare workflow) + **Expo Router v3**
- **Kotlin** (Android) → LiteRT Kotlin SDK
- **Swift** (iOS) → LiteRT Swift SDK
- **TypeScript** strict + **Zod** pour les tool schemas
- **React Native Reanimated 3** pour les animations
- **MMKV** pour le stockage local (historique, config)

---

## PHASE 0 — Scaffolding du projet

### Prompt Phase 0

```
Tu es un expert React Native / Expo. Crée la structure initiale du projet suivant.

OBJECTIF : Initialiser un monorepo contenant :
1. Une app Expo en bare workflow (pas Expo Go)
2. Un module natif Expo vide "expo-litert"
3. La configuration TypeScript stricte partagée

COMMANDES À EXÉCUTER DANS L'ORDRE :

# 1. Créer l'app Expo bare
npx create-expo-app@latest litert-rn --template bare-minimum
cd litert-rn

# 2. Scaffolder le module natif
npx create-expo-module@latest modules/expo-litert --local

# 3. Installer les dépendances communes
npx expo install expo-router react-native-reanimated react-native-gesture-handler
npx expo install react-native-mmkv zod

# 4. Structure des dossiers
mkdir -p apps/mobile/app apps/mobile/components apps/mobile/hooks scripts

FICHIERS À CRÉER :

--- tsconfig.json (racine) ---
{
  "compilerOptions": {
    "strict": true,
    "moduleResolution": "bundler",
    "jsx": "react-native",
    "paths": {
      "expo-litert": ["./modules/expo-litert/src/index.ts"]
    }
  }
}

--- apps/mobile/app.json ---
Configurer avec :
- scheme: "litert-rn"
- plugins: ["expo-router", "./modules/expo-litert"]
- android.package: "com.litert.rn"
- ios.bundleIdentifier: "com.litert.rn"

--- scripts/download-model.sh ---
#!/bin/bash
# Télécharge Gemma 4 E2B quantized depuis HuggingFace
MODEL_DIR="./assets/models"
mkdir -p $MODEL_DIR

echo "Téléchargement de Gemma 4 E2B quantized (INT4)..."
# URL du modèle .litertlm sur HuggingFace (google/gemma-4-e2b-it-litert-preview)
huggingface-cli download google/gemma-4-e2b-it-litert-preview \
  --include "*.litertlm" \
  --local-dir $MODEL_DIR

echo "Modèle téléchargé dans $MODEL_DIR"

Génère tous ces fichiers avec leur contenu complet. Explique chaque choix structurel.
```

---

## PHASE 1 — Bridge Kotlin (Android)

### Prompt Phase 1A — Setup Gradle

```
Tu es un expert Android / Kotlin. Configure le bridge LiteRT pour Android dans le module Expo.

CONTEXTE : Le fichier est modules/expo-litert/android/build.gradle

DÉPENDANCES À AJOUTER dans build.gradle :
- com.google.ai.edge.litert:litert-lm:0.2.0  (SDK LiteRT officiel Google)
- com.google.ai.edge.litert:litert-lm-gpu:0.2.0 (accélération GPU optionnelle)
- NDK r28b configuré (abiFilters arm64-v8a, x86_64)

CONFIGURATION REQUISE :
- minSdk 26 (requis LiteRT)
- Java 17
- Activer les large heap: android:largeHeap="true" dans AndroidManifest
- Permission: READ_EXTERNAL_STORAGE pour lire les modèles

Génère le build.gradle complet avec toutes ces configurations.
```

### Prompt Phase 1B — Module Kotlin principal

```
Tu es un expert Kotlin / Android. Implémente le module Expo natif LiteRT.

FICHIER : modules/expo-litert/android/src/main/java/expo/modules/litert/ExpoLiteRTModule.kt

CE MODULE DOIT EXPOSER LES FONCTIONS ASYNC SUIVANTES :

1. loadModel(modelPath: String): Promise<ModelInfo>
   - Charge un modèle .litertlm depuis le système de fichiers
   - Retourne { modelId, name, maxTokens, supportsVision, supportsTools }
   - Gère les erreurs (fichier manquant, mémoire insuffisante)
   - Émet un événement "onModelLoadProgress" avec { progress: 0.0-1.0, status: string }

2. unloadModel(modelId: String): Promise<void>
   - Libère proprement la mémoire

3. generateText(params: GenerateParams): Promise<GenerateResult>
   params = {
     modelId: String,
     messages: Message[],           // historique complet
     tools: ToolDefinition[],       // outils disponibles (optionnel)
     maxTokens: Int = 512,
     temperature: Float = 0.7,
     topP: Float = 0.9,
     stream: Boolean = false        // si true, émet des events
   }
   GenerateResult = {
     text: String,
     toolCalls: ToolCall[] | null,  // si le modèle appelle un outil
     promptTokens: Int,
     completionTokens: Int,
     durationMs: Long
   }

4. generateStream(params: GenerateParams): Promise<String>  (retourne un streamId)
   - Lance la génération en streaming
   - Émet des événements "onToken" { streamId, token, done }
   - Émet "onToolCall" { streamId, toolCall } si le modèle appelle un outil

5. cancelGeneration(streamId: String): Promise<void>

6. encodeImage(imagePath: String): Promise<String>  
   - Encode une image en base64 pour l'input multimodal
   - Resize automatique si > 1024px

7. getModelInfo(modelId: String): Promise<ModelInfo>

8. listLoadedModels(): Promise<ModelInfo[]>

EVENTS À ÉMETTRE (sendEvent) :
- "onModelLoadProgress": { modelId, progress, status }
- "onToken": { streamId, token, done, tokenCount }
- "onToolCall": { streamId, toolCall: { name, arguments } }
- "onError": { modelId, code, message }

TYPES KOTLIN À DÉFINIR :
data class Message(
  val role: String,          // "user" | "assistant" | "system" | "tool"
  val content: Any,          // String ou List<ContentPart> pour multimodal
  val toolCallId: String?,   // si role == "tool"
  val name: String?          // si role == "tool"
)

data class ContentPart(
  val type: String,          // "text" | "image"
  val text: String?,
  val imageBase64: String?
)

data class ToolDefinition(
  val name: String,
  val description: String,
  val parameters: Map<String, Any>  // JSON Schema
)

data class ToolCall(
  val id: String,
  val name: String,
  val arguments: String    // JSON string
)

IMPORTANT :
- Utilise LlmInference du SDK com.google.ai.edge.litert
- Gère le thread principal vs background (utiliser CoroutineScope(Dispatchers.IO))
- Stocke les sessions actives dans une Map<String, LlmInference>
- Format des messages : convertir vers le format LiteRT avant envoi
- Pour le streaming : utiliser LlmInference.generateResponseAsync avec callback

Génère le fichier Kotlin complet avec gestion d'erreurs robuste.
```

### Prompt Phase 1C — Tool Calling Kotlin

```
Tu es un expert en LLM tool calling et Kotlin.

CONTEXTE : Dans ExpoLiteRTModule.kt, implémente la logique de parsing du tool calling.

Le point le plus délicat sera le format des tool calls — Gemma utilise son propre format, pas OpenAI, donc le ToolCallParser (Phase 1C) sera à ajuster selon les tests réels.
LiteRT/Gemma utilise un format de tool calling basé sur les function calls OpenAI-compatible.
Le modèle peut retourner dans sa réponse texte des blocs JSON structurés de ce format :

```json
{
  "tool_calls": [
    {
      "id": "call_abc123",
      "type": "function",
      "function": {
        "name": "get_weather",
        "arguments": "{\"location\": \"Paris\", \"unit\": \"celsius\"}"
      }
    }
  ]
}
```

FICHIER À CRÉER : ToolCallParser.kt

Implémente une classe ToolCallParser avec :

1. fun parseResponse(rawText: String): ParsedResponse
   ParsedResponse = { text: String, toolCalls: List<ToolCall>? }
   - Détecte si la réponse contient un appel d'outil
   - Parse le JSON des tool calls
   - Retourne le texte "propre" + les tool calls séparément

2. fun buildSystemPromptWithTools(tools: List<ToolDefinition>): String
   - Formate les outils en JSON Schema dans le system prompt
   - Utilise le format que Gemma 4 comprend pour les tools

3. fun buildToolResultMessage(toolCallId: String, result: String): Message
   - Construit le message "tool" avec le résultat

4. fun validateToolCall(toolCall: ToolCall, toolDef: ToolDefinition): Boolean
   - Vérifie que les arguments correspondent au schema

Génère ToolCallParser.kt complet.
```

---

## PHASE 2 — Bridge Swift (iOS)

### Prompt Phase 2A — Setup Package Swift

```
Tu es un expert iOS / Swift. Configure le bridge LiteRT pour iOS dans le module Expo.

FICHIER : modules/expo-litert/ios/ExpoLiteRT.podspec

DÉPENDANCES :
- pod 'LiteRTLm', '~> 0.2.0'   (SDK LiteRT Swift officiel)
- iOS deployment target : 16.0 minimum

AUSSI créer Package.swift si nécessaire pour SPM.

Configuration requise :
- Swift 5.9+
- Enable Metal pour accélération GPU
- Info.plist : NSPhotoLibraryUsageDescription pour accès images

Génère le podspec complet.
```

### Prompt Phase 2B — Module Swift principal

```
Tu es un expert Swift / iOS. Implémente le module Expo natif LiteRT pour iOS.

FICHIER : modules/expo-litert/ios/ExpoLiteRTModule.swift

Implémente EXACTEMENT les mêmes fonctions que le module Kotlin (Phase 1B) mais en Swift :
- loadModel, unloadModel, generateText, generateStream, cancelGeneration
- encodeImage, getModelInfo, listLoadedModels
- Mêmes events : onModelLoadProgress, onToken, onToolCall, onError

SPÉCIFICITÉS iOS :
- Utiliser LlmInference du SDK Swift LiteRT
- Utiliser Task { } et async/await pour le background threading
- Gérer les sessions dans [String: LlmInference] dictionary
- Pour le streaming : utiliser le callback-based API de LiteRT Swift
- Encoder les images avec UIImage → resize → base64

TYPES SWIFT :
struct Message: Codable { ... }
struct ContentPart: Codable { ... }  
struct ToolDefinition: Codable { ... }
struct ToolCall: Codable { ... }

Inclure aussi ToolCallParser.swift avec la même logique que le Kotlin.

Génère le fichier Swift complet.
```

---

## PHASE 3 — API TypeScript unifiée

### Prompt Phase 3

```
Tu es un expert TypeScript / React Native. Crée l'API JS unifiée du module expo-litert.

FICHIER : modules/expo-litert/src/index.ts

En utilisant expo-modules-core, expose une API TypeScript propre et typée.

TYPES À DÉFINIR (avec Zod pour la validation runtime) :

import { z } from 'zod';

const MessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: z.union([
    z.string(),
    z.array(z.discriminatedUnion('type', [
      z.object({ type: z.literal('text'), text: z.string() }),
      z.object({ type: z.literal('image'), imageBase64: z.string(), mimeType: z.string() })
    ]))
  ]),
  toolCallId: z.string().optional(),
  name: z.string().optional(),
  toolCalls: z.array(ToolCallSchema).optional()
});

const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.object({
    type: z.literal('object'),
    properties: z.record(z.object({
      type: z.string(),
      description: z.string().optional(),
      enum: z.array(z.string()).optional()
    })),
    required: z.array(z.string()).optional()
  })
});

// Helper pour créer des tools depuis des fonctions TS typées
export function defineTool<T extends z.ZodObject<any>>(config: {
  name: string,
  description: string,
  parameters: T,
  execute: (args: z.infer<T>) => Promise<string>
}): Tool<T>

FONCTIONS EXPORTS :
- loadModel(options: LoadModelOptions): Promise<ModelInfo>
- generateText(params: GenerateParams): Promise<GenerateResult>
- generateStream(params: GenerateParams, callbacks: StreamCallbacks): Promise<() => void>
- encodeImageForChat(uri: string): Promise<ImageContent>

HOOK PRINCIPAL À CRÉER dans apps/mobile/hooks/useLiteRT.ts :
export function useLiteRT() {
  // Gère le cycle de vie du modèle
  // Retourne: { loadModel, isLoading, isReady, error, modelInfo }
}

HOOK CHAT À CRÉER dans apps/mobile/hooks/useChat.ts :
export function useChat(options: {
  tools?: Tool[],
  systemPrompt?: string,
  onToolCall?: (call: ToolCall) => Promise<string>  // handler pour exécuter les tools
}) {
  // Retourne: { messages, sendMessage, sendImage, isGenerating, stop, clear }
  // Gère automatiquement le tool calling loop :
  // 1. Envoi message
  // 2. Si réponse contient tool_call → appelle onToolCall
  // 3. Ajoute le résultat dans le contexte
  // 4. Re-génère jusqu'à réponse finale
}

Génère tous ces fichiers TypeScript complets avec JSDoc.
```

---

## PHASE 4 — Interface de test (Chat UI)

### Prompt Phase 4

```
Tu es un expert React Native UI avec un goût prononcé pour le design. 
Crée une interface de chat IA moderne et fonctionnelle pour tester le bridge LiteRT.

FICHIERS À CRÉER :
- apps/mobile/app/(tabs)/index.tsx    ← Écran Chat principal
- apps/mobile/app/(tabs)/tools.tsx    ← Écran Tools Manager
- apps/mobile/app/(tabs)/settings.tsx ← Écran Settings (modèle, params)
- apps/mobile/components/ChatMessage.tsx
- apps/mobile/components/ToolCallBubble.tsx
- apps/mobile/components/ModelStatusBar.tsx
- apps/mobile/components/ToolsEditor.tsx

DESIGN : Dark theme, inspiré des terminaux modernes mais accessible.
Couleurs : fond #0A0A0F, accent #7C3AED (violet), texte #E2E8F0
Typographie : JetBrains Mono pour le code, Inter pour le texte normal

ÉCRAN CHAT (index.tsx) :
- Liste de messages scrollable avec FlatList inversée
- Bulles messages : user (droite, violet), assistant (gauche, gris foncé)
- Support multimodal : affiche les images dans les messages
- Indicateur de streaming (dots animés pendant la génération)
- Affichage spécial pour les Tool Calls :
  - Bulle "Tool Call" avec le nom de la fonction et les args (collapsible)
  - Bulle "Tool Result" avec le résultat
- Input bar :
  - TextField multiline
  - Bouton image (ouvre ImagePicker)
  - Bouton send (désactivé pendant génération)
  - Bouton stop (visible pendant génération)
- ModelStatusBar en haut : nom du modèle, tokens/s en temps réel, statut GPU/CPU

ÉCRAN TOOLS (tools.tsx) :
- Liste des tools définis avec toggle on/off
- Bouton "Ajouter Tool" → formulaire :
  - Nom, Description
  - Éditeur JSON Schema pour les paramètres (avec validation Zod)
  - Éditeur de la fonction "execute" (textarea avec JS eval pour tester)
- Tools pré-définis à inclure :
  1. get_current_time → retourne heure/date actuelle
  2. calculate → évalue une expression mathématique (mathjs)
  3. search_web_mock → retourne des résultats fictifs (pour tester)
  4. get_device_info → retourne infos appareil (platform, RAM, etc.)
- Bouton "Tester tool" → lance un chat avec ce tool activé

ÉCRAN SETTINGS (settings.tsx) :
- Sélecteur de modèle (liste les .litertlm dans assets/models/)
- Sliders : Temperature (0-2), Top-P (0-1), Max Tokens (128-4096)
- Toggle : GPU / CPU backend
- Toggle : Streaming mode
- System prompt configurable (textarea)
- Bouton "Effacer historique"
- Stats : tokens générés, temps moyen, mémoire utilisée

COMPOSANT ToolCallBubble :
- Affiche visuellement l'appel de tool pendant la génération
- Icône animée (spinner) tant que le résultat n'est pas arrivé
- Affiche le nom du tool + arguments formatés en JSON pretty
- Une fois résolu : affiche le résultat avec statut (success/error)
- Collapsible (tap pour expand/collapse)

Utilise react-native-reanimated pour les animations.
Utilise expo-image-picker pour la sélection d'images.
Toutes les interactions doivent être fluides et responsives.
Génère tous les composants complets et fonctionnels.
```

---

## PHASE 5 — Tools natifs pré-définis

### Prompt Phase 5

```
Tu es un expert TypeScript et React Native. 
Crée un système de tools "natifs" prêts à l'emploi pour le chat LiteRT.

FICHIER : apps/mobile/tools/index.ts

Implémente ces tools en utilisant la fonction defineTool() de expo-litert :

1. TOOL : current_datetime
   - Paramètres : { timezone?: string, format?: 'iso' | 'human' }
   - Implémentation : new Date() formatée

2. TOOL : calculate
   - Paramètres : { expression: string }
   - Implémentation : utilise mathjs pour évaluer en sandbox
   - Retourne le résultat ou l'erreur

3. TOOL : get_device_info
   - Paramètres : {} (pas de params)
   - Implémentation : Platform.OS, dimensions, RAM via expo-device

4. TOOL : read_clipboard
   - Paramètres : {}
   - Implémentation : expo-clipboard

5. TOOL : create_reminder  (mock)
   - Paramètres : { title: string, datetime: string, notes?: string }
   - Implémentation : stocke dans MMKV, retourne confirmation

6. TOOL : search_memory
   - Paramètres : { query: string }
   - Implémentation : cherche dans l'historique des conversations (MMKV)
   - Retourne les 3 messages les plus pertinents (simple keyword match)

7. TOOL : fetch_url  (optionnel, avec permission)
   - Paramètres : { url: string, selector?: string }
   - Implémentation : fetch() + extraction texte basique

Chaque tool doit avoir :
- Un JSON Schema Zod strict pour les paramètres
- Un handler execute() async robuste avec try/catch
- Une description claire pour que le LLM comprenne quand l'utiliser
- Un test unitaire Jest inline (describe/it)

AUSSI créer : apps/mobile/tools/toolRegistry.ts
- Un registre global des tools
- useToolRegistry() hook : { tools, enableTool, disableTool, addCustomTool }
- Persistance des préférences (tools activés/désactivés) via MMKV

Génère tous les fichiers complets.
```

---

## PHASE 6 — Config Plugin Expo & Build

### Prompt Phase 6

```
Tu es un expert Expo / EAS Build. Configure le projet pour builder correctement.

FICHIERS À CRÉER :

1. modules/expo-litert/plugin/index.ts  (Config Plugin Expo)
   - Modifie AndroidManifest pour ajouter : android:largeHeap="true"
   - Ajoute les permissions Android : READ_EXTERNAL_STORAGE, CAMERA
   - Ajoute Info.plist iOS : NSPhotoLibraryUsageDescription, NSCameraUsageDescription
   - Configure le linking du modèle .litertlm dans les assets Android

2. eas.json
   {
     "build": {
       "development": {
         "developmentClient": true,
         "distribution": "internal",
         "android": { "buildType": "apk" }
       },
       "preview": {
         "distribution": "internal",
         "android": { "buildType": "apk" },
         "ios": { "simulator": true }
       },
       "production": {
         "android": { "buildType": "app-bundle" }
       }
     }
   }

3. apps/mobile/metro.config.js
   - Configure Metro pour inclure les fichiers .litertlm comme assets
   - Ajoute les extensions : litertlm, bin

4. scripts/setup.sh
   #!/bin/bash
   echo "🔧 Setup LiteRT React Native Bridge"
   
   # Install deps
   cd apps/mobile && npm install
   
   # Install Expo module
   cd ../../modules/expo-litert && npm install
   
   # Android: vérifier NDK
   echo "Vérification NDK..."
   
   # iOS: pod install
   if [[ "$OSTYPE" == "darwin"* ]]; then
     cd ../../apps/mobile/ios && pod install
   fi
   
   echo "✅ Setup terminé. Lance avec: npx expo run:android ou run:ios"

5. README.md complet avec :
   - Prérequis système (NDK, Xcode, etc.)
   - Instructions de setup pas à pas
   - Comment télécharger et placer le modèle Gemma 4
   - Commandes de build
   - Architecture du bridge (schéma ASCII)
   - Troubleshooting commun

Génère tous ces fichiers complets.
```

---

## PHASE 7 — Tests & Validation

### Prompt Phase 7

```
Tu es un expert en testing React Native. Crée une suite de tests pour valider le bridge.

FICHIERS À CRÉER :

1. modules/expo-litert/__tests__/bridge.test.ts
   - Mock du module natif
   - Test loadModel (succès, échec fichier manquant, mémoire insuffisante)
   - Test generateText (réponse simple)
   - Test tool calling (détection + parsing)
   - Test streaming (events séquence correcte)
   - Test annulation

2. apps/mobile/__tests__/useChat.test.ts
   - Test envoi message simple
   - Test conversation multi-tour
   - Test tool calling loop complet :
     user → assistant (tool_call) → tool result → assistant (final)
   - Test avec image (multimodal)

3. apps/mobile/app/(tabs)/debug.tsx  (onglet debug caché en dev)
   Interface de test bas niveau :
   - Bouton "Test loadModel" → affiche ModelInfo
   - Bouton "Test generateText simple" → benchmark tokens/s
   - Bouton "Test Tool Call" → envoie un prompt qui force un tool call
   - Bouton "Test Streaming" → affiche les tokens en temps réel
   - Bouton "Test Image" → encode et envoie une image test
   - Logs en temps réel (ScrollView avec timestamps)
   - Bouton "Copy Logs" pour debug

Génère tous les fichiers complets.
```

---

## 🔗 Ordre d'exécution recommandé

```
Phase 0  →  npx create-expo-app + structure
Phase 1A →  Gradle config Android
Phase 1B →  Module Kotlin principal  
Phase 1C →  Tool calling Kotlin
Phase 2A →  Podspec iOS
Phase 2B →  Module Swift
Phase 3  →  API TypeScript + hooks
Phase 4  →  Chat UI
Phase 5  →  Tools natifs
Phase 6  →  Build config
Phase 7  →  Tests

Premiers tests :  npx expo run:android (ou run:ios)
```

---

## ⚠️ Points critiques à ne pas oublier

| Point | Détail |
|-------|--------|
| **Modèle** | Gemma 4 E2B IT quantized INT4 = ~2GB. Tester avec Gemma 3 1B d'abord |
| **Mémoire** | largeHeap Android obligatoire. iOS : risque OOM sur appareils < 6GB RAM |
| **Thread** | Toujours générer sur background thread, jamais le main thread UI |
| **Streaming** | Les events React Native ont un overhead : batcher les tokens (10-20 tokens par event) |
| **Tool loop** | Limiter à 10 itérations max pour éviter les boucles infinies |
| **Format tools** | Gemma 4 utilise le format Gemma function calling, PAS le format OpenAI — adapter le prompt système |
| **Images** | Resize à max 896x896 avant d'encoder (contrainte LiteRT vision) |
| **Expo Go** | Ne fonctionne PAS — toujours utiliser un dev build (`npx expo run:*`) |

---

## 📚 Ressources clés

- [LiteRT-LM Kotlin SDK](https://ai.google.dev/edge/litert-lm/overview)
- [Expo Modules API](https://docs.expo.dev/modules/module-api/)
- [Gemma function calling format](https://ai.google.dev/gemma/docs/capabilities/function-calling)
- [LiteRT supported models](https://github.com/google-ai-edge/LiteRT-LM#supported-models)
- `npx create-expo-module --help` pour le scaffolding du module

---

*Plan généré pour : LiteRT × React Native Bridge — Gemma 4 E2B Multimodal + Tool Calling*