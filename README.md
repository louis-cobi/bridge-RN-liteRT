# LiteRT × React Native (bridge)

Monorepo minimal : application Expo bare dans `apps/mobile` et module natif `modules/expo-litert`.

**Embarquement inférence (Android, LiteRT‑LM, lien RN)** : voir [`docs/embarquement-litert-lm-react-native.md`](docs/embarquement-litert-lm-react-native.md) — même schéma « module Expo + natif lourd » qu’un tuto type YOLO/TFLite, mais avec `litertlm-android` et des fichiers `.litertlm`.

## Prérequis

- **Node.js 20 LTS** (recommandé pour Expo : `prebuild`, Gradle `createExpoConfig`, config plugins). Un fichier `.nvmrc` à `20` est fourni dans `apps/mobile` (`nvm use`, `fnm use`, etc.).
- Android : Android Studio, NDK (Expo en gère une version via Gradle), `minSdk` 26+
- iOS (macOS) : Xcode 16+ — l’inférence LiteRT-LM n’est **pas** encore branchée sur iOS dans ce dépôt ; `encodeImage` fonctionne, le reste renvoie une erreur explicite.

## Setup

```bash
cd apps/mobile
nvm use   # ou fnm use — aligne Node sur .nvmrc (20)
npm install --legacy-peer-deps
npx expo run:android
```

Script optionnel : `bash scripts/setup.sh`

## Config plugin Expo (`expo-litert`) — prebuild / symétrie iOS

Le module inclut un **config plugin en JavaScript pur** : `modules/expo-litert/plugin/index.js` (point d’entrée déclaré dans `package.json` du module via `"app.plugin"`).

**Comportement :**

- **Avec Node 20** : tu peux ajouter `"expo-litert"` dans le tableau `expo.plugins` de `app.json`. Au prochain `npx expo prebuild` ou à la génération de config Gradle, Expo appliquera automatiquement `largeHeap`, permissions Android et textes `Info.plist` (photos / caméra).
- **Avec Node 22+** : le chargement de certains plugins peut déclencher `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` (sources TypeScript d’`expo-modules-core` sous `node_modules` — suivi côté Expo / Node, ex. [expo#36683](https://github.com/expo/expo/issues/36683)). Dans ce cas, **ne mets pas** `"expo-litert"` dans `plugins` : le manifest Android du dépôt est déjà patché à la main pour équivalence. Pour retrouver l’automatisation, **passe à Node 20** pour les commandes Expo/Gradle concernées.

En résumé : **oui, c’est propre** — plugin JS versionné dans le module + **Node 20** pour que la chaîne Expo charge les plugins sans ce bug.

## Modèle `.litertlm`

1. Obtenir un fichier `.litertlm` (voir section suivante sur la Gallery).
2. Le placer sur l’appareil / l’émulateur et indiquer son **chemin absolu** dans **Réglages** → *Chemin modèle*, puis **Charger le modèle**.

## Google AI Edge Gallery : comment ils « téléchargent depuis l’app » ?

D’après le dépôt officiel **[google-ai-edge/gallery](https://github.com/google-ai-edge/gallery)** (README, avril 2026) :

- L’app est **open source** ; elle inclut une **intégration Hugging Face** pour la découverte et le **téléchargement** des modèles (formats adaptés au runtime on-device, notamment **`.litertlm`**).
- Les modèles sont stockés **en local** après téléchargement ; l’inférence reste **100 % on-device** une fois le fichier présent.
- Ce n’est **pas** un comportement magique du seul SDK LiteRT-LM : c’est du **code applicatif** (HTTP / Hub Hugging Face, progression, stockage dans le sandbox de l’app, etc.) que tu peux t’inspirer ou réimplémenter (par ex. `expo-file-system` + URL `resolve` du Hub, ou CLI `huggingface-cli` comme dans `scripts/download-model.sh`).

Pour aller plus loin techniquement, clone le repo Gallery et cherche la logique « model download » / Hugging Face dans les sources Android/iOS.

## Android : Kotlin et SDK

Le projet force **Kotlin 2.3.0** dans `android/build.gradle` pour rester compatible avec `litertlm-android` **0.10.0** (métadonnées Kotlin 2.3).

## Tests

`npm test` dans `apps/mobile` utilise Jest Expo (`--passWithNoTests` tant qu’aucun test n’est ajouté).

## Architecture

`expo-litert` expose `loadModel`, `generateText`, `generateStream`, `encodeImage`, etc. La couche TS (`modules/expo-litert/src/index.ts`) valide avec Zod et fournit `defineTool` / hooks dans `apps/mobile/hooks/`.
