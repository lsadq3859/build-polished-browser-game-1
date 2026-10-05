import type { CSSProperties, ReactNode } from 'react';

export type IconName = 'sound' | 'muted' | 'settings' | 'help' | 'trophy' | 'pause' | 'play' | 'restart' | 'left' | 'right' | 'expand' | 'collapse' | 'close' | 'target' | 'mouse' | 'touch' | 'keyboard' | 'spark' | 'shield' | 'plus' | 'external' | 'home' | 'check' | 'infinity' | 'bolt' | 'recall' | 'arrowUp';

const paths: Record<IconName, ReactNode> = {
    sound: <><path d="m11 5-6 4H2v6h3l6 4V5Z" /><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" /></>,
    muted: <><path d="m11 5-6 4H2v6h3l6 4V5Z" /><path d="m16 9 6 6m0-6-6 6" /></>,
    settings: <><path d="m9 3-1 3-3 1-2 4 2 2v3l3 2 1 3h6l1-3 3-2v-3l2-2-2-4-3-1-1-3Z" /><circle cx="12" cy="12" r="3" /></>,
    help: <><circle cx="12" cy="12" r="9" /><path d="M9.2 9a2.9 2.9 0 0 1 5.6 1c0 2-2.8 2-2.8 4m0 3h.01" /></>,
    trophy: <><path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm4 10v5m-4 3h8m-6-3h4l2 3H8l2-3Z" /><path d="M8 5H4v3a4 4 0 0 0 5 4m7-7h4v3a4 4 0 0 1-5 4" /></>,
    pause: <path d="M7 5h3v14H7zm7 0h3v14h-3z" fill="currentColor" stroke="none" />,
    play: <path d="m8 4 12 8-12 8V4Z" fill="currentColor" stroke="none" />,
    restart: <path d="M3 10a9 9 0 1 1 1 8M3 4v6h6" />,
    left: <path d="m14 6-6 6 6 6M8 12h13" />,
    right: <path d="m10 6 6 6-6 6m6-6H3" />,
    expand: <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />,
    collapse: <path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    target: <><circle cx="12" cy="12" r="7" /><circle cx="12" cy="12" r="2" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" /></>,
    mouse: <><rect x="6" y="2" width="12" height="20" rx="6" /><path d="M12 3v7m-6 0h12" /></>,
    touch: <><path d="M9 12V5a2 2 0 0 1 4 0v7-2a2 2 0 0 1 4 0v2a2 2 0 0 1 4 0v4c0 4-3 6-6 6h-2c-2 0-3-1-4-2l-5-6a2 2 0 0 1 3-2l2 2" /><path d="M3 6 1 4m16 1 2-2" /></>,
    keyboard: <><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M7 16h10" /></>,
    spark: <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    plus: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8m-4-4v8" /></>,
    external: <path d="M7 17 17 7M7 7h10v10" />,
    home: <path d="m3 11 9-8 9 8m-16-1v11h14V10m-10 11v-7h6v7" />,
    check: <path d="m5 12 4 4L19 6" />,
    infinity: <path d="M12 12c-3-6-9-6-9 0s6 6 9 0 9-6 9 0-6 6-9 0Z" />,
    bolt: <path d="M13 2 4 14h7l-1 8 10-13h-7l1-7Z" />,
    recall: <path d="M5 5v8a7 7 0 0 0 14 0V8m-4 4 4-4 4 4" />,
    arrowUp: <path d="m6 14 6-6 6 6m-6-6v13M5 3h14" />,
};

export function Icon({ name, size = 20, className = '', style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name]}</svg>;
}

export function BrandMark({ small = false }: { small?: boolean }) {
  return <svg className={small ? 'brand-mark small' : 'brand-mark'} width="34" height="34" viewBox="0 0 34 34" fill="none" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="2" fill="currentColor" /><rect x="20" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" /><rect x="2" y="20" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2" /><path d="m21 31 10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /><circle cx="30" cy="22" r="3" fill="currentColor" /></svg>;
}