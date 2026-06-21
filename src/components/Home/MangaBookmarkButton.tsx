/**
 * MangaBookmarkButton
 *
 * Reusable toggle for the local manga bookmark store (`manga-bookmarks`).
 * Used on the Info page (manga only) and the Read page — the two places where
 * a user decides they want to save a manga, which previously had no bookmark
 * control at all (only MangaCard in the history view could bookmark).
 *
 * Self-contained: reads its initial state from localStorage on mount, updates
 * optimistically, and dispatches the shared `manga-bookmarks-changed` event so
 * the History Bookmarks tab reflects the change live.
 */

import React, { useState } from 'react';
import styled from 'styled-components';
import { FaBookmark } from 'react-icons/fa';
import { FaRegBookmark } from 'react-icons/fa6';
import {
  isMangaBookmarked,
  toggleMangaBookmark,
  MANGA_BOOKMARKS_CHANGED_EVENT,
} from '../../lib/mangaHistory';

const Button = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  border: 1px solid
    ${({ $active }) => ($active ? 'var(--primary-accent)' : 'var(--global-border)')};
  border-radius: var(--global-border-radius, 6px);
  background: ${({ $active }) =>
    $active ? 'var(--primary-accent)' : 'transparent'};
  color: ${({ $active }) => ($active ? '#ffffff' : 'var(--global-text)')};
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 700;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  flex-shrink: 0;

  svg {
    font-size: 0.85rem;
  }

  &:hover {
    border-color: var(--primary-accent);
    color: ${({ $active }) => ($active ? '#ffffff' : 'var(--primary-accent)')};
  }

  &:focus-visible {
    outline: none;
    border-color: var(--primary-accent);
  }
`;

// Variant matching the Read page's compact icon-only toolbar buttons.
const IconBtn = styled.button<{ $active?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: none;
  border-radius: var(--global-border-radius, 6px);
  padding: 0.4rem 0.65rem;
  background: ${({ $active }) =>
    $active ? 'rgba(124,58,237,0.18)' : 'transparent'};
  color: ${({ $active }) =>
    $active ? 'var(--primary-accent)' : 'var(--global-text)'};
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;

  svg { font-size: 0.75rem; }

  &:hover { background: rgba(124,58,237,0.14); color: var(--primary-accent); }
  &:focus-visible { outline: none; }
`;

interface MangaBookmarkButtonProps {
  mangaId: string;
  /** "toolbar" = compact icon-only (Read page); "pill" = bordered button (Info page). */
  variant?: 'toolbar' | 'pill';
  /** Show the "Bookmark" label text next to the icon (pill variant only). */
  showLabel?: boolean;
}

export const MangaBookmarkButton: React.FC<MangaBookmarkButtonProps> = ({
  mangaId,
  variant = 'pill',
  showLabel = true,
}) => {
  const [bookmarked, setBookmarked] = useState(false);

  // Read initial state lazily — use a function so it only reads once.
  // (useState initializer runs before first paint.)
  const [hydrated, setHydrated] = useState(false);
  if (!hydrated) {
    setBookmarked(isMangaBookmarked(mangaId));
    setHydrated(true);
  }

  // Reflect external bookmark changes (e.g. toggled from another view/tab).
  React.useEffect(() => {
    const sync = () => setBookmarked(isMangaBookmarked(mangaId));
    sync();
    window.addEventListener(MANGA_BOOKMARKS_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(MANGA_BOOKMARKS_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [mangaId]);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setBookmarked(toggleMangaBookmark(mangaId));
  };

  const label = bookmarked ? 'Bookmarked' : 'Bookmark';

  if (variant === 'toolbar') {
    return (
      <IconBtn
        $active={bookmarked}
        onClick={onClick}
        title={label}
        aria-label={label}
        aria-pressed={bookmarked}
      >
        {bookmarked ? <FaBookmark /> : <FaRegBookmark />}
      </IconBtn>
    );
  }

  return (
    <Button
      $active={bookmarked}
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={bookmarked}
    >
      {bookmarked ? <FaBookmark /> : <FaRegBookmark />}
      {showLabel && label}
    </Button>
  );
};

export default MangaBookmarkButton;
