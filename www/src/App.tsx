import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { BrandMark, Icon } from './components/Icon';
import { Modal } from './components/Modal';
import { ArcadeAudio } from './game/audio';
import { GAME_HEIGHT, GAME_WIDTH, INITIAL_SNAPSHOT, NeonEngine } from './game/engine';
import type { Snapshot } from './game/engine';
import { loadScores, loadSettings, saveScores, saveSettings } from './game/storage';
import type { HighScore, Settings } from './game/storage';
import { translations } from './i18n';
import type { Copy } from './i18n';

type Dialog = 'help' | 'settings' | 'scores' | null;
const number = (value: number) => value.toLocaleString('en-US');
const padded = (value: number) => number(value).padStart(4, '0');

const HowToPlay = memo(function HowToPlay({ t }: { t: Copy }) {
  return <aside className="instructions side-rail" aria-labelledby="guide-title">
    <div className="rail-eyebrow"><span className="tiny-line" />HOW TO PLAY</div>
    <h2 id="guide-title">{t.guideTitle}</h2>
    <p className="rail-intro">{t.guide}</p>
    <ol className="instructions-list">
      {[[t.stepOne, t.stepOneText], [t.stepTwo, t.stepTwoText], [t.stepThree, t.stepThreeText]].map(([title, text], index) =>
        <li key={title}><span className="step-number">0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>,
      )}
    </ol>
    <section className="keyboard-guide" id="keyboard-guide">
      <h3 className="section-label">{t.controls}</h3>
      <div className="control-row"><span className="keys" dir="ltr"><kbd><Icon name="left" size={13} /></kbd><kbd><Icon name="right" size={13} /></kbd></span><span>{t.aim}</span></div>
      <div className="control-row"><span className="keys"><kbd className="wide-key">SPACE</kbd></span><span>{t.shoot}</span></div>
      <div className="control-row"><span className="keys"><kbd>P</kbd><span className="key-or">/</span><kbd>ESC</kbd></span><span>{t.pause}</span></div>
      <div className="touch-note"><Icon name="touch" size={16} /><span>{t.touch}</span></div>
    </section>
    <div className="quick-tip"><Icon name="plus" size={22} /><div><h3>{t.tipTitle}</h3><p>{t.tip}</p></div></div>
  </aside>;
});

const Leaderboard = memo(function Leaderboard({ t, scores, language, highlighted, onOpen }: { t: Copy; scores: HighScore[]; language: string; highlighted: string; onOpen: () => void }) {
  const best = scores[0]?.score || 0;
  return <aside className="leaderboard side-rail" aria-labelledby="leaderboard-title">
    <div className="leaderboard-heading"><Icon name="trophy" size={21} /><h2 id="leaderboard-title">{t.leaderboard}</h2><span className="local-label">{t.local}</span></div>
    <div className="leaderboard-table-head"><span>{t.rank}</span><span>{t.score}</span></div>
    <ol className="leaderboard-list">
      {Array.from({ length: 5 }, (_, index) => {
        const entry = scores[index];
        return <li key={entry?.id || index} className={`${index === 0 ? 'first-place' : ''} ${entry?.id === highlighted ? 'highlighted-score' : ''}`}>
          <span className="rank-number" dir="ltr">0{index + 1}</span>
          <div className="score-person"><span>{entry ? entry.name || t.you : index === 0 ? t.waiting : t.emptyRow}</span>{entry && <small>{new Date(entry.date).toLocaleDateString(language === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short' })}</small>}</div>
          <span className={`row-score ${entry ? '' : 'empty-score'}`} dir="ltr">{entry ? number(entry.score) : '---'}</span>
        </li>;
      })}
    </ol>
    <button className="text-button view-scores" onClick={onOpen}><span>{scores.length ? t.all : t.emptyScores}</span><Icon name="external" size={15} /></button>
    <section className="personal-best"><div className="section-label"><Icon name="spark" size={15} />{t.personalBest}</div><div className="personal-best-value" dir="ltr">{padded(best)}<Icon name="external" size={24} /></div><p>{t.bestCaption}</p></section>
    <div className="storage-note"><Icon name="shield" size={15} /><span>{t.localNotice}</span></div>
  </aside>;
});

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [scores, setScores] = useState<HighScore[]>(loadScores);
  const [snapshot, setSnapshot] = useState<Snapshot>(INITIAL_SNAPSHOT);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [highlighted, setHighlighted] = useState('');
  const [newBest, setNewBest] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [engineError, setEngineError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameFrameRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<NeonEngine | null>(null);
  const audioRef = useRef<ArcadeAudio | null>(null);
  const settingsRef = useRef(settings);
  const scoresRef = useRef(scores);
  const resumeAfterDialog = useRef(false);
  const pointerRef = useRef<{ id: number; aimed: boolean } | null>(null);
  const t = translations[settings.language];
  const direction = settings.language === 'ar' ? 'rtl' : 'ltr';
  const bestScore = scores[0]?.score || 0;
  const active = ['aiming', 'shooting', 'advancing'].includes(snapshot.phase);
  const isExpanded = fullscreen || expanded;

  useEffect(() => {
    if (!canvasRef.current) return;
    const audio = new ArcadeAudio(settingsRef.current.sound);
    audioRef.current = audio;
    try {
      const engine = new NeonEngine(canvasRef.current, {
        onChange: setSnapshot,
        onSound: (cue, value) => audio.play(cue, value),
        onGameOver: (score, wave) => {
          const entry: HighScore = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: settingsRef.current.name.trim(), score, wave, date: new Date().toISOString(),
          };
          setNewBest(score > (scoresRef.current[0]?.score || 0));
          const nextScores = [...scoresRef.current, entry].sort((a, b) => b.score - a.score).slice(0, 10);
          scoresRef.current = nextScores;
          setScores(nextScores);
          setHighlighted(entry.id);
          if (!saveScores(nextScores)) setStorageOk(false);
        },
      }, settingsRef.current);
      engineRef.current = engine;
      return () => { engine.destroy(); audio.dispose(); engineRef.current = null; audioRef.current = null; };
    } catch {
      setEngineError(true);
      audio.dispose();
    }
  }, []);

  useEffect(() => {
    settingsRef.current = settings;
    engineRef.current?.setSettings(settings);
    audioRef.current?.setEnabled(settings.sound);
    if (!saveSettings(settings)) setStorageOk(false);
    document.documentElement.lang = settings.language;
    document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
    document.title = settings.language === 'ar' ? 'NEON BREAKER | كل ارتداد يصنع الفرق' : 'NEON BREAKER | Every bounce counts';
  }, [settings]);

  const startGame = useCallback(() => {
    audioRef.current?.unlock();
    setNewBest(false);
    pointerRef.current = null;
    setDragging(false);
    engineRef.current?.start();
    canvasRef.current?.focus({ preventScroll: true });
  }, []);

  const toggleSound = useCallback(() => {
    const sound = !settingsRef.current.sound;
    settingsRef.current = { ...settingsRef.current, sound };
    audioRef.current?.setEnabled(sound);
    if (sound) audioRef.current?.unlock();
    setSettings((previous) => ({ ...previous, sound }));
  }, []);

  const togglePause = useCallback(() => {
    if (engineRef.current?.getSnapshot().phase === 'paused') {
      audioRef.current?.unlock();
      engineRef.current.resume();
      canvasRef.current?.focus({ preventScroll: true });
    } else engineRef.current?.pause();
  }, []);

  const openDialog = useCallback((next: Dialog) => {
    resumeAfterDialog.current = engineRef.current?.pause() || false;
    setConfirmClear(false);
    setDialog(next);
  }, []);

  const openScores = useCallback(() => openDialog('scores'), [openDialog]);

  const closeDialog = useCallback(() => {
    setDialog(null);
    if (resumeAfterDialog.current) {
      engineRef.current?.resume();
      requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
    }
    resumeAfterDialog.current = false;
  }, []);

  const playFromScores = () => {
    const hasRun = engineRef.current?.getSnapshot().phase === 'paused';
    closeDialog();
    if (hasRun) {
      audioRef.current?.unlock();
      engineRef.current?.resume();
      requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
    } else startGame();
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (dialog) { if (event.key === 'Escape') closeDialog(); return; }
      if (event.target instanceof HTMLElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      const activation = event.code === 'Space' || event.key === 'Enter';
      if (activation && event.target instanceof HTMLElement && event.target.closest('button, a')) return;
      const phase = engineRef.current?.getSnapshot().phase;
      if (event.code === 'KeyM') { if (!event.repeat) toggleSound(); return; }
      if (event.key === 'Escape' && expanded) { setExpanded(false); engineRef.current?.pause(); return; }
      if (event.code === 'KeyP' || event.key === 'Escape') {
        event.preventDefault();
        if (!event.repeat) togglePause();
      } else if (event.code === 'KeyR') {
        event.preventDefault();
        if (!event.repeat) startGame();
      } else if (activation) {
        event.preventDefault();
        if (event.repeat) return;
        audioRef.current?.unlock();
        if (phase === 'menu' || phase === 'gameover') startGame();
        else if (phase === 'paused') togglePause();
        else if (phase === 'aiming') engineRef.current?.shoot();
      } else if (['ArrowLeft', 'ArrowRight', 'a', 'd', 'A', 'D', 'Shift'].includes(event.key)) {
        if (phase === 'aiming') { event.preventDefault(); engineRef.current?.setKey(event.key, true); }
      }
    };
    const onKeyUp = (event: KeyboardEvent) => engineRef.current?.setKey(event.key, false);
    const onVisibility = () => { if (document.hidden) engineRef.current?.pause(); };
    const onBlur = () => { engineRef.current?.clearKeys(); pointerRef.current = null; setDragging(false); };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [dialog, expanded, closeDialog, startGame, togglePause, toggleSound]);

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [expanded]);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) { void document.exitFullscreen().catch(() => {}); return; }
    if (expanded) { setExpanded(false); return; }
    const frame = gameFrameRef.current;
    if (frame?.requestFullscreen) void frame.requestFullscreen().catch(() => setExpanded(true));
    else setExpanded(true);
  };

  const getPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) / rect.width * GAME_WIDTH, y: (event.clientY - rect.top) / rect.height * GAME_HEIGHT };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!event.isPrimary || engineRef.current?.getSnapshot().phase !== 'aiming' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getPointer(event);
    pointerRef.current = { id: event.pointerId, aimed: engineRef.current.aimAt(point.x, point.y) };
    setDragging(true);
    audioRef.current?.unlock();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.pointerType !== 'mouse' && pointerRef.current?.id !== event.pointerId) return;
    const point = getPointer(event);
    const aimed = engineRef.current?.aimAt(point.x, point.y) || false;
    if (pointerRef.current?.id === event.pointerId) pointerRef.current.aimed ||= aimed;
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (pointerRef.current?.id !== event.pointerId) return;
    const shouldFire = pointerRef.current.aimed;
    pointerRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (shouldFire) engineRef.current?.shoot();
  };

  const clearScores = () => {
    scoresRef.current = [];
    setScores([]);
    setHighlighted('');
    if (!saveScores([])) setStorageOk(false);
    setConfirmClear(false);
  };

  const statusText = {
    menu: t.ready, aiming: t.aiming, shooting: t.shooting, advancing: t.advancing,
    paused: t.paused, gameover: t.over,
  }[snapshot.phase];

  return <div className={`app ${settings.effects ? '' : 'reduced-effects'}`} dir={direction}>
    <header className="site-header">
      <div className="header-inner">
        <a href="#" className="brand" aria-label={`Neon Breaker / ${t.mainMenu}`} onClick={(event) => { event.preventDefault(); if (active) engineRef.current?.pause(); else engineRef.current?.menu(); }}>
          <BrandMark /><span className="brand-wordmark">NEON<span>BREAKER</span></span><span className="brand-divider" /><span className="brand-caption">A LITTLE LESS ORDINARY.</span>
        </a>
        <nav className="header-actions" aria-label={t.settings}>
          <button className="nav-link" onClick={() => openDialog('help')} aria-label={t.navHelp}><Icon name="help" size={17} /><span>{t.navHelp}</span></button>
          <button className="nav-link" onClick={openScores} aria-label={t.navScores}><Icon name="trophy" size={17} /><span>{t.navScores}</span></button>
          <span className="nav-divider" />
          <button className={`icon-button sound-button ${settings.sound ? '' : 'is-muted'}`} onClick={toggleSound} aria-label={settings.sound ? t.soundOn : t.soundOff} title={settings.sound ? t.soundOn : t.soundOff} aria-pressed={settings.sound}><Icon name={settings.sound ? 'sound' : 'muted'} size={19} /></button>
          <button className="icon-button" onClick={() => openDialog('settings')} aria-label={t.settings} title={t.settings}><Icon name="settings" size={19} /></button>
          <button className="language-button" onClick={() => setSettings((previous) => ({ ...previous, language: previous.language === 'ar' ? 'en' : 'ar' }))} aria-label={t.language}>{settings.language === 'ar' ? 'EN' : 'ع'}</button>
        </nav>
      </div>
    </header>

    <main className="main-shell">
      <section className="page-heading">
        <div><h1>{t.title}</h1><p>{t.subtitle}</p></div>
        <div className="mode-label"><span className="mode-icon"><Icon name="infinity" size={24} /></span><div><span>{t.mode}</span><small>{t.endless}</small></div><span className="live-dot" /></div>
      </section>

      <div className="game-layout">
        <div className="instructions-column" dir={direction}><HowToPlay t={t} /></div>

        <section className="game-column" aria-label="Neon Breaker" style={expanded ? { animation: 'none', transform: 'none' } : undefined}>
          <div ref={gameFrameRef} className={`game-frame ${expanded ? 'is-expanded' : ''} ${dragging ? 'is-aiming' : ''}`} dir={direction}>
            <div className="game-hud">
              <div className="hud-metrics">
                <div className="hud-stat current-score"><span>{t.score}</span><strong key={snapshot.score} className={settings.effects && snapshot.score > 0 ? 'score-pop' : ''} dir="ltr">{padded(snapshot.score)}</strong></div>
                <div className="hud-stat best-score"><span><Icon name="trophy" size={12} />{t.best}</span><strong dir="ltr">{padded(Math.max(bestScore, snapshot.score))}</strong></div>
                <div className="hud-stat round-stat"><span>{t.wave}</span><strong dir="ltr">{String(snapshot.wave).padStart(2, '0')}</strong></div>
              </div>
              <div className="game-hud-actions"><button className="icon-button" onClick={toggleFullscreen} aria-label={isExpanded ? t.collapse : t.expand} title={isExpanded ? t.collapse : t.expand}><Icon name={isExpanded ? 'collapse' : 'expand'} size={17} /></button><button className="icon-button pause-button" onClick={togglePause} disabled={snapshot.phase === 'menu' || snapshot.phase === 'gameover'} aria-label={snapshot.phase === 'paused' ? t.resume : t.pause} title={`${t.pause} (P)`}><Icon name={snapshot.phase === 'paused' ? 'play' : 'pause'} size={18} /></button></div>
            </div>

            <div className={`playfield phase-${snapshot.phase}`}>
              <canvas ref={canvasRef} tabIndex={0} role="application" aria-label={t.canvasLabel} aria-describedby="keyboard-guide" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { pointerRef.current = null; setDragging(false); }} onContextMenu={(event) => event.preventDefault()}>{t.canvasError}</canvas>
              {engineError && <div className="game-overlay error-overlay"><Icon name="help" size={32} /><p>{t.canvasError}</p></div>}
              {!engineError && snapshot.phase === 'menu' && <div className="game-overlay start-overlay">
                <div className="start-content">
                  <div className="start-eyebrow"><span />{t.startEyebrow}</div>
                  <div className="hero-wordmark" dir="ltr"><span>NEON</span><strong>BREAKER<span className="wordmark-period">.</span></strong></div>
                  <p className="start-tagline">{t.startTagline}</p>
                  <button className="primary-button start-button" onClick={startGame}><Icon name="play" size={21} /><span>{t.start}</span><span className="button-enter" aria-hidden="true"><svg width="15" height="15" viewBox="0 0 20 20" fill="none"><path d="M15 4v8H4m4-4-4 4 4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span></button>
                  <div className="start-shortcut"><span>{t.orPress}</span><kbd>SPACE</kbd><span>{t.toStart}</span></div>
                </div>
              </div>}

              {snapshot.phase === 'paused' && <div className="game-overlay state-overlay">
                <div className="state-content"><div className="state-symbol"><Icon name="pause" size={27} /></div><span className="eyebrow">HIT PAUSE, NOT QUIT.</span><h2>{t.pauseTitle}</h2><p>{t.pauseSubtitle}</p><button className="primary-button" onClick={togglePause}><Icon name="play" size={20} />{t.resume}</button><button className="secondary-button" onClick={startGame}><Icon name="restart" size={17} />{t.restart}<kbd>R</kbd></button><button className="text-button back-to-menu" onClick={() => engineRef.current?.menu()}>{t.mainMenu}</button></div>
              </div>}

              {snapshot.phase === 'gameover' && <div className="game-overlay state-overlay gameover-overlay">
                <div className="state-content"><div className={`state-symbol ${newBest ? 'record-symbol' : ''}`}><Icon name={newBest ? 'trophy' : 'restart'} size={27} /></div><span className="eyebrow">{newBest ? t.newBest : 'ONE. MORE. ROUND.'}</span><h2>{t.gameOverTitle}</h2><p className="gameover-subtitle">{t.gameOverSubtitle}</p><div className="end-stats"><div><span>{t.finalScore}</span><strong dir="ltr">{number(snapshot.score)}</strong></div><div><span>{t.reachedWave}</span><strong dir="ltr">{String(snapshot.wave).padStart(2, '0')}</strong></div></div><button className="primary-button" onClick={startGame}><Icon name="restart" size={19} />{t.again}<kbd>R</kbd></button><button className="text-button back-to-menu" onClick={() => engineRef.current?.menu()}>{t.mainMenu}</button><small className="saved-message"><Icon name="check" size={13} />{storageOk ? t.saved : t.storageError}</small></div>
              </div>}

              {active && snapshot.combo > 1 && <div className="combo-indicator" key={snapshot.combo} dir="ltr"><Icon name="bolt" size={15} /><strong>x{snapshot.combo}</strong><span>{t.combo}</span></div>}
            </div>

            <div className="game-status"><span className="ball-counter" dir="ltr"><i /> <strong>{snapshot.balls}</strong><span>{t.balls}</span></span><div className="status-copy"><span className={`status-dot ${active ? 'active' : ''}`} /><span>{statusText}</span></div>{snapshot.phase === 'shooting' ? <button className="recall-button" onClick={() => engineRef.current?.recall()} title={t.recall}><Icon name="recall" size={14} /><span>{t.recallShort}</span></button> : <span className="arena-number" dir="ltr">NB / 001</span>}</div>

            {active && <div className="touch-controls" dir="ltr">
              <button className="touch-aim" aria-label={t.aimLeft} disabled={snapshot.phase !== 'aiming'} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); engineRef.current?.setKey('ArrowLeft', true); }} onPointerUp={() => engineRef.current?.setKey('ArrowLeft', false)} onPointerCancel={() => engineRef.current?.setKey('ArrowLeft', false)} onLostPointerCapture={() => engineRef.current?.setKey('ArrowLeft', false)} onClick={() => engineRef.current?.nudgeAim(-1)}><Icon name="left" /></button>
              <button className="touch-fire" disabled={snapshot.phase === 'advancing'} onClick={() => { audioRef.current?.unlock(); if (snapshot.phase === 'shooting') engineRef.current?.recall(); else engineRef.current?.shoot(); }}><Icon name={snapshot.phase === 'shooting' ? 'recall' : 'play'} size={17} /><span>{snapshot.phase === 'shooting' ? t.recallShort : t.fire}</span></button>
              <button className="touch-aim" aria-label={t.aimRight} disabled={snapshot.phase !== 'aiming'} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); engineRef.current?.setKey('ArrowRight', true); }} onPointerUp={() => engineRef.current?.setKey('ArrowRight', false)} onPointerCancel={() => engineRef.current?.setKey('ArrowRight', false)} onLostPointerCapture={() => engineRef.current?.setKey('ArrowRight', false)} onClick={() => engineRef.current?.nudgeAim(1)}><Icon name="right" /></button>
            </div>}
          </div>
          <div className="below-arena"><span><Icon name="mouse" size={14} /><span>{t.touchHint}</span></span><span className="arena-signature">STAY SHARP. BREAK MORE.</span></div>
          <div className="sr-only" role="status" aria-live="polite">{snapshot.phase === 'gameover' ? `${t.gameOverTitle} ${t.score}: ${snapshot.score}` : snapshot.phase === 'paused' ? t.pauseTitle : snapshot.phase === 'aiming' ? `${t.wave} ${snapshot.wave}. ${t.balls}: ${snapshot.balls}` : ''}</div>
        </section>

        <div className="leaderboard-column" dir={direction}><Leaderboard t={t} scores={scores} language={settings.language} highlighted={highlighted} onOpen={openScores} /></div>
      </div>

      <footer className="site-footer"><div><BrandMark small /><span>{t.footerLeft}</span></div><span>{t.footerRight}<span className="footer-dot" />NEON BREAKER <span className="version">V.01</span></span></footer>
    </main>

    {dialog === 'help' && <Modal title={t.helpTitle} subtitle={t.helpSubtitle} closeLabel={t.close} direction={direction} onClose={closeDialog} className="help-modal"><p className="help-intro">{t.helpGoal}</p><div className="help-sections"><section><h3><Icon name="keyboard" size={18} />{t.keyboard}</h3><ul><li>{t.keyboardAim}<small>{t.keyboardFine}</small></li><li>{t.keyboardShoot}</li><li>{t.keyboardPause}</li><li>{t.keyboardRestart}</li></ul></section><section><h3><Icon name="touch" size={18} />{t.mouseTouch}</h3><p>{t.pointerHelp}</p></section></div><div className="help-tip"><Icon name="spark" size={23} /><p>{t.comboHelp}</p></div><button className="primary-button modal-primary" onClick={closeDialog}><Icon name="check" size={19} />{t.gotIt}</button></Modal>}

    {dialog === 'settings' && <Modal title={t.settings} subtitle={t.settingsSubtitle} closeLabel={t.close} direction={direction} onClose={closeDialog}><label className="name-field"><span>{t.playerName}</span><input type="text" maxLength={18} value={settings.name} placeholder={t.namePlaceholder} onChange={(event) => setSettings((previous) => ({ ...previous, name: event.target.value }))} autoComplete="nickname" /></label><div className="setting-toggles">{([
      ['sound', t.sound, t.soundDescription], ['effects', t.effects, t.effectsDescription], ['haptics', t.haptics, t.hapticsDescription],
    ] as const).map(([key, label, description]) => <div className="setting-row" key={key}><div><h3 id={`setting-${key}`}>{label}</h3><p>{description}</p></div><button role="switch" aria-checked={settings[key]} aria-labelledby={`setting-${key}`} className={`toggle-switch ${settings[key] ? 'is-on' : ''}`} onClick={() => { if (key === 'sound') toggleSound(); else setSettings((previous) => ({ ...previous, [key]: !previous[key] })); }}><span /></button></div>)}</div><p className={`settings-saved ${storageOk ? '' : 'storage-error'}`}><Icon name={storageOk ? 'shield' : 'help'} size={15} />{storageOk ? t.settingsSaved : t.storageError}</p><button className="primary-button modal-primary" onClick={closeDialog}><Icon name="check" size={18} />{t.done}</button></Modal>}

    {dialog === 'scores' && (
      <Modal title={t.leaderboard} subtitle={t.scoresSubtitle} closeLabel={t.close} direction={direction} onClose={closeDialog} className="scores-modal">
        {scores.length ? <>
          <div className="full-score-table">
            <div className="full-score-row score-table-heading"><span>#</span><span>{t.player}</span><span>{t.wave}</span><span>{t.score}</span></div>
            {scores.map((entry, index) => (
              <div className={`full-score-row ${entry.id === highlighted ? 'new-score-row' : ''}`} key={entry.id}>
                <span className="full-rank">{index === 0 ? <Icon name="trophy" size={18} /> : String(index + 1).padStart(2, '0')}</span>
                <div className="full-player"><strong>{entry.name || t.you}</strong><small>{new Date(entry.date).toLocaleDateString(settings.language === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'short' })}</small></div>
                <span className="full-wave" dir="ltr">{String(entry.wave).padStart(2, '0')}</span>
                <strong className="full-score" dir="ltr">{number(entry.score)}</strong>
              </div>
            ))}
          </div>
          {confirmClear ? (
            <div className="clear-confirmation">
              <p>{t.confirmClear}</p>
              <div><button className="danger-button" onClick={clearScores}>{t.confirm}</button><button className="secondary-button" onClick={() => setConfirmClear(false)}>{t.cancel}</button></div>
            </div>
          ) : (
            <div className="score-modal-footer"><span><Icon name="shield" size={14} />{storageOk ? t.localNotice : t.storageError}</span><button className="text-button danger-text" onClick={() => setConfirmClear(true)}>{t.clearScores}</button></div>
          )}
        </> : (
          <div className="empty-leaderboard">
            <Icon name="trophy" size={42} /><h3>{t.noScoresTitle}</h3><p>{t.noScoresText}</p>
            <button className="primary-button" onClick={playFromScores}>{snapshot.phase === 'paused' ? t.resume : t.start}<Icon name="play" size={18} /></button>
          </div>
        )}
      </Modal>
    )}
  </div>;
}
