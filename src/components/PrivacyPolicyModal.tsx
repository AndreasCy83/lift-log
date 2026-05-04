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
        <div className="mx-auto max-w-lg px-4 py-6 text-sm leading-relaxed text-foreground space-y-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}>
          <p className="text-xs text-muted-foreground">Last Updated: May 2026</p>

          <div className="space-y-1 pt-1">
            <p><span className="text-muted-foreground">App:</span> fitlogX</p>
            <p><span className="text-muted-foreground">Package:</span> com.andreascy83.liftlog</p>
            <p><span className="text-muted-foreground">Developer Contact:</span> <a href="mailto:fitlogx@gmail.com" className="text-primary underline">fitlogx@gmail.com</a></p>
            <p><span className="text-muted-foreground">Online Policy:</span> <a href="https://fitlogx.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline">https://fitlogx.com/</a></p>
          </div>

          <h2 className="font-display text-base font-semibold pt-3">1. Overview</h2>
          <p>fitlogX is a fitness tracking application designed to store your workout information locally on your device. The app does not require account registration and does not upload your workout data to our servers.</p>

          <h2 className="font-display text-base font-semibold pt-3">2. Information We Handle</h2>
          <p>fitlogX allows you to create and manage workout logs, routines, exercises, and app settings on your device. This information is stored locally on the device and is not transmitted to the developer's servers through normal app use.</p>

          <h2 className="font-display text-base font-semibold pt-3">3. Personal Information</h2>
          <p>fitlogX does not require you to provide your name, email address, or other account information in order to use the current public version of the app. We do not sell your personal data and we do not use your workout data for advertising.</p>

          <h2 className="font-display text-base font-semibold pt-3">4. Google Drive Backup</h2>
          <p>A Google Drive backup option may appear in the settings screen as part of a planned future feature, but it is currently disabled in the public version of fitlogX. In the current public version, the app does not connect to Google Drive, does not request Google account access for backup use, and does not upload backup data through this feature.</p>

          <h2 className="font-display text-base font-semibold pt-3">5. Data Retention and Deletion</h2>
          <p>Because fitlogX does not use user accounts and does not store your app data on our servers, there is no account to delete and no server-side user record for us to remove. You can delete locally stored app data at any time by clearing the app's storage in Android settings or by uninstalling the app.</p>

          <h2 className="font-display text-base font-semibold pt-3">6. Third-Party Services</h2>
          <p>fitlogX does not currently use third-party services for cloud storage, advertising, or user accounts in the current public version, except for any platform-level services required for app distribution through Google Play. If future app versions add analytics, crash reporting, cloud backup, or account features, this Privacy Policy will be updated before those features are made available.</p>

          <h2 className="font-display text-base font-semibold pt-3">7. Security</h2>
          <p>Data stored by fitlogX is protected by the security mechanisms provided by the Android operating system, such as app sandboxing and device-level protections. If a future version of the app introduces network-based features, those features will use appropriate secure transmission methods.</p>

          <h2 className="font-display text-base font-semibold pt-3">8. Children's Privacy</h2>
          <p>fitlogX is intended for a general audience and is not directed to children under the age of 13. We do not knowingly collect personal information from children under 13 in the current public version of the app.</p>

          <h2 className="font-display text-base font-semibold pt-3">9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time to reflect changes in the app, legal requirements, or Google Play policies. When we do, the updated version will be made available through the app or its store listing.</p>

          <h2 className="font-display text-base font-semibold pt-3">10. Contact</h2>
          <p>For questions about this Privacy Policy, contact: <a href="mailto:fitlogx@gmail.com" className="text-primary underline">fitlogx@gmail.com</a>.</p>
        </div>
      </ScrollArea>
    </div>
  );
}
