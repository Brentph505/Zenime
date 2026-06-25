import React, { useState, useMemo, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { FaPlay, FaSortAmountDown, FaSortAmountUp, FaSearch, FaTrashAlt } from 'react-icons/fa';
import { IoIosCloseCircleOutline, IoIosArrowDown } from 'react-icons/io';
import { Episode } from '../index';
import { MangaGrid } from '../components/Home/MangaGrid';
import { MangaCard } from '../components/Home/MangaCard';
import {
  getMangaBookmarks,
} from '../lib/mangaHistory';
import { safeLocalStorageSet } from '../lib/safeStorage';

type AniListStatus =
  | 'CURRENT'
  | 'PLANNING'
  | 'COMPLETED'
  | 'DROPPED'
  | 'PAUSED'
  | 'REPEATING';

type StatusFilter = 'all' | 'bookmarked' | AniListStatus;
type SortOption = 'lastWatched' | 'alphabetical' | 'progress' | 'airDate';
type SortOrder = 'asc' | 'desc';
type ContentType = 'anime' | 'manga';

interface LastVisitedData {
  [key: string]: {
    timestamp?: number;
    titleEnglish?: string;
    titleRomaji?: string;
    status?: AniListStatus;
    coverImage?: string;
  };
}

interface AnimeWatchData {
  animeId: string;
  titleEnglish?: string;
  titleRomaji?: string;
  coverImage?: string;
  episodes: Episode[];
  timestamp: number;
  playbackPercentage: number;
  lastEpisodeNumber: string | number;
  lastEpisodeTitle?: string;
  lastChapterId?: string;
  status?: AniListStatus;
  type: ContentType;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateLabel = (timestamp: number) =>
  new Date(timestamp).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

const safeTitle = (val: any, key: 'english' | 'romaji'): string => {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object' && key in val) return (val as any)[key];
  return '';
};

// ─── Layout ──────────────────────────────────────────────────────────────────

const Container = styled.div`
  padding: 0.25rem;
  max-width: 125rem;
  margin: 0 auto;
  box-sizing: border-box;

  @media (min-width: 768px) {
    padding: 0.5rem;
  }
`;

const PageTitle = styled.h2`
  color: var(--global-text);
  font-size: 1.25rem;
  font-weight: bold;
  margin-bottom: 1rem;
`;

const ControlBar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  padding: 0.75rem;
  border-radius: var(--global-border-radius);
  background-color: var(--global-secondary-bg);
  border: 1px solid var(--global-border);
  margin-bottom: 1rem;

  @media (min-width: 768px) {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 1rem;
  }
`;

// ── Search ─────────────────────────────────────────────────────────────────────

const SearchRow = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;

  @media (min-width: 768px) {
    flex: 1;
    min-width: 0;
  }
`;

const SearchIconWrapper = styled.span`
  position: absolute;
  left: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--global-text-secondary);
  font-size: 0.8rem;
  pointer-events: none;
  display: flex;
  align-items: center;
  z-index: 1;
`;

const SearchInput = styled.input`
  width: 100%;
  background-color: var(--global-card-bg);
  color: var(--global-text);
  border: 1px solid var(--global-border);
  border-radius: 0.5rem;
  padding: 0.55rem 0.75rem 0.55rem 2.25rem;
  font-size: 0.85rem;
  box-sizing: border-box;
  transition: all 0.2s ease-in-out;

  &::placeholder {
    color: var(--global-text-muted);
  }

  &:hover {
    background-color: var(--global-tertiary-bg);
    border-color: var(--global-border);
  }

  &:focus {
    outline: none;
    border-color: var(--primary-accent);
    box-shadow: 0 0 0 2px rgba(var(--primary-accent), 0.15);
  }
`;

// ── Filter row ─────────────────────────────────────────────────────────────────

const FilterRow = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.3rem;

  @media (min-width: 768px) {
    flex-direction: row;
    flex-wrap: nowrap;
    align-items: center;
    flex-shrink: 0;
    gap: 0.35rem;
  }
`;

const FilterTop = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;

  @media (min-width: 768px) {
    display: contents;
  }
`;

const FilterBottom = styled.div`
  display: flex;
  align-items: center;
  gap: 0.3rem;

  @media (min-width: 768px) {
    display: contents;
  }
`;

// ── Selects ────────────────────────────────────────────────────────────────────

const SelectWrapper = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;

  @media (min-width: 768px) {
    flex: 0 0 auto;
    min-width: 140px;
    order: 2;
  }
`;

const StyledSelect = styled.select`
  width: 100%;
  appearance: none;
  background-color: var(--global-card-bg);
  color: var(--global-text);
  border: 1px solid var(--global-border);
  border-radius: 0.5rem;
  padding: 0.5rem 1.85rem 0.5rem 0.7rem;
  font-size: 0.82rem;
  cursor: pointer;
  box-sizing: border-box;
  transition: all 0.2s ease-in-out;

  @media (min-width: 768px) {
    padding: 0.575rem 2rem 0.575rem 0.8rem;
    font-size: 0.85rem;
  }

  &:hover {
    background-color: var(--global-tertiary-bg);
    border-color: var(--global-border);
  }

  &:focus {
    outline: none;
    border-color: var(--primary-accent);
    box-shadow: 0 0 0 2px rgba(var(--primary-accent), 0.15);
  }

  option {
    background-color: var(--global-card-bg);
    color: var(--global-text);
    padding: 0.5rem;
  }

  option:checked {
    background-color: var(--primary-accent);
    color: #ffffff;
  }
`;

const SelectChevron = styled.span`
  position: absolute;
  right: 0.6rem;
  display: flex;
  align-items: center;
  color: var(--global-text-secondary);
  pointer-events: none;
  font-size: 0.9rem;
`;

// ── Sort-order toggle button ───────────────────────────────────────────────────

const SortButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.7rem;
  border: 1px solid var(--global-border);
  border-radius: 0.5rem;
  background-color: var(--global-card-bg);
  color: var(--global-text);
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  flex-shrink: 0;

  @media (min-width: 768px) {
    padding: 0.575rem 0.75rem;
    order: 4;
  }

  &:hover {
    background-color: var(--global-tertiary-bg);
    border-color: var(--global-border);
  }

  &:focus {
    outline: none;
    border-color: var(--primary-accent);
  }

  svg {
    font-size: 0.9rem;
  }
`;

// ── Clear-all + bookmark-only toggle ─────────────────────────────────────────

const ClearAllButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  padding: 0.5rem 0.7rem;
  border: 1px solid rgba(239, 68, 68, 0.35);
  border-radius: 0.5rem;
  background-color: transparent;
  color: rgba(239, 68, 68, 0.85);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
  font-size: 0.78rem;
  font-weight: 600;

  @media (min-width: 768px) {
    padding: 0.575rem 0.75rem;
    order: 5;
  }

  &:hover {
    background-color: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.6);
  }

  &:focus {
    outline: none;
    border-color: rgba(239, 68, 68, 0.8);
  }

  svg {
    font-size: 0.85rem;
  }
`;

// ── ANIME / MANGA tabs ────────────────────────────────────────────────────────

const TabGroup = styled.div`
  display: flex;
  background-color: var(--global-tertiary-bg);
  border: 1px solid var(--global-border);
  border-radius: 0.5rem;
  padding: 0.15rem;
  flex: 1;

  @media (min-width: 768px) {
    flex: 0 0 auto;
    width: fit-content;
    padding: 0.2rem;
    order: 1;
  }
`;

const TabButton = styled.button<{ $active: boolean }>`
  flex: 1;
  padding: 0.4rem 0.75rem;
  border: none;
  background-color: ${({ $active }) =>
    $active ? 'var(--primary-accent)' : 'transparent'};
  color: ${({ $active }) =>
    $active ? '#ffffff' : 'var(--global-text-secondary)'};
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease-in-out;
  border-radius: 0.3rem;
  white-space: nowrap;
  letter-spacing: 0.04em;

  @media (min-width: 768px) {
    flex: 0 0 auto;
    padding: 0.475rem 1rem;
    font-size: 0.82rem;
  }

  &:hover {
    background-color: ${({ $active }) =>
      $active ? 'var(--primary-accent)' : 'rgba(255, 255, 255, 0.1)'};
  }

  &:focus {
    outline: none;
  }

  @media (prefers-color-scheme: light) {
    &:hover {
      background-color: ${({ $active }) =>
        $active ? 'var(--primary-accent)' : 'rgba(0, 0, 0, 0.1)'};
    }
  }
`;

// ─── Main content area ────────────────────────────────────────────────────────

const MainContent = styled.div`
  min-width: 0;
`;

const GridContainer = styled.div`
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, 1fr);

  @media (min-width: 700px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (min-width: 1000px) {
    grid-template-columns: repeat(5, 1fr);
  }

  @media (min-width: 1200px) {
    grid-template-columns: repeat(6, 1fr);
  }
`;

// ─── Date group header ────────────────────────────────────────────────────────

const DateGroup = styled.div`
  margin-bottom: 1.75rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const DateGroupHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.85rem;
`;

const DateLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--global-text);
  font-size: 1rem;
  font-weight: bold;
`;

const CountBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.35rem;
  height: 1.35rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background-color: var(--global-card-hover-shadow, rgba(255, 255, 255, 0.1));
  color: var(--global-text);
  font-size: 0.7rem;
  font-weight: 600;
`;

const RemoveGroupButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--global-text-secondary);
  cursor: pointer;
  padding: 0.2rem;
  border-radius: var(--global-border-radius);
  transition: color 0.2s ease-in-out;

  svg {
    font-size: 1.4rem;
  }

  &:hover,
  &:focus {
    color: var(--global-text);
  }
`;

// ─── Anime card sub-elements ──────────────────────────────────────────────────

const PlayIcon = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffffff;
  font-size: 2.5rem;
  opacity: 0;
  z-index: 1;
  transition: opacity 0.2s ease-in-out;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
`;

const AnimeCloseButton = styled.button`
  position: absolute;
  top: 0;
  right: 0;
  background: transparent;
  border: none;
  color: #ffffff;
  cursor: pointer;
  display: none;
  transition: 0.2s ease-in-out;
  padding: 0.2rem 0.2rem 0 0;
  z-index: 2;

  svg {
    font-size: 2.25rem;
    transition: transform 0.2s ease-in-out;
    transform: scale(0.95);

    &:hover,
    &:active,
    &:focus {
      transform: scale(1);
    }
  }
`;

const AnimeProgressBar = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 0.25rem;
  border-radius: var(--global-border-radius);
  background-color: var(--primary-accent);
  transition: width 0.3s ease-in-out;
`;

const AnimeCard = styled(Link)`
  position: relative;
  display: flex;
  flex-direction: column;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  transition: box-shadow 0.2s ease-in-out;
  text-decoration: none;

  &:hover,
  &:active,
  &:focus {
    box-shadow: 2px 2px 10px var(--global-card-hover-shadow);

    ${PlayIcon} {
      opacity: 1;
    }

    img {
      filter: brightness(0.5);
    }

    ${AnimeCloseButton} {
      display: block;
    }
  }

  img {
    width: 100%;
    aspect-ratio: 16 / 9;
    object-fit: cover;
    transition: filter 0.2s ease-in-out;
    display: block;
  }

  .episode-info {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    padding: 0.5rem;
    background: linear-gradient(
      360deg,
      rgba(8, 8, 8, 1) -15%,
      transparent 100%
    );
    color: white;
    box-sizing: border-box;

    .episode-title {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 0.95rem;
      font-weight: bold;
      margin: 0.25rem 0 0;
    }

    .episode-number {
      font-size: 0.75rem;
      color: rgba(255, 255, 255, 0.65);
      margin: 0.15rem 0 0.35rem;
    }
  }
`;

// ─── Empty state ──────────────────────────────────────────────────────────────

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: var(--global-text-secondary);

  h2 {
    font-size: 1.5rem;
    margin-bottom: 1rem;
    color: var(--global-text);
  }

  p {
    font-size: 1rem;
    margin-bottom: 2rem;
  }

  a {
    color: var(--primary-accent);
    text-decoration: none;
    font-weight: bold;

    &:hover {
      text-decoration: underline;
    }
  }
`;

// ─── Component ────────────────────────────────────────────────────────────────

const History: React.FC = () => {
  // Separate state for anime and manga so each tab re-renders independently
  const [animeStorageData, setAnimeStorageData] = useState(
    () => localStorage.getItem('watched-episodes'),
  );
  const [mangaStorageData, setMangaStorageData] = useState(
    () => localStorage.getItem('read-chapters'),
  );

  const [sortBy, setSortBy] = useState<SortOption>('lastWatched');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [contentType, setContentType] = useState<ContentType>('anime');

  const lastAnimeVisited = useMemo<LastVisitedData>(() => {
    const data = localStorage.getItem('last-anime-visited');
    return data ? JSON.parse(data) : {};
  }, [animeStorageData]);

  const lastMangaVisited = useMemo<LastVisitedData>(() => {
    const data = localStorage.getItem('last-manga-visited');
    return data ? JSON.parse(data) : {};
  }, [mangaStorageData]);

  // Sync storage keys when any tab changes them (cross-tab via `storage`).
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'watched-episodes' || e.key === null) {
        setAnimeStorageData(localStorage.getItem('watched-episodes'));
      }
      if (
        e.key === 'read-chapters' ||
        e.key === 'last-manga-visited' ||
        e.key === null
      ) {
        setMangaStorageData(localStorage.getItem('read-chapters'));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // ── Build anime list ──────────────────────────────────────────────────────

  const animeList = useMemo<AnimeWatchData[]>(() => {
    if (!animeStorageData) return [];
    try {
      const allEpisodes: Record<string, Episode[]> =
        JSON.parse(animeStorageData);
      const playbackInfo = JSON.parse(
        localStorage.getItem('all_episode_times') || '{}',
      ) as Record<string, { playbackPercentage: number }>;

      return Object.entries(allEpisodes)
        .map(([animeId, episodes]) => {
          const lastEpisode = episodes[episodes.length - 1];
          return {
            animeId,
            titleEnglish: lastAnimeVisited[animeId]?.titleEnglish,
            titleRomaji: lastAnimeVisited[animeId]?.titleRomaji,
            coverImage: lastEpisode?.image,
            episodes,
            timestamp: lastAnimeVisited[animeId]?.timestamp || 0,
            playbackPercentage:
              playbackInfo[lastEpisode?.id]?.playbackPercentage || 0,
            lastEpisodeNumber: lastEpisode?.number ?? '',
            lastEpisodeTitle: lastEpisode?.title,
            status: lastAnimeVisited[animeId]?.status,
            type: 'anime' as ContentType,
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }, [animeStorageData, lastAnimeVisited]);

  // ── Build manga list ──────────────────────────────────────────────────────

  const mangaList = useMemo<AnimeWatchData[]>(() => {
    if (!mangaStorageData) return [];
    try {
      const allChapters: Record<string, Episode[]> =
        JSON.parse(mangaStorageData);
      const readingProgress = JSON.parse(
        localStorage.getItem('all_reading_times') || '{}',
      ) as Record<string, { playbackPercentage: number }>;

      return Object.entries(allChapters)
        .map(([mangaId, chapters]) => {
          const lastChapter = chapters[chapters.length - 1];
          const lastMangaData = lastMangaVisited[mangaId] as any;
          const coverImage =
            lastMangaData?.coverImage || lastChapter?.image || undefined;
          return {
            animeId: mangaId,
            titleEnglish: lastMangaVisited[mangaId]?.titleEnglish,
            titleRomaji: lastMangaVisited[mangaId]?.titleRomaji,
            coverImage: coverImage,
            episodes: chapters,
            timestamp: lastMangaVisited[mangaId]?.timestamp || 0,
            playbackPercentage:
              readingProgress[lastChapter?.id]?.playbackPercentage || 0,
            lastEpisodeNumber: lastChapter?.number ?? '',
            lastEpisodeTitle: lastChapter?.title,
            lastChapterId: lastChapter?.url || lastChapter?.id,
            status: lastMangaVisited[mangaId]?.status,
            type: 'manga' as ContentType,
          };
        })
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch {
      return [];
    }
  }, [mangaStorageData, lastMangaVisited]);

  // ── Active list (whichever tab is showing) ────────────────────────────────

  const activeList = contentType === 'anime' ? animeList : mangaList;

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const filteredAndSortedList = useMemo<AnimeWatchData[]>(() => {
    let list = [...activeList];

    // Manga-tab-only "bookmarked" filter (folded into the status dropdown).
    if (contentType === 'manga' && statusFilter === 'bookmarked') {
      const bookmarks = getMangaBookmarks();
      list = list.filter((item) => !!bookmarks[item.animeId]);
    } else if (statusFilter !== 'all' && statusFilter !== 'bookmarked') {
      list = list.filter((item) => item.status === statusFilter);
    }

    const query = searchQuery.trim().toLowerCase();
    if (query) {
      list = list.filter((item) => {
        const title = (
          safeTitle(item.titleEnglish, 'english') ||
          safeTitle(item.titleRomaji, 'romaji') ||
          ''
        ).toLowerCase();
        return title.includes(query);
      });
    }

    const direction = sortOrder === 'asc' ? 1 : -1;

    switch (sortBy) {
      case 'alphabetical':
        list.sort((a, b) => {
          const ta = (
            safeTitle(a.titleEnglish, 'english') ||
            safeTitle(a.titleRomaji, 'romaji') ||
            ''
          ).toLowerCase();
          const tb = (
            safeTitle(b.titleEnglish, 'english') ||
            safeTitle(b.titleRomaji, 'romaji') ||
            ''
          ).toLowerCase();
          return ta.localeCompare(tb) * direction;
        });
        break;
      case 'progress':
        list.sort(
          (a, b) => (a.playbackPercentage - b.playbackPercentage) * direction,
        );
        break;
      case 'airDate':
      case 'lastWatched':
      default:
        list.sort((a, b) => (a.timestamp - b.timestamp) * direction);
        break;
    }

    return list;
  }, [activeList, statusFilter, searchQuery, sortBy, sortOrder, contentType]);

  // ── Grouping ──────────────────────────────────────────────────────────────

  const groupedByDate = useMemo(() => {
    const map = new Map<string, AnimeWatchData[]>();
    filteredAndSortedList.forEach((item) => {
      const label = item.timestamp
        ? formatDateLabel(item.timestamp)
        : 'Unknown Date';
      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(item);
    });
    return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
  }, [filteredAndSortedList]);

  const groupedByLetter = useMemo(() => {
    const map = new Map<string, AnimeWatchData[]>();
    filteredAndSortedList.forEach((item) => {
      const title = String(
        safeTitle(item.titleEnglish, 'english') ||
          safeTitle(item.titleRomaji, 'romaji') ||
          'Unknown',
      );
      const firstLetter = title.charAt(0).toUpperCase();
      const letter = /[A-Z]/.test(firstLetter) ? firstLetter : '#';
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(item);
    });
    const sortedLetters = Array.from(map.keys()).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    });
    return sortedLetters.map((letter) => ({ letter, items: map.get(letter)! }));
  }, [filteredAndSortedList]);

  // ── Delete handlers ───────────────────────────────────────────────────────

  const removeFromHistory = useCallback(
    (ids: string[]) => {
      if (contentType === 'manga') {
        const updated = JSON.parse(
          localStorage.getItem('read-chapters') || '{}',
        );
        ids.forEach((id) => delete updated[id]);
        safeLocalStorageSet('read-chapters', JSON.stringify(updated));
        setMangaStorageData(JSON.stringify(updated));
      } else {
        const updated = JSON.parse(
          localStorage.getItem('watched-episodes') || '{}',
        );
        ids.forEach((id) => delete updated[id]);
        safeLocalStorageSet('watched-episodes', JSON.stringify(updated));
        setAnimeStorageData(JSON.stringify(updated));
      }
    },
    [contentType],
  );

  const handleDeleteItem = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      removeFromHistory([id]);
    },
    [removeFromHistory],
  );

  const handleDeleteGroup = useCallback(
    (ids: string[], e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      removeFromHistory(ids);
    },
    [removeFromHistory],
  );

  // Wipe the entire active tab's store. Confirms first. Bookmarks are cleared
  // via the shared helper (which also notifies listeners); anime/manga history
  // only clears their own key and leaves bookmarks intact.
  const handleClearAll = useCallback(() => {
    if (activeList.length === 0) return;
    const label =
      contentType === 'manga'
        ? 'all manga reading history'
        : 'all anime watch history';
    if (!window.confirm(`Are you sure you want to remove ${label}? This cannot be undone.`)) {
      return;
    }

    removeFromHistory(activeList.map((item) => item.animeId));
  }, [contentType, activeList, removeFromHistory]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderAnimeCard = (anime: AnimeWatchData) => {
    const titleEng = safeTitle(anime.titleEnglish, 'english');
    const titleRom = safeTitle(anime.titleRomaji, 'romaji');
    const animeTitle = String(titleEng || titleRom || 'Unknown Anime');
    const cleanEpisodeNumber = String(anime.lastEpisodeNumber).split('-')[0];
    const displayTitle = `${animeTitle}${
      anime.lastEpisodeTitle ? ` - ${anime.lastEpisodeTitle}` : ''
    }`;

    return (
      <AnimeCard
        key={anime.animeId}
        to={`/watch/${anime.animeId}`}
        title={`Continue watching ${animeTitle}`}
      >
        <img
          src={anime.coverImage}
          alt={`Cover for ${animeTitle}`}
          onError={(e) => {
            e.currentTarget.src =
              'https://via.placeholder.com/480x270?text=No+Image';
          }}
        />

        <PlayIcon aria-label='Play'>
          <FaPlay />
        </PlayIcon>

        <div className='episode-info'>
          <p className='episode-title'>{displayTitle}</p>
          <p className='episode-number'>Episode {cleanEpisodeNumber}</p>
        </div>

        <AnimeProgressBar
          style={{ width: `${Math.max(anime.playbackPercentage, 5)}%` }}
        />

        <AnimeCloseButton
          onClick={(e) => handleDeleteItem(anime.animeId, e)}
          title='Remove from history'
          aria-label='Remove from history'
        >
          <IoIosCloseCircleOutline aria-hidden='true' />
        </AnimeCloseButton>
      </AnimeCard>
    );
  };

  // MangaCard handles its own sizing via $fullWidth — no extra wrapper needed.
  const renderMangaCard = (manga: AnimeWatchData) => (
    <MangaCard
      key={manga.animeId}
      animeId={manga.animeId}
      titleEnglish={safeTitle(manga.titleEnglish, 'english')}
      titleRomaji={safeTitle(manga.titleRomaji, 'romaji')}
      coverImage={manga.coverImage}
      lastChapterNumber={manga.lastEpisodeNumber}
      lastChapterTitle={manga.lastEpisodeTitle}
      lastChapterId={manga.lastChapterId}
      playbackPercentage={manga.playbackPercentage}
      fullWidth
      onDelete={handleDeleteItem}
    />
  );

  const renderCard = (item: AnimeWatchData) =>
    contentType === 'anime' ? renderAnimeCard(item) : renderMangaCard(item);

  // ── Empty full-page state (no history at all for this tab) ────────────────

  if (activeList.length === 0) {
    // Bookmarks tab also shows manga content, so use manga labels for it.
  const isManga = contentType !== 'anime';
    return (
      <Container>
        <PageTitle>
          {isManga
            ? 'READING HISTORY'
            : 'WATCH HISTORY'}
        </PageTitle>

        <ControlBar>
          {/* ── Search ───────────────────────────────────────────────── */}
          <SearchRow>
            <SearchIconWrapper aria-hidden='true'>
              <FaSearch />
            </SearchIconWrapper>
            <SearchInput
              type='text'
              placeholder={isManga ? 'Search manga...' : 'Search anime...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label={`Search ${contentType}`}
            />
          </SearchRow>

          {/* ── Filters ──────────────────────────────────────────────── */}
          <FilterRow>
            <FilterTop>
              <TabGroup>
                <TabButton
                  $active={contentType === 'anime'}
                  onClick={() => setContentType('anime')}
                  aria-label='Show anime'
                >
                  ANIME
                </TabButton>
                <TabButton
                  $active={contentType === 'manga'}
                  onClick={() => setContentType('manga')}
                  aria-label='Show manga'
                >
                  MANGA
                </TabButton>
              </TabGroup>

              <SortButton
                onClick={() =>
                  setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
                }
                title={
                  sortOrder === 'asc' ? 'Ascending order' : 'Descending order'
                }
                aria-label='Toggle sort order'
              >
                {sortOrder === 'asc' ? <FaSortAmountUp /> : <FaSortAmountDown />}
              </SortButton>
            </FilterTop>

            <FilterBottom>
              <SelectWrapper>
                <StyledSelect
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  aria-label='Sort history by'
                >
                  <option value='lastWatched'>
                    {isManga ? 'Last read' : 'Last watched'}
                  </option>
                  <option value='alphabetical'>A-Z</option>
                  <option value='progress'>Progress</option>
                  <option value='airDate'>Air date</option>
                </StyledSelect>
                <SelectChevron>
                  <IoIosArrowDown />
                </SelectChevron>
              </SelectWrapper>

              <SelectWrapper>
                <StyledSelect
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(e.target.value as StatusFilter)
                  }
                  aria-label='Filter by AniList status'
                >
                  <option value='all'>All statuses</option>
                  {contentType === 'manga' && (
                    <option value='bookmarked'>Bookmarked</option>
                  )}
                  <option value='CURRENT'>
                    {isManga ? 'Reading' : 'Watching'}
                  </option>
                  <option value='PLANNING'>Planning</option>
                  <option value='COMPLETED'>Completed</option>
                  <option value='PAUSED'>Paused</option>
                  <option value='DROPPED'>Dropped</option>
                  <option value='REPEATING'>Repeating</option>
                </StyledSelect>
                <SelectChevron>
                  <IoIosArrowDown />
                </SelectChevron>
              </SelectWrapper>
            </FilterBottom>
          </FilterRow>
        </ControlBar>

        <EmptyState>
          <h2>
            {isManga
              ? 'No Reading History Yet'
              : 'No Watch History Yet'}
          </h2>
          <p>
            {isManga
              ? 'Start reading manga to build your history'
              : 'Start watching anime to build your history'}
          </p>
          <Link to='/'>Go to Home</Link>
        </EmptyState>
      </Container>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────

  // Bookmarks tab also shows manga content, so use manga labels for it.
  const isManga = contentType !== 'anime';

  return (
    <Container>
      <PageTitle>
        {isManga
          ? 'READING HISTORY'
          : 'WATCH HISTORY'}
      </PageTitle>

      <ControlBar>
        {/* ── Search ───────────────────────────────────────────────── */}
        <SearchRow>
          <SearchIconWrapper aria-hidden='true'>
            <FaSearch />
          </SearchIconWrapper>
          <SearchInput
            type='text'
            placeholder={isManga ? 'Search manga...' : 'Search anime...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={`Search ${contentType}`}
          />
        </SearchRow>

        {/* ── Filters ──────────────────────────────────────────────── */}
        <FilterRow>
          <FilterTop>
            <TabGroup>
              <TabButton
                $active={contentType === 'anime'}
                onClick={() => setContentType('anime')}
                aria-label='Show anime'
              >
                ANIME
              </TabButton>
              <TabButton
                $active={contentType === 'manga'}
                onClick={() => setContentType('manga')}
                aria-label='Show manga'
              >
                MANGA
              </TabButton>
            </TabGroup>

            <SortButton
              onClick={() =>
                setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
              }
              title={
                sortOrder === 'asc' ? 'Ascending order' : 'Descending order'
              }
              aria-label='Toggle sort order'
            >
              {sortOrder === 'asc' ? <FaSortAmountUp /> : <FaSortAmountDown />}
            </SortButton>

            {activeList.length > 0 && (
              <ClearAllButton
                onClick={handleClearAll}
                title={`Clear ${
                  isManga
                    ? 'reading history'
                    : 'watch history'
                }`}
                aria-label='Clear all'
              >
                <FaTrashAlt aria-hidden='true' />
              </ClearAllButton>
            )}
          </FilterTop>

          <FilterBottom>
            <SelectWrapper>
              <StyledSelect
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label='Sort history by'
              >
                <option value='lastWatched'>
                  {isManga ? 'Last read' : 'Last watched'}
                </option>
                <option value='alphabetical'>A-Z</option>
                <option value='progress'>Progress</option>
                <option value='airDate'>Air date</option>
              </StyledSelect>
              <SelectChevron>
                <IoIosArrowDown />
              </SelectChevron>
            </SelectWrapper>

            <SelectWrapper>
              <StyledSelect
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as StatusFilter)
                }
                aria-label='Filter by AniList status'
              >
                <option value='all'>All statuses</option>
                {contentType === 'manga' && (
                  <option value='bookmarked'>Bookmarked</option>
                )}
                <option value='CURRENT'>
                  {isManga ? 'Reading' : 'Watching'}
                </option>
                <option value='PLANNING'>Planning</option>
                <option value='COMPLETED'>Completed</option>
                <option value='PAUSED'>Paused</option>
                <option value='DROPPED'>Dropped</option>
                <option value='REPEATING'>Repeating</option>
              </StyledSelect>
              <SelectChevron>
                <IoIosArrowDown />
              </SelectChevron>
            </SelectWrapper>
          </FilterBottom>
        </FilterRow>
      </ControlBar>

      <MainContent>
        {filteredAndSortedList.length === 0 ? (
          <EmptyState>
            <h2>No Matches Found</h2>
            <p>Try adjusting your search or filters.</p>
          </EmptyState>
        ) : sortBy === 'lastWatched' ? (
          groupedByDate.map(({ date, items }) => (
            <DateGroup key={date}>
              <DateGroupHeader>
                <DateLabel>
                  {date}
                  <CountBadge>{items.length}</CountBadge>
                </DateLabel>
                <RemoveGroupButton
                  onClick={(e) =>
                    handleDeleteGroup(
                      items.map((i) => i.animeId),
                      e,
                    )
                  }
                  title={`Remove all from ${date}`}
                  aria-label={`Remove all entries from ${date}`}
                >
                  <IoIosCloseCircleOutline aria-hidden='true' />
                </RemoveGroupButton>
              </DateGroupHeader>
              {contentType === 'anime' ? (
                <GridContainer>{items.map(renderCard)}</GridContainer>
              ) : (
                <MangaGrid>{items.map(renderCard)}</MangaGrid>
              )}
            </DateGroup>
          ))
        ) : sortBy === 'alphabetical' ? (
          groupedByLetter.map(({ letter, items }) => (
            <DateGroup key={letter}>
              <DateGroupHeader>
                <DateLabel>
                  {letter}
                  <CountBadge>{items.length}</CountBadge>
                </DateLabel>
                <RemoveGroupButton
                  onClick={(e) =>
                    handleDeleteGroup(
                      items.map((i) => i.animeId),
                      e,
                    )
                  }
                  title={`Remove all under ${letter}`}
                  aria-label={`Remove all entries under ${letter}`}
                >
                  <IoIosCloseCircleOutline aria-hidden='true' />
                </RemoveGroupButton>
              </DateGroupHeader>
              {contentType === 'anime' ? (
                <GridContainer>{items.map(renderCard)}</GridContainer>
              ) : (
                <MangaGrid>{items.map(renderCard)}</MangaGrid>
              )}
            </DateGroup>
          ))
        ) : contentType === 'anime' ? (
          <GridContainer>{filteredAndSortedList.map(renderCard)}</GridContainer>
        ) : (
          <MangaGrid>{filteredAndSortedList.map(renderCard)}</MangaGrid>
        )}
      </MainContent>
    </Container>
  );
};

export default History;

