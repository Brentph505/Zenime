/**
 * SettingsOverlay
 *
 * Globally-available, centered modal overlay wrapping the Settings panel.
 * Rendered once inside the Navbar (sibling to NotificationsPanel) so Settings
 * is reachable from any page via the profile dropdown, instead of being a
 * route-bound overlay exclusive to /profile/settings.
 *
 * Theme-correct: opaque backgrounds driven by --global-* vars (the previous
 * in-page overlay used a hardcoded dark rgba that was near-invisible in light
 * mode). Body scroll locks while open.
 */

import React, { useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import { Settings } from './Settings';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const popIn = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 450;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(8px);
  animation: ${fadeIn} 0.18s ease both;
`;

const Panel = styled.div`
  width: min(100%, 44rem);
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
  border-radius: var(--global-border-radius, 8px);
  box-shadow: 0 24px 64px var(--global-card-shadow, rgba(0, 0, 0, 0.35));
  /* Opaque, theme-adaptive — was hardcoded rgba(17,24,39,0.96). */
  background: var(--global-secondary-bg, #161b22);
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.08));
  animation: ${popIn} 0.2s ease both;

  &::-webkit-scrollbar { width: 6px; }
  &::-webkit-scrollbar-thumb {
    background: var(--global-div, #30363d);
    border-radius: 99px;
  }
`;

interface SettingsOverlayProps {
  open: boolean;
  onClose: () => void;
}

export const SettingsOverlay: React.FC<SettingsOverlayProps> = ({ open, onClose }) => {
  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Close on overlay backdrop click (the Panel stops propagation).
  if (!open) return null;

  return (
    <Overlay
      role='dialog'
      aria-modal='true'
      aria-label='Settings'
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <Panel onMouseDown={(e) => e.stopPropagation()}>
        <Settings onClose={onClose} />
      </Panel>
    </Overlay>
  );
};

export default SettingsOverlay;
