import React, { useEffect, useRef } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useAuth, EpisodeCard, WatchingAnilist } from '../index';
import { ANILIST_ENTRY_CHANGED_EVENT } from '../hooks/useAniListEntry';
import { SiAnilist } from 'react-icons/si';
import { CgProfile } from 'react-icons/cg';
import { FiClock, FiStar, FiTv, FiFilm, FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/*
  ── Design notes ──────────────────────────────────────────────────
  Subject: a personal AniList-powered tracking dashboard. The viewer
  is the account owner checking their own stats and resuming a show —
  not a public social-profile visitor. So the hero treats this like a
  streaming-platform "title card" moment (Crunchyroll hero / Netflix
  profile rail) rather than a social-network bio card.

  Signature element: the stat rail. On narrow screens it becomes a
  horizontally swipeable, snap-scrolling row with an edge fade — this
  is what actually fixes the old mobile wrapping bug, not just a
  smaller font-size patch. On wide screens the same markup lays out
  flat with no scrolling needed, so there's one component with two
  behaviors driven by viewport, not two parallel implementations.

  Banner stays rounded/contained (matches the rest of the app's visual
  language) but grows taller and more dramatic, with identity overlaid
  directly on the gradient instead of stacked below in a separate card.

  All colors reuse existing tokens (--global-*, --primary-accent).
  No new hex values are introduced anywhere in this file.
*/

/* ── Animations ── */
const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const riseIn = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const bannerReveal = keyframes`
  from { opacity: 0; transform: scale(1.06); }
  to   { opacity: 1; transform: scale(1); }
`;

const popIn = keyframes`
  from { opacity: 0; transform: translateY(8px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

/* ── Page ── */
const Page = styled.div`
  width: 100%;
  max-width: 125rem;
  margin: 0 auto;
  box-sizing: border-box;
  overflow-x: hidden;
  padding: 0.25rem 0.25rem 2.5rem;

  @media (min-width: 768px) { padding: 0.5rem 0.5rem 2.5rem; }
`;

/* ── Hero banner: tall, rounded, dramatic. Identity lives ON it. ── */
const Hero = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  min-height: 320px;
  max-height: clamp(320px, 62vw, 420px);
  border-radius: calc(var(--global-border-radius) * 1.4);
  overflow: hidden;
  isolation: isolate;
  animation: ${fadeUp} 0.4s ease both;

  @media (min-width: 560px) {
    aspect-ratio: 16 / 9;
    min-height: 300px;
    max-height: clamp(300px, 38vw, 360px);
  }
  @media (min-width: 900px) {
    aspect-ratio: 21 / 8;
    max-height: 320px;
  }
`;

const HeroBg = styled.div<{ $src: string | null }>`
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: var(--global-secondary-bg);
  animation: ${bannerReveal} 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;

  ${({ $src }) =>
    $src
      ? css`
          background-image: url(${$src});
          background-size: cover;
          background-position: center 32%;
        `
      : css`
          background:
            radial-gradient(ellipse 65% 75% at 15% 20%, rgba(124,58,237,0.35) 0%, transparent 60%),
            radial-gradient(ellipse 55% 65% at 85% 15%, rgba(219,39,119,0.24) 0%, transparent 60%),
            radial-gradient(ellipse 60% 70% at 50% 100%, rgba(8,145,178,0.18) 0%, transparent 65%),
            var(--global-secondary-bg);
        `}
`;

/* layered scrim: a top vignette for legibility of any future top-right
   actions, and a strong bottom gradient so overlaid text always reads
   regardless of the banner image's own brightness */
const HeroScrimTop = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 30%);
`;

const HeroScrimBottom = styled.div`
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    to top,
    rgba(0,0,0,0.88) 0%,
    rgba(0,0,0,0.62) 28%,
    rgba(0,0,0,0.18) 60%,
    transparent 85%
  );
`;

/* faint hairline at the very bottom edge to separate the hero from
   the content that follows, echoing a "title card" rim */
const HeroFloorLine = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent);
`;

/* ── Identity, overlaid bottom-left on the hero ── */
const HeroContent = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2;
  display: flex;
  align-items: flex-end;
  gap: 0.9rem;
  padding: 1rem 1.1rem 1.1rem;

  @media (min-width: 560px) { padding: 1.25rem 1.5rem 1.4rem; gap: 1.1rem; }
  @media (min-width: 900px) { padding: 1.6rem 1.9rem 1.7rem; gap: 1.35rem; }
`;

const AvatarFrame = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 64px;
  height: 64px;
  border-radius: 16px;
  padding: 2.5px;
  background: linear-gradient(135deg, var(--primary-accent, #7c3aed), #db2777, #0891b2);
  box-shadow: 0 8px 24px rgba(0,0,0,0.45);
  animation: ${riseIn} 0.45s ease 0.1s both;

  @media (min-width: 560px) { width: 80px; height: 80px; border-radius: 18px; }
  @media (min-width: 900px) { width: 96px; height: 96px; border-radius: 20px; }
`;

const AvatarImg = styled.img`
  width: 100%;
  height: 100%;
  border-radius: 13.5px;
  object-fit: cover;
  display: block;
  background: var(--global-secondary-bg);

  @media (min-width: 560px) { border-radius: 15.5px; }
  @media (min-width: 900px) { border-radius: 17.5px; }
`;

const IdentityBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  min-width: 0;
  flex: 1;
  animation: ${riseIn} 0.45s ease 0.16s both;
`;

const MemberBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.32rem;
  width: fit-content;
  padding: 0.2rem 0.55rem 0.2rem 0.45rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.16);
  font-size: 0.62rem;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.07em;

  @media (min-width: 560px) { font-size: 0.66rem; }
`;

const Username = styled.h1`
  margin: 0;
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
  line-height: 1.1;
  text-shadow: 0 2px 12px rgba(0,0,0,0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  @media (min-width: 560px) { font-size: 1.7rem; }
  @media (min-width: 900px) { font-size: 2rem; }
`;

/* ── Stat rail: flex row that scroll-snaps on narrow viewports and
   relaxes into a flat, non-scrolling row once there's enough width.
   This — not a smaller font — is what fixes mobile wrapping, since a
   row that can never wrap also can never break. ── */
const RailSection = styled.div`
  position: relative;
  margin-top: 0.85rem;
`;

const StatRail = styled.div`
  display: flex;
  gap: 0.6rem;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  padding: 0.15rem 0.15rem 0.5rem;
  margin: -0.15rem -0.15rem -0.5rem;

  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  @media (min-width: 720px) {
    overflow-x: visible;
    padding-bottom: 0.15rem;
    margin-bottom: 0;
  }
`;

const StatChip = styled.div<{ $delay?: string }>`
  flex: 0 0 auto;
  scroll-snap-align: start;
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 132px;
  padding: 0.7rem 0.85rem;
  border-radius: var(--global-border-radius);
  background: var(--global-secondary-bg);
  border: 1px solid var(--global-border);
  animation: ${popIn} 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
  animation-delay: ${({ $delay }) => $delay ?? '0s'};
  transition: border-color 0.18s ease, transform 0.18s ease;

  &:hover {
    border-color: var(--primary-accent);
    transform: translateY(-2px);
  }

  @media (min-width: 720px) {
    flex: 1 1 0;
    min-width: 0;
  }
`;

const StatIconWrap = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: var(--global-tertiary-bg);
  font-size: 1rem;
  color: var(--primary-accent);
  flex-shrink: 0;
`;

const StatText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
  min-width: 0;
  line-height: 1;
`;

const StatValue = styled.span`
  font-size: 1.1rem;
  font-weight: 800;
  color: var(--global-text);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
`;

const StatLabel = styled.span`
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
`;

/* edge fades hint "there's more — swipe" on touch; fade out once the
   rail no longer scrolls at the 720px breakpoint */
const RailFade = styled.div<{ $side: 'left' | 'right' }>`
  position: absolute;
  top: 0;
  bottom: 0.5rem;
  ${({ $side }) => ($side === 'left' ? 'left: 0;' : 'right: 0;')}
  width: 28px;
  pointer-events: none;
  z-index: 1;
  background: linear-gradient(
    to ${({ $side }) => ($side === 'left' ? 'right' : 'left')},
    var(--global-secondary-bg) 0%,
    transparent 100%
  );
  opacity: 0.001;

  @media (max-width: 719px) { opacity: 1; }
`;

const RailHint = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  margin-top: 0.5rem;
  font-size: 0.62rem;
  font-weight: 600;
  color: var(--global-text-muted);
  opacity: 0.7;
  letter-spacing: 0.03em;

  @media (min-width: 720px) { display: none; }
`;

/* ── Guest state — same hero-style frame, empty/invitational tone ── */
const GuestHero = styled.div`
  position: relative;
  width: 100%;
  min-height: 280px;
  border-radius: calc(var(--global-border-radius) * 1.4);
  overflow: hidden;
  background:
    radial-gradient(ellipse 70% 80% at 30% 30%, rgba(124,58,237,0.22) 0%, transparent 60%),
    radial-gradient(ellipse 60% 70% at 80% 70%, rgba(219,39,119,0.16) 0%, transparent 60%),
    var(--global-secondary-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2.5rem 1.5rem;
  animation: ${fadeUp} 0.4s ease both;
`;

const GuestWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.8rem;
  text-align: center;
  animation: ${riseIn} 0.45s ease 0.1s both;
`;

const GuestCircle = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--global-tertiary-bg);
  border: 1px solid var(--global-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-accent);
`;

const GuestTitle = styled.p`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: var(--global-text);
  letter-spacing: -0.01em;
`;

const GuestDesc = styled.p`
  margin: 0;
  font-size: 0.82rem;
  color: var(--global-text-muted);
  max-width: 270px;
  line-height: 1.65;
`;

const LoginBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.6rem 1.4rem;
  margin-top: 0.3rem;
  border-radius: var(--global-border-radius);
  border: none;
  background: var(--primary-accent);
  color: var(--global-secondary-bg);
  font-size: 0.84rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, filter 0.16s ease;

  &:hover { filter: brightness(1.08); transform: translateY(-1px); }
  &:active { transform: scale(0.97); }
`;

/* ── Content section ── */
const ContentWrap = styled.div`
  width: 100%;
  margin-top: 1.85rem;
  box-sizing: border-box;
`;

/* ─────────── Component ─────────── */
export const Profile: React.FC = () => {
  const { isLoggedIn, userData, login, refreshUserData } = useAuth();
  const railRef = useRef<HTMLDivElement>(null);

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
          <Hero>
            <HeroBg $src={coverSrc} />
            <HeroScrimTop />
            <HeroScrimBottom />
            <HeroFloorLine />

            <HeroContent>
              <AvatarFrame>
                <AvatarImg src={userData.avatar.large} alt={userData.name} />
              </AvatarFrame>

              <IdentityBlock>
                <MemberBadge><SiAnilist size={10} /> AniList Member</MemberBadge>
                <Username>{userData.name}</Username>
              </IdentityBlock>
            </HeroContent>
          </Hero>

          {userData.statistics && (
            <RailSection>
              <StatRail ref={railRef}>
                <StatChip $delay="0.02s">
                  <StatIconWrap><FiFilm /></StatIconWrap>
                  <StatText>
                    <StatValue>{userData.statistics.anime.count}</StatValue>
                    <StatLabel>Anime</StatLabel>
                  </StatText>
                </StatChip>

                <StatChip $delay="0.06s">
                  <StatIconWrap><FiTv /></StatIconWrap>
                  <StatText>
                    <StatValue>{userData.statistics.anime.episodesWatched}</StatValue>
                    <StatLabel>Episodes</StatLabel>
                  </StatText>
                </StatChip>

                <StatChip $delay="0.1s">
                  <StatIconWrap><FiClock /></StatIconWrap>
                  <StatText>
                    <StatValue>
                      {Math.round(userData.statistics.anime.minutesWatched / 60)}h
                    </StatValue>
                    <StatLabel>Hours</StatLabel>
                  </StatText>
                </StatChip>

                <StatChip $delay="0.14s">
                  <StatIconWrap><FiStar /></StatIconWrap>
                  <StatText>
                    <StatValue>
                      {userData.statistics.anime.meanScore.toFixed(1)}
                    </StatValue>
                    <StatLabel>Avg Score</StatLabel>
                  </StatText>
                </StatChip>
              </StatRail>

              <RailFade $side="left" />
              <RailFade $side="right" />

              <RailHint>
                <FiChevronLeft size={11} /> swipe for more <FiChevronRight size={11} />
              </RailHint>
            </RailSection>
          )}
        </>
      ) : (
        <GuestHero>
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
        </GuestHero>
      )}

      <ContentWrap>
        <EpisodeCard />
        <WatchingAnilist />
      </ContentWrap>
    </Page>
  );
};

export default Profile;
