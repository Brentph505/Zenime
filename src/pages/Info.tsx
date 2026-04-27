import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import styled, { keyframes } from 'styled-components';
import { SiMyanimelist, SiAnilist } from 'react-icons/si';
import {
  FaPlay, FaSearch, FaClosedCaptioning, FaMicrophone,
  FaChevronLeft, FaChevronRight,
} from 'react-icons/fa';
import { MdViewList, MdGridOn } from 'react-icons/md';
import { BsEye } from 'react-icons/bs';
import {
  fetchAnimeInfo,
  fetchAnimeData,
  Episode,
  Anime,
  CardItem as AnimeCardItem,
  AnimeDataList,
} from '../index';

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
  width: 100vw;
  left: 50%;
  right: 50%;
  margin-left: -50vw;
  margin-right: -50vw;
  height: 360px;
  overflow: hidden;
  @media (max-width: 768px) { height: 180px; }
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
  padding: 0 1.5rem 5rem;
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
  gap: 1.5rem;
  margin-top: -110px;
  position: relative; z-index: 2;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
    margin-top: 0;
    gap: 0;
  }
`;

// ─── Mobile hero overlay — poster + quick info floated over the hero ──────────

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

const MobileTitleBlock = styled.div`
  flex: 1; min-width: 0; padding-bottom: 0.25rem;
`;

const MobileEyebrow = styled.div`
  font-size: 0.62rem; font-weight: 700; letter-spacing: 0.16em;
  text-transform: uppercase; color: ${A.accent}; margin-bottom: 0.25rem;
`;

const MobileTitle = styled.h1`
  font-size: 1.15rem; font-weight: 800; line-height: 1.15;
  margin: 0 0 0.2rem; color: ${A.text};
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
`;

const MobileRomaji = styled.p`
  font-size: 0.75rem; color: ${A.muted}; margin: 0; font-style: italic;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
`;

const MobilePillRow = styled.div`
  display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.4rem;
`;

// ─── Left column ─────────────────────────────────────────────────────────────

const LeftCol = styled.div`
  display: flex; flex-direction: column; gap: 0.75rem;
  animation: ${slideR} 0.5s ease both;

  @media (max-width: 860px) {
    display: none;
  }
`;

const PosterWrap = styled.div`
  position: relative; border-radius: 8px; overflow: hidden;
  box-shadow: 0 0 0 1px #e5e7eb, 0 8px 24px rgba(0,0,0,0.12);
  .dark-mode & {
    box-shadow: 0 0 0 1px ${A.border}, 0 24px 48px rgba(0,0,0,0.55);
  }
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

const PosterActions = styled.div`
  display: flex; flex-direction: column; gap: 0.5rem;
`;

const WatchBtn = styled.button`
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;
  padding: 0.75rem; background: ${A.accent}; border: none; border-radius: 6px;
  color: #0a0a0c; font-size: 0.82rem; font-weight: 800;
  letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer;
  transition: filter 0.2s, transform 0.15s;
  &:hover { filter: brightness(1.12); transform: translateY(-1px); }
`;

const ExtRow = styled.div`display: flex; gap: 0.5rem;`;

const ExtBtn = styled.a`
  flex: 1; display: flex; align-items: center; justify-content: center;
  padding: 0.5rem; background: #ffffff; border: 1px solid #e5e7eb;
  border-radius: 6px; color: #6b7280; text-decoration: none;
  transition: border-color 0.2s, color 0.2s;
  &:hover { border-color: ${A.accent}; color: ${A.text}; }
  .dark-mode & {
    background: ${A.card};
    border: 1px solid ${A.border};
    color: ${A.muted};
  }
`;

const SidebarMeta = styled.div`
  display: flex; flex-direction: column; gap: 0; width: 100%;
  font-size: 0.78rem;
`;

const SideMetaRow = styled.div`
  display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem;
  padding: 0.4rem 0; border-bottom: 1px solid #e5e7eb;
  &:last-child { border-bottom: none; }
  .dark-mode & {
    border-bottom: 1px solid ${A.faint};
  }
`;

const SideMetaKey = styled.span`color: #6b7280; white-space: nowrap; flex-shrink: 0;
  .dark-mode & { color: ${A.muted}; }
`;
const SideMetaVal = styled.span`text-align: right; color: #1f2937; word-break: break-word; font-weight: 600;
  .dark-mode & { color: ${A.text}; }
`;

// ─── Right column ─────────────────────────────────────────────────────────────

const RightCol = styled.div`
  min-width: 0; display: flex; flex-direction: column; gap: 1.5rem;
  padding: 1.25rem 1.25rem 1.5rem;
  background: #f8f9fa;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  animation: ${slideU} 0.5s ease 0.1s both;

  .dark-mode & {
    background: var(--global-div-tr);
    border: 1px solid ${A.border};
  }

  @media (max-width: 860px) {
    border-radius: 0;
    border-left: none;
    border-right: none;
    border-top: none;
    padding: 0.85rem 0.75rem 1.25rem;
    gap: 1rem;
    margin: 0;
    width: 100%;
    box-sizing: border-box;
  }
  @media (max-width: 600px) { padding: 0.75rem 0.75rem 1.25rem; }
`;

const DesktopTitleBlock = styled.div`
  @media (max-width: 860px) { display: none; }
`;

const MobileActionBar = styled.div`
  display: none;
  @media (max-width: 860px) {
    display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;
  }
`;

const MobileWatchBtn = styled.button`
  flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.45rem;
  padding: 0.65rem; background: ${A.accent}; border: none; border-radius: 6px;
  color: #0a0a0c; font-size: 0.78rem; font-weight: 800;
  letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
`;

const MobileExtBtn = styled.a`
  display: flex; align-items: center; justify-content: center;
  padding: 0.6rem 0.75rem; background: #ffffff; border: 1px solid #e5e7eb;
  border-radius: 6px; color: #6b7280; text-decoration: none;
  transition: border-color 0.2s, color 0.2s;
  &:hover { border-color: ${A.accent}; color: ${A.text}; }
  .dark-mode & {
    background: ${A.card};
    border: 1px solid ${A.border};
    color: ${A.muted};
  }
`;

const MobileMeta = styled.div`
  display: none;
  @media (max-width: 860px) {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    overflow: hidden;
    font-size: 0.75rem;
    background: #f8f9fa;
    .dark-mode & {
      background: ${A.surface};
      border-color: ${A.border};
    }
  }
`;

const MobileMetaCell = styled.div`
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid #e5e7eb;
  border-right: 1px solid #e5e7eb;
  background: #ffffff;
  &:nth-child(2n) { border-right: none; }
  &:nth-last-child(-n+2) { border-bottom: none; }
  .dark-mode & {
    background: ${A.card};
    border-color: ${A.border};
  }
`;

const MobileMetaKey = styled.div`color: #6b7280; font-size: 0.68rem; margin-bottom: 0.1rem; letter-spacing: 0.04em;
  .dark-mode & { color: ${A.muted}; }
`;
const MobileMetaVal = styled.div`color: #1f2937; font-weight: 600; font-size: 0.78rem;
  .dark-mode & { color: ${A.text}; }
`;

const EyeBrow = styled.div`
  font-size: 0.68rem; font-weight: 700; letter-spacing: 0.18em;
  text-transform: uppercase; color: ${A.accent}; margin-bottom: 0.35rem;
`;

const MainTitle = styled.h1`
  font-size: 2rem; font-weight: 800; line-height: 1.1; margin: 0 0 0.3rem; color: #1f2937;
  .dark-mode & { color: ${A.text}; }
  @media (max-width: 600px) { font-size: 1.45rem; }
`;
const RomajiSub = styled.p`font-size: 0.85rem; color: #6b7280; margin: 0 0 0.9rem; font-style: italic;
  .dark-mode & { color: ${A.muted}; }
`;

const PillRow = styled.div`display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.5rem;`;

const Pill = styled.span<{ $accent?: boolean }>`
  padding: 0.2rem 0.65rem; border-radius: 99px; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em;
  border: 1px solid ${({ $accent }) => $accent ? A.accent : A.border};
  color: ${({ $accent }) => $accent ? A.accent : A.muted};
  background: ${({ $accent }) => $accent ? A.accentDim : 'transparent'};
`;

const ClickablePill = styled(Pill)`
  cursor: pointer;
  transition: all 0.2s ease;
  &:hover {
    border-color: ${A.accent};
    color: ${A.accent};
    background: ${A.accentDim};
  }
`;

const ClickableMetaVal = styled.span`
  cursor: pointer;
  transition: color 0.2s ease;
  &:hover {
    color: ${A.accent};
  }
`;

// ─── Tab navigation ───────────────────────────────────────────────────────────

const TabNav = styled.div`display: flex; border-bottom: 1px solid #e5e7eb;
  .dark-mode & { border-bottom: 1px solid ${A.border}; }
`;

const Tab = styled.button<{ $active?: boolean }>`
  padding: 0.7rem 1.25rem; background: none; border: none;
  border-bottom: 2px solid ${({ $active }) => $active ? A.accent : 'transparent'};
  margin-bottom: -1px;
  color: ${({ $active }) => $active ? '#1f2937' : '#6b7280'};
  font-size: 0.82rem; font-weight: ${({ $active }) => $active ? '700' : '500'};
  letter-spacing: 0.06em; text-transform: uppercase; cursor: pointer;
  transition: color 0.2s, border-color 0.2s;
  &:hover { color: ${A.text}; }
  .dark-mode & {
    color: ${({ $active }) => $active ? A.text : A.muted};
  }
  @media (max-width: 480px) {
    padding: 0.6rem 0.85rem;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
  }
`;

const Panel = styled.div`animation: ${fadeIn} 0.25s ease;`;

// ─── Overview ─────────────────────────────────────────────────────────────────

const Desc = styled.p`
  font-size: 0.88rem; line-height: 1.85; color: #4b5563; margin: 0;
  max-height: 260px;
  overflow-y: auto;
  padding-right: 6px;
  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: ${A.accent}; border-radius: 3px; }
  scrollbar-width: thin;
  scrollbar-color: ${A.accent} transparent;
  .dark-mode & { color: ${A.muted}; }
  @media (max-width: 860px) { max-height: 160px; }
`;

const TrailerBox = styled.div`
  position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;
  border-radius: 8px;
  iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
`;

// ─── Characters ───────────────────────────────────────────────────────────────

const CharGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 8px;
  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: ${A.accent}; border-radius: 3px; opacity: 0.7; }
  scrollbar-width: thin;
  scrollbar-color: ${A.accent} transparent;
  @media (max-width: 500px) {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
`;

const CharCard = styled.div`
  display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem;
  background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px;
  transition: border-color 0.2s;
  &:hover { border-color: ${A.accent}; }
  .dark-mode & {
    background: ${A.card};
    border: 1px solid ${A.border};
  }
`;
const CharImg  = styled.img`width: 44px; height: 60px; object-fit: cover; border-radius: 4px; flex-shrink: 0;`;
const CharName = styled.span`font-size: 0.82rem; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #1f2937;
  .dark-mode & { color: ${A.text}; }
`;
const CharRole = styled.span`font-size: 0.7rem; color: ${A.accent}; font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase;`;

// ─── Episode Controls ─────────────────────────────────────────────────────────

type EpView = 'card' | 'list' | 'number';

const EpControls = styled.div`
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  margin-bottom: 0.85rem;
`;

const RangePillRow = styled.div`
  display: flex; gap: 0.35rem; flex-wrap: wrap; width: 100%;
  margin-bottom: 0.5rem;
`;

const RangePill = styled.button<{ $active?: boolean }>`
  padding: 0.3rem 0.7rem; border-radius: 99px; font-size: 0.72rem; font-weight: 600;
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
  padding: 0.45rem 0.65rem; background: #ffffff; border: 1px solid #e5e7eb;
  border-radius: 6px; color: #1f2937; font-size: 0.8rem; cursor: pointer;
  outline: none;
  &:focus { border-color: ${A.accent}; }
  .dark-mode & {
    background: ${A.card};
    border: 1px solid ${A.border};
    color: ${A.text};
  }
`;

const SearchBox = styled.div`
  flex: 1; min-width: 140px; position: relative;
  svg { position: absolute; left: 0.65rem; top: 50%; transform: translateY(-50%); color: ${A.muted}; pointer-events: none; }
`;

const SearchInput = styled.input`
  width: 100%; padding: 0.45rem 0.75rem 0.45rem 2rem;
  background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px;
  color: #1f2937; font-size: 0.8rem; outline: none; box-sizing: border-box;
  &::placeholder { color: #9ca3af; }
  &:focus { border-color: ${A.accent}; }
  .dark-mode & {
    background: ${A.card};
    border: 1px solid ${A.border};
    color: ${A.text};
    &::placeholder { color: ${A.muted}; }
  }
`;

// ─── Segmented view toggle ────────────────────────────────────────────────────

const SegmentedControl = styled.div`
  display: flex;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
  .dark-mode & {
    background: ${A.card};
    border-color: ${A.border};
  }
`;

const SegmentOption = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.65rem;
  background: ${({ $active }) => $active ? A.accentDim : 'transparent'};
  color: ${({ $active }) => $active ? A.accent : '#6b7280'};
  border: none;
  border-right: 1px solid #e5e7eb;
  cursor: pointer;
  transition: all 0.15s;
  font-size: 0.8rem;
  
  &:last-child {
    border-right: none;
  }
  
  &:hover {
    color: ${A.accent};
  }
  
  .dark-mode & {
    color: ${({ $active }) => $active ? A.accent : A.muted};
    border-right-color: ${A.border};
  }
`;

// ─── Episode scroll container ─────────────────────────────────────────────────

const EpScrollArea = styled.div`
  max-height: 480px;
  overflow-y: auto;
  padding-right: 4px;
  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: ${A.accent}; border-radius: 3px; opacity: 0.7; }
  scrollbar-width: thin;
  scrollbar-color: ${A.accent} transparent;
  @media (max-width: 860px) { max-height: 420px; }
`;

// ─── Card view ────────────────────────────────────────────────────────────────

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.65rem;
  @media (max-width: 900px) { grid-template-columns: repeat(2, 1fr); }
  @media (max-width: 520px) {
    grid-template-columns: 1fr;
  }
`;

const EpisodeCardItem = styled.div`
  display: flex; gap: 0.65rem; padding: 0.6rem;
  background: #ffffff; border: 1px solid #e5e7eb; border-radius: 6px;
  cursor: pointer; transition: border-color 0.15s, background 0.15s;
  &:hover { border-color: ${A.accent}; background: ${A.accentGlow}; }
  .dark-mode & {
    background: ${A.card};
    border: 1px solid ${A.border};
  }
`;

const CardThumbWrap = styled.div`
  position: relative; flex-shrink: 0; border-radius: 4px; overflow: hidden;
  width: 88px; height: 58px;
`;

const CardThumb = styled.img`
  width: 100%; height: 100%; object-fit: cover; display: block;
`;

const CardEpBadge = styled.span`
  position: absolute; bottom: 3px; left: 3px;
  background: rgba(0,0,0,0.75); color: #fff;
  font-size: 0.64rem; font-weight: 700; padding: 1px 5px; border-radius: 3px;
  letter-spacing: 0.03em;
`;

const CardBody = styled.div`flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between;`;

const CardTitle = styled.span`
  font-size: 0.78rem; font-weight: 600; line-height: 1.3;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
  color: #1f2937;
  .dark-mode & { color: ${A.text}; }
`;

const CardMeta = styled.div`
  display: flex; align-items: center; gap: 0.4rem; margin-top: 0.3rem; flex-wrap: wrap;
`;

const CardDate = styled.span`font-size: 0.68rem; color: #6b7280;
  .dark-mode & { color: ${A.muted}; }
`;

const CardIcons = styled.div`display: flex; gap: 0.25rem; align-items: center; margin-left: auto;`;

const SmIcon = styled.span`color: ${A.muted}; font-size: 0.7rem; display: flex; align-items: center;`;

// ─── List view ────────────────────────────────────────────────────────────────

const ListGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.35rem;
  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const ListItem = styled.div<{ $first?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.55rem;
  padding: 0.42rem 0.65rem;
  background: ${({ $first }) => $first ? A.accentDim : '#ffffff'};
  border: 1px solid ${({ $first }) => $first ? A.accent : '#e5e7eb'};
  border-radius: 6px;
  cursor: pointer;
  min-width: 0;
  transition: border-color 0.15s, background 0.15s;
  &:hover { border-color: ${A.accent}; background: ${A.accentGlow}; }
  .dark-mode & {
    background: ${({ $first }) => $first ? A.accentDim : A.card};
    border: 1px solid ${({ $first }) => $first ? A.accent : A.border};
  }
`;

const ListPlayIcon = styled.span`
  color: ${A.accent}; display: flex; align-items: center; flex-shrink: 0;
`;

const ListEpNum = styled.span`
  font-size: 0.68rem;
  color: ${A.accent};
  font-weight: 700;
  flex-shrink: 0;
  min-width: 2.2rem;
`;

const ListTitle = styled.span`
  font-size: 0.8rem;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
  .dark-mode & { color: ${A.text}; }
`;

const ListIcons = styled.div`
  display: flex;
  gap: 0.25rem;
  align-items: center;
  flex-shrink: 0;
  padding-left: 0.25rem;
`;

// ─── Number grid view ─────────────────────────────────────────────────────────

const NumGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: 0.35rem;
`;

const NumCell = styled.div<{ $active?: boolean; $filler?: boolean; $first?: boolean }>`
  display: flex; align-items: center; justify-content: center;
  height: 44px; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 600;
  background: ${({ $active, $first, $filler }) =>
    $first   ? A.accentDim :
    $filler  ? 'rgba(192,132,252,0.08)' :
    $active  ? 'rgba(192,132,252,0.12)' :
    '#ffffff'};
  border: 1px solid ${({ $active, $first }) =>
    $first  ? A.accent :
    $active ? 'rgba(192,132,252,0.4)' :
    '#e5e7eb'};
  color: ${({ $first }) => $first ? A.accent : '#1f2937'};
  transition: border-color 0.15s, background 0.15s;
  &:hover { border-color: ${A.accent}; color: ${A.accent}; }
  .dark-mode & {
    background: ${({ $active, $first, $filler }) =>
      $first   ? A.accentDim :
      $filler  ? 'rgba(192,132,252,0.08)' :
      $active  ? 'rgba(192,132,252,0.12)' :
      A.card};
    border: 1px solid ${({ $active, $first }) =>
      $first  ? A.accent :
      $active ? 'rgba(192,132,252,0.4)' :
      A.border};
    color: ${({ $first }) => $first ? A.accent : A.text};
  }
`;

// ─── Full-width sections (Recommendations + Related) ─────────────────────────

const FullWidthSection = styled.div`
  margin-top: 2.5rem;
  padding-top: 2rem;
  border-top: 1px solid #e5e7eb;
  position: relative;
  z-index: 2;
  .dark-mode & {
    border-top: 1px solid ${A.border};
  }
  @media (max-width: 860px) {
    margin-top: 1.75rem;
    padding-top: 1.5rem;
    padding-left: 0.75rem;
    padding-right: 0.75rem;
  }
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const SectionLabel = styled.div`
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #6b7280;
  &::before {
    content: '';
    display: inline-block;
    width: 12px;
    height: 2px;
    background: ${A.accent};
    margin-right: 0.5rem;
    vertical-align: middle;
  }
  .dark-mode & {
    color: ${A.muted};
  }
`;

const ScrollBtnRow = styled.div`
  display: flex;
  gap: 0.4rem;
  @media (max-width: 860px) {
    display: none;
  }
`;

const ScrollBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid ${A.border};
  background: ${A.card};
  color: ${A.text};
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  &:hover {
    border-color: ${A.accent};
    color: ${A.accent};
  }
`;

const StyledCardGrid = styled.div`
  display: flex;
  gap: 0.9rem;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 0.5rem;
  scroll-snap-type: x mandatory;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar {
    display: block;
    height: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: ${A.accent};
    border-radius: 3px;
  }
  scrollbar-width: thin;
  scrollbar-color: ${A.accent} transparent;

  & > * {
    flex: 0 0 auto;
    width: 150px;
    scroll-snap-align: start;
  }

  @media (max-width: 800px) {
    gap: 0.75rem;
    & > * { width: 130px; }
    &::-webkit-scrollbar { display: none; }
    scrollbar-width: none;
  }

  @media (max-width: 450px) {
    gap: 0.6rem;
    & > * { width: 115px; }
  }
`;

// ─── States ───────────────────────────────────────────────────────────────────

const Loader = styled.div`
  min-height: 60vh; display: flex; align-items: center; justify-content: center;
  color: ${A.accent}; font-size: 0.9rem; letter-spacing: 0.2em; text-transform: uppercase;
`;

const ErrorWrap = styled.div`
  text-align: center; padding: 6rem 2rem;
  h2 { color: #f87171; margin-bottom: 0.75rem; }
  p  { color: ${A.muted}; margin-bottom: 2rem; font-size: 0.9rem; }
`;

const PrimaryBtn = styled.button`
  padding: 0.7rem 1.5rem; background: ${A.accent}; color: #0a0a0c; border: none; border-radius: 4px;
  font-weight: 800; font-size: 0.82rem; letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer;
`;

// ─── Types ────────────────────────────────────────────────────────────────────

type InfoTab = 'overview' | 'characters' | 'episodes';

const RANGE = 100;

// ─── Component ────────────────────────────────────────────────────────────────

const Info: React.FC = () => {
  const { animeId } = useParams<{ animeId?: string }>();
  const navigate    = useNavigate();

  const [animeInfo, setAnimeInfo] = useState<Anime | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<InfoTab>('overview');

  // Episode controls
  const [epView,   setEpView]   = useState<EpView>('card');
  const [epSearch, setEpSearch] = useState('');
  const [epRange,  setEpRange]  = useState(0);

  // Scroll refs for full-width sections
  const recsRef    = useRef<HTMLDivElement>(null);
  const relatedRef = useRef<HTMLDivElement>(null);

  const scrollSection = (ref: React.RefObject<HTMLDivElement>, dir: 'left' | 'right') => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' });
  };

  useEffect(() => {
    if (!animeId) { setError('Anime ID not found'); setLoading(false); return; }
    setLoading(true);
    setError(null);
    setAnimeInfo(null);
    (async () => {
      try {
        const data = await fetchAnimeInfo(animeId, 'kickassanime');
        setAnimeInfo(data);
      } catch {
        try {
          const data = await fetchAnimeData(animeId, 'kickassanime');
          setAnimeInfo(data);
        } catch {
          setError('Failed to load anime information.');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [animeId]);

  // Reset episode controls when anime changes
  useEffect(() => {
    setEpRange(0);
    setEpSearch('');
  }, [animeId]);

  useEffect(() => {
    if (animeInfo?.title) {
      const name = animeInfo.title.english || animeInfo.title.romaji || '';
      document.title = name ? `${name} · Zenime` : 'Zenime';
    }
  }, [animeInfo]);

  const ranges = useMemo(() => {
    const eps = animeInfo?.episodes ?? [];
    if (!eps.length) return [];
    const chunks: Episode[][] = [];
    for (let i = 0; i < eps.length; i += RANGE) chunks.push(eps.slice(i, i + RANGE));
    return chunks;
  }, [animeInfo?.episodes]);

  useEffect(() => {
    if (ranges.length > 0 && epRange >= ranges.length) {
      setEpRange(0);
    }
  }, [ranges, epRange]);

  const currentEps = useMemo(() => {
    const chunk = ranges[epRange] ?? [];
    if (!epSearch.trim()) return chunk;
    const q = epSearch.toLowerCase();
    return chunk.filter(ep =>
      String(ep.number).includes(q) ||
      (ep.title ?? '').toLowerCase().includes(q)
    );
  }, [ranges, epRange, epSearch]);

  // Flatten relations from AnimeDataList into a usable array for card rendering
  // Must be defined before early returns to maintain consistent hook order
  const relatedAnime = useMemo(() => {
    if (!animeInfo?.relations?.length) return [];
    return animeInfo.relations.flatMap((rel: any) =>
      rel.nodes ? rel.nodes : [rel]
    ).filter(Boolean);
  }, [animeInfo?.relations]);

  // Process recommendations - must be before early returns for hook consistency
  const recommendations = useMemo(() => {
    return animeInfo?.recommendations?.slice(0, 16) ?? [];
  }, [animeInfo?.recommendations]);

  // Determine if scroll buttons are needed (more than 1 row worth of items)
  const recsNeedScroll = recommendations.length > 5;
  const relatedNeedScroll = relatedAnime.length > 5;

  if (loading) return <Loader>Loading…</Loader>;
  if (error || !animeInfo) return (
    <ErrorWrap>
      <h2>Something went wrong</h2>
      <p>{error ?? 'Anime not found.'}</p>
      <PrimaryBtn onClick={() => navigate('/home')}>Back to Home</PrimaryBtn>
    </ErrorWrap>
  );

  const banner = animeInfo.cover || animeInfo.image;
  const cover  = animeInfo.image;
  const title  = animeInfo.title.english || animeInfo.title.romaji || '';
  const romaji = animeInfo.title.romaji;

  const metaItems: { key: string; val: string; onClick?: () => void }[] = [
    animeInfo.totalEpisodes != null && { key: 'Episodes', val: String(animeInfo.totalEpisodes) },
    animeInfo.duration        && { key: 'Duration',  val: `${animeInfo.duration} min` },
    animeInfo.season          && { key: 'Season',    val: animeInfo.season.toUpperCase(), onClick: () => navigate(`/search?season=${animeInfo.season?.toUpperCase()}`) },
    animeInfo.releaseDate     && { key: 'Year',      val: String(animeInfo.releaseDate), onClick: () => navigate(`/search?year=${animeInfo.releaseDate}`) },
    animeInfo.status          && { key: 'Status',    val: animeInfo.status },
    animeInfo.type            && { key: 'Format',    val: animeInfo.type, onClick: () => navigate(`/search?type=${encodeURIComponent(animeInfo.type!)}`) },
    animeInfo.title.native    && { key: 'Native',    val: animeInfo.title.native },
    animeInfo.studios?.length > 0 && { key: 'Studio', val: animeInfo.studios.join(', '), onClick: () => navigate(`/studio/${animeInfo.studioIds?.[0]}`) },
  ].filter(Boolean) as { key: string; val: string; onClick?: () => void }[];

  const usePills = ranges.length <= 10;

  const isFirst = (idx: number) => idx === 0 && epRange === 0 && !epSearch.trim();

  return (
    <PageWrapper>
      {/* ── Hero ── */}
      <HeroWrap>
        <HeroImg src={banner} alt="" />
        <HeroGrade />
        <ScanShimmer />
        <HeroAccentBar />
      </HeroWrap>

      {/* ── Body ── */}
      <Shell>

        {/* ── Mobile header: poster + title side-by-side ── */}
        <MobileHeader>
          <MobilePosterWrap>
            <MobilePosterImg src={animeInfo.image} alt={title} />
            {animeInfo.rating != null && <MobilePosterScore>{animeInfo.rating}%</MobilePosterScore>}
          </MobilePosterWrap>
          <MobileTitleBlock>
            <MobileEyebrow>{animeInfo.type || 'Anime'}{animeInfo.releaseDate ? ` · ${animeInfo.releaseDate}` : ''}</MobileEyebrow>
            <MobileTitle>{title}</MobileTitle>
            {romaji && romaji !== title && <MobileRomaji>{romaji}</MobileRomaji>}
            <MobilePillRow>
              {animeInfo.status && <Pill $accent>{animeInfo.status}</Pill>}
              {animeInfo.genres?.slice(0, 3).map((g, i) => <ClickablePill key={i} onClick={() => navigate(`/search?genres=${encodeURIComponent(g)}`)}>{g}</ClickablePill>)}
            </MobilePillRow>
          </MobileTitleBlock>
        </MobileHeader>

        <Grid>
          {/* ── LEFT — desktop poster ── */}
          <LeftCol>
            <PosterWrap>
              <PosterImg src={animeInfo.image} alt={title} />
              {animeInfo.rating != null && <ScoreBadge>{animeInfo.rating}%</ScoreBadge>}
            </PosterWrap>

            <PosterActions>
              <WatchBtn onClick={() => navigate(`/watch/${animeInfo.id}`)}>
                <FaPlay size={11} /> Watch
              </WatchBtn>
              <ExtRow>
                <ExtBtn href={`https://anilist.co/anime/${animeInfo.id}`} target="_blank" rel="noopener noreferrer" title="AniList">
                  <SiAnilist size={16} />
                </ExtBtn>
                {animeInfo.malId && (
                  <ExtBtn href={`https://myanimelist.net/anime/${animeInfo.malId}`} target="_blank" rel="noopener noreferrer" title="MyAnimeList">
                    <SiMyanimelist size={20} />
                  </ExtBtn>
                )}
              </ExtRow>

              <SidebarMeta>
                {animeInfo.totalEpisodes != null && (
                  <SideMetaRow><SideMetaKey>Episodes</SideMetaKey><SideMetaVal>{animeInfo.totalEpisodes}</SideMetaVal></SideMetaRow>
                )}
                {animeInfo.duration && (
                  <SideMetaRow><SideMetaKey>Duration</SideMetaKey><SideMetaVal>{animeInfo.duration} min</SideMetaVal></SideMetaRow>
                )}
                 {animeInfo.season && (
                   <SideMetaRow><SideMetaKey>Season</SideMetaKey><SideMetaVal><ClickableMetaVal onClick={() => navigate(`/search?season=${animeInfo.season?.toUpperCase()}`)}>{animeInfo.season.toUpperCase()}</ClickableMetaVal></SideMetaVal></SideMetaRow>
                 )}
                {animeInfo.releaseDate && (
                  <SideMetaRow><SideMetaKey>Year</SideMetaKey><SideMetaVal><ClickableMetaVal onClick={() => navigate(`/search?year=${animeInfo.releaseDate}`)}>{animeInfo.releaseDate}</ClickableMetaVal></SideMetaVal></SideMetaRow>
                )}
                {animeInfo.status && (
                  <SideMetaRow><SideMetaKey>Status</SideMetaKey><SideMetaVal>{animeInfo.status}</SideMetaVal></SideMetaRow>
                )}
                {animeInfo.type && (
                  <SideMetaRow><SideMetaKey>Format</SideMetaKey><SideMetaVal><ClickableMetaVal onClick={() => navigate(`/search?type=${encodeURIComponent(animeInfo.type!)}`)}>{animeInfo.type}</ClickableMetaVal></SideMetaVal></SideMetaRow>
                )}
                {animeInfo.title.native && (
                  <SideMetaRow><SideMetaKey>Native</SideMetaKey><SideMetaVal>{animeInfo.title.native}</SideMetaVal></SideMetaRow>
                )}
                {animeInfo.studios?.length > 0 && (
                  <SideMetaRow><SideMetaKey>Studio</SideMetaKey><SideMetaVal><ClickableMetaVal onClick={() => navigate(`/studio/${animeInfo.studioIds?.[0]}`)}>{animeInfo.studios.join(', ')}</ClickableMetaVal></SideMetaVal></SideMetaRow>
                )}
              </SidebarMeta>
            </PosterActions>
          </LeftCol>

          {/* ── RIGHT ── */}
          <RightCol>

            {/* Mobile: action bar */}
            <MobileActionBar>
              <MobileWatchBtn onClick={() => navigate(`/watch/${animeInfo.id}`)}>
                <FaPlay size={10} /> Watch
              </MobileWatchBtn>
              <MobileExtBtn href={`https://anilist.co/anime/${animeInfo.id}`} target="_blank" rel="noopener noreferrer" title="AniList">
                <SiAnilist size={15} />
              </MobileExtBtn>
              {animeInfo.malId && (
                <MobileExtBtn href={`https://myanimelist.net/anime/${animeInfo.malId}`} target="_blank" rel="noopener noreferrer" title="MyAnimeList">
                  <SiMyanimelist size={18} />
                </MobileExtBtn>
              )}
            </MobileActionBar>

            {/* Mobile: compact meta grid */}
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

            {/* Desktop: title block */}
            <DesktopTitleBlock>
              <EyeBrow>{animeInfo.type || 'Anime'}{animeInfo.releaseDate ? ` · ${animeInfo.releaseDate}` : ''}</EyeBrow>
              <MainTitle>{title}</MainTitle>
              {romaji && romaji !== title && <RomajiSub>{romaji}</RomajiSub>}
              <PillRow>
                {animeInfo.status && <Pill $accent>{animeInfo.status}</Pill>}
                {animeInfo.rating != null && <Pill>{animeInfo.rating}% Score</Pill>}
                {animeInfo.genres?.slice(0, 5).map((g, i) => <ClickablePill key={i} onClick={() => navigate(`/search?genres=${encodeURIComponent(g)}`)}>{g}</ClickablePill>)}
              </PillRow>
            </DesktopTitleBlock>

            {/* Tabs */}
            <TabNav>
              {(['overview', 'characters', 'episodes'] as InfoTab[]).map(t => (
                <Tab key={t} $active={activeTab === t} onClick={() => setActiveTab(t)}>{t}</Tab>
              ))}
            </TabNav>

            {/* ── Overview ── */}
            {activeTab === 'overview' && (
              <Panel>
                {animeInfo.trailer?.id && (
                  <TrailerBox>
                    <iframe
                      src={`https://www.youtube.com/embed/${animeInfo.trailer.id}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title="Trailer"
                    />
                  </TrailerBox>
                )}
                {animeInfo.description && (
                  <Desc style={{ marginTop: animeInfo.trailer?.id ? '1.25rem' : 0 }}>
                    {animeInfo.description.replace(/<[^>]*>/g, '')}
                  </Desc>
                )}
                {!animeInfo.description && !animeInfo.trailer?.id && (
                  <Desc>No overview available.</Desc>
                )}
              </Panel>
            )}

            {/* ── Characters ── */}
            {activeTab === 'characters' && (
              <Panel>
                {animeInfo.characters?.length > 0 ? (
                  <CharGrid>
                    {animeInfo.characters.slice(0, 24).map(c => (
                      <CharCard key={c.id}>
                        <CharImg src={c.image} alt={c.name.userPreferred} />
                        <div style={{ minWidth: 0 }}>
                          <CharName>{c.name.userPreferred}</CharName>
                          <CharRole>{c.role}</CharRole>
                        </div>
                      </CharCard>
                    ))}
                  </CharGrid>
                ) : <Desc>No character data available.</Desc>}
              </Panel>
            )}

            {/* ── Episodes ── */}
            {activeTab === 'episodes' && (
              <Panel>
                {animeInfo.episodes?.length > 0 ? (
                  <>
                    {/* Range selector */}
                    {ranges.length > 1 && (
                      usePills ? (
                        <RangePillRow>
                          {ranges.map((chunk, i) => (
                            <RangePill
                              key={i}
                              $active={epRange === i}
                              onClick={() => { setEpRange(i); setEpSearch(''); }}
                            >
                              {chunk[0].number}–{chunk[chunk.length - 1].number}
                            </RangePill>
                          ))}
                        </RangePillRow>
                      ) : (
                        <RangePillRow>
                          <RangeSelect
                            value={epRange}
                            onChange={e => { setEpRange(Number(e.target.value)); setEpSearch(''); }}
                          >
                            {ranges.map((chunk, i) => (
                              <option key={i} value={i}>
                                {chunk[0].number} – {chunk[chunk.length - 1].number}
                              </option>
                            ))}
                          </RangeSelect>
                        </RangePillRow>
                      )
                    )}

                    {/* Controls bar */}
                    <EpControls>
                      <SearchBox>
                        <FaSearch size={11} />
                        <SearchInput
                          placeholder="Filter episodes..."
                          value={epSearch}
                          onChange={e => setEpSearch(e.target.value)}
                        />
                      </SearchBox>

                      <SegmentedControl>
                        <SegmentOption
                          $active={epView === 'card'}
                          onClick={() => setEpView('card')}
                          title="Card view"
                        >
                          <BsEye size={15} />
                        </SegmentOption>
                        <SegmentOption
                          $active={epView === 'list'}
                          onClick={() => setEpView('list')}
                          title="List view"
                        >
                          <MdViewList size={16} />
                        </SegmentOption>
                        <SegmentOption
                          $active={epView === 'number'}
                          onClick={() => setEpView('number')}
                          title="Number view"
                        >
                          <MdGridOn size={15} />
                        </SegmentOption>
                      </SegmentedControl>
                    </EpControls>

                    {/* No results state */}
                    {currentEps.length === 0 && (
                      <Desc>No episodes match your search.</Desc>
                    )}

                    {/* Scrollable episode area */}
                    {currentEps.length > 0 && (
                      <EpScrollArea>

                        {/* ── Card view ── */}
                        {epView === 'card' && (
                          <CardGrid>
                            {currentEps.map((ep) => (
                              <EpisodeCardItem key={ep.id} onClick={() => navigate(`/watch/${animeInfo.id}?ep=${ep.number}`)}>
                                <CardThumbWrap>
                                  <CardThumb src={ep.image || cover} alt={ep.title || ''} />
                                  <CardEpBadge>EP {ep.number}</CardEpBadge>
                                </CardThumbWrap>
                                <CardBody>
                                  <CardTitle>{ep.title || `Episode ${ep.number}`}</CardTitle>
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

                        {/* ── List view ── */}
                        {epView === 'list' && (
                          <ListGrid>
                            {currentEps.map((ep, idx) => (
                              <ListItem
                                key={ep.id}
                                $first={isFirst(idx)}
                                onClick={() => navigate(`/watch/${animeInfo.id}?ep=${ep.number}`)}
                              >
                                {isFirst(idx)
                                  ? <ListPlayIcon><FaPlay size={10} /></ListPlayIcon>
                                  : <ListEpNum>EP {ep.number}</ListEpNum>
                                }
                                <ListTitle title={ep.title || `Episode ${ep.number}`}>
                                  {ep.title || `Episode ${ep.number}`}
                                </ListTitle>
                                <ListIcons>
                                  <SmIcon><FaClosedCaptioning size={10} /></SmIcon>
                                  <SmIcon><FaMicrophone size={10} /></SmIcon>
                                </ListIcons>
                              </ListItem>
                            ))}
                          </ListGrid>
                        )}

                        {/* ── Number grid view ── */}
                        {epView === 'number' && (
                          <NumGrid>
                            {currentEps.map((ep, idx) => (
                              <NumCell
                                key={ep.id}
                                $first={isFirst(idx)}
                                onClick={() => navigate(`/watch/${animeInfo.id}?ep=${ep.number}`)}
                                title={ep.title || `Episode ${ep.number}`}
                              >
                                {isFirst(idx) ? <FaPlay size={10} /> : ep.number}
                              </NumCell>
                            ))}
                          </NumGrid>
                        )}

                      </EpScrollArea>
                    )}
                  </>
                ) : <Desc>No episodes available yet.</Desc>}
              </Panel>
            )}

          </RightCol>
        </Grid>

        {/* ── Recommendations — full width below grid ── */}
        {recommendations.length > 0 && (
          <FullWidthSection>
            <SectionHeader>
              <SectionLabel>You might also like</SectionLabel>
              {recsNeedScroll && (
                <ScrollBtnRow>
                  <ScrollBtn onClick={() => scrollSection(recsRef, 'left')} aria-label="Scroll left">
                    <FaChevronLeft size={12} />
                  </ScrollBtn>
                  <ScrollBtn onClick={() => scrollSection(recsRef, 'right')} aria-label="Scroll right">
                    <FaChevronRight size={12} />
                  </ScrollBtn>
                </ScrollBtnRow>
              )}
            </SectionHeader>
            <StyledCardGrid ref={recsRef}>
              {recommendations.map(r => (
                <AnimeCardItem key={r.id} anime={r as unknown as Anime} />
              ))}
            </StyledCardGrid>
          </FullWidthSection>
        )}

        {/* ── Related — full width below recommendations, using AnimeCardItem ── */}
        {relatedAnime.length > 0 && (
          <FullWidthSection>
            <SectionHeader>
              <SectionLabel>Related</SectionLabel>
              {relatedNeedScroll && (
                <ScrollBtnRow>
                  <ScrollBtn onClick={() => scrollSection(relatedRef, 'left')} aria-label="Scroll left">
                    <FaChevronLeft size={12} />
                  </ScrollBtn>
                  <ScrollBtn onClick={() => scrollSection(relatedRef, 'right')} aria-label="Scroll right">
                    <FaChevronRight size={12} />
                  </ScrollBtn>
                </ScrollBtnRow>
              )}
            </SectionHeader>
            <StyledCardGrid ref={relatedRef}>
              {relatedAnime.slice(0, 16).map((r: any) => (
                <AnimeCardItem key={r.id} anime={r as unknown as Anime} />
              ))}
            </StyledCardGrid>
          </FullWidthSection>
        )}

      </Shell>
    </PageWrapper>
  );
};

export default Info;