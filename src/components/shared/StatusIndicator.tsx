import styled from 'styled-components';
import React, { useMemo } from 'react';

const IndicatorDot = styled.div`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  margin: 0rem;
  flex-shrink: 0;
`;

const OngoingIndicator = styled(IndicatorDot)`
  background-color: var(--ongoing-dot-color);
`;

const CompletedIndicator = styled(IndicatorDot)`
  background-color: var(--completed-indicator-color);
`;

const CancelledIndicator = styled(IndicatorDot)`
  background-color: var(--cancelled-indicator-color);
`;

const NotYetAiredIndicator = styled(IndicatorDot)`
  background-color: var(--not-yet-aired-indicator-color);
`;

const DefaultIndicator = styled(IndicatorDot)`
  background-color: var(--default-indicator-color);
`;

export const StatusIndicator: React.FC<{ status: string }> = ({ status }) => {
  const handleStatusCheck = useMemo(() => {
    const normalizedStatus = status.trim().toUpperCase().replace(/[\s-]+/g, '_');

    switch (normalizedStatus) {
      case 'ONGOING':
      case 'RELEASING':
        return <OngoingIndicator />;
      case 'COMPLETED':
      case 'FINISHED':
        return <CompletedIndicator />;
      case 'CANCELLED':
      case 'CANCELED':
        return <CancelledIndicator />;
      case 'NOT_YET_AIRED':
      case 'NOT_YET_RELEASED':
      case 'UPCOMING':
        return <NotYetAiredIndicator />;
      default:
        return <DefaultIndicator />;
    }
  }, [status]); // Ensure all dependencies are correctly listed

  return <>{handleStatusCheck}</>;
};
