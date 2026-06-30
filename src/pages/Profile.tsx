import React, { useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useAuth, EpisodeCard, WatchingAnilist } from '../index';
import { ANILIST_ENTRY_CHANGED_EVENT } from '../hooks/useAniListEntry';
import { SiAnilist } from 'react-icons/si';
import { CgProfile } from 'react-icons/cg';
import { FiClock, FiStar, FiTv, FiFilm } from 'react-icons/fi';

/* ── Animations ── */
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const popIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* ── Page (matches Home/History: centered, max-width 125rem) ── */
const Page = styled.div`
  width: 100%;
  max-width: 125rem;
  margin: 0 auto;
  box-sizing: border-box;
  overflow-x: hidden;
  padding: 0.25rem 0.25rem 2.5rem;
  animation: ${fadeUp} 0.35s ease both;

  @media (min-width: 768px) { padding: 0.5rem 0.5rem 2.5rem; }
`;

/* ── Header: cover + overlapping avatar in one continuous block ── */
const Header = styled.div`
  position: relative;
`;

const CoverWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 120px;
  overflow: hidden;
  border-radius: var(--global-border-radius);

  @media (min-width: 600px) { height: 150px; }
  @media (min-width: 900px) { height: 180px; }
`;

const CoverBg = styled.div<{ $src: string | null }>`
  width: 100%;
  height: 100%;
  background-color: var(--global-secondary-bg);

  ${({ $src }) =>
    $src
      ? css`
          background-image: url(${$src});
          background-size: cover;
          background-position: center 30%;
        `
      : css`
          background:
            radial-gradient(ellipse 60% 80% at 20% 60%, rgba(124,58,237,0.28) 0%, transparent 65%),
            radial-gradient(ellipse 45% 60% at 80% 30%, rgba(219,39,119,0.18) 0%, transparent 65%),
            radial-gradient(ellipse 40% 55% at 55% 85%, rgba(8,145,178,0.10) 0%, transparent 65%);
        `}
`;

const CoverScrim = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.4) 100%);
`;

/* avatar sits half on the cover, half on the card below it */
const AvatarRing = styled.div`
  position: absolute;
  left: 1rem;
  bottom: -28px;
  z-index: 2;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  padding: 2.5px;
  background: linear-gradient(135deg, var(--primary-accent, #7c3aed), #db2777, #0891b2);
  box-shadow: 0 4px 16px rgba(0,0,0,0.35);
  box-sizing: border-box;

  @media (min-width: 600px) {
    left: 1.25rem;
    bottom: -32px;
    width: 76px;
    height: 76px;
  }
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  border: 3px solid var(--global-secondary-bg);
  box-sizing: border-box;
`;

/* ── Identity + stats card, flows directly from the header ── */
const InfoCard = styled.div`
  background: var(--global-secondary-bg);
  border-radius: var(--global-border-radius);
  margin-top: 0.5rem;
  padding: 0.85rem 0.9rem 0.75rem;
`;

const NameRow = styled.div`
  padding-left: calc(64px + 0.85rem);
  min-height: 28px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.1rem;

  @media (min-width: 600px) {
    padding-left: calc(76px + 1rem);
  }
`;

const Username = styled.h1`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--global-text);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (min-width: 600px) { font-size: 1.2rem; }
`;

const SubLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.66rem;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

/* ── Stats: a single flat strip with thin dividers — no boxed cards ── */
const StatsStrip = styled.div`
  display: flex;
  align-items: stretch;
  margin-top: 0.9rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--global-border);
`;

const Stat = styled.div<{ $delay?: string }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.15rem 0.4rem;
  animation: ${popIn} 0.3s ease both;
  animation-delay: ${({ $delay }) => $delay ?? '0s'};

  & + & {
    border-left: 1px solid var(--global-border);
  }
`;

const StatIcon = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.95rem;
  color: var(--primary-accent);
  flex-shrink: 0;
`;

const StatText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
  line-height: 1;
`;

const StatValue = styled.span`
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--global-text);
  letter-spacing: -0.02em;
`;

const StatLabel = styled.span`
  font-size: 0.58rem;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
`;

/* ── Guest state ── */
const GuestWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.7rem;
  padding: 2.25rem 1.5rem 1.75rem;
  text-align: center;
`;

const GuestCircle = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--global-card-bg);
  border: 1px solid var(--global-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--global-text-muted);
`;

const GuestTitle = styled.p`
  margin: 0;
  font-size: 0.92rem;
  font-weight: 700;
  color: var(--global-text);
`;

const GuestDesc = styled.p`
  margin: 0;
  font-size: 0.78rem;
  color: var(--global-text-muted);
  max-width: 250px;
  line-height: 1.6;
`;

const LoginBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.25rem;
  border-radius: var(--global-border-radius);
  border: 1px solid var(--global-border);
  background: var(--global-tertiary-bg);
  color: var(--primary-accent);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.16s, border-color 0.16s, transform 0.16s;

  &:hover {
    border-color: var(--primary-accent);
    transform: translateY(-1px);
  }
  &:active { transform: scale(0.97); }
`;

/* ── Content section ── */
const ContentWrap = styled.div`
  width: 100%;
  margin-top: 1.5rem;
  box-sizing: border-box;
`;

/* ─────────── Component ─────────── */
export const Profile: React.FC = () => {
  const { isLoggedIn, userData, login, refreshUserData } = useAuth();

  // Refresh stats (counts, mean score, …) when a list entry changes elsewhere
  // (e.g. status/score set on the Info page) so the numbers don't go stale.
  useEffect(() => {
    if (!isLoggedIn) return;
    const handler = () => { void refreshUserData(); };
    window.addEventListener(ANILIST_ENTRY_CHANGED_EVENT, handler);
    return () => window.removeEventListener(ANILIST_ENTRY_CHANGED_EVENT, handler);
  }, [isLoggedIn, refreshUserData]);

  useEffect(() => {
    document.title = isLoggedIn && userData
      ? `${userData.name} | Profile`
      : 'Profile';
  }, [isLoggedIn, userData]);

  const coverSrc = userData?.bannerImage ?? null;

  return (
    <Page>
      {isLoggedIn && userData ? (
        <>
          {/* Cover + overlapping avatar, one continuous header */}
          <Header>
            <CoverWrapper>
              <CoverBg $src={coverSrc} />
              <CoverScrim />
            </CoverWrapper>

            <AvatarRing>
              <AvatarImg src={userData.avatar.large} alt={userData.name} />
            </AvatarRing>
          </Header>

          <InfoCard>
            <NameRow>
              <Username>{userData.name}</Username>
              <SubLabel><SiAnilist size={10} /> AniList Member</SubLabel>
            </NameRow>

            {userData.statistics && (
              <StatsStrip>
                <Stat $delay="0.02s">
                  <StatIcon><FiFilm /></StatIcon>
                  <StatText>
                    <StatValue>{userData.statistics.anime.count}</StatValue>
                    <StatLabel>Anime</StatLabel>
                  </StatText>
                </Stat>

                <Stat $delay="0.06s">
                  <StatIcon><FiTv /></StatIcon>
                  <StatText>
                    <StatValue>{userData.statistics.anime.episodesWatched}</StatValue>
                    <StatLabel>Episodes</StatLabel>
                  </StatText>
                </Stat>

                <Stat $delay="0.1s">
                  <StatIcon><FiClock /></StatIcon>
                  <StatText>
                    <StatValue>
                      {Math.round(userData.statistics.anime.minutesWatched / 60)}h
                    </StatValue>
                    <StatLabel>Hours</StatLabel>
                  </StatText>
                </Stat>

                <Stat $delay="0.14s">
                  <StatIcon><FiStar /></StatIcon>
                  <StatText>
                    <StatValue>
                      {userData.statistics.anime.meanScore.toFixed(1)}
                    </StatValue>
                    <StatLabel>Avg Score</StatLabel>
                  </StatText>
                </Stat>
              </StatsStrip>
            )}
          </InfoCard>
        </>
      ) : (
        <InfoCard>
          <GuestWrap>
            <GuestCircle><CgProfile size={24} /></GuestCircle>
            <GuestTitle>Not logged in</GuestTitle>
            <GuestDesc>
              Connect your AniList account to track your anime and continue where you left off.
            </GuestDesc>
            <LoginBtn onClick={login}>
              <SiAnilist size={15} /> Log in with AniList
            </LoginBtn>
          </GuestWrap>
        </InfoCard>
      )}

      <ContentWrap>
        <EpisodeCard />
        <WatchingAnilist />
      </ContentWrap>
    </Page>
  );
};

export default Profile;
