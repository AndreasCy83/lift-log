import { Capacitor } from '@capacitor/core';
import { Instagram, Twitter } from 'lucide-react';

export const SOCIAL_LINKS = {
  instagram: { url: 'https://www.instagram.com/fitlogx/', label: 'Instagram' },
  x: { url: 'https://x.com/fitlogx', label: 'X' },
  tiktok: { url: 'https://tiktok.com/@legend1980cool', label: 'TikTok' },
} as const;

function TikTokIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.53V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function openExternal(url: string) {
  if (Capacitor.isNativePlatform()) {
    window.open(url, '_system');
  } else {
    window.open(url, '_blank');
  }
}

interface SocialLinkButtonProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  ariaLabel: string;
}

function SocialLinkButton({ href, label, icon, ariaLabel }: SocialLinkButtonProps) {
  return (
    <button
      type="button"
      onClick={() => openExternal(href)}
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground hover:bg-secondary/80 active:bg-secondary/60 transition-colors shrink-0"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

interface SocialFollowButtonsProps {
  label?: string;
}

export default function SocialFollowButtons({ label = 'Follow us' }: SocialFollowButtonsProps) {
  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase text-muted-foreground font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        <SocialLinkButton
          href={SOCIAL_LINKS.instagram.url}
          label={SOCIAL_LINKS.instagram.label}
          ariaLabel="Follow us on Instagram"
          icon={<Instagram className="h-3.5 w-3.5" />}
        />
        <SocialLinkButton
          href={SOCIAL_LINKS.x.url}
          label={SOCIAL_LINKS.x.label}
          ariaLabel="Follow us on X"
          icon={<Twitter className="h-3.5 w-3.5" />}
        />
        <SocialLinkButton
          href={SOCIAL_LINKS.tiktok.url}
          label={SOCIAL_LINKS.tiktok.label}
          ariaLabel="Follow us on TikTok"
          icon={<TikTokIcon className="h-3.5 w-3.5" />}
        />
      </div>
    </div>
  );
}
