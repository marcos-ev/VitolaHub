const fs = require('fs');
const path = require('path');

/** Lê EXPO_PUBLIC_DEMO_MODE de .env.production.local (build local preview). */
function isPreviewEnvFile() {
  try {
    const envPath = path.join(__dirname, '.env.production.local');
    if (!fs.existsSync(envPath)) return false;
    return fs.readFileSync(envPath, 'utf8').includes('EXPO_PUBLIC_DEMO_MODE=true');
  } catch {
    return false;
  }
}

/** @type {import('expo/config').ExpoConfig} */
module.exports = ({ config }) => {
  const demoMode =
    process.env.EXPO_PUBLIC_DEMO_MODE === 'true' ||
    process.env.APP_VARIANT === 'preview' ||
    isPreviewEnvFile();

  return {
    ...config,
    extra: {
      ...config.extra,
      demoMode,
    },
  };
};
