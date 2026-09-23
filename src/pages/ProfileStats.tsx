import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import styled, { css, keyframes, createGlobalStyle } from 'styled-components';
import { CardItem, useAuth, type Anime } from '../index';
import { SiAnilist } from 'react-icons/si';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const chartPalette = ['#5eead4', '#7dd3fc', '#c084fc', '#f9a8d4', '#fbbf24', '#fca5a5', '#60a5fa', '#a3e635'];

/** Compact ranked list used for genres, tags, and studios. */
type MediaKind = 'anime' | 'manga';
type Metric = 'count' | 'time' | 'mean';
type NumericStat = { label: string; value: number };

type PastWork = {
  id: string;
  title: string;
  image?: string | null;
  type?: string | null;
};

type StatRow = {
  key: string;
  label: string;
  count: number;
  mean: number;
  /** Minutes watched (anime) or chapters read (manga). 0 when the API data doesn't include it. */
  time: number;
  /** `undefined` = this list has no avatars, `null` = avatar expected but missing. */
  image?: string | null;
  badge?: string | null;
  tone?: 'teal' | 'blue';
  works?: PastWork[];
};

type BarDatum = { label: string; value: number; display: string; detail: string };

type StatBase = {
  count?: number | null;
  meanScore?: number | null;
  minutesWatched?: number | null;
  chaptersRead?: number | null;
};

type PersonLike = {
  id?: number;
  name?: { full?: string | null } | null;
  image?: { large?: string | null; medium?: string | null } | null;
  media?: {
    nodes?: Array<{
      id?: number | null;
      type?: string | null;
      title?: AniListTitleLike | null;
      coverImage?: { large?: string | null; medium?: string | null } | null;
    }> | null;
  } | null;
};

/**
 * Loose shape of AniList's `User.statistics.anime | manga`. Declared locally so this
 * page doesn't depend on the (older) shared user types knowing about per-group
 * `minutesWatched` / `chaptersRead`.
 */
type RawStatistics = {
  count?: number | null;
  meanScore?: number | null;
  standardDeviation?: number | null;
  minutesWatched?: number | null;
  episodesWatched?: number | null;
  chaptersRead?: number | null;
  volumesRead?: number | null;
  formats?: Array<StatBase & { format: string }> | null;
  statuses?: Array<StatBase & { status: string }> | null;
  scores?: Array<StatBase & { score: number }> | null;
  lengths?: Array<StatBase & { length?: string | null }> | null;
  releaseYears?: Array<StatBase & { releaseYear?: number | null }> | null;
  startYears?: Array<StatBase & { startYear?: number | null }> | null;
  genres?: Array<StatBase & { genre: string }> | null;
  tags?: Array<StatBase & { tag?: { id?: number; name?: string | null } | null }> | null;
  countries?: Array<StatBase & { country: string }> | null;
  staff?: Array<StatBase & { staff?: PersonLike | null }> | null;
  studios?: Array<StatBase & { studio?: { id?: number; name?: string | null } | null }> | null;
  voiceActors?: Array<StatBase & { voiceActor?: (PersonLike & { languageV2?: string | null }) | null }> | null;
};

type AniListTitleLike = {
  romaji?: string | null;
  english?: string | null;
  native?: string | null;
  userPreferred?: string | null;
};

/* ────────────────────────────────────────────────────────────────────────────
 * Layout
 * ──────────────────────────────────────────────────────────────────────────── */

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

const spinBorder = keyframes`
  to { --border-angle: 360deg; }
`;

const BorderAngleProperty = createGlobalStyle`
  @property --border-angle {
    syntax: '<angle>';
    inherits: false;
    initial-value: 0deg;
  }
`;

const Page = styled.div`
  width: 100%;
  max-width: 125rem;
  margin: 0 auto;
  box-sizing: border-box;
  overflow-x: hidden;
  padding: 0.25rem 0.25rem 2.5rem;

  @media (min-width: 768px) {
    padding: 0.5rem 0.5rem 2.5rem;
  }
`;

const SectionStack = styled.div`
  display: grid;
  gap: 1rem;
`;

const TwoCol = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;

  & > :last-child:nth-child(odd) {
    grid-column: 1 / -1;
  }

  @media (max-width: 720px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const DashboardLayout = styled.div`
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 1rem;
  align-items: start;

  @media (max-width: 920px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Main = styled.div`
  min-width: 0;
  display: grid;
  gap: 1rem;
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Profile header
 * ──────────────────────────────────────────────────────────────────────────── */

const Hero = styled.header`
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 10;
  min-height: 190px;
  max-height: clamp(190px, 50vw, 260px);
  border-radius: calc(var(--global-border-radius) * 1.4);
  overflow: hidden;
  isolation: isolate;
  margin-bottom: 0.85rem;
  border: 1px solid var(--global-border);
  background: var(--global-secondary-bg);
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

const HeroBanner = styled.div<{ $src?: string | null }>`
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: var(--global-secondary-bg);
  background-image: ${({ $src }) =>
    $src
      ? `url("${$src}")`
      : 'radial-gradient(ellipse 65% 75% at 15% 20%, rgba(124,58,237,0.35) 0%, transparent 60%), radial-gradient(ellipse 55% 65% at 85% 15%, rgba(219,39,119,0.24) 0%, transparent 60%), radial-gradient(ellipse 60% 70% at 50% 100%, rgba(8,145,178,0.18) 0%, transparent 65%), var(--global-secondary-bg)'};
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  animation: ${bannerReveal} 0.7s cubic-bezier(0.16, 1, 0.3, 1) both;
`;

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

const HeroFloorLine = styled.div`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  height: 1px;
  background: linear-gradient(to right, transparent, rgba(255,255,255,0.18), transparent);
`;

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

  @media (min-width: 560px) {
    padding: 1.25rem 1.5rem 1.4rem;
    gap: 1.1rem;
  }

  @media (min-width: 900px) {
    padding: 1.6rem 1.9rem 1.7rem;
    gap: 1.35rem;
  }
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

    &::before {
      inset: -4px;
      filter: blur(10px);
      opacity: 0.5;
    }
  }

  @media (min-width: 900px) {
    width: 96px;
    height: 96px;
    border-radius: 20px;

    &::before {
      inset: -5px;
      filter: blur(12px);
      opacity: 0.52;
    }
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

  @media (min-width: 560px) {
    border-radius: 15.5px;
  }

  @media (min-width: 900px) {
    border-radius: 17.5px;
  }
`;

const IdentityBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.22rem;
  min-width: 0;
  flex: 1;
  animation: ${riseIn} 0.45s ease 0.16s both;

  @media (min-width: 560px) {
    gap: 0.3rem;
  }
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

  @media (min-width: 560px) {
    font-size: 1.7rem;
  }

  @media (min-width: 900px) {
    font-size: 2rem;
  }
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Navigation: desktop sidebar + custom mobile bar
 * ──────────────────────────────────────────────────────────────────────────── */

const Sidebar = styled.aside`
  position: sticky;
  top: 1rem;
  padding: 0.85rem;
  border-radius: var(--global-border-radius);
  background: var(--global-secondary-bg);
  border: 1px solid var(--global-border);

  @media (max-width: 920px) {
    display: none;
  }
`;

const SidebarLabel = styled.div`
  margin-bottom: 0.6rem;
  font-size: 0.74rem;
  font-weight: 700;
  color: var(--global-text-muted);
`;

const SidebarGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const SidebarButton = styled.button<{ $active: boolean }>`
  width: 100%;
  text-align: left;
  border: 1px solid ${({ $active }) => ($active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)')};
  background: ${({ $active }) => ($active ? 'rgba(255,255,255,0.08)' : 'transparent')};
  color: ${({ $active }) => ($active ? 'var(--global-text)' : 'var(--global-text-muted)')};
  padding: 0.65rem 0.8rem;
  border-radius: 12px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    color: var(--global-text);
    border-color: rgba(255,255,255,0.16);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const MediaTabs = styled.div<{ $columns: number }>`
  display: grid;
  grid-template-columns: repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
  gap: 0.4rem;
`;

const MediaTab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  border: 1px solid ${({ $active }) => ($active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)')};
  background: ${({ $active }) => ($active ? 'rgba(255,255,255,0.08)' : 'transparent')};
  color: ${({ $active }) => ($active ? 'var(--global-text)' : 'var(--global-text-muted)')};
  padding: 0.65rem 0.8rem;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.18s ease;

  &:hover {
    color: var(--global-text);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const MediaCount = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  color: var(--global-text-muted);
`;

const MobileBar = styled.nav`
  display: none;
  gap: 0.6rem;
  margin-bottom: 0.9rem;

  @media (max-width: 920px) {
    display: grid;
  }
`;

const ChipScroller = styled.div`
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding: 0.1rem 0 0.25rem;
  margin: 0 -0.65rem;
  padding-left: 0.65rem;
  padding-right: 0.65rem;
  scroll-snap-type: x proximity;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  -webkit-mask-image: linear-gradient(90deg, transparent 0, #000 0.65rem, #000 calc(100% - 1.4rem), transparent 100%);
  mask-image: linear-gradient(90deg, transparent 0, #000 0.65rem, #000 calc(100% - 1.4rem), transparent 100%);

  &::-webkit-scrollbar {
    display: none;
  }
`;

const Chip = styled.button<{ $active: boolean }>`
  flex: 0 0 auto;
  scroll-snap-align: center;
  padding: 0.5rem 0.9rem;
  border-radius: 999px;
  border: 1px solid ${({ $active }) => ($active ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)')};
  background: ${({ $active }) => ($active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.03)')};
  color: ${({ $active }) => ($active ? 'var(--global-text)' : 'var(--global-text-muted)')};
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 2px;
  }
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Summary strip (AniList-style totals row)
 * ──────────────────────────────────────────────────────────────────────────── */

const SummaryStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1px;
  overflow: hidden;
  border-radius: var(--global-border-radius);
  background: var(--global-border);
  border: 1px solid var(--global-border);

  @media (max-width: 920px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));

    & > :last-child {
      grid-column: span 2;
    }
  }

  @media (max-width: 600px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    & > :last-child {
      grid-column: 1 / -1;
    }
  }
`;

const SummaryCell = styled.div`
  padding: 0.95rem 1rem 1rem;
  background: var(--global-secondary-bg);
  min-width: 0;

  @media (max-width: 600px) {
    padding: 0.8rem 0.85rem 0.85rem;
  }
`;

const CellValue = styled.div`
  font-size: clamp(1.05rem, 1.6vw, 1.35rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1.15;
`;

const CellLabel = styled.div`
  margin-top: 0.2rem;
  color: var(--global-text-muted);
  font-size: 0.68rem;
  font-weight: 600;
`;

const CellNote = styled.div`
  margin-top: 0.15rem;
  color: var(--global-text-muted);
  font-size: 0.62rem;
  opacity: 0.85;
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Panels + controls
 * ──────────────────────────────────────────────────────────────────────────── */

const Panel = styled.section`
  padding: 1rem;
  border-radius: var(--global-border-radius);
  background: var(--global-secondary-bg);
  border: 1px solid var(--global-border);
  min-width: 0;

  @media (max-width: 600px) {
    padding: 0.85rem;
  }
`;

const PanelHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 0.75rem;
  margin-bottom: 0.9rem;
`;

const PanelTitle = styled.h2`
  margin: 0;
  font-size: 1rem;
  letter-spacing: -0.02em;
`;

const PanelMeta = styled.span`
  color: var(--global-text-muted);
  font-size: 0.72rem;
`;

const Segmented = styled.div`
  display: inline-flex;
  gap: 2px;
  max-width: 100%;
  padding: 3px;
  overflow-x: auto;
  border-radius: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.06);
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
`;

const SegmentButton = styled.button<{ $active: boolean }>`
  border: 0;
  cursor: pointer;
  white-space: nowrap;
  padding: 0.4rem 0.75rem;
  border-radius: 9px;
  font-size: 0.74rem;
  font-weight: 700;
  background: ${({ $active }) => ($active ? 'rgba(255,255,255,0.1)' : 'transparent')};
  color: ${({ $active }) => ($active ? 'var(--global-text)' : 'var(--global-text-muted)')};

  &:hover {
    color: var(--global-text);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 1px;
  }
`;

const LinkButton = styled.button`
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  color: var(--global-text-muted);
  font-size: 0.74rem;
  font-weight: 700;

  &:hover {
    color: var(--global-text);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 2px;
    border-radius: 4px;
  }
`;

const ExpandButton = styled.button`
  width: 100%;
  margin-top: 0.7rem;
  padding: 0.6rem;
  border-radius: 12px;
  border: 1px dashed rgba(255,255,255,0.12);
  background: transparent;
  color: var(--global-text-muted);
  font-size: 0.76rem;
  font-weight: 700;
  cursor: pointer;

  &:hover {
    color: var(--global-text);
    border-color: rgba(255,255,255,0.2);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 2px;
  }
`;

const EmptyState = styled.div`
  padding: 1rem;
  border-radius: var(--global-border-radius);
  border: 1px dashed var(--global-border);
  color: var(--global-text-muted);
  text-align: center;
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Bar chart
 * ──────────────────────────────────────────────────────────────────────────── */

const Readout = styled.div`
  min-height: 1.3rem;
  margin-bottom: 0.4rem;
  font-size: 0.76rem;
  color: var(--global-text-muted);
`;

const ScrollX = styled.div`
  overflow-x: auto;
  padding-bottom: 0.2rem;
  scrollbar-width: thin;
`;

const BarsInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
`;

const BarsPlot = styled.div`
  display: flex;
  align-items: stretch;
  gap: 4px;
  height: 180px;
  border-bottom: 1px solid rgba(255,255,255,0.08);

  @media (max-width: 600px) {
    height: 150px;
  }
`;

const BarCol = styled.button`
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  gap: 3px;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  cursor: pointer;

  &:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 1px;
    border-radius: 4px;
  }
`;

const BarValue = styled.span`
  height: 15px;
  font-size: 0.62rem;
  line-height: 15px;
  color: var(--global-text-muted);
  white-space: nowrap;
`;

const BarFill = styled.span<{ $color: string; $active: boolean; $dim: boolean }>`
  display: block;
  width: 100%;
  max-width: 36px;
  border-radius: 6px 6px 2px 2px;
  background: linear-gradient(180deg, ${({ $color }) => $color}, ${({ $color }) => $color}59);
  opacity: ${({ $active, $dim }) => ($active ? 1 : $dim ? 0.55 : 0.9)};
  transition: opacity 0.15s ease;

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`;

const BarsAxis = styled.div`
  display: flex;
  gap: 4px;
`;

const AxisLabel = styled.span<{ $active: boolean }>`
  flex: 1 1 0;
  min-width: 0;
  text-align: center;
  font-size: 0.62rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
  color: ${({ $active }) => ($active ? 'var(--global-text)' : 'var(--global-text-muted)')};
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Donut + legend
 * ──────────────────────────────────────────────────────────────────────────── */

const DonutWrap = styled.div`
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 0.9rem;
  align-items: center;

  @media (max-width: 520px) {
    grid-template-columns: minmax(0, 1fr);
    justify-items: center;
    gap: 0.7rem;

    & > div {
      width: 100%;
    }
  }
`;

const ChartLegend = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  font-size: 0.75rem;
`;

const LegendLabel = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
  color: var(--global-text-muted);
`;

const LegendValue = styled.div`
  display: inline-flex;
  align-items: baseline;
  gap: 0.45rem;
  flex: none;

  span {
    color: var(--global-text-muted);
    font-size: 0.68rem;
    min-width: 2.2rem;
    text-align: right;
  }
`;

const Dot = styled.span<{ $color: string }>`
  display: inline-block;
  flex: none;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 9999px;
  background: ${({ $color }) => $color};
  box-shadow: 0 0 0 2px rgba(255,255,255,0.04);
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Ranked lists (genres / tags / voice actors / studios / staff)
 * ──────────────────────────────────────────────────────────────────────────── */

const RankList = styled.div`
  display: grid;
  gap: 0.5rem;
`;

const StatCardGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0;
  width: 100%;
  min-width: 0;
`;

/** Row background doubles as a proportional bar driven by the `--w` custom property. */
const rankSurface = css`
  position: relative;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.06);
  background: linear-gradient(
    90deg,
    rgba(94,234,212,0.13) 0,
    rgba(94,234,212,0.13) var(--w, 0%),
    rgba(255,255,255,0.02) var(--w, 0%)
  );
`;

const RowRank = styled.span`
  color: var(--global-text-muted);
  font-size: 0.78rem;
`;

const RowName = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  min-width: 0;
  color: var(--global-text);
  font-size: 0.82rem;
  font-weight: 600;

  .text {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const RowImage = styled.img<{ $size: number }>`
  flex: none;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 8px 18px rgba(0,0,0,0.18);
`;

const RowImageFallback = styled.div<{ $tone: 'teal' | 'blue'; $size: number }>`
  flex: none;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 10px;
  background: ${({ $tone }) =>
    $tone === 'blue'
      ? 'linear-gradient(135deg, rgba(59,130,246,0.28), rgba(168,85,247,0.28))'
      : 'linear-gradient(135deg, rgba(94,234,212,0.28), rgba(168,85,247,0.28))'};
`;

const LangChip = styled.span`
  flex: none;
  font-size: 0.68rem;
  font-weight: 500;
  color: var(--global-text-muted);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 999px;
  padding: 0.1rem 0.5rem;
`;

const CompactRow = styled.div`
  ${rankSurface}
  display: grid;
  grid-template-columns: 1.4rem minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.7rem;
`;

const CompactMeta = styled.div`
  display: inline-flex;
  align-items: baseline;
  gap: 0.6rem;
  font-size: 0.75rem;

  b {
    color: var(--global-text);
    font-weight: 800;
  }

  span {
    min-width: 2rem;
    text-align: right;
    color: var(--global-text-muted);
  }
`;

/* ── AniList-style ranked stat cards (Voice actors / Staff — the entries that carry a portrait & past work) ── */

const Toolbar = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-bottom: 0.75rem;
`;

const StatCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  gap: 0.75rem;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  padding: 0.9rem 0 1rem;
  animation: ${popIn} 0.25s ease both;

  &:last-child {
    border-bottom: 0;
  }
`;

const CardRankBadge = styled.span`
  position: absolute;
  top: 0.85rem;
  right: 0;
  width: 1.7rem;
  height: 1.7rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.08);
  color: var(--global-text-muted);
  font-size: 0.74rem;
  font-weight: 700;
`;

/** Avatar + name + stat figures sit in one row at every breakpoint — no more juggling grid-template-areas per viewport. */
const CardTop = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding-right: 2.2rem;
`;

const CardTopBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  justify-content: center;
`;

const CardAvatar = styled.img`
  flex: none;
  width: 64px;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  object-fit: cover;
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: 0 8px 18px rgba(0,0,0,0.18);

  @media (min-width: 600px) {
    width: 84px;
  }

  @media (min-width: 900px) {
    width: 108px;
  }
`;

const CardAvatarFallback = styled.div<{ $tone: 'teal' | 'blue' }>`
  flex: none;
  width: 64px;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  background: ${({ $tone }) =>
    $tone === 'blue'
      ? 'linear-gradient(135deg, rgba(59,130,246,0.28), rgba(168,85,247,0.28))'
      : 'linear-gradient(135deg, rgba(94,234,212,0.28), rgba(168,85,247,0.28))'};

  @media (min-width: 600px) {
    width: 84px;
  }

  @media (min-width: 900px) {
    width: 108px;
  }
`;

const CardName = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
  font-size: 0.95rem;
  font-weight: 800;
  color: var(--global-text);
  min-width: 0;

  @media (min-width: 600px) {
    font-size: 1.05rem;
  }

  .text {
    min-width: 0;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

const CardStatsRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(8rem, 11rem));
  justify-content: start;
  gap: 0.5rem;

  @media (max-width: 599px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

const CardStatItem = styled.div<{ $active: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.4rem 0.55rem;
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 8px;
  background: rgba(255,255,255,0.025);

  b {
    font-size: 0.92rem;
    font-weight: 800;
    color: var(--global-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  small {
    font-size: 0.66rem;
    font-weight: 600;
    color: ${({ $active }) => ($active ? 'var(--primary-accent, #7c3aed)' : 'var(--global-text-muted)')};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  @media (min-width: 600px) {
    padding: 0.45rem 0.6rem;

    b {
      font-size: 1rem;
    }

    small {
      font-size: 0.7rem;
    }
  }
`;

const FavoriteGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 8rem), 1fr));
  gap: 0.9rem;
  margin-top: 0.5rem;

  @media (max-width: 1200px) {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 7rem), 1fr));
  }

  @media (max-width: 768px) {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 6rem), 1fr));
  }
`;

const WorkStrip = styled.div`
  position: relative;
  min-width: 0;
  padding-top: -0.80rem;
`;

const WorkScroller = styled.div`
  display: flex;
  gap: 0.55rem;
  overflow-x: auto;
  padding: 0.1rem 0;
  scroll-behavior: smooth;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: none;
  }
`;

/**
 * Sizing wrapper only — the card itself (poster, title, meta) is rendered by
 * the shared `CardItem` component so every "past work" thumbnail across the
 * app looks and behaves the same way (hover state, link target, etc).
 */
const WorkItem = styled.div`
  flex: 0 0 auto;
  width: 108px;
  min-width: 108px;
  scroll-snap-align: start;

  @media (max-width: 480px) {
    width: 92px;
    min-width: 92px;
  }
`;

const ScrollNavButton = styled.button`
  position: absolute;
  top: -3.25rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2rem;
  margin-top: 0;
  border-radius: 999px;
  border: 1px solid transparent;
  background: rgba(7, 12, 20, 0.72);
  color: var(--global-text-muted);
  cursor: pointer;
  opacity: 1;
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease, border-color 0.15s ease;

  @media (max-width: 759px) {
    display: none;
  }

  &:first-child {
    left: 0.15rem;
  }

  &:last-child {
    right: 0.15rem;
  }

  @media (min-width: 760px) {
    &:first-child {
      left: auto;
      right: 2.7rem;
    }
  }

  &:hover,
  &:focus-visible {
    opacity: 1;
    background: rgba(7, 12, 20, 0.9);
    color: var(--global-text);
    border-color: rgba(255,255,255,0.14);
  }

  &:focus-visible {
    outline: 2px solid var(--primary-accent);
    outline-offset: 2px;
  }
`;

/* ────────────────────────────────────────────────────────────────────────────
 * Formatting helpers
 * ──────────────────────────────────────────────────────────────────────────── */

const safeArray = <T,>(value: T[] | null | undefined): T[] => (Array.isArray(value) ? value : []);

const formatLabel = (value: string) =>
  value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const FORMAT_LABELS: Record<string, string> = {
  TV: 'TV',
  TV_SHORT: 'TV short',
  MOVIE: 'Movie',
  SPECIAL: 'Special',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Music',
  MANGA: 'Manga',
  NOVEL: 'Light novel',
  ONE_SHOT: 'One shot',
};

const COUNTRY_NAMES: Record<string, string> = {
  JP: 'Japan',
  KR: 'South Korea',
  CN: 'China',
  TW: 'Taiwan',
  US: 'United States',
  FR: 'France',
  GB: 'United Kingdom',
};

const statusLabel = (status: string, mediaType: MediaKind) => {
  switch (status) {
    case 'CURRENT':
      return mediaType === 'manga' ? 'Reading' : 'Watching';
    case 'REPEATING':
      return mediaType === 'manga' ? 'Rereading' : 'Rewatching';
    case 'PLANNING':
      return 'Planning';
    case 'COMPLETED':
      return 'Completed';
    case 'DROPPED':
      return 'Dropped';
    case 'PAUSED':
      return 'Paused';
    default:
      return formatLabel(status);
  }
};

const compactFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const compactNumber = (value: number) => compactFormatter.format(value);

const formatHours = (minutes: number) => {
  if (!minutes) return '0h';
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  return hours < 100
    ? `${hours.toFixed(1).replace(/\.0$/, '')}h`
    : `${Math.round(hours).toLocaleString()}h`;
};

const formatDuration = (minutes: number) => {
  if (!minutes) return '0 mins';
  const totalMinutes = Math.round(minutes);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
  if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  if (!days && mins) parts.push(`${mins} min${mins === 1 ? '' : 's'}`);
  return parts.length ? parts.join(' ') : '0 mins';
};

const formatTimeValue = (value: number, mediaType: MediaKind) =>
  mediaType === 'manga' ? `${value.toLocaleString()} ch` : formatHours(value);

const formatTimeShort = (value: number, mediaType: MediaKind) =>
  mediaType === 'manga' ? compactNumber(value) : `${compactNumber(Math.round(value / 60))}h`;

const timeMetricLabel = (mediaType: MediaKind) => (mediaType === 'manga' ? 'Chapters read' : 'Time Watched');

const metricValue = (row: StatRow, metric: Metric) =>
  metric === 'count' ? row.count : metric === 'time' ? row.time : row.mean;

const normalizeMediaType = (value?: string | null): MediaKind => (value === 'manga' ? 'manga' : 'anime');

const normalizeTab = (value?: string | null, mediaType: MediaKind = 'anime') => {
  const validTabs = mediaType === 'anime'
    ? ['overview', 'favourites', 'genres', 'tags', 'voiceActors', 'studios', 'staff', 'years']
    : ['overview', 'favourites', 'genres', 'tags', 'staff', 'years'];

  return validTabs.includes(value ?? '') ? value! : validTabs[0];
};

/**
 * Adapts a ranked stat card's "past works" entry (a minimal staff/voice-actor
 * credit) into the `Anime` shape the shared `CardItem` component expects, so
 * this page never has to maintain its own bespoke poster card.
 */
const pastWorkToAnime = (work: PastWork, mediaType: MediaKind): Anime => ({
  id: work.id,
  title: {
    romaji: work.title,
    english: work.title,
    native: work.title,
    userPreferred: work.title,
  },
  malId: work.id,
  trailer: { id: '', site: '', thumbnail: '', thumbnailHash: '' },
  synonyms: [],
  isLicensed: false,
  isAdult: false,
  countryOfOrigin: '',
  image: work.image ?? '',
  imageHash: '',
  cover: work.image ?? '',
  coverHash: '',
  description: '',
  status: 'FINISHED',
  releaseDate: 0,
  totalEpisodes: 0,
  currentEpisode: 0,
  rating: 0,
  duration: 0,
  genres: [],
  studios: [],
  studioIds: [],
  subOrDub: '',
  season: '',
  popularity: 0,
  type: work.type ?? (mediaType === 'manga' ? 'MANGA' : 'ANIME'),
  startDate: { year: 0, month: 0, day: 0 },
  endDate: { year: 0, month: 0, day: 0 },
  recommendations: [],
  characters: [],
  relations: [],
  mappings: [],
  artwork: [],
  episodes: [],
  color: '',
});

/* ────────────────────────────────────────────────────────────────────────────
 * Score formatting
 *
 * AniList's statistics endpoint reports scores on a 0–100 scale regardless of the
 * user's chosen score format. The site converts them for display, so we do too.
 * If the data already looks like a small scale (≤ 10) it's shown as-is.
 * ──────────────────────────────────────────────────────────────────────────── */

type ScoreTools = {
  isHundredScale: boolean;
  scaleNote?: string;
  mean: (value?: number | null) => string;
  deviation: (value?: number | null) => string;
  bucket: (value: number) => string;
};

const buildScoreTools = (selected: RawStatistics, format: string | null): ScoreTools => {
  const peak = Math.max(selected.meanScore ?? 0, ...safeArray(selected.scores).map((entry) => entry.score ?? 0));
  const isHundredScale = peak > 10;
  const divisor = !isHundredScale || format === 'POINT_100' ? 1 : format === 'POINT_5' ? 20 : 10;
  const convert = (value: number) => value / divisor;
  const trim = (value: number) => (Number.isInteger(value) ? `${value}` : value.toFixed(1));

  return {
    isHundredScale,
    scaleNote: !isHundredScale ? undefined : divisor === 1 ? 'out of 100' : divisor === 20 ? 'out of 5' : 'out of 10',
    mean: (value) => (value ? convert(value).toFixed(1) : '—'),
    deviation: (value) => (value ? convert(value).toFixed(1) : '—'),
    bucket: (value) => trim(convert(value)),
  };
};

/* ────────────────────────────────────────────────────────────────────────────
 * Stat building
 * ──────────────────────────────────────────────────────────────────────────── */

const makeRowFactory = (mediaType: MediaKind) =>
  (key: string, label: string, item: StatBase, extra: Partial<StatRow> = {}): StatRow => ({
    key,
    label,
    count: item.count ?? 0,
    mean: item.meanScore ?? 0,
    time: (mediaType === 'manga' ? item.chaptersRead : item.minutesWatched) ?? 0,
    ...extra,
  });

const lengthOrder = (label: string) => {
  const parsed = parseInt(label, 10);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
};

const buildStats = (statistics: unknown, mediaType: MediaKind, scoreFormat: string | null) => {
  const root = statistics as { anime?: RawStatistics | null; manga?: RawStatistics | null } | null | undefined;
  if (!root) return null;

  const selected = mediaType === 'manga' ? root.manga ?? null : root.anime ?? null;
  if (!selected) return null;

  const isManga = mediaType === 'manga';
  const score = buildScoreTools(selected, scoreFormat);
  const rowOf = makeRowFactory(mediaType);
  const byCount = (rows: StatRow[]) => rows.sort((a, b) => b.count - a.count);
  const toWorks = (items: Array<{ id?: number | null; type?: string | null; title?: AniListTitleLike | null; coverImage?: { large?: string | null; medium?: string | null } | null } | null | undefined> | null | undefined): PastWork[] => {
    if (!Array.isArray(items)) return [];

    const seen = new Set<string>();
    const works: PastWork[] = [];

    for (const item of items) {
      if (!item) continue;

      const title = item.title;
      const label = title?.userPreferred ?? title?.english ?? title?.romaji ?? 'Untitled';
      const id = String(item.id ?? label);

      if (seen.has(id)) continue;
      seen.add(id);

      works.push({
        id,
        title: label,
        image: item.coverImage?.large ?? item.coverImage?.medium ?? null,
        type: item.type ?? null,
      });

      if (works.length >= 8) break;
    }

    return works;
  };

  const formats = byCount(
    safeArray(selected.formats).map((e) => rowOf(e.format, FORMAT_LABELS[e.format] ?? formatLabel(e.format), e)),
  );
  const statuses = byCount(
    safeArray(selected.statuses).map((e) => rowOf(e.status, statusLabel(e.status, mediaType), e)),
  );
  const countries = byCount(
    safeArray(selected.countries).map((e) => rowOf(e.country, COUNTRY_NAMES[e.country] ?? e.country, e)),
  );

  // Score buckets: fill the empty 10…100 buckets so the chart always has the full scale.
  const scoreMap = new Map<number, StatBase & { score: number }>();
  safeArray(selected.scores).forEach((e) => scoreMap.set(e.score, e));
  const scoreKeys = new Set<number>([
    ...(score.isHundredScale ? Array.from({ length: 10 }, (_, i) => (i + 1) * 10) : []),
    ...scoreMap.keys(),
  ]);
  const scores = [...scoreKeys]
    .sort((a, b) => a - b)
    .map((key) => rowOf(`${key}`, score.bucket(key), scoreMap.get(key) ?? {}));

  // Episode / chapter count buckets in natural order (1, 2-3, 4-6 …), not by popularity.
  const lengths = safeArray(selected.lengths)
    .map((e) => rowOf(e.length ?? 'Unknown', e.length ?? 'Unknown', e))
    .sort((a, b) => lengthOrder(a.label) - lengthOrder(b.label));

  const toYearRows = <T extends StatBase>(items: T[], getYear: (item: T) => number | null | undefined) => {
    const map = new Map<number, StatRow>();
    items.forEach((item) => {
      const year = getYear(item);
      if (typeof year === 'number' && year > 0) map.set(year, rowOf(`${year}`, `${year}`, item));
    });
    if (!map.size) return [] as StatRow[];

    const years = [...map.keys()];
    const first = Math.min(...years);
    const last = Math.max(...years);
    const rows: StatRow[] = [];
    for (let year = first; year <= last; year += 1) {
      rows.push(map.get(year) ?? rowOf(`${year}`, `${year}`, {}));
    }
    return rows;
  };

  const releaseYears = toYearRows(safeArray(selected.releaseYears), (e) => e.releaseYear);
  const startYears = toYearRows(safeArray(selected.startYears), (e) => e.startYear);

  const genres = byCount(safeArray(selected.genres).map((e) => rowOf(e.genre, e.genre, e)));
  const tags = byCount(
    safeArray(selected.tags).map((e, i) => rowOf(`${e.tag?.id ?? i}`, e.tag?.name ?? 'Unknown', e)),
  );
  const studios = byCount(
    safeArray(selected.studios).map((e, i) => rowOf(`${e.studio?.id ?? i}`, e.studio?.name ?? 'Unknown', e)),
  );
  const staff = byCount(
    safeArray(selected.staff).map((e, i) =>
      rowOf(`${e.staff?.id ?? i}`, e.staff?.name?.full ?? 'Unknown', e, {
        image: e.staff?.image?.large ?? e.staff?.image?.medium ?? null,
        tone: 'blue',
        works: toWorks(e.staff?.media?.nodes),
      }),
    ),
  );
  const voiceActors = byCount(
    safeArray(selected.voiceActors).map((e, i) =>
      rowOf(`${e.voiceActor?.id ?? i}`, e.voiceActor?.name?.full ?? 'Unknown', e, {
        image: e.voiceActor?.image?.large ?? e.voiceActor?.image?.medium ?? null,
        badge: e.voiceActor?.languageV2 ?? null,
        tone: 'teal',
        works: toWorks(e.voiceActor?.media?.nodes),
      }),
    ),
  );

  const minutes = selected.minutesWatched ?? 0;
  const topStats: Array<{ label: string; value: string; note?: string }> = isManga
    ? [
        { label: 'Total manga', value: (selected.count ?? 0).toLocaleString() },
        { label: 'Chapters read', value: (selected.chaptersRead ?? 0).toLocaleString() },
        { label: 'Volumes read', value: (selected.volumesRead ?? 0).toLocaleString() },
        { label: 'Mean score', value: score.mean(selected.meanScore), note: score.scaleNote },
        { label: 'Standard deviation', value: score.deviation(selected.standardDeviation), note: 'Spread of your scores' },
      ]
    : [
        { label: 'Total anime', value: (selected.count ?? 0).toLocaleString() },
        { label: 'Days watched', value: (minutes / 1440).toFixed(1), note: `${Math.round(minutes / 60).toLocaleString()} hours` },
        { label: 'Episodes watched', value: (selected.episodesWatched ?? 0).toLocaleString() },
        { label: 'Mean score', value: score.mean(selected.meanScore), note: score.scaleNote },
        { label: 'Standard deviation', value: score.deviation(selected.standardDeviation), note: 'Spread of your scores' },
      ];

  return {
    mediaType,
    selected,
    fmtMean: score.mean,
    meanScore: score.mean(selected.meanScore),
    deviation: score.deviation(selected.standardDeviation),
    counts: { anime: root.anime?.count ?? 0, manga: root.manga?.count ?? 0 },
    formats,
    statuses,
    countries,
    scores,
    lengths,
    releaseYears,
    startYears,
    genres,
    tags,
    studios,
    staff,
    voiceActors,
    topStats,
  };
};

const toSlices = (rows: StatRow[]): NumericStat[] => rows.map((row) => ({ label: row.label, value: row.count }));

const describeRow = (
  row: StatRow,
  label: string,
  mediaType: MediaKind,
  fmtMean: ((value: number) => string) | null,
) => {
  const parts = [`${row.count.toLocaleString()} ${row.count === 1 ? 'title' : 'titles'}`];
  if (row.time) parts.push(formatTimeValue(row.time, mediaType));
  if (fmtMean && row.mean) parts.push(`mean ${fmtMean(row.mean)}`);
  return `${label}: ${parts.join(', ')}`;
};

const rowsToBars = (
  rows: StatRow[],
  metric: Metric,
  mediaType: MediaKind,
  fmtMean: (value: number) => string,
  options: { prefix?: string; suffix?: string; showMean?: boolean } = {},
): BarDatum[] => {
  const { prefix = '', suffix = '', showMean = true } = options;

  return rows.map((row) => ({
    label: row.label,
    value: metricValue(row, metric),
    display:
      metric === 'count'
        ? compactNumber(row.count)
        : metric === 'time'
          ? formatTimeShort(row.time, mediaType)
          : fmtMean(row.mean),
    detail: describeRow(row, `${prefix}${row.label}${suffix}`, mediaType, showMean ? fmtMean : null),
  }));
};

/* ────────────────────────────────────────────────────────────────────────────
 * Presentational components
 * ──────────────────────────────────────────────────────────────────────────── */

const Bars: React.FC<{
  data: BarDatum[];
  color: string;
  minBarWidth?: number;
  scrollToEnd?: boolean;
  emptyText: string;
}> = ({ data, color, minBarWidth = 22, scrollToEnd = false, emptyText }) => {
  const [active, setActive] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollToEnd && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [scrollToEnd, data.length]);

  if (!data.length) {
    return <EmptyState>{emptyText}</EmptyState>;
  }

  const max = Math.max(1, ...data.map((item) => item.value));
  const showValues = data.length <= 14;
  const readout = active !== null && data[active] ? data[active].detail : 'Hover or tap a bar for details';

  return (
    <>
      <Readout aria-live='polite' style={active !== null ? { color: 'var(--global-text)' } : undefined}>
        {readout}
      </Readout>
      <ScrollX ref={scrollRef}>
        <BarsInner style={{ minWidth: `${data.length * minBarWidth}px` }} onMouseLeave={() => setActive(null)}>
          <BarsPlot>
            {data.map((item, index) => {
              const ratio = item.value / max;
              return (
                <BarCol
                  key={`${item.label}-${index}`}
                  type='button'
                  aria-label={item.detail}
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  onClick={() => setActive(index)}
                >
                  {showValues ? <BarValue>{item.display}</BarValue> : null}
                  <BarFill
                    $color={color}
                    $active={active === index}
                    $dim={active !== null}
                    style={{
                      height: `calc((100% - 18px) * ${ratio})`,
                      minHeight: item.value > 0 ? 3 : 0,
                    }}
                  />
                </BarCol>
              );
            })}
          </BarsPlot>
          <BarsAxis>
            {data.map((item, index) => (
              <AxisLabel key={`${item.label}-axis-${index}`} $active={active === index}>
                {item.label}
              </AxisLabel>
            ))}
          </BarsAxis>
        </BarsInner>
      </ScrollX>
    </>
  );
};

const DonutChart: React.FC<{ data: NumericStat[]; centerLabel?: string }> = ({ data, centerLabel = 'titles' }) => {
  if (!data.length) {
    return <EmptyState>No data available yet.</EmptyState>;
  }

  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let cumulative = 0;

  return (
    <DonutWrap>
      <svg width='140' height='140' viewBox='0 0 160 160' aria-label='Distribution donut chart'>
        <circle cx='80' cy='80' r={radius} fill='none' stroke='rgba(255,255,255,0.08)' strokeWidth='16' />
        {data.map((item, index) => {
          const fraction = item.value / total;
          const dash = fraction * circumference;
          const offset = circumference * (1 - cumulative);
          cumulative += fraction;

          return (
            <circle
              key={item.label}
              cx='80'
              cy='80'
              r={radius}
              fill='none'
              stroke={chartPalette[index % chartPalette.length]}
              strokeWidth='16'
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={offset}
              transform='rotate(-90 80 80)'
              strokeLinecap='round'
            />
          );
        })}
        <text x='80' y='76' textAnchor='middle' fill='var(--global-text)' fontSize='20' fontWeight='700'>
          {total.toLocaleString()}
        </text>
        <text x='80' y='94' textAnchor='middle' fill='var(--global-text-muted)' fontSize='10'>
          {centerLabel}
        </text>
      </svg>

      <ChartLegend>
        {data.map((item, index) => (
          <LegendItem key={item.label}>
            <LegendLabel>
              <Dot $color={chartPalette[index % chartPalette.length]} />
              {item.label}
            </LegendLabel>
            <LegendValue>
              <strong>{item.value.toLocaleString()}</strong>
              <span>{Math.round((item.value / total) * 100)}%</span>
            </LegendValue>
          </LegendItem>
        ))}
      </ChartLegend>
    </DonutWrap>
  );
};

const MetricToggle: React.FC<{
  value: Metric;
  onChange: (metric: Metric) => void;
  mediaType: MediaKind;
  showTime: boolean;
}> = ({ value, onChange, mediaType, showTime }) => {
  const options: Array<{ key: Metric; label: string }> = [
    { key: 'count', label: 'Count' },
    { key: 'mean', label: 'Mean Score' },
    ...(showTime ? [{ key: 'time' as Metric, label: timeMetricLabel(mediaType) }] : []),
  ];

  return (
    <Segmented role='group' aria-label='Chart metric'>
      {options.map((option) => (
        <SegmentButton
          key={option.key}
          type='button'
          $active={value === option.key}
          aria-pressed={value === option.key}
          onClick={() => onChange(option.key)}
        >
          {option.label}
        </SegmentButton>
      ))}
    </Segmented>
  );
};

const RowAvatar: React.FC<{ row: StatRow; size?: number }> = ({ row, size = 42 }) => {
  if (row.image === undefined) return null;

  return row.image ? (
    <RowImage src={row.image} alt={row.label} loading='lazy' $size={size} />
  ) : (
    <RowImageFallback $tone={row.tone ?? 'teal'} $size={size} />
  );
};

/**
 * Category bar chart — used for genres / tags / studios, i.e. lists that have
 * no portrait and can have many entries. Mirrors the Overview's Score /
 * Episode-count bar charts (same `Bars` component, same metric toggle) rather
 * than the heavier ranked card grid, since a plain bar is far easier to scan
 * for a long, portrait-less list than a grid of cards.
 */
const CategoryBars: React.FC<{
  rows: StatRow[];
  mediaType: MediaKind;
  fmtMean: (value: number) => string;
  color: string;
  emptyText: string;
}> = ({ rows, fmtMean, emptyText }) => {
  const top = rows.slice(0, 5);
  const max = Math.max(1, ...top.map((row) => row.count));

  if (!rows.length) {
    return <EmptyState>{emptyText}</EmptyState>;
  }

  return (
    <RankList>
      {top.map((row, index) => (
        <CompactRow key={row.key} style={{ '--w': `${(row.count / max) * 100}%` } as React.CSSProperties}>
          <RowRank>{index + 1}</RowRank>
          <RowName>
            <RowAvatar row={row} size={36} />
            <span className='text'>{row.label}</span>
          </RowName>
          <CompactMeta>
            <b>{row.count.toLocaleString()}</b>
            <span>{fmtMean(row.mean)}</span>
          </CompactMeta>
        </CompactRow>
      ))}
    </RankList>
  );
};

/**
 * AniList-style ranked stat card list — reserved for lists that carry a
 * portrait and past-work credits (Voice actors / Staff), where a picture and
 * a scrollable "past works" strip genuinely add information a bar can't.
 * Big name up top with a rank badge, an avatar, and Count / Mean Score /
 * Time Watched figures beside it. Sortable via the segmented control, with
 * an expand control for long lists.
 */
const RankTable: React.FC<{
  rows: StatRow[];
  mediaType: MediaKind;
  fmtMean: (value: number) => string;
  nameLabel: string;
  initialVisible?: number;
  emptyText: string;
}> = ({ rows, mediaType, fmtMean, initialVisible = 10, emptyText }) => {
  const showTime = rows.some((row) => row.time > 0);
  const [metric, setMetric] = useState<Metric>('count');
  const [expanded, setExpanded] = useState(false);
  const activeMetric: Metric = metric === 'time' && !showTime ? 'count' : metric;

  const sorted = useMemo(
    () => [...rows].sort((a, b) => metricValue(b, activeMetric) - metricValue(a, activeMetric) || b.count - a.count),
    [rows, activeMetric],
  );

  if (!rows.length) {
    return <EmptyState>{emptyText}</EmptyState>;
  }

  const visible = expanded ? sorted : sorted.slice(0, initialVisible);

  return (
    <>
      <Toolbar>
        <MetricToggle value={activeMetric} onChange={setMetric} mediaType={mediaType} showTime={showTime} />
      </Toolbar>

      <StatCardGrid>
        {visible.map((row, index) => (
          <StatCard key={row.key}>
            <CardRankBadge>{index + 1}</CardRankBadge>
            <CardTop>
              {row.image !== undefined ? (
                row.image ? (
                  <CardAvatar src={row.image} alt={row.label} loading='lazy' />
                ) : (
                  <CardAvatarFallback $tone={row.tone ?? 'teal'} />
                )
              ) : null}
              <CardTopBody>
                <CardName>
                  <span className='text'>{row.label}</span>
                  {row.badge ? <LangChip>{row.badge}</LangChip> : null}
                </CardName>
                <CardStatsRow>
                  <CardStatItem $active={activeMetric === 'count'}>
                    <b>{row.count.toLocaleString()}</b>
                    <small>Count</small>
                  </CardStatItem>
                  <CardStatItem $active={activeMetric === 'mean'}>
                    <b>{fmtMean(row.mean)}</b>
                    <small>Mean Score</small>
                  </CardStatItem>
                  {showTime ? (
                    <CardStatItem $active={activeMetric === 'time'}>
                      <b>{formatTimeValue(row.time, mediaType)}</b>
                      <small>{timeMetricLabel(mediaType)}</small>
                    </CardStatItem>
                  ) : null}
                </CardStatsRow>
              </CardTopBody>
            </CardTop>
            <PastWorksStrip works={row.works ?? []} label={row.label} mediaType={mediaType} />
          </StatCard>
        ))}
      </StatCardGrid>

      {sorted.length > initialVisible ? (
        <ExpandButton type='button' onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Show less' : `Show all ${sorted.length.toLocaleString()}`}
        </ExpandButton>
      ) : null}
    </>
  );
};

const PastWorksStrip: React.FC<{ works: PastWork[]; label: string; mediaType: MediaKind }> = ({
  works,
  label,
  mediaType,
}) => {
  const scrollerRef = useRef<HTMLDivElement>(null);

  if (!works.length) return null;

  const scroll = (direction: 'left' | 'right') => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollBy({ left: direction === 'left' ? -220 : 220, behavior: 'smooth' });
  };

  return (
    <WorkStrip className='work-strip'>
      <ScrollNavButton type='button' aria-label={`Scroll ${label} works left`} onClick={() => scroll('left')}>
        <FiChevronLeft size={14} />
      </ScrollNavButton>
      <WorkScroller ref={scrollerRef} aria-label={`${label} past works`}>
        {works.map((work, index) => (
          <WorkItem key={`${label}-${work.id}-${index}`}>
            <CardItem anime={pastWorkToAnime(work, mediaType)} />
          </WorkItem>
        ))}
      </WorkScroller>
      <ScrollNavButton type='button' aria-label={`Scroll ${label} works right`} onClick={() => scroll('right')}>
        <FiChevronRight size={14} />
      </ScrollNavButton>
    </WorkStrip>
  );
};

/** Compact "top 5" card used on the overview. */
const TopList: React.FC<{
  title: string;
  rows: StatRow[];
  fmtMean: (value: number) => string;
  onViewAll: () => void;
  emptyText: string;
  limit?: number;
}> = ({ title, rows, fmtMean, onViewAll, emptyText, limit = 5 }) => {
  const top = rows.slice(0, limit);
  const max = Math.max(1, ...top.map((row) => row.count));

  return (
    <Panel>
      <PanelHeader>
        <PanelTitle>{title}</PanelTitle>
        {top.length ? <LinkButton type='button' onClick={onViewAll}>View all</LinkButton> : null}
      </PanelHeader>
      {top.length ? (
        <RankList>
          {top.map((row, index) => (
            <CompactRow key={row.key} style={{ '--w': `${(row.count / max) * 100}%` } as React.CSSProperties}>
              <RowRank>{index + 1}</RowRank>
              <RowName>
                <RowAvatar row={row} size={36} />
                <span className='text'>{row.label}</span>
              </RowName>
              <CompactMeta>
                <b>{row.count.toLocaleString()}</b>
                <span>{fmtMean(row.mean)}</span>
              </CompactMeta>
            </CompactRow>
          ))}
        </RankList>
      ) : (
        <EmptyState>{emptyText}</EmptyState>
      )}
    </Panel>
  );
};

/* ────────────────────────────────────────────────────────────────────────────
 * Page
 * ──────────────────────────────────────────────────────────────────────────── */

const ProfileStatsPage: React.FC = () => {
  const { isLoggedIn, userData, login } = useAuth();
  const { mediaType: routeMediaType = 'anime', tab: routeTab = 'overview' } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const mediaType = normalizeMediaType(searchParams.get('mediaType') ?? routeMediaType);
  const activeTab = normalizeTab(searchParams.get('tab') ?? routeTab, mediaType);
  const [yearMetric, setYearMetric] = useState<Metric>('count');
  const chipRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const scoreFormat =
    (userData as unknown as { mediaListOptions?: { scoreFormat?: string | null } } | null)?.mediaListOptions
      ?.scoreFormat ?? null;
  const bannerImage = (userData as unknown as { bannerImage?: string | null } | null)?.bannerImage ?? null;

  // Keep the active chip visible in the mobile tab strip.
  useEffect(() => {
    chipRefs.current[activeTab]?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [activeTab, mediaType]);

  const favouriteMedia = useMemo<Anime[]>(() => {
    const items = mediaType === 'manga'
      ? userData?.favourites?.manga?.nodes
      : userData?.favourites?.anime?.nodes;

    return (Array.isArray(items) ? items : []).slice(0, 4).map((item) => {
      const rawTitle = (item.title ?? {}) as AniListTitleLike;
      const title = {
        romaji: rawTitle.romaji ?? rawTitle.english ?? 'Untitled',
        english: rawTitle.english ?? rawTitle.romaji ?? 'Untitled',
        native: rawTitle.native ?? rawTitle.romaji ?? 'Untitled',
        userPreferred: rawTitle.userPreferred ?? rawTitle.english ?? rawTitle.romaji ?? 'Untitled',
      };

      return {
        id: String(item.id),
        title,
        malId: String(item.id),
        trailer: { id: '', site: '', thumbnail: '', thumbnailHash: '' },
        synonyms: [],
        isLicensed: false,
        isAdult: false,
        countryOfOrigin: '',
        image: item.coverImage?.large ?? item.coverImage?.medium ?? '',
        imageHash: '',
        cover: item.coverImage?.large ?? item.coverImage?.medium ?? '',
        coverHash: '',
        description: '',
        status: 'FINISHED',
        releaseDate: 0,
        totalEpisodes: 0,
        currentEpisode: 0,
        rating: 0,
        duration: 0,
        genres: [],
        studios: [],
        studioIds: [],
        subOrDub: '',
        season: '',
        popularity: 0,
        type: mediaType === 'manga' ? 'MANGA' : 'ANIME',
        startDate: { year: 0, month: 0, day: 0 },
        endDate: { year: 0, month: 0, day: 0 },
        recommendations: [],
        characters: [],
        relations: [],
        mappings: [],
        artwork: [],
        episodes: [],
        color: '',
      };
    });
  }, [mediaType, userData]);

  const stats = useMemo(
    () => buildStats(userData?.statistics, mediaType, scoreFormat),
    [mediaType, userData, scoreFormat],
  );

  const tabs = [
    { label: 'Overview', key: 'overview' },
    { label: 'Favourites', key: 'favourites' },
    { label: 'Genres', key: 'genres' },
    { label: 'Tags', key: 'tags' },
    ...(mediaType === 'anime' ? [{ label: 'Voice Actors', key: 'voiceActors' }] : []),
    ...(mediaType === 'anime' ? [{ label: 'Studios', key: 'studios' }] : []),
    { label: 'Staff', key: 'staff' },
    { label: 'Years', key: 'years' },
  ];

  const handleTabChange = (nextTab: string) => {
    const path = `/profile/stats?mediaType=${mediaType}&tab=${nextTab}`;
    navigate(path, { replace: false });
  };

  const handleMediaChange = (nextMedia: MediaKind) => {
    if (nextMedia === mediaType) return;
    navigate(`/profile/stats?mediaType=${nextMedia}&tab=${normalizeTab(activeTab, nextMedia)}`, { replace: false });
  };

  if (!isLoggedIn || !userData) {
    return (
      <Page>
        <EmptyState>
          <h2 style={{ margin: '0 0 0.5rem' }}>No AniList profile connected</h2>
          <p style={{ margin: 0, color: 'var(--global-text-muted)' }}>
            Sign in to view your account stats, trends, and watch history built from your AniList data.
          </p>
          <button
            onClick={login}
            style={{
              marginTop: '1rem',
              border: 'none',
              borderRadius: '999px',
              background: 'var(--primary-accent)',
              color: '#fff',
              padding: '0.75rem 1.1rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <SiAnilist size={14} /> Connect AniList
            </span>
          </button>
        </EmptyState>
      </Page>
    );
  }

  if (!stats) {
    return (
      <Page>
        <EmptyState>
          Your AniList statistics are unavailable right now.
        </EmptyState>
      </Page>
    );
  }

  const isManga = mediaType === 'manga';
  const fmtMean = stats.fmtMean;
  const lengthUnit = isManga ? 'chapters' : 'episodes';
  const startYearTitle = isManga ? 'Read year' : 'Watch year';
  const yearHasTime = [...stats.releaseYears, ...stats.startYears].some((row) => row.time > 0);
  const activeYearMetric: Metric = yearMetric === 'time' && !yearHasTime ? 'count' : yearMetric;

  const scoreBars = rowsToBars(stats.scores, 'count', mediaType, fmtMean, { prefix: 'Score ', showMean: false });
  const lengthBars = rowsToBars(stats.lengths, 'count', mediaType, fmtMean, { suffix: ` ${lengthUnit}` });
  const releaseBars = (metric: Metric) => rowsToBars(stats.releaseYears, metric, mediaType, fmtMean);
  const startBars = (metric: Metric) => rowsToBars(stats.startYears, metric, mediaType, fmtMean);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'favourites':
        return (
          <Panel>
            <PanelHeader>
              <PanelTitle>{mediaType === 'manga' ? 'Favourite manga' : 'Favourite anime'}</PanelTitle>
              <PanelMeta>{favouriteMedia.length} saved</PanelMeta>
            </PanelHeader>
            {favouriteMedia.length ? (
              <FavoriteGrid>
                {favouriteMedia.map((item) => (
                  <div key={item.id} style={{ minWidth: 0 }}>
                    <CardItem anime={item} />
                  </div>
                ))}
              </FavoriteGrid>
            ) : (
              <EmptyState>
                No favourites in this {mediaType === 'manga' ? 'manga' : 'anime'} list yet.
              </EmptyState>
            )}
          </Panel>
        );

      case 'genres':
        return (
          <Panel>
            <PanelHeader>
              <PanelTitle>Genres</PanelTitle>
              <PanelMeta>{stats.genres.length} genres</PanelMeta>
            </PanelHeader>
            <CategoryBars
              key={`${mediaType}-genres`}
              rows={stats.genres}
              mediaType={mediaType}
              fmtMean={fmtMean}
              color={chartPalette[4]}
              emptyText='No genre data available yet.'
            />
          </Panel>
        );

      case 'tags':
        return (
          <Panel>
            <PanelHeader>
              <PanelTitle>Tags</PanelTitle>
              <PanelMeta>{stats.tags.length} tags</PanelMeta>
            </PanelHeader>
            <CategoryBars
              key={`${mediaType}-tags`}
              rows={stats.tags}
              mediaType={mediaType}
              fmtMean={fmtMean}
              color={chartPalette[5]}
              emptyText='No tag data available yet.'
            />
          </Panel>
        );

      case 'voiceActors':
        return (
          <Panel>
            <PanelHeader>
              <PanelTitle>Voice actors</PanelTitle>
              <PanelMeta>{stats.voiceActors.length} actors</PanelMeta>
            </PanelHeader>
            <RankTable
              key={`${mediaType}-voiceActors`}
              rows={stats.voiceActors}
              mediaType={mediaType}
              fmtMean={fmtMean}
              nameLabel='Voice actor'
              initialVisible={12}
              emptyText='No voice actor data available yet.'
            />
          </Panel>
        );

      case 'studios':
        return (
          <Panel>
            <PanelHeader>
              <PanelTitle>Studios</PanelTitle>
              <PanelMeta>{stats.studios.length} studios</PanelMeta>
            </PanelHeader>
            <CategoryBars
              key={`${mediaType}-studios`}
              rows={stats.studios}
              mediaType={mediaType}
              fmtMean={fmtMean}
              color={chartPalette[6]}
              emptyText='No studio data available yet.'
            />
          </Panel>
        );

      case 'staff':
        return (
          <Panel>
            <PanelHeader>
              <PanelTitle>Staff</PanelTitle>
              <PanelMeta>{stats.staff.length} people</PanelMeta>
            </PanelHeader>
            <RankTable
              key={`${mediaType}-staff`}
              rows={stats.staff}
              mediaType={mediaType}
              fmtMean={fmtMean}
              nameLabel='Staff'
              initialVisible={12}
              emptyText='No staff data available yet.'
            />
          </Panel>
        );

      case 'years':
        return (
          <SectionStack>
            <div>
              <MetricToggle
                value={activeYearMetric}
                onChange={setYearMetric}
                mediaType={mediaType}
                showTime={yearHasTime}
              />
            </div>
            <Panel>
              <PanelHeader>
                <PanelTitle>Release year</PanelTitle>
                <PanelMeta>{stats.releaseYears.length} years</PanelMeta>
              </PanelHeader>
              <Bars
                key={`${mediaType}-release-${activeYearMetric}`}
                data={releaseBars(activeYearMetric)}
                color={chartPalette[2]}
                minBarWidth={30}
                scrollToEnd
                emptyText='No release year data available yet.'
              />
            </Panel>
            <Panel>
              <PanelHeader>
                <PanelTitle>{startYearTitle}</PanelTitle>
                <PanelMeta>{stats.startYears.length} years</PanelMeta>
              </PanelHeader>
              <Bars
                key={`${mediaType}-start-${activeYearMetric}`}
                data={startBars(activeYearMetric)}
                color={chartPalette[3]}
                minBarWidth={30}
                scrollToEnd
                emptyText='No start year data available yet.'
              />
            </Panel>
          </SectionStack>
        );

      default:
        return (
          <SectionStack>
            <TwoCol>
              <Panel>
                <PanelHeader>
                  <PanelTitle>Score distribution</PanelTitle>
                  <PanelMeta>Mean {stats.meanScore}, deviation {stats.deviation}</PanelMeta>
                </PanelHeader>
                <Bars
                  key={`${mediaType}-scores`}
                  data={scoreBars}
                  color={chartPalette[0]}
                  minBarWidth={24}
                  emptyText='No scores yet.'
                />
              </Panel>

              <Panel>
                <PanelHeader>
                  <PanelTitle>{isManga ? 'Chapter count' : 'Episode count'}</PanelTitle>
                  <PanelMeta>{stats.selected.count ?? 0} titles</PanelMeta>
                </PanelHeader>
                <Bars
                  key={`${mediaType}-lengths`}
                  data={lengthBars}
                  color={chartPalette[1]}
                  minBarWidth={34}
                  emptyText='No length data available yet.'
                />
              </Panel>
            </TwoCol>

            <TwoCol>
              <Panel>
                <PanelHeader>
                  <PanelTitle>Format distribution</PanelTitle>
                  <PanelMeta>{stats.formats.length} formats</PanelMeta>
                </PanelHeader>
                <DonutChart data={toSlices(stats.formats)} />
              </Panel>

              <Panel>
                <PanelHeader>
                  <PanelTitle>Status distribution</PanelTitle>
                  <PanelMeta>{stats.statuses.length} statuses</PanelMeta>
                </PanelHeader>
                <DonutChart data={toSlices(stats.statuses)} />
              </Panel>
            </TwoCol>

            <Panel>
              <PanelHeader>
                <PanelTitle>Release year</PanelTitle>
                <PanelMeta>Titles by year they came out</PanelMeta>
              </PanelHeader>
              <Bars
                key={`${mediaType}-release-overview`}
                data={releaseBars('count')}
                color={chartPalette[2]}
                minBarWidth={30}
                scrollToEnd
                emptyText='No release year data available yet.'
              />
            </Panel>

            <Panel>
              <PanelHeader>
                <PanelTitle>{startYearTitle}</PanelTitle>
                <PanelMeta>Titles by year you started them</PanelMeta>
              </PanelHeader>
              <Bars
                key={`${mediaType}-start-overview`}
                data={startBars('count')}
                color={chartPalette[3]}
                minBarWidth={30}
                scrollToEnd
                emptyText='No start year data available yet.'
              />
            </Panel>

            <TwoCol>
              <Panel>
                <PanelHeader>
                  <PanelTitle>Country of origin</PanelTitle>
                  <PanelMeta>{stats.countries.length} countries</PanelMeta>
                </PanelHeader>
                <DonutChart data={toSlices(stats.countries)} />
              </Panel>

              <TopList
                title='Top genres'
                rows={stats.genres}
                fmtMean={fmtMean}
                onViewAll={() => handleTabChange('genres')}
                emptyText='No genre data available yet.'
              />
            </TwoCol>

            <TwoCol>
              <TopList
                title='Top tags'
                rows={stats.tags}
                fmtMean={fmtMean}
                onViewAll={() => handleTabChange('tags')}
                emptyText='No tag data available yet.'
              />
              {isManga ? (
                <TopList
                  title='Top staff'
                  rows={stats.staff}
                  fmtMean={fmtMean}
                  onViewAll={() => handleTabChange('staff')}
                  emptyText='No staff data available yet.'
                />
              ) : (
                <TopList
                  title='Top voice actors'
                  rows={stats.voiceActors}
                  fmtMean={fmtMean}
                  onViewAll={() => handleTabChange('voiceActors')}
                  emptyText='No voice actor data available yet.'
                />
              )}
            </TwoCol>

            {!isManga ? (
              <TwoCol>
                <TopList
                  title='Top studios'
                  rows={stats.studios}
                  fmtMean={fmtMean}
                  onViewAll={() => handleTabChange('studios')}
                  emptyText='No studio data available yet.'
                />
                <TopList
                  title='Top staff'
                  rows={stats.staff}
                  fmtMean={fmtMean}
                  onViewAll={() => handleTabChange('staff')}
                  emptyText='No staff data available yet.'
                />
              </TwoCol>
            ) : null}
          </SectionStack>
        );
    }
  };

  return (
    <Page>
      <BorderAngleProperty />
      <Hero>
        <HeroBanner $src={bannerImage} />
        <HeroScrimTop />
        <HeroScrimBottom />
        <HeroFloorLine />

        <ProfileStatsActionButton type='button' onClick={() => navigate('/profile')}>
          <SiAnilist size={12} /> View profile
        </ProfileStatsActionButton>

        <HeroContent>
          <AvatarFrame>
            <AvatarImg src={userData.avatar.large} alt={userData.name} />
          </AvatarFrame>

          <IdentityBlock>
            <MemberBadge>
              <SiAnilist size={10} /> {isManga ? 'Manga stats' : 'Anime stats'}
            </MemberBadge>
            <Username>{userData.name}</Username>
          </IdentityBlock>
        </HeroContent>
      </Hero>

      {/* Custom mobile layout: media switch + swipeable section chips */}
      <MobileBar aria-label='Stats navigation'>
        <MediaTabs $columns={2}>
          <MediaTab type='button' $active={!isManga} aria-pressed={!isManga} onClick={() => handleMediaChange('anime')}>
            Anime <MediaCount>{stats.counts.anime.toLocaleString()}</MediaCount>
          </MediaTab>
          <MediaTab type='button' $active={isManga} aria-pressed={isManga} onClick={() => handleMediaChange('manga')}>
            Manga <MediaCount>{stats.counts.manga.toLocaleString()}</MediaCount>
          </MediaTab>
        </MediaTabs>
        <ChipScroller>
          {tabs.map((tabOption) => (
            <Chip
              key={tabOption.key}
              type='button'
              ref={(node) => {
                chipRefs.current[tabOption.key] = node;
              }}
              $active={activeTab === tabOption.key}
              aria-current={activeTab === tabOption.key ? 'page' : undefined}
              onClick={() => handleTabChange(tabOption.key)}
            >
              {tabOption.label}
            </Chip>
          ))}
        </ChipScroller>
      </MobileBar>

      <DashboardLayout>
        <Sidebar aria-label='Stats navigation'>
          <SidebarLabel>Media</SidebarLabel>
          <MediaTabs $columns={1}>
            <MediaTab type='button' $active={!isManga} aria-pressed={!isManga} onClick={() => handleMediaChange('anime')}>
              Anime <MediaCount>{stats.counts.anime.toLocaleString()}</MediaCount>
            </MediaTab>
            <MediaTab type='button' $active={isManga} aria-pressed={isManga} onClick={() => handleMediaChange('manga')}>
              Manga <MediaCount>{stats.counts.manga.toLocaleString()}</MediaCount>
            </MediaTab>
          </MediaTabs>

          <div style={{ height: '1rem' }} />
          <SidebarLabel>Sections</SidebarLabel>
          <SidebarGroup>
            {tabs.map((tabOption) => (
              <SidebarButton
                key={tabOption.key}
                type='button'
                $active={activeTab === tabOption.key}
                aria-current={activeTab === tabOption.key ? 'page' : undefined}
                onClick={() => handleTabChange(tabOption.key)}
              >
                {tabOption.label}
              </SidebarButton>
            ))}
          </SidebarGroup>
        </Sidebar>

        <Main>
          <SummaryStrip>
            {stats.topStats.map((item) => (
              <SummaryCell key={item.label}>
                <CellValue>{item.value}</CellValue>
                <CellLabel>{item.label}</CellLabel>
                {item.note ? <CellNote>{item.note}</CellNote> : null}
              </SummaryCell>
            ))}
          </SummaryStrip>

          {renderTabContent()}
        </Main>
      </DashboardLayout>
    </Page>
  );
};

export default ProfileStatsPage;