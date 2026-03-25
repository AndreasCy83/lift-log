import { ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PrivacyPolicyModalProps {
  onClose: () => void;
}

export default function PrivacyPolicyModal({ onClose }: PrivacyPolicyModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-lg px-4 py-3">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button onClick={onClose} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="font-display text-lg font-bold">Privacy Policy</h1>
        </div>
      </header>
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-lg px-4 py-6 text-sm leading-relaxed text-foreground space-y-4">
          <p className="text-xs text-muted-foreground">Last updated: March 2026</p>

          <h2 className="font-display text-base font-semibold pt-2">Overview</h2>
          <p>FitLog Tracker does not collect or store any personally identifiable information unless the Google Drive Backup feature has been explicitly enabled (see Google Drive Backup section below).</p>
          <p>You are not required to register an account in order to use FitLog Tracker and all workout data you record within the application is stored locally on your mobile device. No data is transmitted to any server or third party.</p>

          <h2 className="font-display text-base font-semibold pt-2">Local Data Storage</h2>
          <p>All workout logs, routines, exercises, and settings are stored exclusively on your device using local storage. This data never leaves your device unless you explicitly choose to export or back it up.</p>

          <h2 className="font-display text-base font-semibold pt-2">Google Drive Backup</h2>
          <p>You may optionally enable Google Drive Backup via Settings &gt; Google Drive Backup, which will upload a copy of your FitLog Tracker data to your personal Google Drive account. This allows you to recover your data in the event that you switch to a different device in the future.</p>
          <p>When enabling this feature you will be prompted to sign in with Google. This sign-in process is facilitated entirely by Google Play Services and FitLog Tracker is never in possession of your Google password.</p>
          <p>Once you have signed in with Google, the following information is made available to FitLog Tracker from your Google account:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Your email address</li>
            <li>Your full name</li>
          </ul>
          <p>FitLog Tracker does not transmit this information from your mobile device and it is not used for any purpose other than enabling backup files to be uploaded to your Google Drive account.</p>
          <p>FitLog Tracker is only granted access to view, read, and modify files in Google Drive that it has created itself — it is not able to access any files or folders that you have created by any other means.</p>
          <p>You can disable Google Drive Backup at any time by going to Settings &gt; Google Drive Backup and signing out.</p>
          <p>You may also revoke FitLog Tracker's access directly from Google: Go to myaccount.google.com &gt; Security &gt; Third-party apps with account access, find FitLog Tracker and select "Remove access".</p>

          <h2 className="font-display text-base font-semibold pt-2">Data Sharing</h2>
          <p>FitLog Tracker does not sell, trade, or share your personal data with any third parties. No analytics, advertising SDKs, or tracking libraries are included in this application.</p>

          <h2 className="font-display text-base font-semibold pt-2">Children's Privacy</h2>
          <p>FitLog Tracker does not knowingly collect any information from children under the age of 13. The app is intended for general fitness tracking use.</p>

          <h2 className="font-display text-base font-semibold pt-2">Changes to This Policy</h2>
          <p>If this Privacy Policy is updated in the future, the updated version will be made available within the app. Continued use of the app after any changes constitutes acceptance of the new policy.</p>

          <h2 className="font-display text-base font-semibold pt-2">Contact</h2>
          <p>If you have any questions about this Privacy Policy or how your data is handled, please contact:</p>
          <p><a href="mailto:antrosg@gmail.com" className="text-primary underline">antrosg@gmail.com</a></p>
        </div>
      </ScrollArea>
    </div>
  );
}
