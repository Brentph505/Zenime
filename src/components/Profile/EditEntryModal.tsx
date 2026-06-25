import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { FaHeart, FaRegHeart, FaTrash } from 'react-icons/fa';
import { useAuth } from '../../client/useAuth';
import { useAniListEntry } from '../../hooks/useAniListEntry';
import type { Anime } from '../../index';
import type { MediaListStatus, SaveEntryInput } from '../../client/authService';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  animation: fadeIn 0.2s ease;
`;

const ModalContent = styled.div`
  background: #0f0f11;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  display: flex;
  width: 90vw;
  max-width: 800px;
  max-height: 90vh;
  overflow: hidden;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  animation: popIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);

  @media (max-width: 600px) {
    flex-direction: column;
    overflow-y: auto;
  }
`;

const CoverImage = styled.img`
  width: 260px;
  object-fit: cover;
  flex-shrink: 0;

  @media (max-width: 600px) {
    width: 100%;
    height: 180px;
  }
`;

const FormContainer = styled.div`
  padding: 1.5rem;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const Title = styled.h2`
  margin: 0;
  font-size: 1.2rem;
  color: #fff;
  font-weight: 700;
  line-height: 1.3;
`;

const HeartBtn = styled.button<{ $active?: boolean }>`
  background: #1a1a1c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: ${({ $active }) => ($active ? '#f43f5e' : '#9ca3af')};
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
  }
`;

const GridRow = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 1rem;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const Label = styled.label`
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: 600;
`;

const Input = styled.input`
  background: #1a1a1c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  color: #fff;
  font-size: 0.85rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;

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
  background: #1a1a1c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 0.6rem 0.75rem;
  color: #fff;
  font-size: 0.85rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%239ca3af' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;

  &:focus {
    border-color: var(--primary-accent, #c084fc);
  }
`;

const TextArea = styled.textarea`
  background: #1a1a1c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 0.75rem;
  color: #fff;
  font-size: 0.85rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  min-height: 80px;
  resize: vertical;

  &:focus {
    border-color: var(--primary-accent, #c084fc);
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
  padding-top: 1rem;
`;

const DeleteBtn = styled.button`
  background: #1a1a1c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ef4444;
  border-radius: 6px;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    border-color: #ef4444;
  }
`;

const ActionButtons = styled.div`
  display: flex;
  gap: 0.75rem;
`;

const Btn = styled.button<{ $primary?: boolean }>`
  background: ${({ $primary }) => ($primary ? 'var(--primary-accent, #c084fc)' : '#1a1a1c')};
  color: ${({ $primary }) => ($primary ? '#fff' : '#e5e7eb')};
  border: 1px solid ${({ $primary }) => ($primary ? 'transparent' : 'rgba(255, 255, 255, 0.1)')};
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    filter: brightness(1.1);
  }
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
  if (!ymd) return { year: null, month: null, day: null };
  const [y, m, d] = ymd.split('-');
  return {
    year: parseInt(y, 10) || null,
    month: parseInt(m, 10) || null,
    day: parseInt(d, 10) || null,
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
        <CoverImage src={anime.image} alt="Cover" />
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
              <Btn onClick={onClose}>Cancel</Btn>
              <Btn $primary onClick={handleSave} disabled={loading || isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Btn>
            </ActionButtons>
          </Footer>
        </FormContainer>
      </ModalContent>
    </Overlay>
  );
};
