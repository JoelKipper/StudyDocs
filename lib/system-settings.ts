import { supabaseServer } from './supabase-server';

export async function getSystemSetting(key: string): Promise<string | null> {
  const { data, error } = await supabaseServer
    .from('system_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error || !data) {
    return null;
  }

  return data.value;
}

export async function getSystemSettingBoolean(key: string, defaultValue: boolean = false): Promise<boolean> {
  const value = await getSystemSetting(key);
  if (value === null) {
    return defaultValue;
  }
  return value.toLowerCase() === 'true';
}

export async function setSystemSetting(key: string, value: string, userId: string): Promise<void> {
  const { error } = await supabaseServer
    .from('system_settings')
    .upsert({
      key,
      value,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'key',
    });

  if (error) {
    throw new Error(`Failed to update system setting: ${error.message}`);
  }
}

export async function getAllSystemSettings(): Promise<Record<string, string>> {
  const { data, error } = await supabaseServer
    .from('system_settings')
    .select('key, value');

  if (error || !data) {
    return {};
  }

  const settings: Record<string, string> = {};
  data.forEach((item) => {
    settings[item.key] = item.value;
  });

  return settings;
}

