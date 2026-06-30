import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { SiMyanimelist, SiAnilist } from 'react-icons/si';
import {
  FaPlay, FaBookOpen, FaSearch, FaClosedCaptioning, FaMicrophone,
  FaChevronLeft, FaChevronRight,
} from 'react-icons/fa';
import { MdViewList, MdGridOn } from 'react-icons/md';
import { BsEye } from 'react-icons/bs';
import {
  fetchAnimeInfo,
  fetchAnimeData,
  fetchMangaInfo,
  Episode,
  Anime,
  Manga,
  CardItem as AnimeCardItem,
  useTitleWithSubtitle,
  useCharacterName,
} from '../index';
import { saveLastMangaVisited, addReadChapterIfMissing } from '../lib/mangaHistory';
import { ListActions } from '../components/Info/ListActions';
import { MangaBookmarkButton } from '../components/Home/MangaBookmarkButton';
import { SkeletonInfo } from '../components/Skeletons/Skeletons';
import { useSettings } from '../components/Profile/SettingsProvider';

// ─── Animations ───────────────────────────────────────────────────────────────

const fadeIn  = keyframes`from { opacity: 0 } to { opacity: 1 }`;
const slideR  = keyframes`from { opacity: 0; transform: translateX(-12px) } to { opacity: 1; transform: translateX(0) }`;
const slideU  = keyframes`from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) }`;
const scanLine = keyframes`
  0%   { transform: translateY(-100%) }
  100% { transform: translateY(100%) }
`;

// ─── Design tokens ────────────────────────────────────────────────────────────

const A = {
  accent:     '#c084fc',
  accentDim:  'rgba(192,132,252,0.15)',
  accentGlow: 'rgba(192,132,252,0.06)',
  text:       'var(--global-text)',
  muted:      'var(--global-text-muted)',
  bg:         'var(--global-primary-bg)',
  surface:    'var(--global-secondary-bg)',
  card:       'var(--global-card-bg)',
  border:     'var(--global-border)',
  faint:      'var(--global-div-tr)',
};

// ─── AniList format types that are definitively manga/print media ─────────────
// These are the format strings that AniList returns for non-anime media.
// TV, TV_SHORT, MOVIE, SPECIAL, OVA, ONA, MUSIC → ANIME
// MANGA, ONE_SHOT, NOVEL, LIGHT_NOVEL            → MANGA
const MANGA_FORMAT_TYPES = new Set([
  'MANGA', 'ONE_SHOT', 'NOVEL', 'LIGHT_NOVEL',
]);

type MediaType = 'ANIME' | 'MANGA';
type AnimeProvider = 'kickassanime' | 'animepahe' | 'anikoto' | 'reanime' | 'hentaimama' | 'watchhentai';
type MangaProvider = 'mangahere' | 'mangapill';
type Provider = AnimeProvider | MangaProvider;
type InfoTab = 'overview' | 'characters' | 'episodes';

/** Checks if a genres array contains 'hentai'. */
function isHentaiGenres(genres?: string[]): boolean {
  return Array.isArray(genres) && genres.some((g) => g.toLowerCase() === 'hentai');
}

const RANGE = 100;

/**
 * Determines the correct MediaType for a piece of content.
 *
 * Priority order (highest → lowest):
 *  1. Explicit URL ?type=MANGA / ?type=ANIME param — user/router set this
 *  2. AniList `type` field on the returned data (MANGA vs ANIME at the media level)
 *  3. AniList `format` field if type is ambiguous (ONE_SHOT, NOVEL, etc.)
 *
 * We deliberately NEVER upgrade an ANIME result to MANGA based solely on
 * missing episodes — a provider outage should not change the content type.
 */
function resolveMediaType(
  queryType: string | null,
  dataType?: string,
  dataFormat?: string,
): MediaType {
  // 1. Explicit URL param wins unconditionally
  if (queryType === 'MANGA') return 'MANGA';
  if (queryType === 'ANIME') return 'ANIME';

  // 2. AniList `type` field — this is the most reliable signal
  //    AniList returns "ANIME" or "MANGA" at the top-level type field
  const anilistType = dataType?.toUpperCase();
  if (anilistType === 'MANGA') return 'MANGA';
  if (anilistType === 'ANIME') return 'ANIME';

  // 3. Fall back to format-based detection
  const format = (dataFormat ?? dataType ?? '').toUpperCase();
  if (MANGA_FORMAT_TYPES.has(format)) return 'MANGA';

  // 4. Default to ANIME — better to show an anime page with no episodes
  //    than to misidentify an anime as manga
  return 'ANIME';
}

// ─── Root ─────────────────────────────────────────────────────────────────────

const PageWrapper = styled.div`
  min-height: 100vh;
  background: transparent;
  color: ${A.text};
  font-family: 'DM Sans', 'Segoe UI', sans-serif;
  animation: ${fadeIn} 0.4s ease;
  overflow-x: hidden;
`;

// ─── Hero ─────────────────────────────────────────────────────────────────────

const HeroWrap = styled.div`
  position: relative;
  width: calc(100vw + 2rem);
  margin: 0 -1rem;
  height: 360px;
  overflow: hidden;
  @media (max-width: 768px) { width: calc(100vw + 1rem); margin: 0 -0.5rem; height: 180px; }
`;

const HeroImg = styled.img`
  width: 100%; height: 100%;
  object-fit: cover; object-position: center 18%;
  filter: saturate(0.6) brightness(0.55);
`;

const HeroGrade = styled.div`
  position: absolute; inset: 0;
  background: linear-gradient(
    160deg,
    rgba(0,0,0,0.05) 0%,
    rgba(0,0,0,0.35) 50%,
    var(--global-primary-bg) 100%
  );
`;

const ScanShimmer = styled.div`
  position: absolute; inset: 0; overflow: hidden; pointer-events: none;
  &::after {
    content: ''; position: absolute; left: 0; right: 0; height: 60px;
    background: linear-gradient(to bottom, transparent, rgba(192,132,252,0.04), transparent);
    animation: ${scanLine} 4s linear infinite;
  }
`;

const HeroAccentBar = styled.div`
  position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: linear-gradient(to bottom, transparent, ${A.accent}, transparent);
`;

// ─── Layout ───────────────────────────────────────────────────────────────────

const Shell = styled.div`
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1rem 5rem;
  position: relative;
  box-sizing: border-box;
  @media (max-width: 860px) {
    padding: 0 0 4rem;
    width: 100%;
  }
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: 230px 1fr;
  gap: 1rem;
  margin-top: -110px;
  position: relative; z-index: 2;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    margin-top: 0;
    gap: 0;
  }
`;

// ─── Mobile hero overlay ──────────────────────────────────────────────────────

const MobileHeader = styled.div`
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

const MobilePosterWrap = styled.div`
  flex-shrink: 0;
  width: 100px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 0 0 1px ${A.border}, 0 16px 32px rgba(0,0,0,0.6);
  position: relative;
`;

const MobilePosterImg = styled.img`
  width: 100%; display: block;
`;

const MobilePosterScore = styled.div`
  position: absolute; top: 0; right: 0;
  background: ${A.accent}; color: #0a0a0c;
  font-size: 0.65rem; font-weight: 800;
  padding: 0.2rem 0.45rem; letter-spacing: 0.04em; border-bottom-left-radius: 6px;
`;

const MobileTitleBlock = styled.div`flex: 1; min-width: 0; padding-bottom: 0.25rem;`;

const MobileEyebrow = styled.div`
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.16em;
  text-transform: uppercase; color: ${A.accent}; margin-bottom: 0.25rem;
`;

const MobileTitle = styled.h1`
  font-size: 1.15rem; font-weight: 800; line-height: 1.15;
  margin: 0 0 0.2rem; color: ${A.text};
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; word-break: break-word;
`;

const MobileRomaji = styled.p`
  font-size: 0.75rem; color: ${A.muted}; margin: 0; font-style: italic;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;

const MobilePillRow = styled.div`display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem;`;

// ─── Left column ─────────────────────────────────────────────────────────────

const LeftCol = styled.div`
  display: flex; flex-direction: column; gap: 0.75rem;
  animation: ${slideR} 0.5s ease both;
  @media (max-width: 860px) { display: none; }
`;

const PosterWrap = styled.div`
  position: relative; border-radius: 8px; overflow: hidden;
  box-shadow: 0 0 0 1px #e5e7eb, 0 8px 24px rgba(0,0,0,0.12);
  .dark-mode & { box-shadow: 0 0 0 1px ${A.border}, 0 24px 48px rgba(0,0,0,0.55); }
`;

const PosterImg = styled.img`
  width: 100%; display: block;
`;

const ScoreBadge = styled.div`
  position: absolute; top: 0; right: 0;
  background: ${A.accent}; color: #0a0a0c;
  font-size: 0.72rem; font-weight: 800;
  padding: 0.25rem 0.5rem; letter-spacing: 0.04em; border-bottom-left-radius: 6px;
`;

const AdultBadge = styled.div`
  position: absolute; top: 0; left: 0;
  background: rgba(220, 38, 38, 0.95);
  color: #ffffff;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.35rem 0.6rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border-bottom-right-radius: 6px;
`;

const PosterActions = styled.div`display: flex; flex-direction: column; gap: 0.5rem;`;

const WatchBtn = styled.button`
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.75rem; background: ${A.accent}; border: none; border-radius: 6px;
  color: #0a0a0c; font-size: 0.82rem; font-weight: 800;
  letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
  transition: filter 0.2s, transform 0.15s;
  &:hover { filter: brightness(1.12); transform: translateY(-1px); }
  &:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
`;

const ExtRow = styled.div`display: flex; gap: 0.25rem;`;

const ExtBtn = styled.a`
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 0.5rem; background: #ffffff; border: 1px solid #e5e7eb;
  border-radius: 6px; color: #6b7280; text-decoration: none;
  transition: border-color 0.2s, color 0.2s;
  &:hover { border-color: ${A.accent}; color: ${A.text}; }
  .dark-mode & { background: ${A.card}; border: 1px solid ${A.border}; color: ${A.muted}; }
`;

const SidebarMeta = styled.div`
  display: flex; flex-direction: column; gap: 0; width: 100%; font-size: 0.78rem;
`;

const SideMetaRow = styled.div`
  display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem;
  padding: 0.4rem 0; border-bottom: 1px solid #e5e7eb;
  &:last-child { border-bottom: none; }
  .dark-mode & { border-bottom: 1px solid ${A.faint}; }
`;

const SideMetaKey = styled.span`color: #6b7280; white-space: nowrap; flex-shrink: 0;
  .dark-mode & { color: ${A.muted}; }`;
const SideMetaVal = styled.span`text-align: right; color: #1f2937; word-break: break-word; font-weight: 600;
  .dark-mode & { color: ${A.text}; }`;

// ─── Right column ─────────────────────────────────────────────────────────────

const RightCol = styled.div`
  min-width: 0; display: flex; flex-direction: column; gap: 1.5rem;
  padding: 1.25rem 1.25rem 1.5rem;
  background: #f8f9fa; border: 1px solid #e5e7eb; border-radius: 12px;
  animation: ${slideU} 0.5s ease 0.1s both;
  .dark-mode & { background: var(--global-div-tr); border: 1px solid ${A.border}; }
  @media (max-width: 860px) {
    border-radius: 0; border-left: none; border-right: none; border-top: none;
    padding: 0.85rem 0.75rem 1.25rem; gap: 1rem; margin: 0; width: 100%; box-sizing: border-box;
  }
  @media (max-width: 600px) { padding: 0.75rem 0.75rem 1.25rem; }
`;

const DesktopTitleBlock = styled.div`@media (max-width: 860px) { display: none; }`;

const MobileActionBar = styled.div`
  display: none;
  @media (max-width: 860px) { display: flex; gap: 0.25rem; flex-wrap: wrap; align-items: center; }
`;

const MobileListActions = styled.div`
  display: none;
  @media (max-width: 860px) { display: block; flex-basis: 100%; }
`;

const MobileWatchBtn = styled.button`
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.45rem;
  padding: 0.65rem; background: ${A.accent}; border: none; border-radius: 6px;
  color: #0a0a0c; font-size: 0.78rem; font-weight: 800;
  letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
  &:disabled { opacity: 0.45; cursor: not-allowed; }
`;

const MobileExtBtn = styled.a`
  display: flex; align-items: center; justify-content: center;
  padding: 0.6rem 0.75rem; background: #ffffff; border: 1px solid #e5e7eb;
  border-radius: 6px; color: #6b7280; text-decoration: none;
  transition: border-color 0.2s, color 0.2s;
  &:hover { border-color: ${A.accent}; color: ${A.text}; }
  .dark-mode & { background: ${A.card}; border: 1px solid ${A.border}; color: ${A.muted}; }
`;

const MobileMeta = styled.div`
  display: none;
  @media (max-width: 860px) {
    display: grid; grid-template-columns: 1fr 1fr; gap: 0;
    border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; font-size: 0.75rem;
    background: #f8f9fa;
    .dark-mode & { background: ${A.surface}; border-color: ${A.border}; }
  }
`;

const MobileMetaCell = styled.div`
  padding: 0.4rem 0.6rem; border-bottom: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;
  background: #ffffff;
  &:nth-child(2n) { border-right: none; }
  &:nth-last-child(-n+2) { border-bottom: none; }
  .dark-mode & { background: ${A.card}; border-color: ${A.border}; }
`;

const MobileMetaKey = styled.div`color: #6b7280; font-size: 0.68rem; margin-bottom: 0.1rem; letter-spacing: 0.04em;
  .dark-mode & { color: ${A.muted}; }`;
const MobileMetaVal = styled.div`color: #1f2937; font-weight: 600; font-size: 0.78rem;
  .dark-mode & { color: ${A.text}; }`;

const EyeBrow = styled.div`
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: ${A.accent}; margin-bottom: 0.35rem;
`;

const MainTitle = styled.h1`
  font-size: 1.75rem; font-weight: 800; line-height: 1.1; margin: 0 0 0.3rem; color: #1f2937;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden; word-break: break-word;
  .dark-mode & { color: ${A.text}; }
  @media (max-width: 600px) { font-size: 1.45rem; }
`;
const RomajiSub = styled.p`font-size: 0.85rem; color: #6b7280; margin: 0 0 0.9rem; font-style: italic;
  .dark-mode & { color: ${A.muted}; }`;

const PillRow = styled.div`display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem;`;

const Pill = styled.span<{ $accent?: boolean }>`
  padding: 0.2rem 0.65rem; border-radius: 99px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em;
  border: 1px solid ${({ $accent }) => $accent ? A.accent : A.border};
  color: ${({ $accent }) => $accent ? A.accent : A.muted};
  background: ${({ $accent }) => $accent ? A.accentDim : 'transparent'};
`;

const ClickablePill = styled(Pill)`
  cursor: pointer; transition: all 0.2s ease;
  &:hover { border-color: ${A.accent}; color: ${A.accent}; background: ${A.accentDim}; }
`;

const ClickableMetaVal = styled.span`
  cursor: pointer; transition: color 0.2s ease;
  &:hover { color: ${A.accent}; }
`;

// ─── Tab navigation ───────────────────────────────────────────────────────────

const TabNav = styled.div`display: flex; border-bottom: 1px solid #e5e7eb;
  .dark-mode & { border-bottom: 1px solid ${A.border}; }`;

const Tab = styled.button<{ $active?: boolean }>`
  padding: 0.7rem 1.25rem; background: none; border: none;
  border-bottom: 2px solid ${({ $active }) => $active ? A.accent : 'transparent'};
  margin-bottom: -1px;
  color: ${({ $active }) => $active ? '#1f2937' : '#6b7280'};
  font-size: 0.82rem; font-weight: ${({ $active }) => $active ? '700' : '500'};
  letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  &:hover { color: ${A.text}; }
  .dark-mode & { color: ${({ $active }) => $active ? A.text : A.muted}; }
  @media (max-width: 480px) { padding: 0.6rem 0.85rem; font-size: 0.75rem; letter-spacing: 0.04em; }
`;

const Panel = styled.div`animation: ${fadeIn} 0.25s ease;`;

// ─── Overview ─────────────────────────────────────────────────────────────────

const Desc = styled.p`
  font-size: 0.88rem; line-height: 1.85; color: #4b5563; margin: 0;
  max-height: 260px; overflow-y: auto; padding-right: 6px;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: ${A.accent}; border-radius: 3px; }
  scrollbar-width: thin; scrollbar-color: ${A.accent} transparent;
  .dark-mode & { color: ${A.muted}; }
  @media (max-width: 860px) { max-height: 160px; }
`;

const TrailerBox = styled.div`
  position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px;
  iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
`;

// ─── Characters ───────────────────────────────────────────────────────────────

const CharGrid = styled.div`
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.6rem;
  max-height: 400px; overflow-y: auto; padding-right: 8px;
  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: ${A.accent}; border-radius: 3px; }
  scrollbar-width: thin; scrollbar-color: ${A.accent} transparent;
  @media (max-width: 500px) { display: flex; flex-direction: column; gap: 0.5rem; }
`;

const CharCard = styled.div`
  display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem;
  background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px;
  transition: border-color 0.2s;
  &:hover { border-color: ${A.accent}; }
  .dark-mode & { background: ${A.card}; border: 1px solid ${A.border}; }
`;
const CharImg  = styled.img`width: 44px; height: 60px; object-fit: cover; border-radius: 4px; flex-shrink: 0;`;
const CharName = styled.span`font-size: 0.82rem; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1f2937;
  .dark-mode & { color: ${A.text}; }`;
const CharRole = styled.span`font-size: 0.7rem; color: ${A.accent}; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase;`;

// ─── Episode Controls ─────────────────────────────────────────────────────────

type EpView = 'card' | 'list' | 'number';

const EpControls = styled.div`
  display: flex; align-items: center; gap: 0.25rem; flex-wrap: wrap; margin-bottom: 0.35rem;
`;

const RangePillRow = styled.div`
  display: flex; gap: 0.22rem; flex-wrap: wrap; flex: 0 0 auto; min-width: 0; margin-bottom: 0.28rem;
  @media (max-width: 860px) {
    order: 2;
    width: 100%;
    margin-bottom: 0.15rem;
  }
`;

const RangeRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.22rem;
  flex-wrap: wrap;
  margin-bottom: 0.28rem;

  @media (max-width: 860px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0.14rem;
    margin-bottom: 0.15rem;
  }
`;

const RangeAction = styled.div`
  display: flex;
  align-items: center;
  gap: 0.22rem;
  flex: 1 1 0;
  min-width: 0;
  flex-wrap: wrap;

  @media (max-width: 860px) {
    flex-wrap: wrap;
    align-items: stretch;
    order: 1;
    gap: 0.16rem;
  }
`;

const AnimeRangeAction = styled.div`
  display: flex;
  align-items: center;
  gap: 0.22rem;
  flex: 1 1 0;
  min-width: 0;
  flex-wrap: wrap;

  @media (max-width: 860px) {
    flex-wrap: wrap;
    align-items: center;
    order: 1;
    gap: 0.16rem;
  }
`;

const RangePill = styled.button<{ $active?: boolean }>`
  padding: 0.26rem 0.6rem; border-radius: 99px; font-size: 0.72rem; font-weight: 600;
  cursor: pointer; transition: all 0.15s;
  border: 1px solid ${({ $active }) => $active ? A.accent : '#e5e7eb'};
  background: ${({ $active }) => $active ? A.accentDim : '#ffffff'};
  color: ${({ $active }) => $active ? A.accent : '#6b7280'};
  &:hover { border-color: ${A.accent}; color: ${A.accent}; }
  .dark-mode & {
    border: 1px solid ${({ $active }) => $active ? A.accent : A.border};
    background: ${({ $active }) => $active ? A.accentDim : A.card};
    color: ${({ $active }) => $active ? A.accent : A.muted};
  }
`;

const RangeSelect = styled.select`
  width: auto;
  padding: 0.4rem 0.6rem;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  color: #1f2937;
  font-size: 0.8rem;
  cursor: pointer;
  outline: none;

  &:focus { border-color: ${A.accent}; }

  .dark-mode & {
    background: ${A.card};
    border: 1px solid ${A.border};
    color: ${A.text};
  }

  @media (max-width: 860px) {
    width: 100%;
    min-width: 0;
  }
`;

const RangeSelectWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  min-width: 0;

  svg {
    position: absolute;
    left: 0.5rem;
    color: ${A.muted};
    pointer-events: none;
  }

  select {
    width: 100%;
    padding-left: 2rem;
  }
`;

const SearchBox = styled.div`
  flex: 1 1 auto; min-width: 150px; position: relative;
  svg { position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%); color: ${A.muted}; pointer-events: none; }
`;

const SearchInput = styled.input`
  width: 100%; padding: 0.45rem 0.75rem 0.45rem 2rem;
  background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px;
  color: #1f2937; font-size: 0.8rem; outline: none; box-sizing: border-box;
  &::placeholder { color: #9ca3af; }
  &:focus { border-color: ${A.accent}; }
  .dark-mode & {
    background: ${A.card}; border: 1px solid ${A.border}; color: ${A.text};
    &::placeholder { color: ${A.muted}; }
  }
  @media (max-width: 860px) {
    padding: 0.35rem 0.6rem 0.35rem 1.8rem;
    font-size: 0.75rem;
  }
`;

const SegmentedControl = styled.div`
  display: flex; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;
  .dark-mode & { background: ${A.card}; border-color: ${A.border}; }
  @media (max-width: 860px) {
    flex-shrink: 0;
  }
`;

const SegmentOption = styled.button<{ $active?: boolean }>`
  display: flex; align-items: center; justify-content: center; padding: 0.4rem 0.55rem;
  background: ${({ $active }) => $active ? A.accentDim : 'transparent'};
  color: ${({ $active }) => $active ? A.accent : '#6b7280'};
  border: none; border-right: 1px solid #e5e7eb; cursor: pointer; transition: all 0.15s; font-size: 0.78rem;
  &:last-child { border-right: none; }
  &:hover { color: ${A.accent}; }
  .dark-mode & { color: ${({ $active }) => $active ? A.accent : A.muted}; border-right-color: ${A.border}; }
  @media (max-width: 860px) {
    padding: 0.32rem 0.45rem;
    font-size: 0.7rem;
  }
`;

const EpScrollArea = styled.div`
  max-height: 480px; overflow-y: auto; padding-right: 4px;
  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: ${A.accent}; border-radius: 3px; }
  scrollbar-width: thin; scrollbar-color: ${A.accent} transparent;
  @media (max-width: 860px) { max-height: 420px; }
`;

// ─── Card view ────────────────────────────────────────────────────────────────

const CardGrid = styled.div`
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.45rem;
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 520px) { grid-template-columns: 1fr; gap: 0.3rem; }
`;

const EpisodeCardItem = styled.div`
  display: flex; gap: 0.45rem; padding: 0.45rem;
  background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px;
  cursor: pointer; transition: border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s;
  .dark-mode & { background: ${A.card}; border: 1px solid ${A.border}; }

  @media (hover: hover) {
    &:hover {
      border-color: ${A.accent};
      background: ${A.accentGlow};
      transform: translateY(-1px);
      box-shadow: 0 10px 20px rgba(55, 65, 81, 0.08);
    }
  }

  @media (max-width: 520px) {
    gap: 0.3rem;
    padding: 0.35rem;
  }
`;

const CardThumbWrap = styled.div`
  position: relative; flex-shrink: 0; border-radius: 4px; overflow: hidden; width: 88px; height: 58px;
  @media (max-width: 520px) {
    width: 72px;
    height: 48px;
  }
`;

const imagePulse = keyframes`
  0%, 100% { background-color: var(--global-primary-skeleton); }
  50% { background-color: var(--global-secondary-skeleton); }
`;

const CardThumbSkeleton = styled.div`
  position: absolute;
  inset: 0;
  background: var(--global-primary-skeleton);
  animation: ${imagePulse} 1.6s ease-in-out infinite;
`;

const CardThumb = styled.img<{ $loaded: boolean; $blurred?: boolean }>`
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  opacity: ${({ $loaded }) => ($loaded ? 1 : 0)};
  transition: opacity 0.2s ease-in-out;
  filter: ${({ $blurred }) => ($blurred ? 'blur(8px)' : 'none')};
`;

const CardEpBadge = styled.span`
  position: absolute; bottom: 3px; left: 3px;
  background: rgba(0,0,0,0.75); color: #fff;
  font-size: 0.64rem; font-weight: 700; padding: 1px 5px; border-radius: 3px; letter-spacing: 0.03em;
`;

const CardBody = styled.div`flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;`;

const CardTitle = styled.span`
  font-size: 0.78rem; font-weight: 600; line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  color: #1f2937;
  .dark-mode & { color: ${A.text}; }
`;

const CardDescription = styled.span`
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 0.72rem;
  line-height: 1.35;
  color: #4b5563;
  margin-top: 0.25rem;
  .dark-mode & { color: ${A.muted}; }
`;

const CardMeta = styled.div`display: flex; align-items: center; gap: 0.4rem; margin-top: 0.3rem; flex-wrap: wrap;`;
const CardDate = styled.span`font-size: 0.68rem; color: #6b7280; .dark-mode & { color: ${A.muted}; }`;
const CardIcons = styled.div`display: flex; gap: 0.25rem; align-items: center; margin-left: auto;`;
const SmIcon = styled.span`color: ${A.muted}; font-size: 0.7rem; display: flex; align-items: center;`;

// ─── List view ────────────────────────────────────────────────────────────────

const ListGrid = styled.div`
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.22rem;
  @media (max-width: 860px) { grid-template-columns: 1fr; }
`;

const ListItem = styled.div<{ $first?: boolean }>`
  display: flex; align-items: center; gap: 0.4rem; padding: 0.34rem 0.55rem;
  background: ${({ $first }) => $first ? A.accentDim : '#ffffff'};
  border: 1px solid ${({ $first }) => $first ? A.accent : '#e5e7eb'};
  border-radius: 6px; cursor: pointer; min-width: 0;
  transition: border-color 0.15s, background 0.15s, transform 0.15s, box-shadow 0.15s;
  .dark-mode & {
    background: ${({ $first }) => $first ? A.accentDim : A.card};
    border: 1px solid ${({ $first }) => $first ? A.accent : A.border};
  }

  @media (hover: hover) {
    &:hover {
      border-color: ${A.accent};
      background: ${A.accentGlow};
      transform: translateY(-1px);
      box-shadow: 0 6px 14px rgba(55, 65, 81, 0.08);
    }
  }
`;

const ListPlayIcon = styled.span`color: ${A.accent}; display: flex; align-items: center; flex-shrink: 0;`;
const ListEpNum = styled.span`font-size: 0.68rem; color: ${A.accent}; font-weight: 700; flex-shrink: 0; min-width: 2.2rem;`;
const ListTitle = styled.span`
  font-size: 0.8rem; font-weight: 600; color: #1f2937;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; min-width: 0;
  .dark-mode & { color: ${A.text}; }
`;
const ListIcons = styled.div`display: flex; gap: 0.25rem; align-items: center; flex-shrink: 0; padding-left: 0.25rem;`;

// ─── Number grid view ─────────────────────────────────────────────────────────

const NumGrid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fill, minmax(52px, 1fr)); gap: 0.22rem;
`;

const NumCell = styled.div<{ $active?: boolean; $filler?: boolean; $first?: boolean }>`
  display: flex; align-items: center; justify-content: center;
  height: 44px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600;
  background: ${({ $active, $first, $filler }) =>
    $first  ? A.accentDim :
    $filler ? 'rgba(192,132,252,0.08)' :
    $active ? 'rgba(192,132,252,0.12)' : '#ffffff'};
  border: 1px solid ${({ $active, $first }) =>
    $first  ? A.accent :
    $active ? 'rgba(192,132,252,0.4)' : '#e5e7eb'};
  color: ${({ $first }) => $first ? A.accent : '#1f2937'};
  transition: border-color 0.15s, background 0.15s;
  &:hover { border-color: ${A.accent}; color: ${A.accent}; }
  .dark-mode & {
    background: ${({ $active, $first, $filler }) =>
      $first  ? A.accentDim :
      $filler ? 'rgba(192,132,252,0.08)' :
      $active ? 'rgba(192,132,252,0.12)' : A.card};
    border: 1px solid ${({ $active, $first }) =>
      $first  ? A.accent :
      $active ? 'rgba(192,132,252,0.4)' : A.border};
    color: ${({ $first }) => $first ? A.accent : A.text};
  }
`;

// ─── Full-width sections ──────────────────────────────────────────────────────

const FullWidthSection = styled.div`
  margin-top: 2.5rem; padding: 2rem 0;
  border-top: 1px solid #e5e7eb; position: relative; z-index: 2;
  .dark-mode & { border-top: 1px solid ${A.border}; }
  @media (max-width: 860px) {
    margin-top: 1.75rem;
    padding: 1.5rem 0 0;
    width: 100%;
    margin-left: 0;
    margin-right: 0;
  }
`;

const SectionHeader = styled.div`display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;`;

const SectionLabel = styled.div`
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #6b7280;
  &::before { content: ''; display: inline-block; width: 12px; height: 2px; background: ${A.accent}; margin-right: 0.5rem; vertical-align: middle; }
  .dark-mode & { color: ${A.muted}; }
`;

const ScrollBtnRow = styled.div`
  display: flex; gap: 0.4rem;
  @media (max-width: 860px) { display: none; }
`;

const ScrollBtn = styled.button`
  display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 6px;
  border: 1px solid ${A.border}; background: ${A.card}; color: ${A.text}; cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  &:hover { border-color: ${A.accent}; color: ${A.accent}; }
`;

const StyledCardGrid = styled.div`
  display: flex; gap: 0.75rem; overflow-x: auto; overflow-y: hidden;
  padding-bottom: 0.4rem; scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch;
  &::-webkit-scrollbar { display: none; height: 0; }
  scrollbar-width: none; scrollbar-color: transparent transparent;
  & > * { flex: 0 0 auto; width: 150px; scroll-snap-align: start; }
  @media (max-width: 800px) { gap: 0.6rem; & > * { width: 140px; } }
  @media (max-width: 450px) { gap: 0.5rem; & > * { width: 120px; } }
`;

// ─── States ───────────────────────────────────────────────────────────────────

const ErrorWrap = styled.div`
  text-align: center; padding: 6rem 2rem;
  h2 { color: #f87171; margin-bottom: 0.75rem; }
  p  { color: ${A.muted}; margin-bottom: 2rem; font-size: 0.9rem; }
`;

const PrimaryBtn = styled.button`
  padding: 0.7rem 1.5rem; background: ${A.accent}; color: #0a0a0c; border: none; border-radius: 4px;
  font-weight: 800; font-size: 0.82rem; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
`;

const ProviderSwitcher = styled.div`
  display: flex; gap: 0.25rem; flex-wrap: wrap; align-items: center;
  flex: 0 0 auto; min-width: auto;
  @media (max-width: 860px) {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.18rem;
    margin-top: 0.15rem;
    flex: 1 1 100%;
    width: 100%;
    min-width: 0;
  }
`;

const ProviderButton = styled.button<{ $active?: boolean }>`
  padding: 0.4rem 0.65rem; border-radius: 6px;
  border: 1px solid ${p => p.$active ? A.accent : A.border};
  background: ${p => p.$active ? A.accent : A.card};
  color: ${p => p.$active ? '#0a0a0c' : A.text};
  cursor: pointer; font-size: 0.78rem; font-weight: 700;
  transition: background 0.2s, border-color 0.2s, color 0.2s;
  &:hover { border-color: ${A.accent}; }

  @media (max-width: 860px) {
    width: 100%;
    padding: 0.65rem 0.75rem;
    justify-content: center;
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

interface CharacterCardComponentProps {
  character: any;
}

const CharacterCardComponent: React.FC<CharacterCardComponentProps> = ({ character }) => {
  const displayName = useCharacterName(character.name);
  
  return (
    <CharCard>
      <CharImg src={character.image} alt={displayName} />
      <div style={{ minWidth: 0 }}>
        <CharName>{displayName}</CharName>
        <CharRole>{character.role}</CharRole>
      </div>
    </CharCard>
  );
};

const Info: React.FC = () => {
  const { animeId } = useParams<{ animeId?: string }>();
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();

  // ── Stable type resolution — derived from URL, not from provider responses ──
  // This is the *authoritative* source of truth for media type. It is computed
  // once per URL change and never mutated based on what a provider returns.
  const queryType     = searchParams.get('type')?.toUpperCase() ?? null;
  const queryProvider = searchParams.get('provider')?.toLowerCase() ?? null;

  const [animeInfo, setAnimeInfo] = useState<Anime & Partial<Manga> | null>(null);
  const { settings } = useSettings();

  const [loading, setLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  
  // Call hook unconditionally at the top level, before any conditional renders
  const titleDisplay = useTitleWithSubtitle(animeInfo?.title);
  
  const [activeTab, setActiveTab] = useState<InfoTab>('overview');
  const [selectedEpisodeId] = useState<string | null>(null);

  // Track which manga providers actually returned chapters (for button visibility)
  const [availableMangaProviders, setAvailableMangaProviders] = useState<Set<MangaProvider>>(new Set());

  // Track which hentai providers are available (hentaimama is default, watchhentai is extra)
  const [availableHentaiProviders, setAvailableHentaiProviders] = useState<Set<AnimeProvider>>(new Set());

  const [provider, setProvider] = useState<Provider>(() => {
    if (queryType === 'MANGA') {
      return (queryProvider === 'mangapill' ? 'mangapill'
        : (localStorage.getItem('manga-provider-preference') as MangaProvider)) || 'mangahere';
    }
    // Hentai preference is stored separately
    const savedHentai = localStorage.getItem('hentai-provider-preference') as AnimeProvider | null;
    const savedAnime  = localStorage.getItem('provider-preference') as AnimeProvider | null;
    return savedAnime || savedHentai || 'anikoto';
  });

  // ── Sync state when URL params change ────────────────────────────────────────
  useEffect(() => {
    const newType: MediaType = queryType === 'MANGA' ? 'MANGA' : 'ANIME';
    setAvailableMangaProviders(new Set());
    setAvailableHentaiProviders(new Set());
    setEpRange(0);
    setEpSearch('');

    if (newType === 'MANGA') {
      setEpView('list');
      setProvider(
        queryProvider === 'mangapill' ? 'mangapill'
          : (localStorage.getItem('manga-provider-preference') as MangaProvider) || 'mangahere',
      );
    } else {
      // Will be overridden by the fetch effect once genres are known
      setProvider(
        (localStorage.getItem('provider-preference') as AnimeProvider) || 'anikoto',
      );
    }
  }, [queryType, queryProvider]);

  // Episode UI controls
  const [epView,   setEpView]   = useState<EpView>(() => queryType === 'MANGA' ? 'list' : 'card');
  const [epSearch, setEpSearch] = useState('');
  const [epRange,  setEpRange]  = useState(0);
  const [loadedEpisodeImages, setLoadedEpisodeImages] = useState<Record<string, boolean>>({});

  // Scroll refs for horizontal carousels
  const recsRef    = useRef<HTMLDivElement>(null);
  const relatedRef = useRef<HTMLDivElement>(null);

  const handleEpisodeImageLoad = useCallback((id: string) => {
    setLoadedEpisodeImages((prev) => ({ ...prev, [id]: true }));
  }, []);

  const scrollSection = (ref: React.RefObject<HTMLDivElement>, dir: 'left' | 'right') => {
    ref.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  // ── Primary fetch effect ──────────────────────────────────────────────────
  // IMPORTANT: `currentMediaType` is intentionally derived inside the effect
  // from the `queryType` URL param and not kept in separate state.
  // This avoids a fetch loop while still responding correctly to URL changes.
  useEffect(() => {
    if (!animeId) {
      setError('Anime ID not found');
      setLoading(false);
      return;
    }

    // Read mediaType from the URL param directly to avoid closure issues
    const currentMediaType: MediaType = queryType === 'MANGA' ? 'MANGA' : 'ANIME';

    setLoading(true);
    setError(null);
    setAnimeInfo(null);

    const hasEntries = (data: any): boolean => {
      const episodes = data?.episodes ?? [];
      const chapters = data?.chapters ?? [];
      return (Array.isArray(episodes) && episodes.length > 0) ||
             (Array.isArray(chapters) && chapters.length > 0);
    };

    (async () => {
      if (currentMediaType === 'MANGA') {
        // ── Probe all manga providers in parallel ────────────────────────────
        const candidates: MangaProvider[] = provider === 'mangapill'
          ? ['mangapill', 'mangahere']
          : ['mangahere', 'mangapill'];

        const probeResults = await Promise.allSettled(
          candidates.map(async (candidate) => {
            const data = await fetchMangaInfo(animeId, candidate);
            return { candidate, data, hasData: hasEntries(data) };
          }),
        );

        const viable = new Set<MangaProvider>();
        const dataMap: Partial<Record<MangaProvider, any>> = {};
        let anyData: any = null;

        for (const result of probeResults) {
          if (result.status === 'fulfilled') {
            const { candidate, data, hasData } = result.value;
            if (hasData) {
              viable.add(candidate);
              dataMap[candidate] = data;
            }
            if (!anyData) anyData = data; // keep first result as fallback
          }
        }

        setAvailableMangaProviders(viable);

        // Pick the preferred provider that has chapters, else first viable one
        const chosen = candidates.find(p => viable.has(p)) ?? null;

        if (chosen && dataMap[chosen]) {
          setAnimeInfo(dataMap[chosen]);
          setProvider(chosen);
          localStorage.setItem('manga-provider-preference', chosen);
        } else if (anyData) {
          // No provider had chapters — still show the info page
          setAnimeInfo(anyData);
          setProvider(candidates[0]);
        } else {
          setError('Failed to load manga information.');
        }

      } else {
        // ── Anime fetch ──────────────────────────────────────────────────────
        //
        // First, do a quick genre probe with fetchAnimeData to detect hentai
        // so we can pick the right provider order before hitting fetchAnimeInfo.
        // ─────────────────────────────────────────────────────────────────────
        let probeData: any = null;
        try {
          probeData = await fetchAnimeData(animeId);
        } catch {
          // probe failure is non-fatal
        }

        const detectedHentai = isHentaiGenres(probeData?.genres);

        let candidates: AnimeProvider[];
        if (detectedHentai) {
          // Hentai: prefer hentaimama, allow watchhentai as fallback
          const savedHentai = localStorage.getItem('hentai-provider-preference') as AnimeProvider | null;
          const preferredHentai: AnimeProvider =
            savedHentai === 'watchhentai' ? 'watchhentai' : 'hentaimama';
          candidates = preferredHentai === 'watchhentai'
            ? ['watchhentai', 'hentaimama']
            : ['hentaimama', 'watchhentai'];
        } else if (provider === 'animepahe') {
          candidates = ['animepahe', 'anikoto', 'reanime', 'kickassanime'];
        } else if (provider === 'kickassanime') {
          candidates = ['kickassanime', 'anikoto', 'reanime', 'animepahe'];
        } else if (provider === 'reanime') {
          candidates = ['reanime', 'anikoto', 'kickassanime', 'animepahe'];
        } else {
          candidates = ['anikoto', 'reanime', 'kickassanime', 'animepahe'];
        }

        let loaded = false;
        let bestData: any = probeData ?? null;

        // Pass 1: look for a provider with episodes
        for (const candidate of candidates) {
          try {
            const data = await fetchAnimeInfo(animeId, candidate);
            if (!bestData && data) bestData = data;

            if (hasEntries(data)) {
              const detectedType = resolveMediaType(queryType, data.type, data.format);

              if (detectedType === 'MANGA' && queryType !== 'ANIME') {
                navigate(`/info/${animeId}?type=MANGA`, { replace: true });
                return;
              }

              setAnimeInfo(data);
              setProvider(candidate);
              if (detectedHentai) {
                localStorage.setItem('hentai-provider-preference', candidate);
              } else {
                localStorage.setItem('provider-preference', candidate);
              }
              loaded = true;
              break;
            }
          } catch {
            // continue
          }
        }

        // Pass 2: if no episodes found, try fetchAnimeData as fallback
        if (!loaded) {
          for (const candidate of candidates) {
            try {
              const data = await fetchAnimeData(animeId, candidate);
              if (!bestData && data) bestData = data;

              if (hasEntries(data)) {
                const detectedType = resolveMediaType(queryType, data.type, data.format);

                if (detectedType === 'MANGA' && queryType !== 'ANIME') {
                  navigate(`/info/${animeId}?type=MANGA`, { replace: true });
                  return;
                }

                setAnimeInfo(data);
                setProvider(candidate);
                if (detectedHentai) {
                  localStorage.setItem('hentai-provider-preference', candidate);
                } else {
                  localStorage.setItem('provider-preference', candidate);
                }
                loaded = true;
                break;
              }
            } catch {
              // continue
            }
          }
        }

        // Pass 3: no provider had episodes — show the page anyway with what we have.
        if (!loaded && bestData) {
          const detectedType = resolveMediaType(queryType, bestData.type, bestData.format);

          if (detectedType === 'MANGA' && queryType !== 'ANIME') {
            navigate(`/info/${animeId}?type=MANGA`, { replace: true });
            return;
          }

          setAnimeInfo(bestData);
          setProvider(candidates[0]);
        } else if (!loaded) {
          setError('Failed to load anime information.');
        }

        // Expose which hentai providers are available for the UI switcher
        if (detectedHentai) {
          const available = new Set<AnimeProvider>(candidates as AnimeProvider[]);
          setAvailableHentaiProviders(available);
        }
      }

      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animeId, queryType, queryProvider]);
  // ↑ INTENTIONALLY excludes `mediaType` and `provider` (stateful) to prevent
  //   re-fetch loops. URL params are the single source of truth for type.

  // ── Manual manga provider switch ─────────────────────────────────────────
  const handleMangaProviderSwitch = async (newProvider: MangaProvider) => {
    if (!animeId || newProvider === provider) return;
    setProvider(newProvider);
    localStorage.setItem('manga-provider-preference', newProvider);

    try {
      const data = await fetchMangaInfo(animeId, newProvider);
      setAnimeInfo(data);
      setEpRange(0);
      setEpSearch('');
    } catch (err) {
      console.warn(`⚠️ Provider switch to ${newProvider} failed:`, err);
    }
  };

  // ── Manual hentai provider switch ─────────────────────────────────────────
  const handleHentaiProviderSwitch = async (newProvider: AnimeProvider) => {
    if (!animeId || newProvider === provider) return;
    setProvider(newProvider);
    localStorage.setItem('hentai-provider-preference', newProvider);
    try {
      const data = await fetchAnimeInfo(animeId, newProvider);
      if (data) setAnimeInfo(data as any);
    } catch (err) {
      console.warn(`⚠️ Hentai provider switch to ${newProvider} failed:`, err);
    }
  };

  // Reset episode UI when the anime changes
  useEffect(() => {
    setEpRange(0);
    setEpSearch('');
    setLoadedEpisodeImages({});
  }, [animeId]);

  // Update document title
  useEffect(() => {
    if (animeInfo?.title) {
      const displayName = animeInfo.title.english || animeInfo.title.romaji || '';
      document.title = displayName ? `${displayName} · Zenime` : 'Zenime';
    }
  }, [animeInfo?.title]);

  // ── Derived data ──────────────────────────────────────────────────────────

  const ranges = useMemo(() => {
    const entries = (animeInfo as Manga)?.chapters ?? animeInfo?.episodes ?? [];
    if (!entries.length) return [];
    const chunks: Episode[][] = [];
    for (let i = 0; i < entries.length; i += RANGE) chunks.push(entries.slice(i, i + RANGE));
    return chunks;
  }, [animeInfo?.episodes, (animeInfo as Manga)?.chapters]);

  useEffect(() => {
    if (ranges.length > 0 && epRange >= ranges.length) setEpRange(0);
  }, [ranges, epRange]);

  const currentEps = useMemo(() => {
    const chunk = ranges[epRange] ?? [];
    if (!epSearch.trim()) return chunk;
    const q = epSearch.toLowerCase();
    return chunk.filter(ep =>
      String(ep.number).includes(q) || (ep.title ?? '').toLowerCase().includes(q),
    );
  }, [ranges, epRange, epSearch]);

  const relatedAnime = useMemo(() => {
    if (!animeInfo?.relations?.length) return [];
    return animeInfo.relations.flatMap((rel: any) =>
      rel.nodes ? rel.nodes : [rel],
    ).filter(Boolean);
  }, [animeInfo?.relations]);

  const recommendations = useMemo<Anime[]>(() => {
    const parentColor = animeInfo?.color ?? '#8b5cf6';
    return (animeInfo?.recommendations ?? []).slice(0, 16).map((rec): Anime => ({
      id: rec.id, title: rec.title, malId: rec.malId,
      trailer: { id: '', site: '', thumbnail: '', thumbnailHash: '' },
      synonyms: [], isLicensed: false, isAdult: false, countryOfOrigin: '',
      image: rec.image, imageHash: rec.imageHash, cover: rec.cover, coverHash: rec.coverHash,
      description: '', status: rec.status, type: rec.type, releaseDate: 0,
      totalEpisodes: rec.episodes, currentEpisode: rec.episodes, rating: rec.rating,
      duration: 0, genres: [], studios: [], studioIds: [], subOrDub: 'sub', season: '',
      popularity: 0, color: parentColor,
      startDate: { year: 0, month: 0, day: 0 }, endDate: { year: 0, month: 0, day: 0 },
      recommendations: [], characters: [], relations: [], mappings: [], artwork: [], episodes: [],
    }));
  }, [animeInfo?.recommendations, animeInfo?.color]);

  const recsNeedScroll    = recommendations.length > 5;
  const relatedNeedScroll = relatedAnime.length > 5;

  if (loading) return <SkeletonInfo />;
  if (error || !animeInfo) return (
    <ErrorWrap>
      <h2>Something went wrong</h2>
      <p>{error ?? 'Anime not found.'}</p>
      <PrimaryBtn onClick={() => navigate('/home')}>Back to Home</PrimaryBtn>
    </ErrorWrap>
  );

  // ── Render helpers ────────────────────────────────────────────────────────

  const mediaInfo   = animeInfo as Anime & Partial<Manga>;
  const banner      = mediaInfo.cover || mediaInfo.image;
  const cover       = mediaInfo.image;
  const title       = titleDisplay.title || '';
  const romaji      = titleDisplay.subtitle;

  // Determine final display type — use mediaType state (driven by URL) as
  // the primary signal, but allow AniList `type` field to distinguish between
  // ANIME and MANGA when the URL didn't specify.
  const displayType = resolveMediaType(queryType, mediaInfo.type, (mediaInfo as any).format);

  const isManga = displayType === 'MANGA';
  const label   = isManga ? 'Manga' : 'Anime';

  const chapterEntries = (mediaInfo as Manga)?.chapters ?? mediaInfo.episodes ?? [];
  const firstEntry     = chapterEntries.length > 0 ? chapterEntries[0] : null;
  const firstNumber    = firstEntry?.number ?? 1;
  const usePills       = !isManga && ranges.length <= 10;

  const formatRangeLabel = (chunk: Episode[]) => {
    const startNumber = chunk[0]?.number;
    const endNumber = chunk[chunk.length - 1]?.number;

    if (startNumber != null && endNumber != null) {
      return startNumber === endNumber ? `${startNumber}` : `${startNumber}-${endNumber}`;
    }

    const startLabel = chunk[0]?.title?.slice(0, 12) || '…';
    const endLabel = chunk[chunk.length - 1]?.title?.slice(0, 12) || '…';
    return startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;
  };

  const isFirst = (ep: Episode) => ep.id === selectedEpisodeId;

  const navigateToEntry = (ep: Episode) => {
    if (isManga) {
      saveLastMangaVisited(animeInfo.id, {
        timestamp: Date.now(),
        titleEnglish:
          animeInfo.title?.english || animeInfo.title?.userPreferred || '',
        titleRomaji: animeInfo.title?.romaji || '',
        coverImage: animeInfo.image || undefined,
      });

      addReadChapterIfMissing(animeInfo.id, {
        id: ep.id,
        number: ep.number,
        title: ep.title || '',
        image: ep.image || '',
        description: ep.description || '',
        imageHash: ep.imageHash || '',
        airDate: new Date().toISOString(),
      });

      navigate(`/read/${animeInfo.id}?chapterId=${ep.id}&provider=${provider}`);
    } else {
      navigate(`/watch/${animeInfo.id}?ep=${ep.number}`);
    }
  };

  const navigateToFirst = () => {
    if (!firstEntry) return;
    if (isManga) {
      saveLastMangaVisited(animeInfo.id, {
        timestamp: Date.now(),
        titleEnglish:
          animeInfo.title?.english || animeInfo.title?.userPreferred || '',
        titleRomaji: animeInfo.title?.romaji || '',
        coverImage: animeInfo.image || undefined,
      });

      addReadChapterIfMissing(animeInfo.id, {
        id: firstEntry.id,
        number: firstEntry.number,
        title: firstEntry.title || '',
        image: firstEntry.image || '',
        description: firstEntry.description || '',
        imageHash: firstEntry.imageHash || '',
        airDate: new Date().toISOString(),
      });

      navigate(`/read/${animeInfo.id}?chapterId=${firstEntry.id}&provider=${provider}`);
    } else {
      navigate(`/watch/${animeInfo.id}?ep=${firstNumber}`);
    }
  };

  const metaItems: { key: string; val: string; onClick?: () => void }[] = [
    isManga
      ? mediaInfo.totalChapters != null && { key: 'Chapters', val: String(mediaInfo.totalChapters) }
      : mediaInfo.totalEpisodes != null && { key: 'Episodes', val: String(mediaInfo.totalEpisodes) },
    isManga
      ? mediaInfo.totalVolumes != null && { key: 'Volumes', val: String(mediaInfo.totalVolumes) }
      : mediaInfo.duration && { key: 'Duration', val: `${mediaInfo.duration} min` },
    mediaInfo.season   && { key: 'Season', val: mediaInfo.season.toUpperCase(), onClick: () => navigate(`/search?season=${mediaInfo.season?.toUpperCase()}`) },
    mediaInfo.releaseDate && { key: 'Year', val: String(mediaInfo.releaseDate), onClick: () => navigate(`/search?year=${mediaInfo.releaseDate}`) },
    mediaInfo.status   && { key: 'Status', val: mediaInfo.status },
    mediaInfo.type     && { key: 'Format', val: mediaInfo.type, onClick: () => navigate(`/search?format=${encodeURIComponent(mediaInfo.type!)}`) },
    mediaInfo.title.native && { key: 'Native', val: mediaInfo.title.native },
    mediaInfo.studios?.length > 0 && { key: 'Studio', val: mediaInfo.studios.join(', '), onClick: () => navigate(`/studio/${mediaInfo.studioIds?.[0]}`) },
  ].filter(Boolean) as { key: string; val: string; onClick?: () => void }[];

  const isHentai = !isManga && animeInfo.genres?.some(g => g.toLowerCase() === 'hentai');
  const isNsfw = !isManga && (animeInfo.isAdult || animeInfo.genres?.some(g => g.toLowerCase() === 'ecchi'));
  const shouldBlur = Boolean((isHentai && settings.blurHentai) || (!isHentai && isNsfw && settings.blurNSFW));

  return (
    <PageWrapper>
      {/* ── Hero ── */}
      <HeroWrap>
        <HeroImg src={banner} alt="" />
        <HeroGrade />
        <ScanShimmer />
        <HeroAccentBar />
      </HeroWrap>

      <Shell>
        {/* ── Mobile header ── */}
        <MobileHeader>
          <MobilePosterWrap>
            <MobilePosterImg src={animeInfo.image} alt={title} />
            {(isHentai || isNsfw) && (
              <AdultBadge>{isHentai ? '+18 Hentai' : '+18 NSFW'}</AdultBadge>
            )}
            {animeInfo.rating != null && <MobilePosterScore>{animeInfo.rating}%</MobilePosterScore>}
          </MobilePosterWrap>
          <MobileTitleBlock>
            <MobileEyebrow>{animeInfo.type || label}{animeInfo.releaseDate ? ` · ${animeInfo.releaseDate}` : ''}</MobileEyebrow>
            <MobileTitle>{title}</MobileTitle>
            {romaji && romaji !== title && <MobileRomaji>{romaji}</MobileRomaji>}
            <MobilePillRow>
              {animeInfo.status && <Pill $accent>{animeInfo.status}</Pill>}
              {animeInfo.genres?.slice(0, 3).map((g, i) => (
                <ClickablePill key={i} onClick={() => navigate(`/search?genres=${encodeURIComponent(g)}`)}>{g}</ClickablePill>
              ))}
            </MobilePillRow>
          </MobileTitleBlock>
        </MobileHeader>

        <Grid>
          {/* ── Left — desktop poster + sidebar ── */}
          <LeftCol>
            <PosterWrap>
              <PosterImg src={animeInfo.image} alt={title} />
              {(isHentai || isNsfw) && (
                <AdultBadge>{isHentai ? '+18 Hentai' : '+18 NSFW'}</AdultBadge>
              )}
              {animeInfo.rating != null && <ScoreBadge>{animeInfo.rating}%</ScoreBadge>}
            </PosterWrap>

            <PosterActions>
              <WatchBtn onClick={navigateToFirst} disabled={!firstEntry}>
                {isManga ? <FaBookOpen size={11} /> : <FaPlay size={11} />}
                {isManga ? `Read CH ${firstNumber}` : 'Watch'}
              </WatchBtn>

              <ExtRow>
                <ExtBtn href={`https://anilist.co/${isManga ? 'manga' : 'anime'}/${animeInfo.id}`} target="_blank" rel="noopener noreferrer" title="AniList">
                  <SiAnilist size={16} />
                </ExtBtn>
                {animeInfo.malId && (
                  <ExtBtn href={`https://myanimelist.net/${isManga ? 'manga' : 'anime'}/${animeInfo.malId}`} target="_blank" rel="noopener noreferrer" title="MyAnimeList">
                    <SiMyanimelist size={20} />
                  </ExtBtn>
                )}
                {isManga && (
                  <MangaBookmarkButton mangaId={animeInfo.id} />
                )}
              </ExtRow>

              <ListActions mediaId={Number(animeInfo.id)} type={isManga ? 'MANGA' : 'ANIME'} />

              <SidebarMeta>
                {isManga ? (
                  <>
                    {mediaInfo.totalChapters != null && <SideMetaRow><SideMetaKey>Chapters</SideMetaKey><SideMetaVal>{mediaInfo.totalChapters}</SideMetaVal></SideMetaRow>}
                    {mediaInfo.totalVolumes  != null && <SideMetaRow><SideMetaKey>Volumes</SideMetaKey><SideMetaVal>{mediaInfo.totalVolumes}</SideMetaVal></SideMetaRow>}
                  </>
                ) : (
                  <>
                    {mediaInfo.totalEpisodes != null && <SideMetaRow><SideMetaKey>Episodes</SideMetaKey><SideMetaVal>{mediaInfo.totalEpisodes}</SideMetaVal></SideMetaRow>}
                    {mediaInfo.duration      && <SideMetaRow><SideMetaKey>Duration</SideMetaKey><SideMetaVal>{mediaInfo.duration} min</SideMetaVal></SideMetaRow>}
                  </>
                )}
                {mediaInfo.season      && <SideMetaRow><SideMetaKey>Season</SideMetaKey><SideMetaVal><ClickableMetaVal onClick={() => navigate(`/search?season=${mediaInfo.season?.toUpperCase()}`)}>{mediaInfo.season.toUpperCase()}</ClickableMetaVal></SideMetaVal></SideMetaRow>}
                {mediaInfo.releaseDate && <SideMetaRow><SideMetaKey>Year</SideMetaKey><SideMetaVal><ClickableMetaVal onClick={() => navigate(`/search?year=${mediaInfo.releaseDate}`)}>{mediaInfo.releaseDate}</ClickableMetaVal></SideMetaVal></SideMetaRow>}
                {mediaInfo.status      && <SideMetaRow><SideMetaKey>Status</SideMetaKey><SideMetaVal>{mediaInfo.status}</SideMetaVal></SideMetaRow>}
                {mediaInfo.type        && <SideMetaRow><SideMetaKey>Format</SideMetaKey><SideMetaVal><ClickableMetaVal onClick={() => navigate(`/search?format=${encodeURIComponent(mediaInfo.type!)}`)}>{mediaInfo.type}</ClickableMetaVal></SideMetaVal></SideMetaRow>}
                {mediaInfo.title.native && <SideMetaRow><SideMetaKey>Native</SideMetaKey><SideMetaVal>{mediaInfo.title.native}</SideMetaVal></SideMetaRow>}
                {mediaInfo.studios?.length > 0 && <SideMetaRow><SideMetaKey>Studio</SideMetaKey><SideMetaVal><ClickableMetaVal onClick={() => navigate(`/studio/${mediaInfo.studioIds?.[0]}`)}>{mediaInfo.studios.join(', ')}</ClickableMetaVal></SideMetaVal></SideMetaRow>}
              </SidebarMeta>
            </PosterActions>
          </LeftCol>

          {/* ── Right ── */}
          <RightCol>
            {/* Mobile: action bar */}
            <MobileActionBar>
              <MobileWatchBtn onClick={navigateToFirst} disabled={!firstEntry}>
                {isManga ? <FaBookOpen size={10} /> : <FaPlay size={10} />}
                {isManga ? `Read CH ${firstNumber}` : 'Watch'}
              </MobileWatchBtn>
              <MobileExtBtn href={`https://anilist.co/${isManga ? 'manga' : 'anime'}/${animeInfo.id}`} target="_blank" rel="noopener noreferrer" title="AniList">
                <SiAnilist size={15} />
              </MobileExtBtn>
              {animeInfo.malId && (
                <MobileExtBtn href={`https://myanimelist.net/${isManga ? 'manga' : 'anime'}/${animeInfo.malId}`} target="_blank" rel="noopener noreferrer" title="MyAnimeList">
                  <SiMyanimelist size={18} />
                </MobileExtBtn>
              )}
              {isManga && (
                <MangaBookmarkButton mangaId={animeInfo.id} showLabel={false} />
              )}
              <MobileListActions>
                <ListActions mediaId={Number(animeInfo.id)} type={isManga ? 'MANGA' : 'ANIME'} />
              </MobileListActions>
            </MobileActionBar>

            {/* Mobile: meta grid */}
            {metaItems.length > 0 && (
              <MobileMeta>
                {metaItems.map(({ key, val, onClick }) => (
                  <MobileMetaCell key={key}>
                    <MobileMetaKey>{key}</MobileMetaKey>
                    <MobileMetaVal>{onClick ? <ClickableMetaVal onClick={onClick}>{val}</ClickableMetaVal> : val}</MobileMetaVal>
                  </MobileMetaCell>
                ))}
              </MobileMeta>
            )}

            {/* Desktop: title */}
            <DesktopTitleBlock>
              <EyeBrow>{animeInfo.type || label}{animeInfo.releaseDate ? ` · ${animeInfo.releaseDate}` : ''}</EyeBrow>
              <MainTitle>{title}</MainTitle>
              {romaji && romaji !== title && <RomajiSub>{romaji}</RomajiSub>}
              <PillRow>
                {animeInfo.status && <Pill $accent>{animeInfo.status}</Pill>}
                {animeInfo.rating != null && <Pill>{animeInfo.rating}% Score</Pill>}
                {animeInfo.genres?.slice(0, 5).map((g, i) => (
                  <ClickablePill key={i} onClick={() => navigate(`/search?genres=${encodeURIComponent(g)}`)}>{g}</ClickablePill>
                ))}
              </PillRow>
            </DesktopTitleBlock>

            {/* Tabs */}
            <TabNav>
              {(['overview', 'characters', 'episodes'] as InfoTab[]).map(t => (
                <Tab key={t} $active={activeTab === t} onClick={() => setActiveTab(t)}>
                  {t === 'episodes' ? (isManga ? 'chapters' : 'episodes') : t}
                </Tab>
              ))}
            </TabNav>

            {/* Overview */}
            {activeTab === 'overview' && (
              <Panel>
                {animeInfo.trailer?.id && (
                  <TrailerBox>
                    <iframe
                      src={`https://www.youtube.com/embed/${animeInfo.trailer.id}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen title="Trailer"
                    />
                  </TrailerBox>
                )}
                {animeInfo.description && (
                  <Desc style={{ marginTop: animeInfo.trailer?.id ? '1.25rem' : 0 }}>
                    {animeInfo.description.replace(/<[^>]*>/g, '')}
                  </Desc>
                )}
                {!animeInfo.description && !animeInfo.trailer?.id && <Desc>No overview available.</Desc>}
              </Panel>
            )}

            {/* Characters */}
            {activeTab === 'characters' && (
              <Panel>
                {animeInfo.characters?.length > 0 ? (
                  <CharGrid>
                    {animeInfo.characters.slice(0, 24).map(c => (
                      <CharacterCardComponent key={c.id} character={c} />
                    ))}
                  </CharGrid>
                ) : <Desc>No character data available.</Desc>}
              </Panel>
            )}

            {/* Episodes / Chapters */}
            {activeTab === 'episodes' && (
              <Panel>
                {chapterEntries.length > 0 ? (
                  <>
                    {/* Range selector */}
                    {ranges.length > 1 ? (
                      <RangeRow>
                        {usePills ? (
                          <RangePillRow>
                            {ranges.map((chunk, i) => (
                              <RangePill key={i} $active={epRange === i} onClick={() => { setEpRange(i); setEpSearch(''); }}>
                                {formatRangeLabel(chunk)}
                              </RangePill>
                            ))}
                          </RangePillRow>
                        ) : (
                          <RangePillRow>
                            <RangeSelectWrapper>
                              {isManga ? <FaBookOpen size={13} /> : <FaPlay size={13} />}
                              <RangeSelect value={epRange} onChange={e => { setEpRange(Number(e.target.value)); setEpSearch(''); }}>
                                {ranges.map((chunk, i) => (
                                  <option key={i} value={i}>{formatRangeLabel(chunk)}</option>
                                ))}
                              </RangeSelect>
                            </RangeSelectWrapper>
                          </RangePillRow>
                        )}

                        {!isManga ? (
                          <AnimeRangeAction>
                            <SearchBox>
                              <FaSearch size={11} />
                              <SearchInput
                                placeholder='Filter episodes...'
                                value={epSearch}
                                onChange={e => setEpSearch(e.target.value)}
                              />
                            </SearchBox>

                            <SegmentedControl>
                              <SegmentOption $active={epView === 'card'} onClick={() => setEpView('card')} title="Card view"><BsEye size={15} /></SegmentOption>
                              <SegmentOption $active={epView === 'list'} onClick={() => setEpView('list')} title="List view"><MdViewList size={16} /></SegmentOption>
                              <SegmentOption $active={epView === 'number'} onClick={() => setEpView('number')} title="Number view"><MdGridOn size={15} /></SegmentOption>
                            </SegmentedControl>
                          </AnimeRangeAction>
                        ) : (
                          <RangeAction>
                            <SearchBox>
                              <FaSearch size={11} />
                              <SearchInput
                                placeholder='Filter chapters...'
                                value={epSearch}
                                onChange={e => setEpSearch(e.target.value)}
                              />
                            </SearchBox>

                            {availableMangaProviders.size > 1 && (
                              <ProviderSwitcher>
                                {(['mangahere', 'mangapill'] as MangaProvider[])
                                  .filter(p => availableMangaProviders.has(p))
                                  .map(p => (
                                    <ProviderButton key={p} $active={provider === p} onClick={() => handleMangaProviderSwitch(p)}>
                                      {p === 'mangahere' ? 'MangaHere' : 'MangaPill'}
                                    </ProviderButton>
                                  ))}
                              </ProviderSwitcher>
                            )}
                          </RangeAction>
                        )}
                      </RangeRow>
                    ) : (
                      <EpControls>
                        <SearchBox>
                          <FaSearch size={11} />
                          <SearchInput
                            placeholder={isManga ? 'Filter chapters...' : 'Filter episodes...'}
                            value={epSearch}
                            onChange={e => setEpSearch(e.target.value)}
                          />
                        </SearchBox>

                        {/* Anime view toggle */}
                        {!isManga && (
                          <SegmentedControl>
                            <SegmentOption $active={epView === 'card'} onClick={() => setEpView('card')} title="Card view"><BsEye size={15} /></SegmentOption>
                            <SegmentOption $active={epView === 'list'} onClick={() => setEpView('list')} title="List view"><MdViewList size={16} /></SegmentOption>
                            <SegmentOption $active={epView === 'number'} onClick={() => setEpView('number')} title="Number view"><MdGridOn size={15} /></SegmentOption>
                          </SegmentedControl>
                        )}

                        {/* Hentai provider switcher — only shown for hentai content */}
                        {!isManga && availableHentaiProviders.size > 1 && (
                          <ProviderSwitcher>
                            {(['hentaimama', 'watchhentai'] as AnimeProvider[])
                              .filter(p => availableHentaiProviders.has(p))
                              .map(p => (
                                <ProviderButton key={p} $active={provider === p} onClick={() => handleHentaiProviderSwitch(p)}>
                                  {p === 'hentaimama' ? 'HentaiMama' : 'WatchHentai'}
                                </ProviderButton>
                              ))}
                          </ProviderSwitcher>
                        )}

                        {isManga && availableMangaProviders.size > 1 && (
                          <ProviderSwitcher>
                            {(['mangahere', 'mangapill'] as MangaProvider[])
                              .filter(p => availableMangaProviders.has(p))
                              .map(p => (
                                <ProviderButton key={p} $active={provider === p} onClick={() => handleMangaProviderSwitch(p)}>
                                  {p === 'mangahere' ? 'MangaHere' : 'MangaPill'}
                                </ProviderButton>
                              ))}
                          </ProviderSwitcher>
                        )}
                      </EpControls>
                    )}

                    {currentEps.length === 0 && (
                      <Desc>No {isManga ? 'chapters' : 'episodes'} match your search.</Desc>
                    )}

                    {currentEps.length > 0 && (
                      <EpScrollArea>
                        {/* Card view */}
                        {epView === 'card' && !isManga && (
                          <CardGrid>
                            {currentEps.map(ep => (
                              <EpisodeCardItem key={ep.id} onClick={() => navigateToEntry(ep)}>
                                <CardThumbWrap>
                                  {!loadedEpisodeImages[ep.id] && <CardThumbSkeleton />}
                                  <CardThumb
                                    src={ep.image || cover}
                                    alt={ep.title || ''}
                                    $loaded={!!loadedEpisodeImages[ep.id]}
                                    $blurred={shouldBlur}
                                    onLoad={() => handleEpisodeImageLoad(ep.id)}
                                    onError={() => handleEpisodeImageLoad(ep.id)}
                                  />
                                  <CardEpBadge>EP {ep.number}</CardEpBadge>
                                </CardThumbWrap>
                                <CardBody>
                                  <div>
                                    <CardTitle>{ep.title || `Episode ${ep.number}`}</CardTitle>
                                    {ep.description ? (
                                      <CardDescription>{ep.description}</CardDescription>
                                    ) : null}
                                  </div>
                                  <CardMeta>
                                    {ep.airDate && <CardDate>{ep.airDate}</CardDate>}
                                    <CardIcons>
                                      <SmIcon><FaClosedCaptioning size={10} /></SmIcon>
                                      <SmIcon><FaMicrophone size={10} /></SmIcon>
                                    </CardIcons>
                                  </CardMeta>
                                </CardBody>
                              </EpisodeCardItem>
                            ))}
                          </CardGrid>
                        )}

                        {/* List view (default for manga) */}
                        {(epView === 'list' || isManga) && !(epView === 'card' && !isManga) && !(epView === 'number' && !isManga) && (
                          <ListGrid>
                            {currentEps.map((ep, idx) => (
                              <ListItem key={ep.id} $first={isFirst(ep)} onClick={() => navigateToEntry(ep)}>
                                {isFirst(ep)
                                  ? <ListPlayIcon><FaPlay size={10} /></ListPlayIcon>
                                  : <ListEpNum>{isManga ? 'CH' : 'EP'} {ep.number ?? idx + 1}</ListEpNum>
                                }
                                <ListTitle title={ep.title || `${isManga ? 'Chapter' : 'Episode'} ${ep.number ?? idx + 1}`}>
                                  {ep.title || `${isManga ? 'Chapter' : 'Episode'} ${ep.number ?? idx + 1}`}
                                </ListTitle>
                                {!isManga && (
                                  <ListIcons>
                                    <SmIcon><FaClosedCaptioning size={10} /></SmIcon>
                                    <SmIcon><FaMicrophone size={10} /></SmIcon>
                                  </ListIcons>
                                )}
                              </ListItem>
                            ))}
                          </ListGrid>
                        )}

                        {/* Number view */}
                        {epView === 'number' && !isManga && (
                          <NumGrid>
                            {currentEps.map(ep => (
                              <NumCell
                                key={ep.id} $first={isFirst(ep)}
                                onClick={() => navigateToEntry(ep)}
                                title={ep.title || `Episode ${ep.number}`}
                              >
                                {isFirst(ep) ? <FaPlay size={10} /> : ep.number}
                              </NumCell>
                            ))}
                          </NumGrid>
                        )}
                      </EpScrollArea>
                    )}
                  </>
                ) : (
                  <Desc>No {isManga ? 'chapters' : 'episodes'} available yet.</Desc>
                )}
              </Panel>
            )}
          </RightCol>
        </Grid>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <FullWidthSection>
            <SectionHeader>
              <SectionLabel>You might also like</SectionLabel>
              {recsNeedScroll && (
                <ScrollBtnRow>
                  <ScrollBtn onClick={() => scrollSection(recsRef, 'left')} aria-label="Scroll left"><FaChevronLeft size={12} /></ScrollBtn>
                  <ScrollBtn onClick={() => scrollSection(recsRef, 'right')} aria-label="Scroll right"><FaChevronRight size={12} /></ScrollBtn>
                </ScrollBtnRow>
              )}
            </SectionHeader>
            <StyledCardGrid ref={recsRef}>
              {recommendations.map(r => <AnimeCardItem key={r.id} anime={r as unknown as Anime} />)}
            </StyledCardGrid>
          </FullWidthSection>
        )}

        {/* Related */}
        {relatedAnime.length > 0 && (
          <FullWidthSection>
            <SectionHeader>
              <SectionLabel>Related</SectionLabel>
              {relatedNeedScroll && (
                <ScrollBtnRow>
                  <ScrollBtn onClick={() => scrollSection(relatedRef, 'left')} aria-label="Scroll left"><FaChevronLeft size={12} /></ScrollBtn>
                  <ScrollBtn onClick={() => scrollSection(relatedRef, 'right')} aria-label="Scroll right"><FaChevronRight size={12} /></ScrollBtn>
                </ScrollBtnRow>
              )}
            </SectionHeader>
            <StyledCardGrid ref={relatedRef}>
              {relatedAnime.slice(0, 16).map((r: any) => <AnimeCardItem key={r.id} anime={r as unknown as Anime} />)}
            </StyledCardGrid>
          </FullWidthSection>
        )}
      </Shell>
    </PageWrapper>
  );
};

export default Info;