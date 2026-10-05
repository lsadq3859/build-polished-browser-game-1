export type Language = 'ar' | 'en';

export interface Settings {
  sound: boolean;
  effects: boolean;
  haptics: boolean;
  name: string;
  language: Language;
}

export interface HighScore {
  id: string;
  name: string;
  score: number;
  wave: number;
  date: string;
}

const SETTINGS_KEY = 'neon-breaker.settings.v1';
const SCORES_KEY = 'neon-breaker.scores.v1';

export function loadSettings(): Settings {
  const defaults: Settings = {
    sound: true,
    effects: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    haptics: false,
    name: '',
    language: 'ar',
  };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      sound: typeof saved.sound === 'boolean' ? saved.sound : defaults.sound,
      effects: typeof saved.effects === 'boolean' ? saved.effects : defaults.effects,
      haptics: typeof saved.haptics === 'boolean' ? saved.haptics : defaults.haptics,
      name: typeof saved.name === 'string' ? saved.name.slice(0, 18) : '',
      language: saved.language === 'en' ? 'en' : 'ar',
    };
  } catch {
    return defaults;
  }
}

export function saveSettings(settings: Settings): boolean {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

export function loadScores(): HighScore[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SCORES_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    return saved.filter((item): item is HighScore =>
      item !== null && typeof item === 'object' &&
      typeof item.id === 'string' && typeof item.name === 'string' &&
      typeof item.score === 'number' && Number.isFinite(item.score) && item.score >= 0 &&
      typeof item.wave === 'number' && Number.isFinite(item.wave) && item.wave > 0 &&
      typeof item.date === 'string' && !Number.isNaN(Date.parse(item.date)),
    ).sort((a, b) => b.score - a.score).slice(0, 10);
  } catch {
    return [];
  }
}

export function saveScores(scores: HighScore[]): boolean {
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(scores.slice(0, 10)));
    return true;
  } catch {
    return false;
  }
}