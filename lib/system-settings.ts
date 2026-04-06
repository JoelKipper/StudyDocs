import {
  getSystemSetting as readSetting,
  setSystemSetting as writeSetting,
  getAllSystemSettings as readAll,
} from './local-store';

export async function getSystemSetting(key: string): Promise<string | null> {
  return readSetting(key);
}

export async function getSystemSettingBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
  const value = await readSetting(key);
  if (value === null) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

export async function setSystemSetting(key: string, value: string, userId: string): Promise<void> {
  await writeSetting(key, value, userId);
}

export async function getAllSystemSettings(): Promise<Record<string, string>> {
  return readAll();
}
