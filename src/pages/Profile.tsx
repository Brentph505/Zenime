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

/*
  Cover now uses aspect-ratio instead of a short fixed pixel height.
  A fixed height (e.g. 120px) ignores the image's natural proportions,
  so wide banners get vertically crushed. A ~16:5 ratio gives banner
  images real room while staying compact on mobile, and clamp() lets
  it scale smoothly between breakpoints instead of jumping.
*/
const CoverWrapper = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 5;
  min-height: 140px;
  max-height: clamp(140px, 26vw, 260px);
  overflow: hidden;
  border-radius: var(--global-border-radius);

  @media (min-width: 600px) { aspect-ratio: 18 / 5; }
  @media (min-width: 1100px) { aspect-ratio: 20 / 5; }
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
          background-position: center 38%;
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
  background: linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.45) 100%);
`;

/* avatar sits half on the cover, half on the card below it */
const AvatarRing = styled.div`
  position: absolute;
  left: 1.25rem;
  bottom: -34px;
  z-index: 2;
  width: 76px;
  height: 76px;
  border-radius: 50%;
  padding: 3px;
  background: linear-gradient(135deg, var(--primary-accent, #7c3aed), #db2777, #0891b2);
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
  box-sizing: border-box;

  @media (min-width: 600px) {
    left: 1.5rem;
    bottom: -38px;
    width: 92px;
    height: 92px;
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
  border: 1px solid var(--global-border);
  border-radius: var(--global-border-radius);
  margin-top: 0.5rem;
  padding: 1.1rem 1.15rem 1rem;
`;

const NameRow = styled.div`
  padding-left: calc(76px + 1rem);
  min-height: 34px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.2rem;

  @media (min-width: 600px) {
    padding-left: calc(92px + 1.15rem);
  }
`;

const Username = styled.h1`
  margin: 0;
  font-size: 1.15rem;
  font-weight: 700;
  color: var(--global-text);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (min-width: 600px) { font-size: 1.35rem; }
`;

const SubLabel = styled.span`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.07em;
`;

/* ── Stats: a single flat strip with thin dividers — no boxed cards ── */
const StatsStrip = styled.div`
  display: flex;
  align-items: stretch;
  margin-top: 1.1rem;
  padding-top: 0.9rem;
  border-top: 1px solid var(--global-border);
`;

const Stat = styled.div<{ $delay?: string }>`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 0.2rem 0.4rem;
  animation: ${popIn} 0.3s ease both;
  animation-delay: ${({ $delay }) => $delay ?? '0s'};

  & + & {
    border-left: 1px solid var(--global-border);
  }
`;

const StatIconWrap = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: var(--global-tertiary-bg);
  font-size: 0.95rem;
  color: var(--primary-accent);
  flex-shrink: 0;
`;

const StatText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
  line-height: 1;
`;

const StatValue = styled.span`
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--global-text);
  letter-spacing: -0.02em;
`;

const StatLabel = styled.span`
  font-size: 0.6rem;
  font-weight: 600;
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
  gap: 0.75rem;
  padding: 2.5rem 1.5rem 2rem;
  text-align: center;
`;

const GuestCircle = styled.div`
  width: 52px;
  height: 52px;
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
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--global-text);
`;

const GuestDesc = styled.p`
  margin: 0;
  font-size: 0.8rem;
  color: var(--global-text-muted);
  max-width: 260px;
  line-height: 1.65;
`;

const LoginBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 1.35rem;
  margin-top: 0.25rem;
  border-radius: var(--global-border-radius);
  border: 1px solid var(--global-border);
  background: var(--global-tertiary-bg);
  color: var(--primary-accent);
  font-size: 0.82rem;
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
  margin-top: 1.75rem;
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
              <SubLabel><SiAnilist size={11} /> AniList Member</SubLabel>
            </NameRow>

            {userData.statistics && (
              <StatsStrip>
                <Stat $delay="0.02s">
                  <StatIconWrap><FiFilm /></StatIconWrap>
                  <StatText>
                    <StatValue>{userData.statistics.anime.count}</StatValue>
                    <StatLabel>Anime</StatLabel>
                  </StatText>
                </Stat>

                <Stat $delay="0.06s">
                  <StatIconWrap><FiTv /></StatIconWrap>
                  <StatText>
                    <StatValue>{userData.statistics.anime.episodesWatched}</StatValue>
                    <StatLabel>Episodes</StatLabel>
                  </StatText>
                </Stat>

                <Stat $delay="0.1s">
                  <StatIconWrap><FiClock /></StatIconWrap>
                  <StatText>
                    <StatValue>
                      {Math.round(userData.statistics.anime.minutesWatched / 60)}h
                    </StatValue>
                    <StatLabel>Hours</StatLabel>
                  </StatText>
                </Stat>

                <Stat $delay="0.14s">
                  <StatIconWrap><FiStar /></StatIconWrap>
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
            <GuestCircle><CgProfile size={26} /></GuestCircle>
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
