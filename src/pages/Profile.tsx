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

/* ── Cover ── */
const CoverWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 130px;
  overflow: hidden;
  border-radius: var(--global-border-radius);

  @media (min-width: 600px) { height: 160px; }
  @media (min-width: 900px) { height: 190px; }
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
  background: linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.45) 100%);
`;

/* ── Accent line ── */
const AccentLine = styled.div`
  height: 1.5px;
  background: linear-gradient(90deg, var(--primary-accent, #7c3aed), #db2777, #0891b2, var(--primary-accent, #7c3aed));
  background-size: 300% auto;
  border-radius: var(--global-border-radius);
`;

/* ── Profile header bar (opaque) ── */
const ProfileBar = styled.div`
  background: var(--global-secondary-bg);
  border-radius: var(--global-border-radius);
  margin-top: 0.5rem;
  padding: 0.75rem;
  overflow: visible;

  @media (min-width: 600px) { padding: 1rem; }
`;

/* avatar row overlapping the cover */
const AvatarRow = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  margin-top: -32px;

  @media (min-width: 600px) {
    margin-top: -36px;
    gap: 1rem;
  }
`;

/* gradient ring */
const AvatarRing = styled.div`
  flex-shrink: 0;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  padding: 2.5px;
  background: linear-gradient(135deg, var(--primary-accent, #7c3aed), #db2777, #0891b2);
  box-shadow: 0 0 0 3px var(--global-secondary-bg), 0 4px 16px rgba(0,0,0,0.4);
  overflow: hidden;
  box-sizing: border-box;

  @media (min-width: 600px) {
    width: 80px;
    height: 80px;
  }
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  border: 2.5px solid var(--global-secondary-bg);
  box-sizing: border-box;
`;

const MetaRow = styled.div`
  flex: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  padding-bottom: 0.3rem;
  gap: 0.5rem;
  min-width: 0;
`;

const NameStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
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

  @media (min-width: 600px) { font-size: 1.15rem; }
`;

const SubLabel = styled.span`
  font-size: 0.62rem;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

/* ── Stats row ── */
const StatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
  margin-top: 0.85rem;

  @media (min-width: 480px) { grid-template-columns: repeat(4, 1fr); }
`;

const StatBox = styled.div<{ $delay?: string }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--global-border-radius);
  background: var(--global-card-bg);
  border: 1px solid var(--global-border);
  transition: border-color 0.16s, transform 0.16s;
  animation: ${popIn} 0.35s ease both;
  animation-delay: ${({ $delay }) => $delay ?? '0s'};
  cursor: default;

  &:hover {
    border-color: var(--primary-accent);
    transform: translateY(-1px);
  }
`;

const StatIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: var(--global-tertiary-bg);
  color: var(--primary-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  flex-shrink: 0;
`;

const StatText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
`;

const StatValue = styled.span`
  font-size: 1rem;
  font-weight: 700;
  color: var(--global-text);
  letter-spacing: -0.02em;
  line-height: 1;
`;

const StatLabel = styled.span`
  font-size: 0.6rem;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
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
  gap: 0.4rem;
  padding: 0.5rem 1.25rem;
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
      {/* Cover */}
      <CoverWrapper>
        <CoverBg $src={coverSrc} />
        <CoverScrim />
      </CoverWrapper>

      <AccentLine />

      {/* Profile header */}
      <ProfileBar>
        {isLoggedIn && userData ? (
          <>
            <AvatarRow>
              <AvatarRing>
                <AvatarImg
                  src={userData.avatar.large}
                  alt={userData.name}
                />
              </AvatarRing>

              <MetaRow>
                <NameStack>
                  <Username>{userData.name}</Username>
                  <SubLabel>AniList Member</SubLabel>
                </NameStack>
              </MetaRow>
            </AvatarRow>

            {/* Stats */}
            {userData.statistics && (
              <StatsRow>
                <StatBox $delay='0.04s'>
                  <StatIcon><FiFilm /></StatIcon>
                  <StatText>
                    <StatValue>{userData.statistics.anime.count}</StatValue>
                    <StatLabel>Anime</StatLabel>
                  </StatText>
                </StatBox>

                <StatBox $delay='0.08s'>
                  <StatIcon><FiTv /></StatIcon>
                  <StatText>
                    <StatValue>{userData.statistics.anime.episodesWatched}</StatValue>
                    <StatLabel>Episodes</StatLabel>
                  </StatText>
                </StatBox>

                <StatBox $delay='0.12s'>
                  <StatIcon><FiClock /></StatIcon>
                  <StatText>
                    <StatValue>
                      {Math.round(userData.statistics.anime.minutesWatched / 60)}h
                    </StatValue>
                    <StatLabel>Hours</StatLabel>
                  </StatText>
                </StatBox>

                <StatBox $delay='0.16s'>
                  <StatIcon><FiStar /></StatIcon>
                  <StatText>
                    <StatValue>
                      {userData.statistics.anime.meanScore.toFixed(1)}
                    </StatValue>
                    <StatLabel>Avg Score</StatLabel>
                  </StatText>
                </StatBox>
              </StatsRow>
            )}
          </>
        ) : (
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
        )}
      </ProfileBar>

      <ContentWrap>
        <EpisodeCard />
        <WatchingAnilist />
      </ContentWrap>
    </Page>
  );
};

export default Profile;
