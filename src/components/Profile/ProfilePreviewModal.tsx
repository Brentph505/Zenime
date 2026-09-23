import React, { useEffect } from 'react';
import styled, { createGlobalStyle, keyframes } from 'styled-components';
import { IoClose } from 'react-icons/io5';

const backdropEnter = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const backdropExit = keyframes`
  from { opacity: 1; }
  to   { opacity: 0; }
`;

const modalEnter = keyframes`
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.94);
    filter: blur(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
`;

const modalExit = keyframes`
  from {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
  to {
    opacity: 0;
    transform: translateY(12px) scale(0.96);
    filter: blur(3px);
  }
`;

const modalSpin = keyframes`
  to { --modal-border-angle: 360deg; }
`;

const modalGlow = keyframes`
  0%, 100% {
    box-shadow: 0 18px 44px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(255,255,255,0.06), 0 0 12px rgba(124,58,237,0.08), 0 0 20px rgba(8,145,178,0.06);
  }
  50% {
    box-shadow: 0 22px 54px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255,255,255,0.08), 0 0 18px rgba(124,58,237,0.13), 0 0 26px rgba(8,145,178,0.1);
  }
`;

const ModalBorderAngleProperty = createGlobalStyle`
  @property --modal-border-angle {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0deg;
  }
`;

const Backdrop = styled.div<{ $isClosing?: boolean }>`
  position: fixed;
  inset: 0;
  z-index: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: rgba(2, 6, 23, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: ${({ $isClosing }) => ($isClosing ? backdropExit : backdropEnter)} 180ms ease forwards;

  @media (max-width: 480px) {
    padding: 0.5rem;
  }
`;

const Modal = styled.div<{ $isClosing?: boolean }>`
  position: relative;
  width: min(92vw, 30rem);
  padding: 2px;
  border-radius: 1.2rem;
  overflow: visible;
  background: conic-gradient(
    from var(--modal-border-angle, 0deg),
    rgba(124, 58, 237, 0.9),
    rgba(219, 39, 119, 0.8),
    rgba(8, 145, 178, 0.8),
    rgba(124, 58, 237, 0.9)
  );
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.38), 0 0 0 1px rgba(255,255,255,0.06), 0 0 12px rgba(124,58,237,0.08), 0 0 20px rgba(8,145,178,0.06);
  animation: ${({ $isClosing }) => ($isClosing ? modalExit : modalEnter)} 180ms ease forwards, ${modalSpin} 7s linear infinite, ${modalGlow} 4s ease-in-out infinite;
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    inset: -8px;
    z-index: -1;
    border-radius: inherit;
    background: conic-gradient(
      from var(--modal-border-angle, 0deg),
      rgba(124, 58, 237, 0.24),
      rgba(219, 39, 119, 0.18),
      rgba(8, 145, 178, 0.18),
      rgba(124, 58, 237, 0.24)
    );
    filter: blur(16px);
    opacity: 0.9;
  }

  @media (max-width: 480px) {
    width: min(94vw, 100%);
    border-radius: 0.9rem;
  }
`;

const Header = styled.div`
  position: absolute;
  top: 0.65rem;
  right: 0.65rem;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: auto;
  padding: 0;
  background: transparent;
  border: none;
`;

const CloseButton = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.1rem;
  height: 2.1rem;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(15, 23, 42, 0.6);
  color: #fff;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.28);

  &:hover {
    background: rgba(30, 41, 59, 0.82);
  }

  svg {
    font-size: 1rem;
  }
`;

const ImageWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  overflow: hidden;
  background: rgba(9, 12, 18, 0.9);
  border-radius: 1.08rem;
`;

const ProfileImage = styled.img`
  display: block;
  width: 100%;
  max-height: min(82vh, 42rem);
  object-fit: cover;
  border-radius: 1.08rem;
  background: var(--global-secondary-bg);
`;

interface ProfilePreviewModalProps {
  open: boolean;
  onClose: () => void;
  user: {
    name: string;
    avatar: { large: string };
  } | null;
}

export const ProfilePreviewModal: React.FC<ProfilePreviewModalProps> = ({ open, onClose, user }) => {
  const [isClosing, setIsClosing] = React.useState(false);

  if (!user) return null;

  const shouldRender = open || isClosing;

  useEffect(() => {
    if (open) {
      setIsClosing(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleClose = () => {
    if (isClosing) return;
    setIsClosing(true);
    window.setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 180);
  };

  if (!shouldRender) return null;

  const safeUser = user;

  return (
    <>
      <ModalBorderAngleProperty />
      <Backdrop $isClosing={isClosing} onClick={handleClose} role='dialog' aria-modal='true' aria-label={`${safeUser.name} profile image`}>
        <Modal $isClosing={isClosing} onClick={(event) => event.stopPropagation()}>
          <Header>
            <CloseButton aria-label='Close profile image' onClick={handleClose}>
              <IoClose />
            </CloseButton>
          </Header>

          <ImageWrap>
            <ProfileImage src={safeUser.avatar.large} alt={safeUser.name} />
          </ImageWrap>
        </Modal>
      </Backdrop>
    </>
  );
};

export default ProfilePreviewModal;
