import React from 'react';
import styled, { keyframes, css } from 'styled-components';

const pulseAnimation = keyframes`
  0%, 100% { background-color: var(--global-primary-skeleton); }
  50% { background-color: var(--global-secondary-skeleton); }
`;

const popInAnimation = keyframes`
  0%, 100% { opacity: 0; transform: scale(0.95); }
  50% { opacity: 1; transform: scale(1); }
  75% { opacity: 0.5; transform: scale(1); }
`;

const playerPopInAnimation = keyframes`
  0% { opacity: 0; transform: scale(0.9); }
  100% { opacity: 1; transform: scale(1); }
`;

const SkeletonPulse = keyframes`
  0%, 100% { background-color: var(--global-primary-skeleton); }
  25%, 75% { background-color: var(--global-secondary-skeleton); }
  50% { background-color: var(--global-primary-skeleton); }
`;

const animationMixin = css`
  animation:
    ${pulseAnimation} 1s infinite,
    ${popInAnimation} 1s infinite;
`;

const BaseSkeleton = styled.div`
  background: var(--global-primary-skeleton);
  border-radius: var(--global-border-radius);
`;

const SkeletonCardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 1rem;
  width: 100%;
  
  @media (max-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
`;

const SkeletonCards = styled(BaseSkeleton)`
  width: 100%;
  height: 0;
  padding-top: calc(100% * 184 / 133);
  margin-bottom: 5.1rem;
  ${animationMixin};
`;

const SkeletonTitle = styled(BaseSkeleton)`
  height: 1.4rem;
  margin: 0.5rem 0 0.3rem;
  ${animationMixin};
`;

const SkeletonDetails = styled(SkeletonTitle)`
  height: 1.3rem;
  width: 80%;
`;

export const SkeletonCard = React.memo(() => (
  <SkeletonCards>
    <SkeletonTitle />
    <SkeletonDetails />
    <SkeletonDetails />
  </SkeletonCards>
));

const SkeletonSlides = styled(BaseSkeleton)<{ loading?: boolean }>`
  width: 100%;
  height: 24rem;
  ${({ loading }) => !loading && animationMixin}
  @media (max-width: 1000px) {
    height: 20rem;
  }
  @media (max-width: 500px) {
    height: 18rem;
  }
`;

export const SkeletonSlide: React.FC<{ loading?: boolean }> = React.memo(
  ({ loading }) => (
    <SkeletonSlides loading={loading}>
      <SkeletonImage />
    </SkeletonSlides>
  ),
);

const SkeletonContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const PlayerSkeleton = styled(BaseSkeleton)`
  position: relative;
  padding-top: 56.25%;
  width: 100%;
  height: 0;
  animation:
    ${SkeletonPulse} 2.5s ease-in-out infinite,
    ${playerPopInAnimation} 0.5s ease-in-out;
`;

const PlayerButtons = styled(BaseSkeleton)`
  position: relative;
  height: 23px;
  width: 100%;
  animation:
    ${SkeletonPulse} 2.5s ease-in-out infinite,
    ${playerPopInAnimation} 0.5s ease-in-out;
`;

export const SkeletonPlayer = React.memo(() => (
  <SkeletonContainer>
    <PlayerSkeleton />
    <PlayerButtons />
  </SkeletonContainer>
));

const SkeletonImage = styled(BaseSkeleton)`
  width: 100%;
  height: 100%;
`;

// ─── Info Page Skeletons ─────────────────────────────────────────────────────

const InfoSkeletonContainer = styled.div`
  min-height: 100vh;
  background: transparent;
`;

const InfoHeroSkeleton = styled(BaseSkeleton)`
  width: 100vw;
  height: 360px;
  margin-left: -50vw;
  margin-right: -50vw;
  left: 50%;
  right: 50%;
  position: relative;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
  @media (max-width: 768px) { height: 180px; }
`;

const InfoShell = styled.div`
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1.5rem 5rem;
  position: relative;
  box-sizing: border-box;
  @media (max-width: 860px) {
    padding: 0 0 4rem;
    width: 100%;
  }
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: 230px 1fr;
  gap: 1.5rem;
  margin-top: -110px;
  position: relative;
  z-index: 2;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    margin-top: 0;
    gap: 0;
  }
`;

const InfoLeftCol = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  @media (max-width: 860px) { display: none; }
`;

const InfoPosterSkeleton = styled(BaseSkeleton)`
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: 8px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const InfoButtonSkeleton = styled(BaseSkeleton)`
  width: 100%;
  height: 2.5rem;
  border-radius: 6px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const InfoMetaRow = styled(BaseSkeleton)`
  width: 100%;
  height: 1.1rem;
  margin: 0.3rem 0;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const InfoRightCol = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.25rem 1.25rem 1.5rem;
  background: var(--global-div-tr);
  border: 1px solid var(--global-border);
  border-radius: 12px;
  @media (max-width: 860px) {
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-top: none;
    padding: 0.85rem 0.75rem 1.25rem;
    gap: 1rem;
    margin: 0;
    width: 100%;
    box-sizing: border-box;
  }
`;

const InfoTitleSkeleton = styled(BaseSkeleton)`
  width: 70%;
  height: 2.5rem;
  margin-bottom: 0.5rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
  @media (max-width: 600px) { height: 1.8rem; }
`;

const InfoSubtitleSkeleton = styled(BaseSkeleton)`
  width: 40%;
  height: 1.2rem;
  margin-bottom: 1rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const InfoPillRow = styled.div`
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
`;

const InfoPillSkeleton = styled(BaseSkeleton)`
  width: 60px;
  height: 1.5rem;
  border-radius: 99px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const InfoTabNav = styled.div`
  display: flex;
  border-bottom: 1px solid var(--global-border);
  gap: 0.5rem;
`;

const InfoTabSkeleton = styled(BaseSkeleton)`
  width: 80px;
  height: 2rem;
  margin-bottom: -1px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const InfoContentSkeleton = styled(BaseSkeleton)`
  width: 100%;
  height: 200px;
  margin-top: 1rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const InfoMobileHeader = styled.div`
  display: none;
  @media (max-width: 860px) {
    display: flex;
    align-items: flex-end;
    gap: 0.6rem;
    margin-top: -100px;
    position: relative;
    z-index: 3;
    padding: 0 0.75rem 1rem;
  }
`;

const InfoMobilePoster = styled(BaseSkeleton)`
  width: 100px;
  height: 140px;
  border-radius: 8px;
  flex-shrink: 0;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const InfoMobileTitleBlock = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`;

const InfoMobileTitle = styled(BaseSkeleton)`
  width: 80%;
  height: 1.2rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const InfoMobileSubtitle = styled(BaseSkeleton)`
  width: 50%;
  height: 0.9rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

// ─── Studio Page Skeletons ───────────────────────────────────────────────────

const StudioPageLayout = styled.div`
  gap: 1rem;
  margin: 0 auto;
  max-width: 125rem;
  border-radius: var(--global-border-radius);
  display: flex;
  flex-direction: column;
  width: 100%;
  box-sizing: border-box;
  overflow-x: hidden;
`;

const StudioHeroWrapper = styled(BaseSkeleton)`
  position: relative;
  background-color: var(--global-secondary-bg);
  border-radius: var(--global-border-radius);
  overflow: hidden;
  height: 120px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const StudioHeroBody = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 1.25rem;
  padding: 1.5rem;
  flex-wrap: wrap;
`;

const StudioAvatarSkeleton = styled(BaseSkeleton)`
  width: 60px;
  height: 60px;
  border-radius: var(--global-border-radius);
  flex-shrink: 0;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
  @media (max-width: 500px) {
    width: 48px;
    height: 48px;
  }
`;

const StudioHeroInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const StudioNameSkeleton = styled(BaseSkeleton)`
  width: 50%;
  height: 2rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
  @media (max-width: 500px) {
    height: 1.5rem;
  }
`;

const StudioStatsRow = styled.div`
  display: flex;
  gap: 1.5rem;
  flex-wrap: wrap;
  margin-top: 0.25rem;
`;

const StudioStatSkeleton = styled(BaseSkeleton)`
  width: 80px;
  height: 2.5rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const StudioCatalogHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
`;

const StudioTitleSkeleton = styled(BaseSkeleton)`
  width: 200px;
  height: 1.5rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const StudioTabsRow = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const StudioTabSkeleton = styled(BaseSkeleton)`
  width: 60px;
  height: 2rem;
  border-radius: var(--global-border-radius);
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

export const SkeletonStudio = React.memo(() => (
  <StudioPageLayout>
    <StudioHeroWrapper>
      <StudioHeroBody>
        <StudioAvatarSkeleton />
        <StudioHeroInfo>
          <StudioNameSkeleton />
          <StudioStatsRow>
            <StudioStatSkeleton />
            <StudioStatSkeleton />
            <StudioStatSkeleton />
          </StudioStatsRow>
        </StudioHeroInfo>
      </StudioHeroBody>
    </StudioHeroWrapper>
    <StudioCatalogHeader>
      <StudioTitleSkeleton />
      <StudioTabsRow>
        <StudioTabSkeleton />
        <StudioTabSkeleton />
        <StudioTabSkeleton />
        <StudioTabSkeleton />
        <StudioTabSkeleton />
      </StudioTabsRow>
    </StudioCatalogHeader>
    <SkeletonCardGrid>
      {Array.from({ length: 17 }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </SkeletonCardGrid>
  </StudioPageLayout>
));

export const SkeletonInfo = React.memo(() => (
  <InfoSkeletonContainer>
    <InfoHeroSkeleton />
    <InfoShell>
      <InfoMobileHeader>
        <InfoMobilePoster />
        <InfoMobileTitleBlock>
          <InfoMobileTitle />
          <InfoMobileSubtitle />
          <InfoPillRow>
            <InfoPillSkeleton />
            <InfoPillSkeleton />
          </InfoPillRow>
        </InfoMobileTitleBlock>
      </InfoMobileHeader>
      <InfoGrid>
        <InfoLeftCol>
          <InfoPosterSkeleton />
          <InfoButtonSkeleton />
          <InfoMetaRow style={{ width: '60%' }} />
          <InfoMetaRow style={{ width: '80%' }} />
          <InfoMetaRow style={{ width: '70%' }} />
          <InfoMetaRow style={{ width: '50%' }} />
        </InfoLeftCol>
        <InfoRightCol>
          <InfoTitleSkeleton />
          <InfoSubtitleSkeleton />
          <InfoPillRow>
            <InfoPillSkeleton />
            <InfoPillSkeleton />
            <InfoPillSkeleton />
          </InfoPillRow>
          <InfoTabNav>
            <InfoTabSkeleton />
            <InfoTabSkeleton />
            <InfoTabSkeleton />
          </InfoTabNav>
          <InfoContentSkeleton />
        </InfoRightCol>
      </InfoGrid>
    </InfoShell>
  </InfoSkeletonContainer>
));
