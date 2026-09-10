/**
 * Build local do APK preview com EXPO_PUBLIC_DEMO_MODE=true.
 * Copia .env.preview → .env.production.local (carregado só em builds release).
 * Não altera .env de desenvolvimento.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPreview = path.join(root, 'env.preview.example');
const envProductionLocal = path.join(root, '.env.production.local');

if (!fs.existsSync(envPreview)) {
  console.error('Arquivo env.preview.example não encontrado.');
  process.exit(1);
}

fs.copyFileSync(envPreview, envProductionLocal);
console.log('→ env.preview.example copiado para .env.production.local');

const env = {
  ...process.env,
  NODE_ENV: 'production',
  APP_VARIANT: 'preview',
  CI: '1',
  JAVA_HOME: process.env.JAVA_HOME ?? 'C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.20.8-hotspot',
  ANDROID_HOME: process.env.ANDROID_HOME ?? path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk'),
};

const androidDir = path.join(root, 'android');
if (!fs.existsSync(androidDir)) {
  console.log('→ expo prebuild (android)...');
  execSync('npx expo prebuild --platform android', { cwd: root, stdio: 'inherit', env });
}

console.log('→ gradlew assembleRelease...');
execSync(process.platform === 'win32' ? 'gradlew.bat assembleRelease' : './gradlew assembleRelease', {
  cwd: androidDir,
  stdio: 'inherit',
  env,
});

const apk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
console.log(`\n✓ APK gerado: ${apk}`);
