/**
 * ListActions.tsx
 *
 * AniList list-management controls for the Info page: a favourite heart
 * toggle, a status selector, and a score input. Each reflects the viewer's
 * existing AniList entry (or lets them add one) and updates optimistically.
 *
 * Renders nothing when the user is not logged in.
 */

import React from 'react';
import styled from 'styled-components';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { useAuth, useAniListEntry } from '../../index';
import type { MediaListStatus } from '../../client/authService';

// ─── Design tokens (mirror the Info page's `A` map) ───────────────────────────
const T = {
  accent: 'var(--primary-accent, #c084fc)',
  text: 'var(--global-text, #e5e7eb)',
  muted: 'var(--global-text-muted, #9ca3af)',
  card: 'var(--global-card-bg, #1f2937)',
  surface: 'var(--global-div-tr, #111827)',
  border: 'var(--global-border, rgba(255,255,255,0.08))',
};

const ANIME_STATUS_OPTIONS: { value: MediaListStatus; label: string }[] = [
  { value: 'CURRENT',   label: 'Watching'      },
  { value: 'PLANNING',  label: 'Plan to Watch' },
  { value: 'COMPLETED', label: 'Completed'     },
  { value: 'REPEATING', label: 'Re-watching'   },
  { value: 'PAUSED',    label: 'Paused'        },
  { value: 'DROPPED',   label: 'Dropped'       },
];

const MANGA_STATUS_OPTIONS: { value: MediaListStatus; label: string }[] = [
  { value: 'CURRENT',   label: 'Reading'       },
  { value: 'PLANNING',  label: 'Plan to Read'  },
  { value: 'COMPLETED', label: 'Completed'     },
  { value: 'REPEATING', label: 'Re-reading'    },
  { value: 'PAUSED',    label: 'Paused'        },
  { value: 'DROPPED',   label: 'Dropped'       },
];

interface ListActionsProps {
  /** AniList media ID. Anime.id is a string; caller must Number() it. */
  mediaId: number;
  /** 'MANGA' uses the manga label set + manga favourite key. */
  type?: 'ANIME' | 'MANGA';
}

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
`;

const Row = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
`;

const HeartBtn = styled.button<{ $active?: boolean; $busy?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 2.3rem;
  height: 2.05rem;
  border: 1px solid ${T.border};
  border-radius: 6px;
  background: ${({ $active }) => ($active ? 'rgba(244,63,94,0.12)' : T.card)};
  color: ${({ $active }) => ($active ? '#f43f5e' : T.muted)};
  cursor: pointer;
  transition: color 0.15s, background 0.15s, border-color 0.15s, opacity 0.15s;
  &:hover { border-color: #f43f5e; color: #f43f5e; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;

const Select = styled.select`
  flex: 1;
  min-width: 0;
  appearance: none;
  -webkit-appearance: none;
  height: 2.05rem;
  padding: 0 1.5rem 0 0.6rem;
  background: ${T.card};
  color: ${T.text};
  border: 1px solid ${T.border};
  border-radius: 6px;
  font-size: 0.8rem;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%239ca3af' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.55rem center;
  outline: none;
  &:hover { border-color: ${T.accent}; }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;



const Hint = styled.p`
  margin: 0;
  font-size: 0.72rem;
  color: ${T.muted};
`;

export const ListActions: React.FC<ListActionsProps> = ({ mediaId, type = 'ANIME' }) => {
  const { isLoggedIn } = useAuth();
  const {
    loading, inList, status, isFavourite, saving,
    setStatus, toggleFavourite,
  } = useAniListEntry(mediaId, isLoggedIn);

  if (!isLoggedIn) return null;

  const isManga = type === 'MANGA';
  const statusOptions = isManga ? MANGA_STATUS_OPTIONS : ANIME_STATUS_OPTIONS;

  return (
    <Wrap>
      <Row>
        <HeartBtn
          type='button'
          $active={isFavourite}
          $busy={saving}
          disabled={loading || saving}
          onClick={() => toggleFavourite(type)}
          title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          aria-label={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={isFavourite}
        >
          {isFavourite ? <FaHeart size={13} /> : <FaRegHeart size={13} />}
        </HeartBtn>

        <Select
          value={status ?? ''}
          disabled={loading || saving}
          onChange={(e) => {
            const v = e.target.value as MediaListStatus;
            if (v) setStatus(v);
          }}
          aria-label={`${isManga ? 'Reading' : 'Watch'} list status`}
        >
          <option value='' disabled>
            {inList ? `${status}…` : 'Add to list'}
          </option>
          {statusOptions.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </Row>

      {loading && <Hint>Loading your {isManga ? 'reading' : 'watch'} status…</Hint>}
    </Wrap>
  );
};

export default ListActions;
