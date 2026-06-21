import React, { useEffect, useRef, useState } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { IoLogOutOutline } from 'react-icons/io5';
import { useAuth, EpisodeCard, WatchingAnilist } from '../index';
import { Settings } from '../components/Profile/Settings';
import { ANILIST_ENTRY_CHANGED_EVENT } from '../hooks/useAniListEntry';
import { SiAnilist } from 'react-icons/si';
import { CgProfile } from 'react-icons/cg';
import { FiClock, FiStar, FiTv, FiFilm, FiChevronDown, FiUser, FiLogOut, FiSettings } from 'react-icons/fi';
import { useNavigate, useLocation } from 'react-router-dom';

/* ── Animations ── */
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(-6px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
`;

const popIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* ── Page ── */
const Page = styled.div`
  width: 100%;
  overflow-x: hidden;
  padding-bottom: 2.5rem;
  animation: ${fadeUp} 0.35s ease both;
`;

/* ── Cover ── */
const CoverWrapper = styled.div`
  position: relative;
  width: 100%;
  height: 130px;
  overflow: hidden;

  @media (min-width: 600px) { height: 160px; }
  @media (min-width: 900px) { height: 190px; }
`;

const CoverBg = styled.div<{ $src: string | null }>`
  width: 100%;
  height: 100%;
  background-color: #0c0c14;

  ${({ $src }) =>
    $src
      ? css`
          background-image: url(${$src});
          background-size: cover;
          background-position: center 30%;
        `
      : css`
          &::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
              radial-gradient(ellipse 60% 80% at 20% 60%, rgba(76,29,149,0.35) 0%, transparent 65%),
              radial-gradient(ellipse 45% 60% at 80% 30%, rgba(157,23,77,0.22) 0%, transparent 65%),
              radial-gradient(ellipse 40% 55% at 55% 85%, rgba(6,182,212,0.12) 0%, transparent 65%);
          }
          &::after {
            content: '';
            position: absolute;
            inset: 0;
            background-image:
              radial-gradient(1px 1px at 10% 20%, rgba(255,255,255,0.55) 0%,transparent 100%),
              radial-gradient(1px 1px at 25% 65%, rgba(255,255,255,0.4)  0%,transparent 100%),
              radial-gradient(1px 1px at 40% 12%, rgba(255,255,255,0.5)  0%,transparent 100%),
              radial-gradient(2px 2px at 52% 45%, rgba(167,139,250,0.65) 0%,transparent 100%),
              radial-gradient(1px 1px at 68% 78%, rgba(255,255,255,0.38) 0%,transparent 100%),
              radial-gradient(1px 1px at 80% 28%, rgba(255,255,255,0.48) 0%,transparent 100%),
              radial-gradient(1.5px 1.5px at 90% 14%, rgba(255,255,255,0.6) 0%,transparent 100%),
              radial-gradient(1px 1px at 14% 88%, rgba(255,255,255,0.32) 0%,transparent 100%),
              radial-gradient(1.5px 1.5px at 45% 55%, rgba(236,72,153,0.5) 0%,transparent 100%),
              radial-gradient(1px 1px at 93% 62%, rgba(255,255,255,0.42) 0%,transparent 100%);
          }
        `}
`;

const CoverScrim = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 25%, rgba(0,0,0,0.5) 100%);
`;

/* ── Accent line ── */
const AccentLine = styled.div`
  height: 1.5px;
  background: linear-gradient(90deg, #7c3aed, #db2777, #0891b2, #7c3aed);
  background-size: 300% auto;
`;

/* ── Profile bar (sits below cover) ── */
const ProfileBar = styled.div`
  background: var(--global-div-tr);
  padding: 0 0.5rem 1rem;
  overflow: visible;

  @media (min-width: 600px) { padding: 0 0.75rem 1.25rem; }
  @media (min-width: 900px) { padding: 0 1rem 1.25rem; }
`;

const BarInner = styled.div`
  width: 100%;
  max-width: 110rem;
  margin: 0 auto;
  box-sizing: border-box;
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
  background: linear-gradient(135deg, #7c3aed, #db2777, #0891b2);
  box-shadow: 0 0 0 3px var(--global-div-tr), 0 4px 16px rgba(0,0,0,0.4);
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
  border: 2.5px solid var(--global-div-tr);
  box-sizing: border-box;
`;

const AvatarPlaceholder = styled.div`
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background: var(--global-div);
  border: 2.5px solid var(--global-div-tr);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--global-text);
  opacity: 0.3;
`;

/* name + badge + dropdown — all inline */
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
  color: var(--global-text);
  opacity: 0.35;
  text-transform: uppercase;
  letter-spacing: 0.1em;
`;

/* ── Custom Dropdown ── */
const DropdownWrap = styled.div`
  position: relative;
  flex-shrink: 0;
`;

const DropdownTrigger = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--global-border-radius);
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: var(--global-text);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.14s, border-color 0.14s;
  white-space: nowrap;

  svg { transition: transform 0.2s ease; }
  &[data-open='true'] svg.chevron { transform: rotate(180deg); }

  &:hover {
    background: rgba(255,255,255,0.09);
    border-color: rgba(255,255,255,0.18);
  }

  @media (prefers-color-scheme: light) {
    border-color: rgba(0,0,0,0.1);
    background: rgba(0,0,0,0.04);
    &:hover { background: rgba(0,0,0,0.08); border-color: rgba(0,0,0,0.16); }
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 148px;
  background: var(--global-div-tr);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: var(--global-border-radius);
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
  overflow: hidden;
  z-index: 100;
  animation: ${fadeIn} 0.18s ease both;

  @media (prefers-color-scheme: light) {
    border-color: rgba(0,0,0,0.1);
    box-shadow: 0 8px 24px rgba(0,0,0,0.12);
  }
`;

const DropdownItem = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  width: 100%;
  padding: 0.55rem 0.85rem;
  background: none;
  border: none;
  color: ${({ $danger }) => $danger ? '#f87171' : 'var(--global-text)'};
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;

  &:hover {
    background: rgba(255,255,255,0.07);
  }

  @media (prefers-color-scheme: light) {
    &:hover { background: rgba(0,0,0,0.05); }
  }
`;

const DropdownDivider = styled.div`
  height: 1px;
  background: rgba(255,255,255,0.07);
  margin: 2px 0;

  @media (prefers-color-scheme: light) {
    background: rgba(0,0,0,0.07);
  }
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
  background: var(--global-div);
  border: 1px solid rgba(255,255,255,0.04);
  transition: border-color 0.16s, transform 0.16s;
  animation: ${popIn} 0.35s ease both;
  animation-delay: ${({ $delay }) => $delay ?? '0s'};
  cursor: default;

  &:hover {
    border-color: rgba(124,58,237,0.3);
    transform: translateY(-1px);
  }

  @media (prefers-color-scheme: light) {
    border-color: rgba(0,0,0,0.05);
    &:hover { border-color: rgba(124,58,237,0.22); }
  }
`;

const StatIcon = styled.div`
  width: 28px;
  height: 28px;
  border-radius: 7px;
  background: rgba(124,58,237,0.14);
  color: #a78bfa;
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
  color: var(--global-text);
  opacity: 0.35;
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
  background: var(--global-div);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--global-text);
  opacity: 0.2;
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
  color: var(--global-text);
  opacity: 0.42;
  max-width: 260px;
  line-height: 1.65;
`;

const LoginBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1.25rem;
  border-radius: var(--global-border-radius);
  border: 1px solid rgba(124,58,237,0.4);
  background: rgba(124,58,237,0.1);
  color: #a78bfa;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.16s, border-color 0.16s, transform 0.16s;

  &:hover {
    background: rgba(124,58,237,0.2);
    border-color: rgba(124,58,237,0.55);
    transform: translateY(-1px);
  }
  &:active { transform: scale(0.97); }
`;

/* ── Content padding wrapper (for EpisodeCard / WatchingAnilist) ── */
const ContentWrap = styled.div`
  width: 100%;
  max-width: 110rem;
  margin: 0 auto;
  padding: 0 0.25rem;
  box-sizing: border-box;

  @media (min-width: 600px) { padding: 0 0.5rem; }
  @media (min-width: 900px) { padding: 0 0.75rem; }
`;

const SettingsOverlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(8px);
`;

const SettingsPanel = styled.div`
  width: min(100%, 44rem);
  max-height: calc(100vh - 3rem);
  overflow-y: auto;
  border-radius: var(--global-border-radius);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
  background: rgba(17, 24, 39, 0.96);
  border: 1px solid rgba(255, 255, 255, 0.07);
`;

/* ─────────── Component ─────────── */
export const Profile: React.FC = () => {
  const { isLoggedIn, userData, login, logout, refreshUserData } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const location = useLocation();
  const isSettingsPage = location.pathname.endsWith('/settings');

  // Refresh stats (counts, mean score, …) when a list entry changes elsewhere
  // (e.g. status/score set on the Info page) so the numbers don't go stale.
  useEffect(() => {
    if (!isLoggedIn) return;
    const handler = () => { void refreshUserData(); };
    window.addEventListener(ANILIST_ENTRY_CHANGED_EVENT, handler);
    return () => window.removeEventListener(ANILIST_ENTRY_CHANGED_EVENT, handler);
  }, [isLoggedIn, refreshUserData]);

  useEffect(() => {
    document.title = isSettingsPage
      ? 'Settings | Profile'
      : isLoggedIn && userData
      ? `${userData.name} | Profile`
      : 'Profile';
  }, [isLoggedIn, userData, isSettingsPage]);

  /* close dropdown on outside click */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const coverSrc = userData?.bannerImage ?? null;

  return (
    <Page>
      {/* Cover */}
      <CoverWrapper>
        <CoverBg $src={coverSrc} />
        <CoverScrim />
      </CoverWrapper>

      <AccentLine />

      {/* Profile bar */}
      <ProfileBar>
        <BarInner>
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

                  {/* Custom dropdown */}
                  <DropdownWrap ref={menuRef}>
                    <DropdownTrigger
                      data-open={menuOpen}
                      onClick={() => setMenuOpen(o => !o)}
                    >
                      <FiUser size={13} />
                      Account
                      <FiChevronDown size={12} className="chevron" />
                    </DropdownTrigger>

                    {menuOpen && (
                      <DropdownMenu>
                        <DropdownItem onClick={() => setMenuOpen(false)}>
                          <FiUser size={13} /> Profile
                        </DropdownItem>
                        <DropdownItem onClick={() => { setMenuOpen(false); navigate('/profile/settings'); }}>
                          <FiSettings size={13} /> Settings
                        </DropdownItem>
                        <DropdownDivider />
                        <DropdownItem
                          $danger
                          onClick={() => { setMenuOpen(false); logout(); }}
                        >
                          <FiLogOut size={13} /> Log out
                        </DropdownItem>
                      </DropdownMenu>
                    )}
                  </DropdownWrap>
                </MetaRow>
              </AvatarRow>

              {/* Stats */}
              {userData.statistics && (
                <StatsRow>
                  <StatBox $delay="0.04s">
                    <StatIcon><FiFilm /></StatIcon>
                    <StatText>
                      <StatValue>{userData.statistics.anime.count}</StatValue>
                      <StatLabel>Anime</StatLabel>
                    </StatText>
                  </StatBox>

                  <StatBox $delay="0.08s">
                    <StatIcon><FiTv /></StatIcon>
                    <StatText>
                      <StatValue>{userData.statistics.anime.episodesWatched}</StatValue>
                      <StatLabel>Episodes</StatLabel>
                    </StatText>
                  </StatBox>

                  <StatBox $delay="0.12s">
                    <StatIcon><FiClock /></StatIcon>
                    <StatText>
                      <StatValue>
                        {Math.round(userData.statistics.anime.minutesWatched / 60)}h
                      </StatValue>
                      <StatLabel>Hours</StatLabel>
                    </StatText>
                  </StatBox>

                  <StatBox $delay="0.16s">
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
        </BarInner>
      </ProfileBar>

      <ContentWrap>
        <EpisodeCard />
        <WatchingAnilist />
      </ContentWrap>

      {isSettingsPage && (
        <SettingsOverlay>
          <SettingsPanel>
            <Settings onClose={() => navigate('/profile')} />
          </SettingsPanel>
        </SettingsOverlay>
      )}
    </Page>
  );
};

export default Profile;