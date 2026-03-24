import { useState, useEffect } from 'react';
import { Download, HardDrive, Clock, Cloud } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  getBackupSettings,
  saveBackupSettings,
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
  const [backing, setBacking] = useState(false);
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

  const handleManualBackup = async () => {
    setBacking(true);
    try {
      await downloadBackup();
      setBs(getBackupSettings());
      toast({ title: '📤 Choose where to save', description: 'Select "Save to Files" in the share sheet' });
    } catch {
      toast({ title: 'Backup failed', variant: 'destructive' });
    } finally {
      setBacking(false);
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

      {/* Last backup status */}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>Last backup: {lastBackupLabel}</span>
      </div>

      {/* Manual backup */}
      <Button
        onClick={handleManualBackup}
        disabled={backing}
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
      >
        <Download className="h-3.5 w-3.5" />
        {backing ? 'Downloading…' : 'Backup & Save'}
      </Button>

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
        </div>

        {gDriveSettings.userEmail && (
          <p className="text-[10px] text-muted-foreground">
            Connected: {gDriveSettings.userEmail}
          </p>
        )}

        {gDriveSettings.lastBackupAt && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Last Drive backup: {format(new Date(gDriveSettings.lastBackupAt), 'yyyy-MM-dd HH:mm')}</span>
          </div>
        )}

        <Button
          onClick={handleGDriveBackup}
          disabled={gDriveBacking}
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
        >
          <Cloud className="h-3.5 w-3.5" />
          {gDriveBacking ? 'Backing up to Drive…' : 'Backup to Google Drive'}
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Auto Drive Backup</p>
            <p className="text-[10px] text-muted-foreground">Upload to Drive ~1hr after each workout</p>
          </div>
          <Switch checked={gDriveSettings.enabled} onCheckedChange={handleGDriveToggle} />
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center">
        Data stored locally • tap "Save to Files" when share sheet opens
      </p>
    </div>
  );
}
