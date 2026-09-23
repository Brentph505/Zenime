import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styled, { keyframes, css, createGlobalStyle } from 'styled-components';
import { useAuth, EpisodeCard, WatchingAnilist } from '../index';
import { ProfilePreviewModal } from '../components/Profile/ProfilePreviewModal';
import { ANILIST_ENTRY_CHANGED_EVENT } from '../hooks/useAniListEntry';
import { useAnimeProgressSync } from '../hooks/useAnimeProgressSync';
import { useSyncAniListHistory } from '../hooks/useSyncAniListHistory';
import { SiAnilist } from 'react-icons/si';
import { CgProfile } from 'react-icons/cg';
import { FaSyncAlt } from 'react-icons/fa';
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
  language) but is short and wide on mobile (16/10) so it never eats
  the whole first screen, then grows more cinematic at larger sizes.
  Identity is overlaid directly on the gradient instead of stacked
  below in a separate card.

  Avatar frame: the border is an animated, rotating conic-gradient
  applied directly as AvatarFrame's own background (same technique as
  the original static version — the image sits inside a 2.5px padding
  gap, so the gradient can only ever be visible as a thin ring, never
  a full box). Rotation is done by animating a registered custom
  property (--border-angle) rather than transform: rotate(), so only
  the *hue* spins — the frame's corners and the avatar image inside
  stay put. A blurred ::before copy (using `background: inherit`, so
  it always tracks the live animated gradient) sits behind for the
  glow halo. No new colors: still just --primary-accent, #db2777,
  #0891b2.

  Guest state mirrors the same compact banner proportions and is
  centered both axes, with its icon/title/copy scaling down on small
  screens so it doesn't read as floating in a tall empty box.

  Stat chips scale down their padding/icon/font under 560px so the
  rail takes less vertical and horizontal room on phones, then return
  to full size at the 560px breakpoint and flatten into a non-scrolling
  row at 720px.

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

/* rotates the conic-gradient's hue in place via a registered custom
   property, so the border spins without rotating the box/corners */
const spinBorder = keyframes`
  to { --border-angle: 360deg; }
`;

/* Registers --border-angle as an animatable <angle> so the keyframes
   above can interpolate it smoothly. Must be a top-level @property
   rule; mounted once via <BorderAngleProperty /> in the component. */
const BorderAngleProperty = createGlobalStyle`
  @property --border-angle {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0deg;
  }
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

/* ── Hero banner: short + wide on mobile, grows more cinematic as the
   viewport widens. Identity lives ON it. ── */
const Hero = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  min-height: 190px;
  max-height: clamp(190px, 50vw, 260px);
  border-radius: calc(var(--global-border-radius) * 1.4);
  overflow: hidden;
  isolation: isolate;
  animation: ${fadeUp} 0.4s ease both;

  @media (min-width: 560px) {
    aspect-ratio: 16 / 9;
    min-height: 280px;
    max-height: clamp(280px, 38vw, 340px);
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
          background-position: center center;
          background-repeat: no-repeat;
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
  gap: 0.75rem;
  padding: 0.85rem 0.9rem 0.9rem;

  @media (min-width: 560px) { padding: 1.25rem 1.5rem 1.4rem; gap: 1.1rem; }
  @media (min-width: 900px) { padding: 1.6rem 1.9rem 1.7rem; gap: 1.35rem; }
`;

const ProfileStatsActionButton = styled.button`
  position: absolute;
  top: 0.8rem;
  left: 0.8rem;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(255,255,255,0.18);
  background: rgba(10, 14, 22, 0.42);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #fff;
  border-radius: 999px;
  padding: 0.54rem 0.8rem;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
  transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;

  &:hover {
    transform: translateY(-1px);
    border-color: rgba(255,255,255,0.3);
    background: rgba(10, 14, 22, 0.54);
  }
`;

const SyncAniListButton = styled.button<{ $disabled?: boolean }>`
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 3;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.2rem;
  height: 2.2rem;
  padding: 0;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(10, 14, 22, 0.38);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  color: ${({ $disabled }) => ($disabled ? 'var(--global-text-muted)' : '#fff')};
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  transition: transform 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  opacity: ${({ $disabled }) => ($disabled ? 0.7 : 1)};

  &:hover {
    border-color: ${({ $disabled }) => ($disabled ? 'rgba(255,255,255,0.18)' : 'var(--primary-accent)')};
    transform: translateY(-1px);
  }

  &:active {
    transform: scale(0.98);
  }

  svg {
    font-size: 0.9rem;
  }

  ${({ $disabled }) =>
    $disabled &&
    `
      svg {
        animation: spin 0.9s linear infinite;
      }

      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    `}
`;

/* ── Avatar frame: the animated ring is the frame's own background,
   exactly like the original static version — it can only ever render
   as a thin border because AvatarImg fills everything inside the
   2.5px padding and physically covers the center. Rotation comes from
   animating --border-angle (registered above), so the conic-gradient
   spins in place without transforming the box itself. A blurred
   ::before, using `background: inherit`, mirrors whatever the parent
   is currently rendering (so it never falls out of sync) for the glow
   halo behind the ring. Same three colors as before, nothing new. ── */
const AvatarFrame = styled.div`
  position: relative;
  flex-shrink: 0;
  width: 52px;
  height: 52px;
  border-radius: 14px;
  padding: 2.5px;
  background: conic-gradient(
    from var(--border-angle, 0deg),
    var(--primary-accent, #7c3aed),
    #db2777,
    #0891b2,
    var(--primary-accent, #7c3aed)
  );
  animation: ${spinBorder} 4s linear infinite;
  box-shadow: 0 6px 16px rgba(0,0,0,0.38);
  isolation: isolate;

  &::before {
    content: '';
    position: absolute;
    inset: -3px;
    z-index: -1;
    border-radius: inherit;
    background: inherit;
    filter: blur(8px);
    opacity: 0.48;
  }

  @media (min-width: 560px) {
    width: 80px;
    height: 80px;
    border-radius: 18px;

    &::before { inset: -4px; filter: blur(10px); opacity: 0.5; }
  }

  @media (min-width: 900px) {
    width: 96px;
    height: 96px;
    border-radius: 20px;

    &::before { inset: -5px; filter: blur(12px); opacity: 0.52; }
  }
`;

const AvatarImg = styled.img`
  position: relative;
  z-index: 1;
  width: 100%;
  height: 100%;
  border-radius: 11.5px;
  object-fit: cover;
  display: block;
  background: var(--global-secondary-bg);

  @media (min-width: 560px) { border-radius: 15.5px; }
  @media (min-width: 900px) { border-radius: 17.5px; }
`;

const IdentityBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  min-width: 0;
  flex: 1;
  animation: ${riseIn} 0.45s ease 0.16s both;

  @media (min-width: 560px) { gap: 0.3rem; }
`;

const MemberBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  width: fit-content;
  padding: 0.16rem 0.5rem 0.16rem 0.4rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.1);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255,255,255,0.16);
  font-size: 0.56rem;
  font-weight: 700;
  color: #fff;
  text-transform: uppercase;
  letter-spacing: 0.07em;

  @media (min-width: 560px) {
    gap: 0.32rem;
    padding: 0.2rem 0.55rem 0.2rem 0.45rem;
    font-size: 0.66rem;
  }
`;

const Username = styled.h1`
  margin: 0;
  font-size: 1.05rem;
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
   row that can never wrap also can never break. Sizing itself also
   scales down under 560px so the rail is compact on phones. ── */
const RailSection = styled.div`
  position: relative;
  margin-top: 0.65rem;

  @media (min-width: 560px) { margin-top: 0.85rem; }
`;

const StatRail = styled.div`
  display: flex;
  gap: 0.45rem;
  overflow-x: auto;
  scroll-snap-type: x proximity;
  -webkit-overflow-scrolling: touch;
  padding: 0.15rem 0.15rem 0.5rem;
  margin: -0.15rem -0.15rem -0.5rem;

  scrollbar-width: none;
  &::-webkit-scrollbar { display: none; }

  @media (min-width: 560px) { gap: 0.6rem; }

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
  gap: 0.5rem;
  min-width: 104px;
  padding: 0.5rem 0.65rem;
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

  @media (min-width: 560px) {
    gap: 0.65rem;
    min-width: 132px;
    padding: 0.7rem 0.85rem;
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
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: var(--global-tertiary-bg);
  font-size: 0.85rem;
  color: var(--primary-accent);
  flex-shrink: 0;

  @media (min-width: 560px) {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    font-size: 1rem;
  }
`;

const StatText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.14rem;
  min-width: 0;
  line-height: 1;

  @media (min-width: 560px) { gap: 0.18rem; }
`;

const StatValue = styled.span`
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--global-text);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;

  @media (min-width: 560px) { font-size: 1.1rem; }
`;

const StatLabel = styled.span`
  font-size: 0.56rem;
  font-weight: 600;
  color: var(--global-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;

  @media (min-width: 560px) { font-size: 0.62rem; }
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
  margin-top: 0.4rem;
  font-size: 0.58rem;
  font-weight: 600;
  color: var(--global-text-muted);
  opacity: 0.7;
  letter-spacing: 0.03em;

  @media (min-width: 560px) { margin-top: 0.5rem; font-size: 0.62rem; }
  @media (min-width: 720px) { display: none; }
`;

/* ── Guest state — same compact banner proportions as the logged-in
   hero. Centering is done with an absolute-fill inner layer rather
   than flex-on-the-outer-box, so horizontal padding on the card can
   never throw off the centering axis (this was the bug: width: 100%
   + padding without border-box was pushing the flex box wider than
   its parent, making "centered" content look shifted left). ── */
const GuestHero = styled.div`
  position: relative;
  box-sizing: border-box;
  width: 100%;
  aspect-ratio: 16 / 10;
  min-height: 220px;
  max-height: clamp(220px, 50vw, 300px);
  border-radius: calc(var(--global-border-radius) * 1.4);
  overflow: hidden;
  background:
    radial-gradient(ellipse 70% 80% at 30% 30%, rgba(124,58,237,0.22) 0%, transparent 60%),
    radial-gradient(ellipse 60% 70% at 80% 70%, rgba(219,39,119,0.16) 0%, transparent 60%),
    var(--global-secondary-bg);
  animation: ${fadeUp} 0.4s ease both;

  @media (min-width: 560px) {
    aspect-ratio: 21 / 9;
    min-height: 260px;
    max-height: 320px;
  }
`;

/* absolute-fill layer: this is what actually centers GuestWrap. Using
   inset:0 + flex here (instead of flex directly on GuestHero) means
   the centering box's size is always exactly the parent's content
   box, regardless of any padding rules on GuestHero itself. */
const GuestCenterLayer = styled.div`
  position: absolute;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem 1.25rem;

  @media (min-width: 560px) { padding: 2.5rem 1.5rem; }
`;

const GuestWrap = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  text-align: center;
  animation: ${riseIn} 0.45s ease 0.1s both;

  @media (min-width: 560px) { gap: 0.8rem; }
`;

const GuestCircle = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 14px;
  background: var(--global-tertiary-bg);
  border: 1px solid var(--global-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-accent);

  @media (min-width: 560px) {
    width: 56px;
    height: 56px;
    border-radius: 16px;
  }
`;

const GuestTitle = styled.p`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--global-text);
  letter-spacing: -0.01em;

  @media (min-width: 560px) { font-size: 1.05rem; }
`;

const GuestDesc = styled.p`
  margin: 0;
  font-size: 0.78rem;
  color: var(--global-text-muted);
  max-width: 270px;
  line-height: 1.55;

  @media (min-width: 560px) { font-size: 0.82rem; line-height: 1.65; }
`;

const LoginBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.55rem 1.25rem;
  margin-top: 0.25rem;
  border-radius: var(--global-border-radius);
  border: none;
  background: var(--primary-accent);
  color: var(--global-secondary-bg);
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.16s ease, filter 0.16s ease;

  &:hover { filter: brightness(1.08); transform: translateY(-1px); }
  &:active { transform: scale(0.97); }

  @media (min-width: 560px) {
    gap: 0.45rem;
    padding: 0.6rem 1.4rem;
    margin-top: 0.3rem;
    font-size: 0.84rem;
  }
`;

/* ── Content section ── */
const ContentWrap = styled.div`
  width: 100%;
  margin-top: 1.85rem;
  box-sizing: border-box;
`;

/* ─────────── Component ─────────── */
export const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { isLoggedIn, userData, login, refreshUserData } = useAuth();
  const railRef = useRef<HTMLDivElement>(null);
  const [isPreviewOpen, setIsPreviewOpen] = React.useState(false);
  const { syncNow: pushToAniList, isSyncing: isPushingToAniList } = useAnimeProgressSync();
  const { syncNow: pullFromAniList, isSyncing: isPullingFromAniList } = useSyncAniListHistory();

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

  const handleManualAniListSync = useCallback(async () => {
    if (!isLoggedIn || isPushingToAniList || isPullingFromAniList) return;

    try {
      await pushToAniList();
      await pullFromAniList();
      window.dispatchEvent(new Event('storage'));
      window.dispatchEvent(new CustomEvent(ANILIST_ENTRY_CHANGED_EVENT));
    } catch (error) {
      console.error('[ProfileSync] Manual AniList sync failed:', error);
    }
  }, [isLoggedIn, isPushingToAniList, isPullingFromAniList, pushToAniList, pullFromAniList]);

  const coverSrc = userData?.bannerImage ?? null;

  return (
    <Page>
      <BorderAngleProperty />
      {isLoggedIn && userData ? (
        <>
          <Hero>
            <HeroBg $src={coverSrc} />
            <HeroScrimTop />
            <HeroScrimBottom />
            <HeroFloorLine />

            <ProfileStatsActionButton
              type='button'
              onClick={() => navigate('/profile/stats?mediaType=anime&tab=overview')}
              aria-label='View profile stats'
            >
              <SiAnilist size={12} />
              View stats
            </ProfileStatsActionButton>

            <SyncAniListButton
              $disabled={isPushingToAniList || isPullingFromAniList}
              onClick={handleManualAniListSync}
              disabled={isPushingToAniList || isPullingFromAniList}
              title={isPushingToAniList || isPullingFromAniList ? 'Syncing history with AniList…' : 'Sync local history with AniList now'}
              aria-label='Sync AniList now'
            >
              <FaSyncAlt aria-hidden='true' />
            </SyncAniListButton>

            <HeroContent>
              <AvatarFrame
                onClick={() => setIsPreviewOpen(true)}
                style={{ cursor: 'pointer' }}
                title='View profile photo'
              >
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
          <GuestCenterLayer>
            <GuestWrap>
              <GuestCircle><CgProfile size={24} /></GuestCircle>
              <GuestTitle>Not logged in</GuestTitle>
              <GuestDesc>
                Connect your AniList account to track your anime and continue where you left off.
              </GuestDesc>
              <LoginBtn onClick={login}>
                <SiAnilist size={14} /> Log in with AniList
              </LoginBtn>
            </GuestWrap>
          </GuestCenterLayer>
        </GuestHero>
      )}

      <ContentWrap>
        <EpisodeCard />
        <WatchingAnilist />
      </ContentWrap>

      <ProfilePreviewModal open={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} user={userData} />
    </Page>
  );
};

export default Profile;