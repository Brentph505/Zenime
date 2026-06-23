/**
 * SettingsOverlay
 *
 * A proper, self-contained modal for the Settings panel. Rendered once inside
 * the Navbar so Settings is reachable from any page (logged in or out) via the
 * profile dropdown.
 *
 * The modal owns its own shell (backdrop, card, header with close button) and
 * scrolls internally. `<Settings />` is a pure body component with no header
 * of its own, so nothing double-wraps or bleeds outside the card.
 *
 * Sizing: the modal has a fixed height (not just a max-height), so switching
 * between General / Media / Data no longer grows or shrinks the dialog —
 * each tab just scrolls internally if its content runs long. This is what
 * was causing the modal to visibly jump in size between tabs.
 *
 * Theme-correct: opaque --global-* backgrounds, works in light + dark mode.
 */

import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { IoClose, IoSettingsOutline } from 'react-icons/io5';
import { Settings } from './Settings';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const scaleIn = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
`;

/* ── Backdrop ── */
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 450;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  animation: ${fadeIn} 0.18s ease both;

  @media (max-width: 480px) {
    padding: 0.5rem;
  }
`;

/* ── Modal card (opaque, owns its own header) ── */
const Modal = styled.div`
  width: min(96%, 65rem);
  /* Fixed height across all sections — prevents modal from resizing when
     switching tabs. Content scrolls internally if needed. */
  height: min(90vh, 42rem);
  display: flex;
  flex-direction: column;
  border-radius: 14px;
  overflow: hidden;
  background: var(--global-primary-bg, #0d1117);
  border: 1px solid var(--global-border, rgba(255,255,255,0.08));
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
  animation: ${scaleIn} 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;

  @media (max-width: 768px) {
    width: min(98%, 100%);
    height: min(85vh, 38rem);
    border-radius: 12px;
  }

  @media (max-width: 480px) {
    width: calc(100% - 1rem);
    height: min(90vh, 35rem);
    border-radius: 10px;
  }
`;

/* ── Header (sticky, owns the close button) ── */
const Header = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--global-border, rgba(255,255,255,0.08));
  background: var(--global-secondary-bg, #161b22);

  @media (max-width: 480px) {
    padding: 0.8rem 0.9rem;
    gap: 0.5rem;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
`;

const HeaderIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: 9px;
  background: var(--primary-accent, #8080cf);
  color: #ffffff;
  font-size: 1.05rem;
  flex-shrink: 0;

  @media (max-width: 480px) {
    width: 1.7rem;
    height: 1.7rem;
    font-size: 0.9rem;
  }
`;

const TitleStack = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--global-text, #c9d1d9);
  letter-spacing: -0.01em;
  line-height: 1.2;

  @media (max-width: 480px) {
    font-size: 0.95rem;
  }
`;

const Subtitle = styled.span`
  font-size: 0.68rem;
  color: var(--global-text-muted, #8b949e);

  @media (max-width: 480px) {
    font-size: 0.6rem;
  }
`;

const CloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 9px;
  background: transparent;
  color: var(--global-text-muted, #8b949e);
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;

  &:hover { background: var(--global-tertiary-bg, #21262d); color: var(--global-text, #c9d1d9); }
  &:active { transform: scale(0.92); }

  svg { font-size: 1.25rem; }

  @media (max-width: 480px) {
    width: 1.8rem;
    height: 1.8rem;
    svg { font-size: 1.05rem; }
  }
`;

/* ── Scrollable body (renders the pure <Settings/> body) ── */
const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--global-primary-bg, #0d1117);
  padding: 3px 0;

  @media (min-width: 769px) {
    padding: 0;
  }
`;

interface SettingsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsOverlay: React.FC<SettingsOverlayProps> = ({ open, onClose }) => {
  const [activeSection, setActiveSection] = React.useState('App Behavior');

  // Lock body scroll + close on ESC while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <Backdrop
      role='dialog'
      aria-modal='true'
      aria-label='Settings'
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Modal onMouseDown={(e) => e.stopPropagation()}>
        <Header>
          <HeaderLeft>
            <HeaderIcon><IoSettingsOutline /></HeaderIcon>
            <TitleStack>
              <Title>Settings</Title>
              <Subtitle>{activeSection}</Subtitle>
            </TitleStack>
          </HeaderLeft>
          <CloseBtn onClick={onClose} aria-label='Close settings'>
            <IoClose />
          </CloseBtn>
        </Header>

        <Body>
          <Settings onSectionChange={setActiveSection} />
        </Body>
      </Modal>
    </Backdrop>
  );
};

export default SettingsOverlay;