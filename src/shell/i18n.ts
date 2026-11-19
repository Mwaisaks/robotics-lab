/**
 * All user-visible strings, English + Kiswahili. Add every new string here and
 * read it with t('key'). Kiswahili lines need a native speaker's review.
 */
export type Lang = 'en' | 'sw';

const STRINGS = {
  en: {
    'start.title': 'Robotics Lab',
    'start.subtitle': 'Practise robotics with your hands',
    'start.browser': 'PLAY IN BROWSER',
    'start.vr': 'ENTER VR',
    'robo.name': 'Robo',
    'robo.close': 'Close hint',
  },
  sw: {
    'start.title': 'Robotics Lab',
    'start.subtitle': 'Jifunze roboti kwa vitendo',
    'start.browser': 'CHEZA KWENYE KIVINJARI',
    'start.vr': 'INGIA VR',
    'robo.name': 'Robo',
    'robo.close': 'Funga dokezo',
  },
} as const satisfies Record<Lang, Record<string, string>>;

export type StringKey = keyof (typeof STRINGS)['en'];

let lang: Lang = 'en';

export function setLang(next: Lang): void {
  lang = next;
}

export function getLang(): Lang {
  return lang;
}

export function t(key: StringKey): string {
  return STRINGS[lang][key] ?? STRINGS.en[key];
}
