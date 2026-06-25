import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FaHeart, FaRegHeart, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../client/useAuth';
import { useAniListEntry } from '../../hooks/useAniListEntry';
import type { Anime } from '../../index';
import type { MediaListStatus, SaveEntryInput } from '../../client/authService';

import { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const scaleIn = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  animation: ${fadeIn} 0.18s ease both;

  @media (max-width: 480px) {
    padding: 0.5rem;
  }
`;

const ModalContent = styled.div`
  background: var(--global-primary-bg, #0d1117);
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.08));
  border-radius: 14px;
  display: flex;
  align-items: stretch;
  width: min(96%, 52rem);
  height: min(90vh, 42rem);
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
  animation: ${scaleIn} 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;

  /* Mobile: stack vertically */
  @media (max-width: 600px) {
    flex-direction: column;
    width: min(96%, 100%);
    height: min(95vh, 680px);
  }
`;

/* Desktop: tall side image. Mobile: hidden (replaced by CoverBanner) */
const CoverImage = styled.img`
  width: 200px;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  flex-shrink: 0;
  align-self: stretch;

  @media (max-width: 600px) {
    display: none;
  }
`;

/* Mobile-only: full-width banner at the top with title overlay */
const CoverBanner = styled.div<{ $src: string }>`
  display: none;

  @media (max-width: 600px) {
    display: block;
    flex-shrink: 0;
    width: 100%;
    height: 140px;
    background: url(${({ $src }) => $src}) center/cover no-repeat;
    position: relative;

    /* Dark gradient at the bottom so the title is readable */
    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, transparent 30%, rgba(0,0,0,0.75) 100%);
    }
  }
`;

const BannerTitleRow = styled.div`
  display: none;

  @media (max-width: 600px) {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 0.75rem;
    position: absolute;
    bottom: 0.75rem;
    left: 0.75rem;
    right: 0.75rem;
    z-index: 1;
  }
`;

const FormContainer = styled.div`
  padding: 1.25rem 1.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  min-height: 0;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: var(--global-div, #30363d);
    border-radius: 99px;
  }

  @media (max-width: 600px) {
    padding: 1rem;
    gap: 0.85rem;
  }
`;

/* Desktop header (title + heart) inside FormContainer */
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;

  /* On mobile, the title/heart live in the BannerTitleRow overlay, not here */
  @media (max-width: 600px) {
    display: none;
  }
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.15rem;
  color: var(--global-text, #c9d1d9);
  font-weight: 700;
  line-height: 1.3;

  @media (max-width: 600px) {
    font-size: 1rem;
    color: #ffffff;
    text-shadow: 0 1px 4px rgba(0,0,0,0.5);
  }
`;

const HeartBtn = styled.button<{ $active?: boolean }>`
  background: var(--global-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
  color: ${({ $active }) => ($active ? '#f43f5e' : 'var(--global-text-muted, #8b949e)')};
  border-radius: 8px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.2s;

  &:hover {
    border-color: #f43f5e;
    color: #f43f5e;
    background: rgba(244, 63, 94, 0.1);
  }
`;

/* 2-column on mobile, auto-fill on desktop */
const GridRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.85rem;

  @media (max-width: 600px) {
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const Label = styled.label`
  font-size: 0.75rem;
  color: var(--global-text-muted, #8b949e);
  font-weight: 600;
`;

const Input = styled.input`
  background: var(--global-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  color: var(--global-text, #c9d1d9);
  font-size: 0.85rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--primary-accent, #c084fc);
  }
  &::-webkit-calendar-picker-indicator {
    filter: invert(1);
    opacity: 0.5;
    cursor: pointer;
  }
`;

const Select = styled.select`
  background: var(--global-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  color: var(--global-text, #c9d1d9);
  font-size: 0.85rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%239ca3af' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--primary-accent, #c084fc);
  }
  
  option {
    background: var(--global-secondary-bg, #161b22);
    color: var(--global-text, #c9d1d9);
  }
`;

const TextArea = styled.textarea`
  background: var(--global-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  padding: 0.75rem;
  color: var(--global-text, #c9d1d9);
  font-size: 0.85rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  min-height: 80px;
  resize: vertical;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--primary-accent, #c084fc);
  }
`;

const Footer = styled.div`
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 0.85rem;
  border-top: 1px solid var(--global-border, rgba(255,255,255,0.08));
  margin-top: auto;

  @media (max-width: 600px) {
    padding-top: 0.75rem;
    margin-top: 0.25rem;
  }
`;

const DeleteBtn = styled.button`
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #ef4444;
  border-radius: 6px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.6);
  }
  &:active { transform: scale(0.97); }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const Btn = styled.button<{ $primary?: boolean }>`
  background: ${({ $primary }) => ($primary ? 'var(--primary-accent, #c084fc)' : 'transparent')};
  color: ${({ $primary }) => ($primary ? '#ffffff' : 'var(--global-text, #c9d1d9)')};
  border: 1px solid ${({ $primary }) => ($primary ? 'transparent' : 'var(--global-border, rgba(255, 255, 255, 0.1))')};
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: ${({ $primary }) => ($primary ? 'var(--primary-accent, #c084fc)' : 'var(--global-tertiary-bg, #21262d)')};
    filter: ${({ $primary }) => ($primary ? 'brightness(1.1)' : 'none')};
  }
  &:active { transform: scale(0.97); }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

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

interface EditEntryModalProps {
  anime: Anime;
  isOpen: boolean;
  onClose: () => void;
}

function dateObjToYMD(obj?: { year?: number | null; month?: number | null; day?: number | null }) {
  if (!obj || !obj.year) return '';
  const y = obj.year;
  const m = obj.month ? String(obj.month).padStart(2, '0') : '01';
  const d = obj.day ? String(obj.day).padStart(2, '0') : '01';
  return `${y}-${m}-${d}`;
}

function ymdToDateObj(ymd: string) {
  if (!ymd) return { year: undefined, month: undefined, day: undefined };
  const [y, m, d] = ymd.split('-');
  return {
    year: parseInt(y, 10) || undefined,
    month: parseInt(m, 10) || undefined,
    day: parseInt(d, 10) || undefined,
  };
}

export const EditEntryModal: React.FC<EditEntryModalProps> = ({ anime, isOpen, onClose }) => {
  const { isLoggedIn, saveEntry } = useAuth();
  const mediaId = Number(anime.id);
  const { loading, entry, isFavourite, toggleFavourite, deleteFromList } = useAniListEntry(mediaId, isLoggedIn && isOpen);

  const [status, setLocalStatus] = useState<MediaListStatus | ''>('');
  const [progress, setProgress] = useState<number | ''>('');
  const [score, setScore] = useState<number | ''>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [repeat, setRepeat] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && entry) {
      setLocalStatus(entry.status || '');
      setProgress(entry.progress || '');
      setScore(entry.score || '');
      setStartDate(dateObjToYMD(entry.startedAt));
      setEndDate(dateObjToYMD(entry.completedAt));
      setRepeat(entry.repeat || '');
      setNotes(entry.notes || '');
    } else if (!loading && !entry) {
      // Not in list yet, set some defaults based on action? Or just leave blank.
    }
  }, [loading, entry]);

  // Lock body scroll + close on ESC while open.
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !isLoggedIn) return null;

  const isManga = ['MANGA', 'ONE_SHOT', 'NOVEL', 'LIGHT_NOVEL'].includes(anime.type);
  const statusOptions = isManga ? MANGA_STATUS_OPTIONS : ANIME_STATUS_OPTIONS;
  const progressLabel = isManga ? 'Chapters' : 'Eps Progress';
  const repeatLabel = isManga ? 'Total Rereads' : 'Total Rewatches';

  const handleSave = async () => {
    setIsSaving(true);
    const input: SaveEntryInput = { mediaId };
    if (status) input.status = status as MediaListStatus;
    if (progress !== '') input.progress = Number(progress);
    if (score !== '') input.score = Number(score);
    if (startDate) input.startedAt = ymdToDateObj(startDate);
    if (endDate) input.completedAt = ymdToDateObj(endDate);
    if (repeat !== '') input.repeat = Number(repeat);
    if (notes !== undefined) input.notes = notes;

    const res = await saveEntry(input);
    setIsSaving(false);
    if (res) {
      // Successfully saved!
      window.dispatchEvent(new CustomEvent('anilist-entry-changed'));
      onClose();
    } else {
      alert('Failed to save entry.');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to remove this from your list?')) {
      const ok = await deleteFromList();
      if (ok) onClose();
    }
  };

  return (
    <Overlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        {/* Desktop: tall side cover */}
        <CoverImage src={anime.image} alt="Cover" />

        {/* Mobile: top banner with title overlay */}
        <CoverBanner $src={anime.image}>
          <BannerTitleRow>
            <Title>{anime.title.english || anime.title.romaji}</Title>
            <HeartBtn
              $active={isFavourite}
              onClick={() => toggleFavourite(isManga ? 'MANGA' : 'ANIME')}
              title={isFavourite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavourite ? <FaHeart /> : <FaRegHeart />}
            </HeartBtn>
          </BannerTitleRow>
        </CoverBanner>

        <FormContainer>
          {/* Desktop header (hidden on mobile) */}
          <Header>
            <Title>{anime.title.english || anime.title.romaji}</Title>
            <HeartBtn
              $active={isFavourite}
              onClick={() => toggleFavourite(isManga ? 'MANGA' : 'ANIME')}
              title={isFavourite ? 'Remove from favorites' : 'Add to favorites'}
            >
              {isFavourite ? <FaHeart /> : <FaRegHeart />}
            </HeartBtn>
          </Header>

          <GridRow>
            <FormGroup>
              <Label>Status</Label>
              <Select value={status} onChange={(e) => setLocalStatus(e.target.value as MediaListStatus)}>
                <option value="" disabled>Select status</option>
                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </Select>
            </FormGroup>

            <FormGroup>
              <Label>{progressLabel} {anime.totalEpisodes ? `/ ${anime.totalEpisodes}` : ''}</Label>
              <Input
                type="number"
                min="0"
                max={anime.totalEpisodes || undefined}
                value={progress}
                onChange={(e) => setProgress(e.target.value !== '' ? Number(e.target.value) : '')}
              />
            </FormGroup>

            <FormGroup>
              <Label>Score (0-100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(e.target.value !== '' ? Number(e.target.value) : '')}
              />
            </FormGroup>

            <FormGroup>
              <Label>{repeatLabel}</Label>
              <Input
                type="number"
                min="0"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value !== '' ? Number(e.target.value) : '')}
              />
            </FormGroup>
          </GridRow>

          <GridRow>
            <FormGroup>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormGroup>

            <FormGroup>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormGroup>
          </GridRow>

          <FormGroup style={{ flex: 1 }}>
            <Label>Notes</Label>
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormGroup>

          <Footer>
            {entry ? (
              <DeleteBtn onClick={handleDelete} title="Delete from list">
                <FaTrash size={14} />
              </DeleteBtn>
            ) : <div />}
            <ActionButtons>
              <Btn $primary onClick={handleSave} disabled={loading || isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Btn>
              <Btn onClick={onClose}>Cancel</Btn>
            </ActionButtons>
          </Footer>
        </FormContainer>
      </ModalContent>
    </Overlay>
  );
};
