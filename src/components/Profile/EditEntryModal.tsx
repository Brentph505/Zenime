import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import styled from 'styled-components';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { 
  IoPencilOutline, 
  IoBanOutline, 
  IoTrashOutline, 
  IoEyeOutline, 
  IoCheckmarkCircleOutline, 
  IoTimeOutline, 
  IoCloseCircleOutline, 
  IoBookOutline 
} from 'react-icons/io5';
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
  z-index: 9999;
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
  width: min(96%, 54rem);
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 32px 80px rgba(0, 0, 0, 0.5);
  animation: ${scaleIn} 0.22s cubic-bezier(0.16, 1, 0.3, 1) both;

  /* Mobile: stack vertically */
  @media (max-width: 600px) {
    flex-direction: column;
    width: min(96%, 100%);
    max-height: 95vh;
  }
`;

/* Desktop: tall side image. Mobile: hidden (replaced by CoverBanner) */
const CoverImage = styled.img`
  width: 280px;
  height: 100%;
  object-fit: cover;
  object-position: center;
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
    height: 120px;
    background: url(${({ $src }) => $src}) center/cover no-repeat;
  }
`;

const FormContainer = styled.div`
  padding: 1.1rem 1.3rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
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

/* Header (title + heart) inside FormContainer */
const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.15rem;
  color: var(--global-text, #c9d1d9);
  font-weight: 700;
  line-height: 1.3;

  @media (max-width: 600px) {
    font-size: 1rem;
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

/* 3-column on desktop to match the reference, 2-column on mobile */
const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;

  @media (max-width: 600px) {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
`;

const FormGroup = styled.div<{ $mobileOrder?: number }>`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;

  @media (max-width: 600px) {
    ${({ $mobileOrder }) => $mobileOrder !== undefined && `order: ${$mobileOrder};`}
  }
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

const Select = styled.select<{ $hasIcon?: boolean; $statusColor?: string }>`
  background: var(--global-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  padding-left: ${({ $hasIcon }) => ($hasIcon ? '2.2rem' : '0.75rem')};
  color: ${({ $statusColor }) => $statusColor || 'var(--global-text, #c9d1d9)'};
  font-size: 0.85rem;
  font-weight: ${({ $statusColor }) => ($statusColor ? '700' : 'normal')};
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
  min-height: 60px;
  resize: vertical;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--primary-accent, #c084fc);
  }
`;

const StatusSelectWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
`;

const StatusIconWrapper = styled.div<{ $color: string }>`
  position: absolute;
  left: 0.75rem;
  color: ${({ $color }) => $color};
  display: flex;
  align-items: center;
  pointer-events: none;
  font-size: 1.1rem;
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
  background: var(--global-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
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
    background: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
  }
  &:active { transform: scale(0.97); }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
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
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  transition: all 0.15s;

  svg { font-size: 1.1rem; }

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

const STATUS_COLORS: Record<string, string> = {
  CURRENT: '#84cc16', // bright green
  COMPLETED: '#3b82f6', // blue
  PAUSED: '#eab308', // yellow
  DROPPED: '#ef4444', // red
  PLANNING: '#c9d1d9', // white/gray
  REPEATING: '#8b5cf6', // purple
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  CURRENT: IoEyeOutline,
  COMPLETED: IoCheckmarkCircleOutline,
  PAUSED: IoTimeOutline,
  DROPPED: IoCloseCircleOutline,
  PLANNING: IoBookOutline,
  REPEATING: IoTimeOutline,
};

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
  const {
    loading,
    entry,
    isFavourite,
    toggleFavourite,
    deleteFromList,
    saving: entrySaving,
  } = useAniListEntry(mediaId, isLoggedIn && isOpen);

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
    // score 0 is valid (means "unscored"), so check for empty string specifically
    if (score !== '') input.score = Number(score);
    if (startDate) input.startedAt = ymdToDateObj(startDate);
    if (endDate) input.completedAt = ymdToDateObj(endDate);
    if (repeat !== '') input.repeat = Number(repeat);
    // Send notes always (even empty string) so the user can clear their notes
    input.notes = notes;

    const res = await saveEntry(input);
    setIsSaving(false);
    if (res) {
      // Successfully saved — notify other views and close.
      window.dispatchEvent(new CustomEvent('anilist-entry-changed'));
      onClose();
    } else {
      alert('Failed to save entry. Make sure you are logged in and try again.');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to remove this from your list?')) {
      const ok = await deleteFromList();
      if (ok) onClose();
      else alert('Unable to remove the entry from AniList. Please try again.');
    }
  };

  const modalContent = (
    <Overlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        {/* Desktop: tall side cover */}
        <CoverImage src={anime.image} alt="Cover" />

        {/* Mobile: top banner */}
        <CoverBanner $src={anime.image} />

        <FormContainer>
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

          <FormGrid>
            <FormGroup $mobileOrder={1}>
              <Label>Status</Label>
              <StatusSelectWrapper>
                {status && STATUS_ICONS[status] && (
                  <StatusIconWrapper $color={STATUS_COLORS[status]}>
                    {React.createElement(STATUS_ICONS[status])}
                  </StatusIconWrapper>
                )}
                <Select
                  $hasIcon={!!status}
                  $statusColor={status ? STATUS_COLORS[status] : undefined}
                  value={status}
                  onChange={(e) => setLocalStatus(e.target.value as MediaListStatus)}
                >
                  <option value="" disabled>Select status</option>
                  {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </Select>
              </StatusSelectWrapper>
            </FormGroup>

            <FormGroup $mobileOrder={2}>
              <Label>{progressLabel} {anime.totalEpisodes ? `/ ${anime.totalEpisodes}` : ''}</Label>
              <Input
                type="number"
                min="0"
                max={anime.totalEpisodes || undefined}
                value={progress}
                onChange={(e) => setProgress(e.target.value !== '' ? Number(e.target.value) : '')}
              />
            </FormGroup>

            <FormGroup $mobileOrder={3}>
              <Label>Score (0-100)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={score}
                onChange={(e) => setScore(e.target.value !== '' ? Number(e.target.value) : '')}
              />
            </FormGroup>

            <FormGroup $mobileOrder={5}>
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormGroup>

            <FormGroup $mobileOrder={6}>
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormGroup>

            <FormGroup $mobileOrder={4}>
              <Label>{repeatLabel}</Label>
              <Input
                type="number"
                min="0"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value !== '' ? Number(e.target.value) : '')}
              />
            </FormGroup>

            <FormGroup style={{ gridColumn: '1 / -1' }} $mobileOrder={7}>
              <Label>Custom Lists</Label>
              <Select value="" disabled>
                <option value="" disabled>Add to custom lists</option>
              </Select>
            </FormGroup>
          </FormGrid>

          <FormGroup style={{ gridColumn: '1 / -1' }} $mobileOrder={8}>
            <Label>Notes</Label>
            <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </FormGroup>

          <Footer>
            <DeleteBtn
              type="button"
              onClick={handleDelete}
              title={entry ? 'Delete from list' : 'Entry not in list yet'}
              disabled={!entry || loading || entrySaving || isSaving}
            >
              <IoTrashOutline size={16} />
            </DeleteBtn>
            <ActionButtons>
              <Btn $primary onClick={handleSave} disabled={loading || isSaving}>
                <IoPencilOutline /> {isSaving ? 'Saving...' : 'Save Changes'}
              </Btn>
              <Btn onClick={onClose}>
                <IoBanOutline /> Cancel
              </Btn>
            </ActionButtons>
          </Footer>
        </FormContainer>
      </ModalContent>
    </Overlay>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};
