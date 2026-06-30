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
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* ── Page ── */
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

/* ── Unified header card ── */
const HeaderCard = styled.div`
  position: relative;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  background: var(--global-secondary-bg);
`;

/* ── Cover ── */
const CoverArea = styled.div`
  position: relative;
  width: 100%;
  height: 120px;
  overflow: hidden;

  @media (min-width: 600px) { height: 150px; }
  @media (min-width: 900px) { height: 180px; }
`;

const CoverBg = styled.div<{ $src: string | null }>`
  width: 100%;
  height: 100%;
  background-color: var(--global-tertiary-bg);

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
  background: linear-gradient(to bottom, transparent 25%, var(--global-secondary-bg) 100%);
`;

/* ── Info area (overlaps cover) ── */
const InfoArea = styled.div`
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0 0.85rem 0.85rem;
  margin-top: -30px;

  @media (min-width: 600px) {
    padding: 0 1rem 1rem;
    margin-top: -34px;
    gap: 0.7rem;
  }
`;

const TopRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 0.7rem;

  @media (min-width: 600px) { gap: 0.85rem; }
`;

const AvatarRing = styled.div`
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  padding: 2px;
  background: linear-gradient(135deg, var(--primary-accent, #7c3aed), #db2777, #0891b2);
  box-shadow: 0 2px 12px rgba(0,0,0,0.35);
  overflow: hidden;
  box-sizing: border-box;

  @media (min-width: 600px) {
    width: 72px;
    height: 72px;
  }
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  border: 2px solid var(--global-secondary-bg);
  box-sizing: border-box;
`;

const NameArea = styled.div`
  flex: 1;
  min-width: 0;
  padding-bottom: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
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
  font-size: 0.62rem;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

/* ── Stats pills ── */
const StatsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  animation: ${popIn} 0.35s ease both;
  animation-delay: 0.08s;
`;

const Pill = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.28rem 0.55rem;
  border-radius: 999px;
  background: var(--global-card-bg);
  border: 1px solid var(--global-border);
  font-size: 0.72rem;
  color: var(--global-text-muted);
  white-space: nowrap;
  transition: border-color 0.16s;

  &:hover {
    border-color: var(--primary-accent);
  }

  svg {
    color: var(--primary-accent);
    font-size: 0.68rem;
    flex-shrink: 0;
  }

  strong {
    color: var(--global-text);
    font-weight: 700;
    letter-spacing: -0.02em;
  }
`;

/* ── Guest state ── */
const GuestWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 2rem 1.5rem 1.75rem;
  text-align: center;
`;

const GuestCircle = styled.div`
  width: 44px;
  height: 44px;
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
  padding: 0.45rem 1.1rem;
  border-radius: 999px;
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
  margin-top: 1.25rem;
  box-sizing: border-box;
`;

/* ─────────── Component ─────────── */
export const Profile: React.FC = () => {
  const { isLoggedIn, userData, login, refreshUserData } = useAuth();

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
      <HeaderCard>
        {isLoggedIn && userData ? (
          <>
            <CoverArea>
              <CoverBg $src={coverSrc} />
              <CoverScrim />
            </CoverArea>

            <InfoArea>
              <TopRow>
                <AvatarRing>
                  <AvatarImg
                    src={userData.avatar.large}
                    alt={userData.name}
                  />
                </AvatarRing>

                <NameArea>
                  <Username>{userData.name}</Username>
                  <SubLabel>AniList Member</SubLabel>
                </NameArea>
              </TopRow>

              {userData.statistics && (
                <StatsRow>
                  <Pill>
                    <FiFilm />
                    <strong>{userData.statistics.anime.count}</strong> Anime
                  </Pill>
                  <Pill>
                    <FiTv />
                    <strong>{userData.statistics.anime.episodesWatched}</strong> Episodes
                  </Pill>
                  <Pill>
                    <FiClock />
                    <strong>{Math.round(userData.statistics.anime.minutesWatched / 60)}h</strong> Watched
                  </Pill>
                  <Pill>
                    <FiStar />
                    <strong>{userData.statistics.anime.meanScore.toFixed(1)}</strong> Avg
                  </Pill>
                </StatsRow>
              )}
            </InfoArea>
          </>
        ) : (
          <GuestWrap>
            <GuestCircle><CgProfile size={22} /></GuestCircle>
            <GuestTitle>Not logged in</GuestTitle>
            <GuestDesc>
              Connect your AniList account to track your anime and continue where you left off.
            </GuestDesc>
            <LoginBtn onClick={login}>
              <SiAnilist size={14} /> Log in with AniList
            </LoginBtn>
          </GuestWrap>
        )}
      </HeaderCard>

      <ContentWrap>
        <EpisodeCard />
        <WatchingAnilist />
      </ContentWrap>
    </Page>
  );
};

export default Profile;
