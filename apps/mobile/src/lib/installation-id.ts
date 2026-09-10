import { secureStorage } from './secure-storage';

const INSTALLATION_ID_KEY = 'charuto.installationId';

// UUID v4 "bom o suficiente": este id só precisa ser estável e
// razoavelmente único por aparelho (o backend usa para limitar 1 trial por
// dispositivo — seção 6.3), não precisa de garantias criptográficas.
function generateUuidV4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

let cachedInstallationId: string | null = null;

/**
 * Retorna um identificador estável do dispositivo, persistido em armazenamento
 * seguro. Gerado uma única vez na primeira execução do app.
 */
export async function getInstallationId(): Promise<string> {
  if (cachedInstallationId) return cachedInstallationId;

  const stored = await secureStorage.getItem(INSTALLATION_ID_KEY);
  if (stored) {
    cachedInstallationId = stored;
    return stored;
  }

  const generated = generateUuidV4();
  await secureStorage.setItem(INSTALLATION_ID_KEY, generated);
  cachedInstallationId = generated;
  return generated;
}
