/** Aligne le package Android RN (autolinking / BuildConfig) sur applicationId — évite com.mobile depuis package.json "name". */
module.exports = {
  project: {
    android: {
      packageName: 'com.litert.rn',
    },
  },
};
