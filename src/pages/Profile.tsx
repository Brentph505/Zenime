import React, { useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { IoLogOutOutline } from 'react-icons/io5';
import { useAuth, EpisodeCard, WatchingAnilist } from '../index';
import { SiAnilist } from 'react-icons/si';
import { CgProfile } from 'react-icons/cg';
import { FiClock, FiStar, FiTv, FiFilm } from 'react-icons/fi';

/* ─────────────────────────────────────────────
   Keyframes
───────────────────────────────────────────── */

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulseRing = keyframes`
  0%   { box-shadow: 0 0 0 0    rgba(139, 92, 246, 0.55),
                     0 0 0 4px  var(--global-div-tr),
                     0 12px 40px rgba(0,0,0,0.45); }
  70%  { box-shadow: 0 0 0 14px rgba(139, 92, 246, 0),
                     0 0 0 4px  var(--global-div-tr),
                     0 12px 40px rgba(0,0,0,0.45); }
  100% { box-shadow: 0 0 0 0    rgba(139, 92, 246, 0),
                     0 0 0 4px  var(--global-div-tr),
                     0 12px 40px rgba(0,0,0,0.45); }
`;

const popIn = keyframes`
  from { opacity: 0; transform: translateY(10px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
`;

/* ─────────────────────────────────────────────
   Page wrapper
───────────────────────────────────────────── */

const Page = styled.div`
  width: 100%;
  padding: 0 0 3rem;
  animation: ${fadeUp} 0.4s ease both;
`;

/* ─────────────────────────────────────────────
   Cover photo
───────────────────────────────────────────── */

const CoverWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 190px;
  overflow: hidden;

  @media (min-width: 600px) { height: 240px; }
  @media (min-width: 900px) { height: 300px; }
`;

const CoverImage = styled.div<{ $src: string | null }>`
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center 30%;

  ${({ $src }) =>
    $src
      ? css`
          background-image: url(${$src});
        `
      : css`
          /* Atmospheric space-like fallback — no real image needed */
          background-color: #0d0d1a;

          &::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
              radial-gradient(ellipse 55% 60% at 15% 55%, rgba(88,28,220,0.28) 0%, transparent 70%),
              radial-gradient(ellipse 40% 50% at 80% 35%, rgba(219,39,119,0.2) 0%, transparent 70%),
              radial-gradient(ellipse 35% 45% at 55% 80%, rgba(6,182,212,0.16) 0%, transparent 70%);
          }

          &::after {
            content: '';
            position: absolute;
            inset: 0;
            background-image:
              radial-gradient(1px 1px at 8%  18%, rgba(255,255,255,0.6) 0%, transparent 100%),
              radial-gradient(1px 1px at 22% 65%, rgba(255,255,255,0.4) 0%, transparent 100%),
              radial-gradient(1px 1px at 38% 12%, rgba(255,255,255,0.55) 0%, transparent 100%),
              radial-gradient(2px 2px at 52% 48%, rgba(167,139,250,0.7) 0%, transparent 100%),
              radial-gradient(1px 1px at 65% 78%, rgba(255,255,255,0.4) 0%, transparent 100%),
              radial-gradient(1px 1px at 78% 28%, rgba(255,255,255,0.5) 0%, transparent 100%),
              radial-gradient(1.5px 1.5px at 88% 12%, rgba(255,255,255,0.65) 0%, transparent 100%),
              radial-gradient(1px 1px at 14% 88%, rgba(255,255,255,0.35) 0%, transparent 100%),
              radial-gradient(1.5px 1.5px at 44% 55%, rgba(236,72,153,0.55) 0%, transparent 100%),
              radial-gradient(1px 1px at 92% 60%, rgba(255,255,255,0.45) 0%, transparent 100%);
          }
        `}
`;

/* Bottom scrim so avatar + card blend nicely */
const CoverScrim = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    transparent 30%,
    rgba(0, 0, 0, 0.55) 100%
  );
`;

/* ─────────────────────────────────────────────
   Accent line between cover and card
───────────────────────────────────────────── */

const AccentLine = styled.div`
  height: 2px;
  background: linear-gradient(
    90deg,
    #8b5cf6,
    #ec4899,
    #06b6d4,
    #8b5cf6
  );
  background-size: 300% auto;
`;

/* ─────────────────────────────────────────────
   Profile card shell
───────────────────────────────────────────── */

const ProfileCard = styled.div`
  position: relative;
  background: var(--global-div-tr);
  border-radius: 0;
  padding: 0 1.25rem 1.75rem;
  margin-bottom: 1.75rem;

  @media (min-width: 600px) { padding: 0 2rem 1.75rem; }
  @media (min-width: 900px) { padding: 0 3rem 2rem; }
`;

/* ─────────────────────────────────────────────
   Avatar row (FB-style: avatar overlaps cover)
───────────────────────────────────────────── */

const AvatarRow = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.65rem;
  /* pull avatar up to overlap the cover photo */
  margin-top: -52px;

  @media (min-width: 600px) {
    flex-direction: row;
    align-items: flex-end;
    margin-top: -60px;
    gap: 1.25rem;
  }
`;

/* Gradient ring = the "border" around the avatar */
const AvatarRing = styled.div`
  width: 108px;
  height: 108px;
  border-radius: 50%;
  padding: 3px;
  flex-shrink: 0;
  background: linear-gradient(
    135deg,
    #8b5cf6 0%,
    #ec4899 50%,
    #06b6d4 100%
  );
  animation: ${pulseRing} 3.5s ease-in-out infinite;

  @media (min-width: 600px) {
    width: 120px;
    height: 120px;
  }
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  object-fit: cover;
  display: block;
  /* white gap between ring gradient and image */
  border: 3px solid var(--global-div-tr);
`;

const AvatarPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--global-div);
  border: 3px solid var(--global-div-tr);
  color: var(--global-text);
  opacity: 0.3;
`;

/* ─────────────────────────────────────────────
   Name + label
───────────────────────────────────────────── */

const NameBlock = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.18rem;
  /* align baseline with avatar bottom on desktop */
  padding-bottom: 0.4rem;

  @media (min-width: 600px) {
    align-items: flex-start;
    padding-bottom: 0.55rem;
  }
`;

const Username = styled.h1`
  margin: 0;
  font-size: 1.5rem;
  font-weight: 800;
  color: var(--global-text);
  letter-spacing: -0.025em;
  line-height: 1.15;
`;

const SubLabel = styled.p`
  margin: 0;
  font-size: 0.72rem;
  color: var(--global-text);
  opacity: 0.38;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

/* ─────────────────────────────────────────────
   Logout button — right-aligned on desktop
───────────────────────────────────────────── */

const ActionSlot = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;

  @media (min-width: 600px) {
    margin-left: auto;
    padding-bottom: 0.55rem;
  }
`;

const LogoutBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.52rem 1.15rem;
  border-radius: var(--global-border-radius);
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: var(--global-text);
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.16s ease, border-color 0.16s ease,
    transform 0.16s ease;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.22);
    transform: translateY(-1px);
  }
  &:active {
    transform: scale(0.97);
  }

  /* Light mode */
  @media (prefers-color-scheme: light) {
    border-color: rgba(0, 0, 0, 0.1);
    background: rgba(0, 0, 0, 0.04);

    &:hover {
      background: rgba(0, 0, 0, 0.08);
      border-color: rgba(0, 0, 0, 0.18);
    }
  }
`;

/* ─────────────────────────────────────────────
   Divider
───────────────────────────────────────────── */

const Divider = styled.div`
  height: 1px;
  margin: 1.35rem 0 1.5rem;
  background: linear-gradient(
    to right,
    transparent 0%,
    rgba(255, 255, 255, 0.08) 20%,
    rgba(255, 255, 255, 0.08) 80%,
    transparent 100%
  );

  @media (prefers-color-scheme: light) {
    background: linear-gradient(
      to right,
      transparent 0%,
      rgba(0, 0, 0, 0.08) 20%,
      rgba(0, 0, 0, 0.08) 80%,
      transparent 100%
    );
  }
`;

/* ─────────────────────────────────────────────
   Stats grid
───────────────────────────────────────────── */

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.7rem;

  @media (min-width: 480px) {
    grid-template-columns: repeat(4, 1fr);
  }
`;

const StatCard = styled.div<{ $delay?: string }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1.1rem 0.6rem;
  border-radius: var(--global-border-radius);
  background: var(--global-div);
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: default;
  transition: transform 0.18s ease, border-color 0.18s ease,
    box-shadow 0.18s ease;
  animation: ${popIn} 0.4s ease both;
  animation-delay: ${({ $delay }) => $delay ?? '0s'};

  &:hover {
    transform: translateY(-3px);
    border-color: rgba(139, 92, 246, 0.38);
    box-shadow: 0 6px 24px rgba(139, 92, 246, 0.14);
  }

  @media (prefers-color-scheme: light) {
    border-color: rgba(0, 0, 0, 0.05);

    &:hover {
      border-color: rgba(139, 92, 246, 0.28);
      box-shadow: 0 6px 24px rgba(139, 92, 246, 0.08);
    }
  }
`;

const StatIconWrap = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(139, 92, 246, 0.14);
  color: #a78bfa;
  font-size: 1.05rem;
`;

const StatValue = styled.span`
  font-size: 1.45rem;
  font-weight: 800;
  color: var(--global-text);
  letter-spacing: -0.03em;
  line-height: 1;
`;

const StatLabel = styled.span`
  font-size: 0.67rem;
  color: var(--global-text);
  opacity: 0.38;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  text-align: center;
`;

/* ─────────────────────────────────────────────
   Guest / logged-out state
───────────────────────────────────────────── */

const GuestWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem 3rem;
  text-align: center;
`;

const GuestIconCircle = styled.div`
  width: 76px;
  height: 76px;
  border-radius: 50%;
  background: var(--global-div);
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--global-text);
  opacity: 0.25;

  @media (prefers-color-scheme: light) {
    border-color: rgba(0, 0, 0, 0.07);
  }
`;

const GuestTitle = styled.h2`
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--global-text);
`;

const GuestDesc = styled.p`
  margin: 0;
  font-size: 0.88rem;
  color: var(--global-text);
  opacity: 0.45;
  max-width: 300px;
  line-height: 1.75;
`;

const LoginBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.7rem 1.6rem;
  border-radius: var(--global-border-radius);
  border: 1px solid rgba(139, 92, 246, 0.4);
  background: rgba(139, 92, 246, 0.1);
  color: #a78bfa;
  font-size: 0.9rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.18s ease, border-color 0.18s ease,
    transform 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    background: rgba(139, 92, 246, 0.2);
    border-color: rgba(139, 92, 246, 0.6);
    transform: translateY(-1px);
    box-shadow: 0 4px 20px rgba(139, 92, 246, 0.22);
  }
  &:active {
    transform: scale(0.97);
  }
`;

/* ─────────────────────────────────────────────
   Component
───────────────────────────────────────────── */

export const Profile: React.FC = () => {
  const { isLoggedIn, userData, login, logout } = useAuth();

  useEffect(() => {
    document.title =
      isLoggedIn && userData ? `${userData.name} | Profile` : 'Profile';
  }, [isLoggedIn, userData]);

  // bannerImage is now properly typed as string | null on UserData
  const coverSrc = userData?.bannerImage ?? null;

  return (
    <Page>
      {/* ── Cover photo ── */}
      <CoverWrapper>
        <CoverImage $src={coverSrc} />
        <CoverScrim />
      </CoverWrapper>

      {/* Purple → pink → cyan accent stripe */}
      <AccentLine />

      {/* ── Profile card ── */}
      <ProfileCard>
        {isLoggedIn && userData ? (
          <>
            {/* Avatar + name + logout */}
            <AvatarRow>
              <AvatarRing>
                <AvatarImg
                  src={userData.avatar.large}
                  alt={`${userData.name}'s avatar`}
                />
              </AvatarRing>

              <NameBlock>
                <Username>{userData.name}</Username>
                <SubLabel>AniList Member</SubLabel>
              </NameBlock>

              <ActionSlot>
                <LogoutBtn onClick={logout}>
                  Log out <IoLogOutOutline size={16} />
                </LogoutBtn>
              </ActionSlot>
            </AvatarRow>

            {/* Stats */}
            {userData.statistics && (
              <>
                <Divider />
                <StatsGrid>
                  <StatCard $delay="0.05s">
                    <StatIconWrap><FiFilm /></StatIconWrap>
                    <StatValue>
                      {userData.statistics.anime.count}
                    </StatValue>
                    <StatLabel>Anime</StatLabel>
                  </StatCard>

                  <StatCard $delay="0.1s">
                    <StatIconWrap><FiTv /></StatIconWrap>
                    <StatValue>
                      {userData.statistics.anime.episodesWatched}
                    </StatValue>
                    <StatLabel>Episodes</StatLabel>
                  </StatCard>

                  <StatCard $delay="0.15s">
                    <StatIconWrap><FiClock /></StatIconWrap>
                    <StatValue>
                      {Math.round(
                        userData.statistics.anime.minutesWatched / 60
                      )}
                      h
                    </StatValue>
                    <StatLabel>Hours</StatLabel>
                  </StatCard>

                  <StatCard $delay="0.2s">
                    <StatIconWrap><FiStar /></StatIconWrap>
                    <StatValue>
                      {userData.statistics.anime.meanScore.toFixed(1)}
                    </StatValue>
                    <StatLabel>Avg Score</StatLabel>
                  </StatCard>
                </StatsGrid>
              </>
            )}
          </>
        ) : (
          <GuestWrap>
            <GuestIconCircle>
              <CgProfile size={38} />
            </GuestIconCircle>
            <GuestTitle>You're not logged in</GuestTitle>
            <GuestDesc>
              Connect your AniList account to sync your list, scores, and
              continue right where you left off.
            </GuestDesc>
            <LoginBtn onClick={login}>
              <SiAnilist size={18} />
              Log in with AniList
            </LoginBtn>
          </GuestWrap>
        )}
      </ProfileCard>

      <EpisodeCard />
      <WatchingAnilist />
    </Page>
  );
};

export default Profile;