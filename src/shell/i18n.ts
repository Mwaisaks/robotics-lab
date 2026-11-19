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
    'join.title': 'Join your class',
    'join.class': 'Class code',
    'join.nickname': 'Nickname',
    'join.privacy': 'Nickname only. No real names.',
    'join.start': 'START',
    'join.guest': 'Play as guest',
    'join.invalid': 'Check the class code and nickname',
    'join.change': 'Change',
    'join.asGuest': 'Playing as guest',
    'settings.virtualLab.on': 'Virtual lab: on',
    'settings.virtualLab.off': 'Virtual lab: off',
  },
  sw: {
    'start.title': 'Robotics Lab',
    'start.subtitle': 'Jifunze roboti kwa vitendo',
    'start.browser': 'CHEZA KWENYE KIVINJARI',
    'start.vr': 'INGIA VR',
    'robo.name': 'Robo',
    'robo.close': 'Funga dokezo',
    'join.title': 'Jiunge na darasa lako',
    'join.class': 'Msimbo wa darasa',
    'join.nickname': 'Jina la utani',
    'join.privacy': 'Jina la utani tu. Si jina halisi.',
    'join.start': 'ANZA',
    'join.guest': 'Cheza kama mgeni',
    'join.invalid': 'Angalia msimbo wa darasa na jina la utani',
    'join.change': 'Badilisha',
    'join.asGuest': 'Unacheza kama mgeni',
    // TODO(sw review): Virtual lab toggle lines need a native speaker's check.
    'settings.virtualLab.on': 'Maabara pepe: imewashwa',
    'settings.virtualLab.off': 'Maabara pepe: imezimwa',
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
