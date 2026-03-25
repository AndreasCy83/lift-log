import { SocialLogin } from '@capgo/capacitor-social-login';
import { generateBackupData } from '@/lib/autoBackup';
import { format } from 'date-fns';

const GDRIVE_SETTINGS_KEY = 'gym-gdrive-backup-settings';

export interface GDriveSettings {
  enabled: boolean;
  lastBackupAt: string | null;
  userEmail: string | null;
}

export function getGDriveSettings(): GDriveSettings {
  try {
    const raw = localStorage.getItem(GDRIVE_SETTINGS_KEY);
    return raw ? JSON.parse(raw) : { enabled: false, lastBackupAt: null, userEmail: null };
  } catch {
    return { enabled: false, lastBackupAt: null, userEmail: null };
  }
}

export function saveGDriveSettings(s: GDriveSettings) {
  localStorage.setItem(GDRIVE_SETTINGS_KEY, JSON.stringify(s));
}

export async function signInToGoogle(): Promise<{ accessToken: string; email: string }> {
  const result = await SocialLogin.login({
    provider: 'google',
    options: {
      scopes: ['profile', 'email', 'https://www.googleapis.com/auth/drive.file'],
    },
  });
  const googleResult = result.result as { accessToken?: { token?: string } | null; profile?: { email?: string | null } | null };
  const accessToken = googleResult?.accessToken?.token;
  const email = googleResult?.profile?.email;
  if (!accessToken || !email) {
    throw new Error('Google sign-in failed: missing token or email');
  }
  return { accessToken, email };
}

export async function signOutFromGoogle(): Promise<void> {
  try {
    await SocialLogin.logout({ provider: 'google' });
  } catch {
    // ignore
  }
}

async function getOrCreateFitLogFolder(accessToken: string): Promise<string> {
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=name='FitLog Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: 'FitLog Backups',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  const folder = await createRes.json();
  return folder.id;
}

export async function backupToGoogleDrive(): Promise<{ email: string }> {
  const { accessToken, email } = await signInToGoogle();
  const folderId = await getOrCreateFitLogFolder(accessToken);

  const data = generateBackupData();
  const now = new Date();
  const filename = `Fitlog-Backup-${format(now, 'yyyy-MM-dd-HHmm')}.json`;
  const jsonString = JSON.stringify(data, null, 2);

  const metadata = {
    name: filename,
    mimeType: 'application/json',
    parents: [folderId],
  };

  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([jsonString], { type: 'application/json' }));

  const uploadRes = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: form,
    }
  );

  if (!uploadRes.ok) {
    const err = await uploadRes.json();
    throw new Error(err?.error?.message || 'Google Drive upload failed');
  }

  const settings = getGDriveSettings();
  settings.lastBackupAt = now.toISOString();
  settings.userEmail = email;
  saveGDriveSettings(settings);

  return { email };
}
