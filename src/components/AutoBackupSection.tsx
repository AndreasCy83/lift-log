import { useState, useEffect } from 'react';
import { Download, HardDrive, Clock, Cloud, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  getBackupSettings,
  saveBackupSettings,
  saveBackupToDevice,
  downloadBackup,
  schedulePendingBackup,
  cancelPendingBackup,
  type BackupSettings,
} from '@/lib/autoBackup';
import {
  getGDriveSettings,
  saveGDriveSettings,
  backupToGoogleDrive,
  signOutFromGoogle,
  type GDriveSettings,
} from '@/lib/googleDriveBackup';

export default function AutoBackupSection() {
  const { toast } = useToast();
  const [bs, setBs] = useState<BackupSettings>(() => getBackupSettings());
  const [saving, setSaving] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [gDriveSettings, setGDriveSettings] = useState<GDriveSettings>(() => getGDriveSettings());
  const [gDriveBacking, setGDriveBacking] = useState(false);

  useEffect(() => {
    saveBackupSettings(bs);
  }, [bs]);

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      setBs({ ...bs, enabled: true });
      toast({
        title: 'Auto-backup enabled',
        description: 'A backup will download ~1hr after each workout. Uses ~500KB per backup.',
      });
    } else {
      cancelPendingBackup();
      setBs({ ...bs, enabled: false });
      toast({ title: 'Auto-backup disabled' });
    }
  };

  const handleSaveToDevice = async () => {
    setSaving(true);
    try {
      const { filename } = await saveBackupToDevice();
      setBs(getBackupSettings());
      toast({ title: '✅ Saved to:', description: `Internal Storage/Documents/${filename}` });
    } catch {
      toast({ title: 'Save failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleShareBackup = async () => {
    setSharing(true);
    try {
      await downloadBackup();
      setBs(getBackupSettings());
      toast({ title: '📤 Choose where to save', description: 'Select "Save to Files" in the share sheet' });
    } catch {
      toast({ title: 'Share failed', variant: 'destructive' });
    } finally {
      setSharing(false);
    }
  };

  const handleGDriveBackup = async () => {
    setGDriveBacking(true);
    try {
      const { email } = await backupToGoogleDrive();
      setGDriveSettings(getGDriveSettings());
      toast({
        title: '✅ Backed up to Google Drive',
        description: `Saved to FitLog Backups folder (${email})`,
      });
    } catch (e: any) {
      toast({
        title: 'Google Drive backup failed',
        description: String(e?.message || e),
        variant: 'destructive',
      });
    } finally {
      setGDriveBacking(false);
    }
  };

  const handleGDriveToggle = async (enabled: boolean) => {
    if (!enabled) {
      await signOutFromGoogle();
    }
    const updated = { ...gDriveSettings, enabled };
    saveGDriveSettings(updated);
    setGDriveSettings(updated);
    toast({
      title: enabled ? 'Auto Google Drive backup enabled' : 'Auto Google Drive backup disabled',
    });
  };

  const lastBackupLabel = bs.lastBackupAt
    ? format(new Date(bs.lastBackupAt), 'yyyy-MM-dd HH:mm')
    : 'Never';

  return (
    <div className="gym-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-semibold">Data Backup</h3>
        </div>
      </div>

      {/* Auto-backup toggle */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Automatic Backup</p>
          <p className="text-[10px] text-muted-foreground">Backup will be ready to save ~1hr after each workout</p>
        </div>
        <Switch checked={bs.enabled} onCheckedChange={handleToggle} />
      </div>

      {/* Last backup timestamp */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Last backup: {lastBackupLabel}</span>
      </div>

      {/* Save & Share buttons */}
      <div className="flex gap-2 w-full">
        <Button
          onClick={handleSaveToDevice}
          disabled={saving}
          variant="outline"
          size="sm"
          className="flex-1 min-w-0 gap-1.5"
        >
          <Download className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{saving ? 'Saving…' : 'Save to Device'}</span>
        </Button>
        <Button
          onClick={handleShareBackup}
          disabled={sharing}
          variant="outline"
          size="sm"
          className="flex-1 min-w-0 gap-1.5"
        >
          <Share2 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{sharing ? 'Sharing…' : 'Share Backup'}</span>
        </Button>
      </div>

      {/* Google Drive Backup */}
      <div className="border-t border-border pt-3 space-y-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-20.4 35.3c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l11.5 19.6z" fill="#ea4335"/>
            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
            <path d="m73.4 26.5-10.1-17.5c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 23.5h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
          </svg>
          <h3 className="font-display text-sm font-semibold">Google Drive Backup</h3>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium text-muted-foreground">Coming Soon</span>
        </div>

        <Button
          disabled
          variant="outline"
          size="sm"
          className="w-full gap-1.5 opacity-50 pointer-events-none"
        >
          <Cloud className="h-3.5 w-3.5" />
          Backup to Google Drive
        </Button>

        <div className="flex items-center justify-between opacity-50">
          <div>
            <p className="text-sm font-medium">Auto Drive Backup</p>
            <p className="text-[10px] text-muted-foreground">Coming Soon — Auto Drive Backup will be available in a future update</p>
          </div>
          <Switch checked={false} disabled />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Data stored locally • tap "Save to Files" when share sheet opens
      </p>
    </div>
  );
}
