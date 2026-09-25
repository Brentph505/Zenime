import React, { useEffect } from 'react';
import styled from 'styled-components';

interface ToastNotificationProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

const Toast = styled.div`
  position: fixed;
  right: 1rem;
  bottom: 1rem;
  z-index: 1000;
  max-width: min(24rem, calc(100vw - 2rem));
  padding: 0.75rem 1rem;
  border-radius: var(--global-border-radius);
  background: var(--global-secondary-bg);
  color: var(--global-text);
  border: 1px solid var(--global-border);
  box-shadow: 0 0.5rem 1.5rem rgba(0, 0, 0, 0.25);
  font-size: 0.85rem;
`;

export const ToastNotification: React.FC<ToastNotificationProps> = ({
  message,
  onClose,
  duration = 3500,
}) => {
  useEffect(() => {
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <Toast role='status' aria-live='polite'>
      {message}
    </Toast>
  );
};

export default ToastNotification;
