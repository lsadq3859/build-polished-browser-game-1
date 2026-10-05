import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface ModalProps {
  title: string;
  subtitle: string;
  closeLabel: string;
  direction: 'rtl' | 'ltr';
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Modal({ title, subtitle, closeLabel, direction, onClose, children, className = '' }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        close.current();
      }
      if (event.key !== 'Tab' || !panel.current) return;
      const elements = Array.from(panel.current.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]'));
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return createPortal(
    <div className="modal-backdrop" onPointerDown={(event) => { if (event.target === event.currentTarget) onClose(); }} dir={direction}>
      <div className={`modal-panel ${className}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-subtitle" ref={panel}>
        <header className="modal-heading">
          <div><span className="eyebrow">NEON BREAKER / ARCADE</span><h2 id="modal-title">{title}</h2><p id="modal-subtitle">{subtitle}</p></div>
          <button className="icon-button modal-close" onClick={onClose} aria-label={closeLabel}><Icon name="close" /></button>
        </header>
        {children}
      </div>
    </div>,
    document.fullscreenElement || document.body,
  );
}