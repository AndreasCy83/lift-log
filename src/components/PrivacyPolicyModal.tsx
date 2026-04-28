import { ArrowLeft } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface PrivacyPolicyModalProps {
  onClose: () => void;
}

export default function PrivacyPolicyModal({ onClose }: PrivacyPolicyModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
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
          <p className="text-xs text-muted-foreground">Last Updated: April 2026</p>

          <div className="space-y-1 pt-1">
            <p><span className="text-muted-foreground">App Name:</span> fitlogX</p>
            <p><span className="text-muted-foreground">Package Name:</span> com.andreascy83.liftlog</p>
            <p><span className="text-muted-foreground">Developer Contact:</span> <a href="mailto:fitlogx@gmail.com" className="text-primary underline">fitlogx@gmail.com</a></p>
          </div>

          <h2 className="font-display text-base font-semibold pt-3">Overview</h2>
          <p>fitlogX is designed with a "Privacy-First" approach. We believe your fitness journey is your business. As such, fitlogX does not collect or store any personally identifiable information on our own servers.</p>
          <p>You are not required to register an account to use fitlogX. All workout data, logs, and settings you record within the application are stored locally on your mobile device. No data is transmitted to any third-party server unless you explicitly enable the optional Google Drive Backup feature.</p>

          <h2 className="font-display text-base font-semibold pt-3">1. Local Data Storage</h2>
          <p>All workout logs, routines, exercises, and settings are stored exclusively on your device's internal storage. This data remains on your device and is not accessible by the developer or any third party.</p>

          <h2 className="font-display text-base font-semibold pt-3">2. Google Drive Backup (Optional)</h2>
          <p>You may optionally choose to enable Google Drive Backup (via Settings &gt; Google Drive Backup) to upload a copy of your fitlogX data to your own personal Google Drive account. This allows for data recovery when switching devices.</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><span className="font-semibold">Authentication:</span> This process is handled entirely by Google Play Services. fitlogX never sees or stores your Google password.</li>
            <li><span className="font-semibold">Data Accessed:</span> Once signed in, fitlogX accesses your Email Address and Full Name only to identify the backup destination.</li>
            <li><span className="font-semibold">Limited Scope Access:</span> fitlogX only requests access to the "drive.file" scope. This means the app can only see, read, and modify files that it has created itself. It cannot see your photos, documents, or other personal files in your Drive.</li>
            <li><span className="font-semibold">Revoking Access:</span> You can sign out at any time within the app or revoke access via myaccount.google.com/security.</li>
          </ul>

          <h2 className="font-display text-base font-semibold pt-3">3. Data Collection and Usage Disclosure</h2>
          <p>For the purposes of the Google Play "Data Safety" section, here is how we handle data:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><span className="font-semibold">Personal Info:</span> We do not collect names or emails unless you use the Drive Backup (where it is used only for authentication).</li>
            <li><span className="font-semibold">Health &amp; Fitness:</span> Workout logs are stored locally and are not "collected" by us.</li>
            <li><span className="font-semibold">Device Identifiers:</span> We do not collect Ad IDs or device serial numbers.</li>
          </ul>

          <h2 className="font-display text-base font-semibold pt-3">4. Data Deletion &amp; Retention</h2>
          <p>Because your data is stored locally, we do not retain your data if you leave the app. To permanently delete all data associated with fitlogX:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Navigate to Android Settings &gt; Apps &gt; fitlogX &gt; Clear Data/Storage.</li>
            <li>Uninstall the application.</li>
            <li>Manually delete the fitlogX_backup files from your personal Google Drive if you created them.</li>
          </ul>

          <h2 className="font-display text-base font-semibold pt-3">5. Data Security</h2>
          <p>We protect your data by relying on the built-in security features of the Android operating system (encryption, sandboxing). For the Google Drive feature, all data is transmitted via a secure, encrypted HTTPS connection directly to Google.</p>

          <h2 className="font-display text-base font-semibold pt-3">6. Children's Privacy</h2>
          <p>fitlogX is intended for a general audience. We do not knowingly collect information from children under the age of 13.</p>

          <h2 className="font-display text-base font-semibold pt-3">7. Changes to This Policy</h2>
          <p>If we update this policy, the new version will be available within the app. Continued use signifies acceptance of the terms.</p>

          <h2 className="font-display text-base font-semibold pt-3">8. Contact</h2>
          <p>For any questions regarding your privacy, please contact: <a href="mailto:fitlogx@gmail.com" className="text-primary underline">fitlogx@gmail.com</a></p>
        </div>
      </ScrollArea>
    </div>
  );
}
