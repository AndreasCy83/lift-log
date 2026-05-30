export type SupportedLang =
  | 'en' | 'fr' | 'it' | 'pt' | 'ru' | 'tr' | 'zh' | 'hi' | 'ar' | 'ja';

export interface LangMeta {
  code: SupportedLang;
  /** Native script label shown in the picker */
  nativeName: string;
  /** English name */
  englishName: string;
  rtl?: boolean;
}

export const LANGUAGES: LangMeta[] = [
  { code: 'en', nativeName: 'English',    englishName: 'English' },
  { code: 'fr', nativeName: 'Français',   englishName: 'French' },
  { code: 'it', nativeName: 'Italiano',   englishName: 'Italian' },
  { code: 'pt', nativeName: 'Português',  englishName: 'Portuguese' },
  { code: 'ru', nativeName: 'Русский',    englishName: 'Russian' },
  { code: 'tr', nativeName: 'Türkçe',     englishName: 'Turkish' },
  { code: 'zh', nativeName: '中文',        englishName: 'Chinese (Simplified)' },
  { code: 'hi', nativeName: 'हिन्दी',       englishName: 'Hindi' },
  { code: 'ar', nativeName: 'العربية',     englishName: 'Arabic', rtl: true },
  { code: 'ja', nativeName: '日本語',      englishName: 'Japanese' },
];

export const SUPPORTED_CODES = LANGUAGES.map((l) => l.code);

export function isRtl(code: string): boolean {
  return LANGUAGES.find((l) => l.code === code)?.rtl ?? false;
}
