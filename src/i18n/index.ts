import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { isRtl, SUPPORTED_CODES, type SupportedLang } from './languages';

import en from './locales/en.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import ar from './locales/ar.json';
import ja from './locales/ja.json';

const STORAGE_KEY = 'gym-language';

/** Read persisted language, fallback to detector. */
function initialLang(): SupportedLang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_CODES.includes(stored as SupportedLang)) {
      return stored as SupportedLang;
    }
    // Also try the settings blob (in case it was set there only)
    const settingsRaw = localStorage.getItem('gym-settings');
    if (settingsRaw) {
      const lang = JSON.parse(settingsRaw)?.language;
      if (lang && SUPPORTED_CODES.includes(lang)) return lang;
    }
  } catch { /* ignore */ }
  return 'en';
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en }, fr: { translation: fr }, it: { translation: it },
      pt: { translation: pt }, ru: { translation: ru }, tr: { translation: tr },
      zh: { translation: zh }, hi: { translation: hi }, ar: { translation: ar },
      ja: { translation: ja },
    },
    lng: initialLang(),
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_CODES,
    interpolation: { escapeValue: false },
    returnNull: false,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

applyDirection(i18n.language);
i18n.on('languageChanged', applyDirection);

function applyDirection(lng: string) {
  if (typeof document === 'undefined') return;
  document.documentElement.dir = isRtl(lng) ? 'rtl' : 'ltr';
  document.documentElement.lang = lng;
}

export function setLanguage(code: SupportedLang) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
  void i18n.changeLanguage(code);
}

export default i18n;
