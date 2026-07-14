import React from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import { IoCloseCircleOutline } from 'react-icons/io5';
import { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const scaleIn = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 9999;
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

const ModalContent = styled.div`
  background: var(--global-primary-bg, #0d1117);
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.08));
  border-radius: 14px;
  padding: 2rem;
  width: min(96%, 32rem);
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
  animation: ${scaleIn} 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  text-align: center;

  @media (max-width: 480px) {
    padding: 1.5rem;
    gap: 1rem;
  }
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  color: var(--global-text, #c9d1d9);
  font-weight: 700;

  @media (max-width: 480px) {
    font-size: 1.1rem;
  }
`;

const Description = styled.p`
  margin: 0;
  font-size: 0.95rem;
  color: var(--global-text-muted, #8b949e);
  line-height: 1.5;
`;

const LoginButton = styled.button`
  background: var(--primary-accent, #c084fc);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  justify-content: center;
  width: fit-content;

  &:hover {
    filter: brightness(1.1);
  }

  &:active {
    transform: scale(0.98);
  }

  svg {
    font-size: 1.1rem;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: transparent;
  border: none;
  color: var(--global-text-muted, #8b949e);
  cursor: pointer;
  font-size: 1.5rem;
  transition: color 0.2s;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;

  &:hover {
    color: var(--global-text, #c9d1d9);
  }

  @media (max-width: 480px) {
    top: 0.75rem;
    right: 0.75rem;
  }
`;

const ModalWrapper = styled.div`
  position: relative;
`;

interface AddToListLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginClick: () => void;
}

export const AddToListLoginModal: React.FC<AddToListLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginClick,
}) => {
  // Lock body scroll while open
  React.useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <Overlay onClick={onClose}>
      <ModalWrapper>
        <ModalContent onClick={(e) => e.stopPropagation()}>
          <CloseButton onClick={onClose}>
            <IoCloseCircleOutline />
          </CloseButton>
          <Title>Edit your list</Title>
          <Description>
            Sign in with your AniList account to add this title to your list and track your progress.
          </Description>
          <LoginButton onClick={onLoginClick}>
            <span>Log in with</span>
            <strong>AniList</strong>
          </LoginButton>
        </ModalContent>
      </ModalWrapper>
    </Overlay>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
