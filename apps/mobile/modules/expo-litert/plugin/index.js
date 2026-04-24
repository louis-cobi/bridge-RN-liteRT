/**
 * Config plugin Expo (JavaScript pur).
 *
 * @type {import('@expo/config-plugins').ConfigPlugin}
 */
function withExpoLiteRT(config) {
  const { AndroidConfig, withAndroidManifest, withInfoPlist } = require('expo/config-plugins');

  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application?.[0];
    if (app?.$) {
      app.$['android:largeHeap'] = 'true';
    }
    AndroidConfig.Permissions.ensurePermissions(mod.modResults, [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.CAMERA',
    ]);
    return mod;
  });

  config = withInfoPlist(config, (mod) => {
    mod.NSPhotoLibraryUsageDescription =
      mod.NSPhotoLibraryUsageDescription ??
      "LiteRT chat a besoin d'accéder à vos photos pour les pièces jointes.";
    mod.NSCameraUsageDescription =
      mod.NSCameraUsageDescription ??
      'LiteRT chat peut utiliser la caméra pour capturer des images.';
    return mod;
  });

  return config;
}

module.exports = withExpoLiteRT;
