import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Link } from 'react-router-dom';
import { FaBookOpen, FaBookmark } from 'react-icons/fa';
import { IoIosCloseCircleOutline } from 'react-icons/io';

const LOCAL_STORAGE_KEYS = {
  READ_CHAPTERS: 'read-chapters',
  LAST_MANGA_VISITED: 'last-manga-visited',
  READING_PROGRESS: 'all_reading_times',
  MANGA_BOOKMARKS: 'manga-bookmarks',
};

// ── Overlay elements ── defined before MangaCardLink so styled() refs resolve ──

/** Centred open-book icon, fades in on hover */
const ReadIcon = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ffffff;
  font-size: 2rem;
  opacity: 0;
  z-index: 1;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s ease-in-out;
`;

/** Top-left × button, hidden until hover */
const CloseButton = styled.button`
  position: absolute;
  top: 0;
  left: 0;
  background: transparent;
  border: none;
  color: #ffffff;
  cursor: pointer;
  display: none;
  padding: 0.2rem 0 0 0.2rem;
  z-index: 3;
  transition: 0.2s ease-in-out;

  svg {
    font-size: 2.25rem;
    transition: transform 0.2s ease-in-out;

    &:hover {
      transform: scale(1.05);
    }
  }
`;

/** Top-right bookmark badge — always visible when bookmarked, else fades in on hover */
const BookmarkBadge = styled.button<{ $bookmarked?: boolean }>`
  position: absolute;
  top: 0.4rem;
  right: 0.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  background: ${({ $bookmarked }) =>
    $bookmarked ? 'var(--primary-accent)' : 'rgba(0, 0, 0, 0.55)'};
  border-radius: 0.3rem;
  color: #ffffff;
  font-size: 0.72rem;
  cursor: pointer;
  border: 1px solid
    ${({ $bookmarked }) =>
      $bookmarked ? 'var(--primary-accent)' : 'rgba(255, 255, 255, 0.15)'};
  /* hidden by default; always visible when bookmarked */
  opacity: ${({ $bookmarked }) => ($bookmarked ? 1 : 0)};
  transition: all 0.2s ease-in-out;
  backdrop-filter: blur(4px);
  z-index: 3;
  padding: 0;

  &:hover {
    transform: scale(1.1);
  }
`;

/** Thin progress bar pinned to the bottom edge of the cover */
const ProgressBar = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 0.2rem;
  border-radius: var(--global-border-radius);
  background-color: var(--primary-accent);
  transition: width 0.3s ease-in-out;
  z-index: 3;
`;

// ── Main card ─────────────────────────────────────────────────────────────────

const MangaCardLink = styled(Link)`
  position: relative;
  display: block;
  border-radius: var(--global-border-radius);
  overflow: hidden;
  text-decoration: none;
  transition: box-shadow 0.2s ease-in-out;
  width: 100%;
  max-width: 7.5rem;
  margin: 0 auto;

  @media (max-width: 1000px) {
    max-width: 7rem;
  }

  @media (max-width: 800px) {
    max-width: 6.5rem;
  }

  @media (max-width: 450px) {
    max-width: 5.5rem;
  }

  /* ── hover state ── */
  &:hover,
  &:focus-visible {
    box-shadow: 2px 2px 10px var(--global-card-hover-shadow);

    img {
      filter: brightness(0.5);
    }

    ${ReadIcon} {
      opacity: 1;
    }

    ${CloseButton} {
      display: block;
    }

    ${BookmarkBadge} {
      opacity: 1;
    }
  }

  /* ── cover image ── */
  img {
    width: 100%;
    aspect-ratio: 2 / 3;
    object-fit: cover;
    display: block;
    transition: filter 0.2s ease-in-out;
  }

  /* ── bottom info overlay ── */
  .manga-info {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    /* extra bottom padding so the progress bar never sits on top of text */
    padding: 1.75rem 0.5rem 0.45rem;
    background: linear-gradient(
      0deg,
      rgba(8, 8, 8, 0.95) 0%,
      transparent 100%
    );
    color: #ffffff;
    box-sizing: border-box;

    .manga-title {
      font-size: 0.85rem;
      font-weight: 700;
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.25;
    }

    .chapter-info {
      font-size: 0.7rem;
      color: rgba(255, 255, 255, 0.6);
      margin: 0.15rem 0 0.3rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;

// ── Component ─────────────────────────────────────────────────────────────────

interface MangaCardProps {
  animeId: string;
  titleEnglish?: string;
  titleRomaji?: string;
  coverImage?: string;
  lastChapterNumber?: string | number;
  lastChapterTitle?: string;
  playbackPercentage?: number;
  onDelete?: (animeId: string, e: React.MouseEvent) => void;
}

export const MangaCard: React.FC<MangaCardProps> = ({
  animeId,
  titleEnglish,
  titleRomaji,
  coverImage,
  lastChapterNumber,
  lastChapterTitle,
  playbackPercentage = 0,
  onDelete,
}) => {
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const bookmarks = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEYS.MANGA_BOOKMARKS) || '{}',
    );
    setIsBookmarked(!!bookmarks[animeId]);
  }, [animeId]);

  // Safely unwrap title — handles both plain strings and AniList shape objects
  const safeTitleEnglish =
    titleEnglish && typeof titleEnglish === 'string'
      ? titleEnglish
      : titleEnglish &&
          typeof titleEnglish === 'object' &&
          'english' in titleEnglish
        ? (titleEnglish as any).english
        : '';

  const safeTitleRomaji =
    titleRomaji && typeof titleRomaji === 'string'
      ? titleRomaji
      : titleRomaji &&
          typeof titleRomaji === 'object' &&
          'romaji' in titleRomaji
        ? (titleRomaji as any).romaji
        : '';

  const mangaTitle = String(
    safeTitleEnglish || safeTitleRomaji || 'Unknown Manga',
  );
  const cleanChapterNumber = String(lastChapterNumber || '0').split('-')[0];
  const chapterLabel = lastChapterTitle
    ? `Ch. ${cleanChapterNumber} · ${lastChapterTitle}`
    : `Chapter ${cleanChapterNumber}`;

  // ── handlers ──

  const handleBookmarkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const bookmarks = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEYS.MANGA_BOOKMARKS) || '{}',
    );
    if (bookmarks[animeId]) {
      delete bookmarks[animeId];
    } else {
      bookmarks[animeId] = { timestamp: Date.now() };
    }
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.MANGA_BOOKMARKS,
      JSON.stringify(bookmarks),
    );
    setIsBookmarked((prev) => !prev);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(animeId, e);
  };

  const trackMangaRead = () => {
    // Stamp last-visited
    const lastVisited = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEYS.LAST_MANGA_VISITED) || '{}',
    );
    lastVisited[animeId] = { timestamp: Date.now(), titleEnglish, titleRomaji };
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.LAST_MANGA_VISITED,
      JSON.stringify(lastVisited),
    );

    // Persist chapter entry
    const readChapters = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEYS.READ_CHAPTERS) || '{}',
    );
    if (!readChapters[animeId]) readChapters[animeId] = [];
    const entry = {
      id: `${animeId}-${lastChapterNumber}`,
      number: lastChapterNumber,
      title: lastChapterTitle || '',
      image: coverImage || '',
      description: '',
      imageHash: '',
      airDate: new Date().toISOString(),
    };
    if (!readChapters[animeId].some((ch: any) => ch.id === entry.id)) {
      readChapters[animeId].push(entry);
    }
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.READ_CHAPTERS,
      JSON.stringify(readChapters),
    );

    // Persist reading progress
    const readingTimes = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_KEYS.READING_PROGRESS) || '{}',
    );
    readingTimes[`${animeId}-${lastChapterNumber}`] = {
      playbackPercentage: Math.min(playbackPercentage, 100),
    };
    localStorage.setItem(
      LOCAL_STORAGE_KEYS.READING_PROGRESS,
      JSON.stringify(readingTimes),
    );
  };

  return (
    <MangaCardLink
      to={`/read/${animeId}`}
      title={`Continue reading ${mangaTitle}`}
      onClick={trackMangaRead}
    >
      {/* Cover image */}
      <img
        src={coverImage}
        alt={`Cover for ${mangaTitle}`}
        onError={(e) => {
          e.currentTarget.src =
            'https://via.placeholder.com/320x480?text=No+Image';
        }}
      />

      {/* Centred read icon */}
      <ReadIcon aria-hidden='true'>
        <FaBookOpen />
      </ReadIcon>

      {/* Bottom info overlay */}
      <div className='manga-info' aria-label={`${mangaTitle}, ${chapterLabel}`}>
        <p className='manga-title'>{mangaTitle}</p>
        <p className='chapter-info'>{chapterLabel}</p>
      </div>

      {/* Reading progress bar */}
      <ProgressBar style={{ width: `${Math.max(playbackPercentage, 5)}%` }} />

      {/* Remove from history */}
      <CloseButton
        onClick={handleDeleteClick}
        title='Remove from history'
        aria-label='Remove from history'
      >
        <IoIosCloseCircleOutline aria-hidden='true' />
      </CloseButton>

      {/* Bookmark toggle */}
      <BookmarkBadge
        $bookmarked={isBookmarked}
        onClick={handleBookmarkClick}
        title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
        aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
      >
        <FaBookmark aria-hidden='true' />
      </BookmarkBadge>
    </MangaCardLink>
  );
};