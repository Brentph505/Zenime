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
// Mirrors the redesigned Studio page: a header card (avatar + name, no stats),
// a single bottom-border tab row, then the grid. No hero/background image.

const StudioPageLayout = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const StudioCardSkeleton = styled(BaseSkeleton)`
  display: flex;
  align-items: center;
  gap: 1.25rem;
  padding: 1.5rem;
  height: 120px;
  border-radius: 12px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
  @media (max-width: 500px) { padding: 1rem; gap: 0.85rem; }
`;

const StudioAvatarSkeleton = styled(BaseSkeleton)`
  width: 72px;
  height: 72px;
  border-radius: 10px;
  flex-shrink: 0;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
  @media (max-width: 500px) { width: 56px; height: 56px; }
`;

const StudioCardInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StudioEyebrowSkeleton = styled(BaseSkeleton)`
  width: 110px;
  height: 0.8rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const StudioNameSkeleton = styled(BaseSkeleton)`
  width: 45%;
  height: 2rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
  @media (max-width: 500px) { height: 1.5rem; }
`;

const StudioLinkRowSkeleton = styled.div`
  display: flex;
  gap: 0.4rem;
  margin-top: 0.35rem;
`;

const StudioLinkSkeleton = styled(BaseSkeleton)`
  width: 120px;
  height: 1.6rem;
  border-radius: 6px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const StudioCatalogSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const StudioCatalogHeader = styled.div`
  display: flex;
  align-items: center;
`;

const StudioLabelSkeleton = styled(BaseSkeleton)`
  width: 130px;
  height: 1rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const StudioTabNavSkeleton = styled.div`
  display: flex;
  border-bottom: 1px solid var(--global-border);
  gap: 0.5rem;
  padding-bottom: 1px;
`;

const StudioTabSkeleton = styled(BaseSkeleton)`
  width: 60px;
  height: 2rem;
  margin-bottom: -1px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

export const SkeletonStudio = React.memo(() => (
  <StudioPageLayout>
    <StudioCardSkeleton>
      <StudioAvatarSkeleton />
      <StudioCardInfo>
        <StudioEyebrowSkeleton />
        <StudioNameSkeleton />
        <StudioLinkRowSkeleton>
          <StudioLinkSkeleton />
          <StudioLinkSkeleton />
        </StudioLinkRowSkeleton>
      </StudioCardInfo>
    </StudioCardSkeleton>

    <StudioCatalogSection>
      <StudioCatalogHeader>
        <StudioLabelSkeleton />
      </StudioCatalogHeader>
      <StudioTabNavSkeleton>
        <StudioTabSkeleton />
        <StudioTabSkeleton />
        <StudioTabSkeleton />
        <StudioTabSkeleton />
        <StudioTabSkeleton />
      </StudioTabNavSkeleton>
      <SkeletonCardGrid>
        {Array.from({ length: 17 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </SkeletonCardGrid>
    </StudioCatalogSection>
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

// ─── Watch Page Skeletons ────────────────────────────────────────────────────
// Mirrors Watch.tsx exactly:
//   - WatchWrapper: flex column on mobile, flex row (video flex:3, list max 380px)
//     from 1000px up.
//   - EpisodeList: a scrollable stack of thumbnail + title/meta rows, not a
//     16:9 player.
//   - DataWrapper: 2-col grid on mobile, minmax(0,1fr) 380px grid from 1000px
//     up, holding MediaSource (server picker) + AnimeData (title/meta/desc)
//     on the left and AnimeDataList (relations) on the right.

const WatchSkeletonWrapper = styled.div`
  font-size: 0.9rem;
  gap: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;

  @media (min-width: 1000px) {
    flex-direction: row;
    align-items: flex-start;
  }
`;

const WatchVideoSkeletonContainer = styled.div`
  position: relative;
  width: 100%;
  border-radius: var(--global-border-radius);

  @media (min-width: 1000px) {
    flex: 3 1 0;
    min-width: 0;
  }
`;

const WatchEpisodeListSkeletonContainer = styled.div`
  width: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  @media (min-width: 1000px) {
    flex: 1 1 320px;
    max-width: 380px;
  }
`;

// Header row: "Episodes 1 - 12 ▾" dropdown pill on the left, a search box
// and a small image-filter icon on the right.
const EpisodeListHeaderRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.6rem;
  margin-bottom: 0.25rem;
`;

const EpisodeListDropdownSkeleton = styled(BaseSkeleton)`
  width: 130px;
  height: 1.6rem;
  border-radius: 6px;
  flex-shrink: 0;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const EpisodeListSearchSkeleton = styled(BaseSkeleton)`
  flex: 1;
  max-width: 150px;
  height: 1.6rem;
  border-radius: 6px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const EpisodeListIconSkeleton = styled(BaseSkeleton)`
  width: 1.4rem;
  height: 1.4rem;
  border-radius: 4px;
  flex-shrink: 0;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

// Each row mirrors a real episode card: a squarish thumbnail, a bold title
// line, and a two-line description snippet, all on one rounded row.
const EpisodeRowSkeletonWrapper = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.5rem;
  border-radius: 8px;
`;

const EpisodeRowThumbSkeleton = styled(BaseSkeleton)`
  width: 70px;
  height: 70px;
  border-radius: 6px;
  flex-shrink: 0;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const EpisodeRowTextSkeleton = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding-top: 0.15rem;
`;

const EpisodeRowTitleSkeleton = styled(BaseSkeleton)<{ $width?: string }>`
  width: ${({ $width }) => $width || '70%'};
  height: 0.95rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const EpisodeRowLineSkeleton = styled(BaseSkeleton)<{ $width?: string }>`
  width: ${({ $width }) => $width || '100%'};
  height: 0.7rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

export const SkeletonEpisodeRow = React.memo(() => (
  <EpisodeRowSkeletonWrapper>
    <EpisodeRowThumbSkeleton />
    <EpisodeRowTextSkeleton>
      <EpisodeRowTitleSkeleton $width="65%" />
      <EpisodeRowLineSkeleton $width="95%" />
      <EpisodeRowLineSkeleton $width="80%" />
    </EpisodeRowTextSkeleton>
  </EpisodeRowSkeletonWrapper>
));

export const SkeletonEpisodeList: React.FC<{ height?: string }> = React.memo(
  ({ height }) => (
    <WatchEpisodeListSkeletonContainer style={height ? { height } : undefined}>
      <EpisodeListHeaderRow>
        <EpisodeListDropdownSkeleton />
        <EpisodeListSearchSkeleton />
        <EpisodeListIconSkeleton />
      </EpisodeListHeaderRow>
      {Array.from({ length: 7 }, (_, i) => (
        <SkeletonEpisodeRow key={i} />
      ))}
    </WatchEpisodeListSkeletonContainer>
  ),
);

export const SkeletonWatchVideo = React.memo(() => (
  <WatchVideoSkeletonContainer>
    <SkeletonPlayer />
  </WatchVideoSkeletonContainer>
));

// Full top section, mirrors <WatchWrapper> (video + episode list side by side)
export const SkeletonWatchTop: React.FC<{ episodeListHeight?: string }> = React.memo(
  ({ episodeListHeight }) => (
    <WatchSkeletonWrapper>
      <SkeletonWatchVideo />
      <SkeletonEpisodeList height={episodeListHeight} />
    </WatchSkeletonWrapper>
  ),
);

// ── Below-the-player data section (MediaSource + AnimeData + AnimeDataList) ──

const WatchDataWrapperSkeleton = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  margin-top: 1rem;

  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1fr) 380px;
  }

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
    max-width: 100%;
  }
`;

const ServerRowSkeleton = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 0.5rem;
`;

const ServerButtonSkeleton = styled(BaseSkeleton)`
  width: 90px;
  height: 2.2rem;
  border-radius: 6px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

export const SkeletonMediaSource = React.memo(() => (
  <div>
    <ServerRowSkeleton>
      <ServerButtonSkeleton />
      <ServerButtonSkeleton />
      <ServerButtonSkeleton />
      <ServerButtonSkeleton />
    </ServerRowSkeleton>
    <ServerRowSkeleton>
      <ServerButtonSkeleton />
      <ServerButtonSkeleton />
    </ServerRowSkeleton>
  </div>
));

const AnimeDataSkeletonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin-top: 1.25rem;
`;

const AnimeDataTitleSkeleton = styled(BaseSkeleton)`
  width: 60%;
  height: 1.8rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const AnimeDataPillRow = styled.div`
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
`;

const AnimeDataPillSkeleton = styled(BaseSkeleton)`
  width: 65px;
  height: 1.5rem;
  border-radius: 99px;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const AnimeDataLineSkeleton = styled(BaseSkeleton)<{ $width?: string }>`
  width: ${({ $width }) => $width || '100%'};
  height: 0.9rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

export const SkeletonAnimeData = React.memo(() => (
  <AnimeDataSkeletonWrapper>
    <AnimeDataTitleSkeleton />
    <AnimeDataPillRow>
      <AnimeDataPillSkeleton />
      <AnimeDataPillSkeleton />
      <AnimeDataPillSkeleton />
    </AnimeDataPillRow>
    <AnimeDataLineSkeleton $width="100%" />
    <AnimeDataLineSkeleton $width="95%" />
    <AnimeDataLineSkeleton $width="80%" />
    <AnimeDataLineSkeleton $width="60%" />
  </AnimeDataSkeletonWrapper>
));

const RelationsSkeletonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
  margin-top: 1rem;
`;

const RelationRowSkeleton = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
`;

const RelationThumbSkeleton = styled(BaseSkeleton)`
  width: 50px;
  height: 70px;
  border-radius: 6px;
  flex-shrink: 0;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const RelationTextSkeleton = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;

const RelationLineSkeleton = styled(BaseSkeleton)<{ $width?: string }>`
  width: ${({ $width }) => $width || '100%'};
  height: 0.8rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

export const SkeletonRelations = React.memo(() => (
  <RelationsSkeletonWrapper>
    {Array.from({ length: 5 }, (_, i) => (
      <RelationRowSkeleton key={i}>
        <RelationThumbSkeleton />
        <RelationTextSkeleton>
          <RelationLineSkeleton $width="80%" />
          <RelationLineSkeleton $width="40%" />
        </RelationTextSkeleton>
      </RelationRowSkeleton>
    ))}
  </RelationsSkeletonWrapper>
));

// Full below-player section, mirrors <DataWrapper>
export const SkeletonWatchData = React.memo(() => (
  <WatchDataWrapperSkeleton>
    <div>
      <SkeletonMediaSource />
      <SkeletonAnimeData />
    </div>
    <SkeletonRelations />
  </WatchDataWrapperSkeleton>
));

// ─── Home Page: Sidebar List Skeleton ────────────────────────────────────────
// Mirrors HomeSideBar / AnimeCard exactly: a 24rem-max-width column of rows,
// each row min-height 6.5rem with 0.5rem margin-bottom (matching
// SidebarStyled's own `(6.5rem + 0.5rem) * n` scroll-height math), a
// 4.25rem x 6rem thumbnail, and a text column sized like TitleWithDot
// (two-line title) + Details (one meta line). Plain rectangles only.

const SideBarListSkeletonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 24rem;
  max-width: 100%;
  box-sizing: border-box;

  @media (max-width: 1000px) {
    width: 100%;
  }
`;

const SideBarRowSkeletonWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  min-height: 6.5rem;
  margin-bottom: 0.5rem;
  border-radius: var(--global-border-radius);
  box-sizing: border-box;
  overflow: hidden;
`;

const SideBarThumbSkeleton = styled(BaseSkeleton)`
  width: 4.25rem;
  height: 6rem;
  border-radius: var(--global-border-radius);
  flex-shrink: 0;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const SideBarTextSkeleton = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
  padding: 0 0.75rem;
`;

const SideBarTitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
`;

const SideBarTitleLineSkeleton = styled(BaseSkeleton)<{ $width?: string }>`
  width: ${({ $width }) => $width || '100%'};
  height: 0.8rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

const SideBarMetaLineSkeleton = styled(BaseSkeleton)<{ $width?: string }>`
  width: ${({ $width }) => $width || '55%'};
  height: 0.65rem;
  animation: ${SkeletonPulse} 2s ease-in-out infinite;
`;

export const SkeletonSideBarRow = React.memo(() => (
  <SideBarRowSkeletonWrapper>
    <SideBarThumbSkeleton />
    <SideBarTextSkeleton>
      <SideBarTitleBlock>
        <SideBarTitleLineSkeleton $width="95%" />
        <SideBarTitleLineSkeleton $width="65%" />
      </SideBarTitleBlock>
      <SideBarMetaLineSkeleton $width="55%" />
    </SideBarTextSkeleton>
  </SideBarRowSkeletonWrapper>
));

export const SkeletonSideBarList: React.FC<{ count?: number }> = React.memo(
  ({ count = 10 }) => (
    <SideBarListSkeletonWrapper>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonSideBarRow key={i} />
      ))}
    </SideBarListSkeletonWrapper>
  ),
);