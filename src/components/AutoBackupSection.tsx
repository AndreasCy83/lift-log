import { useState, useEffect } from 'react';
import { Download, HardDrive, Clock } from 'lucide-react';
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

export default function AutoBackupSection() {
  const { toast } = useToast();
  const [bs, setBs] = useState<BackupSettings>(() => getBackupSettings());
  const [backing, setBacking] = useState(false);

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
        {backing ? 'Downloading…' : 'Backup Now'}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center">
        Data stored locally on your device • ~500KB per backup
      </p>
    </div>
  );
}
