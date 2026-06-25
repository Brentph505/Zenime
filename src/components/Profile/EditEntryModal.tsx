import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import {
  FaHeart, FaRegHeart, FaTrash,
  FaTv, FaStar, FaRedo, FaCalendarAlt, FaCalendarCheck,
  FaRegStickyNote, FaListUl, FaBook, FaCheckCircle,
  FaBookmark, FaClock, FaBan, FaPause,
} from 'react-icons/fa';
import { useAuth } from '../../client/useAuth';
import { useAniListEntry } from '../../hooks/useAniListEntry';
import type { Anime } from '../../index';
import type { MediaListStatus, SaveEntryInput } from '../../client/authService';

/* ─────────────────────────── animations ─────────────────────────── */
const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const scaleIn = keyframes`
  from { opacity: 0; transform: translateY(14px) scale(0.97); }
  to   { opacity: 1; transform: translateY(0)    scale(1); }
`;

/* ─────────────────────────── status palette ──────────────────────── */
const STATUS_COLORS: Record<string, string> = {
  CURRENT:   '#10b981',
  PLANNING:  '#0ea5e9',
  COMPLETED: '#c084fc',
  REPEATING: '#f59e0b',
  PAUSED:    '#f97316',
  DROPPED:   '#ef4444',
};

/* ─────────────────────────── overlay ────────────────────────────── */
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.65);
  backdrop-filter: blur(8px);
  animation: ${fadeIn} 0.18s ease both;

  @media (max-width: 480px) {
    padding: 0;
    align-items: flex-end;
  }
`;

/* ─────────────────────────── modal shell ────────────────────────── */
const ModalContent = styled.div`
  background: var(--global-primary-bg, #0d1117);
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  display: flex;
  align-items: stretch;
  width: min(96%, 54rem);
  max-height: min(90vh, 44rem);
  overflow: hidden;
  box-shadow: 0 40px 100px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(192, 132, 252, 0.06);
  animation: ${scaleIn} 0.24s cubic-bezier(0.16, 1, 0.3, 1) both;
  position: relative;

  /* Signature: subtle accent line across the top */
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, #c084fc 35%, #a855f7 65%, transparent 100%);
    z-index: 2;
    border-radius: 16px 16px 0 0;
    opacity: 0.7;
  }

  @media (max-width: 600px) {
    flex-direction: column;
    width: 100%;
    max-height: 96vh;
    border-radius: 20px 20px 0 0;
    border-bottom: none;
  }
`;

/* ─────────────────────────── left cover panel (desktop) ─────────── */
const CoverPanel = styled.div`
  position: relative;
  width: 220px;
  flex-shrink: 0;
  overflow: hidden;

  @media (max-width: 600px) {
    display: none;
  }
`;

const CoverImg = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  display: block;
`;

const CoverOverlay = styled.div`
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0,0,0,0) 35%,
    rgba(13,17,23,0.65) 65%,
    rgba(13,17,23,0.95) 100%
  );
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 1.1rem;
  gap: 0.55rem;
`;

const CoverTitle = styled.h2`
  margin: 0;
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.35;
  text-shadow: 0 1px 6px rgba(0,0,0,0.5);
`;

const TypeBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--primary-accent, #c084fc);
  background: rgba(192, 132, 252, 0.12);
  border: 1px solid rgba(192, 132, 252, 0.2);
  padding: 0.2rem 0.5rem;
  border-radius: 5px;
  width: fit-content;
`;

/* ─────────────────────────── top banner (mobile) ────────────────── */
const MobileBanner = styled.div<{ $src: string }>`
  display: none;

  @media (max-width: 600px) {
    display: block;
    flex-shrink: 0;
    width: 100%;
    height: 150px;
    background: url(${({ $src }) => $src}) center/cover no-repeat;
    position: relative;

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(to bottom, rgba(0,0,0,0.05) 0%, rgba(13,17,23,0.88) 100%);
    }
  }
`;

const MobileBannerContent = styled.div`
  position: absolute;
  bottom: 0.85rem;
  left: 1rem;
  right: 1rem;
  z-index: 1;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 0.75rem;
`;

const MobileTitle = styled.h2`
  margin: 0;
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  line-height: 1.3;
  text-shadow: 0 1px 4px rgba(0,0,0,0.5);
`;

/* ─────────────────────────── form panel ─────────────────────────── */
const FormPanel = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
`;

const FormScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 1.4rem 1.5rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 0;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: var(--global-div, rgba(255,255,255,0.08));
    border-radius: 99px;
  }

  @media (max-width: 600px) {
    padding: 1rem 1rem 0.5rem;
    gap: 0.85rem;
  }
`;

/* ─────────────────────────── desktop header ─────────────────────── */
const DesktopHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--global-border, rgba(255,255,255,0.06));

  @media (max-width: 600px) {
    display: none;
  }
`;

const DesktopTitle = styled.h2`
  margin: 0;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--global-text, #c9d1d9);
  line-height: 1.3;
`;

/* ─────────────────────────── heart button ───────────────────────── */
const HeartBtn = styled.button<{ $active?: boolean }>`
  background: var(--global-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
  color: ${({ $active }) => ($active ? '#f43f5e' : 'var(--global-text-muted, #8b949e)')};
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.2s, border-color 0.2s, background 0.2s;

  &:hover {
    border-color: #f43f5e;
    color: #f43f5e;
    background: rgba(244, 63, 94, 0.1);
  }
  &:active { transform: scale(0.94); }
`;

/* ─────────────────────────── field grid ─────────────────────────── */
const Grid2 = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;

  @media (max-width: 400px) {
    grid-template-columns: 1fr;
  }
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
`;

const Label = styled.label`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--global-text-muted, #8b949e);
  letter-spacing: 0.03em;

  svg {
    flex-shrink: 0;
    opacity: 0.7;
  }
`;

/* ─────────────────────────── status select ──────────────────────── */
const StatusSelect = styled.select<{ $color: string }>`
  background: var(--global-card-bg, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
  border-left: 3px solid ${({ $color }) => $color};
  border-radius: 8px;
  padding: 0.6rem 2rem 0.6rem 0.8rem;
  color: var(--global-text, #c9d1d9);
  font-size: 0.85rem;
  font-weight: 500;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  appearance: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath fill='%239ca3af' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.75rem center;
  cursor: pointer;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--primary-accent, #c084fc);
    border-left-color: ${({ $color }) => $color};
  }

  option {
    background: var(--global-secondary-bg, #161b22);
    color: var(--global-text, #c9d1d9);
  }
`;

/* ─────────────────────────── number/text inputs ─────────────────── */
const Input = styled.input`
  background: var(--global-card-bg, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
  border-radius: 8px;
  padding: 0.6rem 0.8rem;
  color: var(--global-text, #c9d1d9);
  font-size: 0.85rem;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    border-color: var(--primary-accent, #c084fc);
    box-shadow: 0 0 0 3px rgba(192, 132, 252, 0.1);
  }
  &::-webkit-calendar-picker-indicator {
    filter: invert(1);
    opacity: 0.45;
    cursor: pointer;
  }
  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }
`;

/* ─────────────────────────── divider ────────────────────────────── */
const Divider = styled.div`
  height: 1px;
  background: var(--global-border, rgba(255,255,255,0.06));
  margin: 0.15rem 0;
`;

/* ─────────────────────────── notes textarea ─────────────────────── */
const TextArea = styled.textarea`
  background: var(--global-card-bg, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
  border-radius: 8px;
  padding: 0.65rem 0.8rem;
  color: var(--global-text, #c9d1d9);
  font-size: 0.85rem;
  font-family: inherit;
  outline: none;
  width: 100%;
  box-sizing: border-box;
  min-height: 76px;
  resize: vertical;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    border-color: var(--primary-accent, #c084fc);
    box-shadow: 0 0 0 3px rgba(192, 132, 252, 0.1);
  }
`;

/* ─────────────────────────── footer ─────────────────────────────── */
const Footer = styled.div`
  flex-shrink: 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.85rem 1.5rem 1.1rem;
  border-top: 1px solid var(--global-border, rgba(255,255,255,0.06));
  background: var(--global-primary-bg, #0d1117);

  @media (max-width: 600px) {
    padding: 0.75rem 1rem 1rem;
  }
`;

const DeleteBtn = styled.button`
  background: transparent;
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: rgba(239, 68, 68, 0.7);
  border-radius: 8px;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.55);
    color: #ef4444;
  }
  &:active { transform: scale(0.94); }
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 0.6rem;
`;

const CancelBtn = styled.button`
  background: transparent;
  color: var(--global-text-muted, #8b949e);
  border: 1px solid var(--global-border, rgba(255, 255, 255, 0.1));
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.83rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    background: rgba(255,255,255,0.04);
    color: var(--global-text, #c9d1d9);
  }
  &:active { transform: scale(0.97); }
`;

const SaveBtn = styled.button`
  background: var(--primary-accent, #c084fc);
  color: #fff;
  border: 1px solid transparent;
  padding: 0.5rem 1.1rem;
  border-radius: 8px;
  font-size: 0.83rem;
  font-weight: 700;
  cursor: pointer;
  letter-spacing: 0.01em;
  transition: filter 0.15s, transform 0.12s, box-shadow 0.15s;

  &:hover:not(:disabled) {
    filter: brightness(1.12);
    box-shadow: 0 0 18px rgba(192, 132, 252, 0.35);
  }
  &:active:not(:disabled) { transform: scale(0.97); }
  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
`;

/* ─────────────────────────── data ────────────────────────────────── */
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

/* ─────────────────────────── helpers ─────────────────────────────── */
interface EditEntryModalProps {
  anime: Anime;
  isOpen: boolean;
  onClose: () => void;
}

function dateObjToYMD(obj?: { year?: number | null; month?: number | null; day?: number | null }) {
  if (!obj || !obj.year) return '';
  const y = obj.year;
  const m = obj.month ? String(obj.month).padStart(2, '0') : '01';
  const d = obj.day   ? String(obj.day).padStart(2, '0')   : '01';
  return `${y}-${m}-${d}`;
}

function ymdToDateObj(ymd: string) {
  if (!ymd) return { year: undefined, month: undefined, day: undefined };
  const [y, m, d] = ymd.split('-');
  return {
    year:  parseInt(y, 10) || undefined,
    month: parseInt(m, 10) || undefined,
    day:   parseInt(d, 10) || undefined,
  };
}

/* ─────────────────────────── status icon map ─────────────────────── */
const STATUS_ICON: Record<string, React.ReactElement> = {
  CURRENT:   <FaTv size={10} />,
  PLANNING:  <FaBookmark size={10} />,
  COMPLETED: <FaCheckCircle size={10} />,
  REPEATING: <FaRedo size={10} />,
  PAUSED:    <FaPause size={10} />,
  DROPPED:   <FaBan size={10} />,
};

/* ═══════════════════════════ component ═══════════════════════════ */
export const EditEntryModal: React.FC<EditEntryModalProps> = ({ anime, isOpen, onClose }) => {
  const { isLoggedIn, saveEntry } = useAuth();
  const mediaId = Number(anime.id);
  const { loading, entry, isFavourite, toggleFavourite, deleteFromList } = useAniListEntry(mediaId, isLoggedIn && isOpen);

  const [status,    setLocalStatus] = useState<MediaListStatus | ''>('');
  const [progress,  setProgress]    = useState<number | ''>('');
  const [score,     setScore]       = useState<number | ''>('');
  const [startDate, setStartDate]   = useState('');
  const [endDate,   setEndDate]     = useState('');
  const [repeat,    setRepeat]      = useState<number | ''>('');
  const [notes,     setNotes]       = useState('');
  const [isSaving,  setIsSaving]    = useState(false);

  useEffect(() => {
    if (!loading && entry) {
      setLocalStatus(entry.status || '');
      setProgress(entry.progress || '');
      setScore(entry.score || '');
      setStartDate(dateObjToYMD(entry.startedAt));
      setEndDate(dateObjToYMD(entry.completedAt));
      setRepeat(entry.repeat || '');
      setNotes(entry.notes || '');
    }
  }, [loading, entry]);

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

  const isManga      = ['MANGA', 'ONE_SHOT', 'NOVEL', 'LIGHT_NOVEL'].includes(anime.type);
  const statusOptions = isManga ? MANGA_STATUS_OPTIONS : ANIME_STATUS_OPTIONS;
  const progressLabel = isManga ? 'Chapters' : 'Episodes';
  const repeatLabel   = isManga ? 'Rereads'  : 'Rewatches';
  const mediaType     = isManga ? 'Manga'    : 'Anime';
  const statusColor   = STATUS_COLORS[status] ?? 'rgba(255,255,255,0.15)';
  const displayTitle  = anime.title.english || anime.title.romaji;

  const handleSave = async () => {
    setIsSaving(true);
    const input: SaveEntryInput = { mediaId };
    if (status)      input.status      = status as MediaListStatus;
    if (progress !== '') input.progress = Number(progress);
    if (score    !== '') input.score    = Number(score);
    if (startDate)   input.startedAt   = ymdToDateObj(startDate);
    if (endDate)     input.completedAt = ymdToDateObj(endDate);
    if (repeat   !== '') input.repeat  = Number(repeat);
    if (notes !== undefined) input.notes = notes;

    const res = await saveEntry(input);
    setIsSaving(false);
    if (res) {
      window.dispatchEvent(new CustomEvent('anilist-entry-changed'));
      onClose();
    } else {
      alert('Failed to save entry.');
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Remove this from your list?')) {
      const ok = await deleteFromList();
      if (ok) onClose();
    }
  };

  const heartBtn = (
    <HeartBtn
      $active={isFavourite}
      onClick={() => toggleFavourite(isManga ? 'MANGA' : 'ANIME')}
      title={isFavourite ? 'Remove from favourites' : 'Add to favourites'}
    >
      {isFavourite ? <FaHeart size={13} /> : <FaRegHeart size={13} />}
    </HeartBtn>
  );

  return (
    <Overlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>

        {/* ── desktop: left cover panel ── */}
        <CoverPanel>
          <CoverImg src={anime.image} alt={displayTitle} />
          <CoverOverlay>
            <TypeBadge>
              {isManga ? <FaBook size={8} /> : <FaTv size={8} />}
              {mediaType}
            </TypeBadge>
            <CoverTitle>{displayTitle}</CoverTitle>
            {heartBtn}
          </CoverOverlay>
        </CoverPanel>

        {/* ── mobile: top banner ── */}
        <MobileBanner $src={anime.image}>
          <MobileBannerContent>
            <MobileTitle>{displayTitle}</MobileTitle>
            {heartBtn}
          </MobileBannerContent>
        </MobileBanner>

        {/* ── right / bottom form panel ── */}
        <FormPanel>
          <FormScroll>

            {/* desktop header */}
            <DesktopHeader>
              <DesktopTitle>{displayTitle}</DesktopTitle>
            </DesktopHeader>

            {/* status — full width with dynamic color indicator */}
            <FormGroup>
              <Label>
                {STATUS_ICON[status] ?? <FaListUl size={10} />}
                Status
              </Label>
              <StatusSelect
                $color={statusColor}
                value={status}
                onChange={(e) => setLocalStatus(e.target.value as MediaListStatus)}
              >
                <option value="" disabled>Select status…</option>
                {statusOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </StatusSelect>
            </FormGroup>

            <Divider />

            {/* progress + score */}
            <Grid2>
              <FormGroup>
                <Label>
                  {isManga ? <FaBook size={10} /> : <FaTv size={10} />}
                  {progressLabel}
                  {anime.totalEpisodes ? ` / ${anime.totalEpisodes}` : ''}
                </Label>
                <Input
                  type="number"
                  min="0"
                  max={anime.totalEpisodes || undefined}
                  value={progress}
                  onChange={(e) => setProgress(e.target.value !== '' ? Number(e.target.value) : '')}
                  placeholder="0"
                />
              </FormGroup>

              <FormGroup>
                <Label>
                  <FaStar size={10} />
                  Score (0–100)
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={score}
                  onChange={(e) => setScore(e.target.value !== '' ? Number(e.target.value) : '')}
                  placeholder="—"
                />
              </FormGroup>
            </Grid2>

            {/* start + end dates */}
            <Grid2>
              <FormGroup>
                <Label>
                  <FaCalendarAlt size={10} />
                  Start Date
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </FormGroup>

              <FormGroup>
                <Label>
                  <FaCalendarCheck size={10} />
                  End Date
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </FormGroup>
            </Grid2>

            {/* repeat — narrower, lives in its own row */}
            <FormGroup style={{ maxWidth: '50%' }}>
              <Label>
                <FaRedo size={10} />
                {repeatLabel}
              </Label>
              <Input
                type="number"
                min="0"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value !== '' ? Number(e.target.value) : '')}
                placeholder="0"
              />
            </FormGroup>

            <Divider />

            {/* notes */}
            <FormGroup>
              <Label>
                <FaRegStickyNote size={10} />
                Notes
              </Label>
              <TextArea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add a personal note…"
              />
            </FormGroup>

          </FormScroll>

          {/* footer */}
          <Footer>
            {entry ? (
              <DeleteBtn onClick={handleDelete} title="Remove from list">
                <FaTrash size={12} />
              </DeleteBtn>
            ) : <div />}

            <ActionGroup>
              <SaveBtn onClick={handleSave} disabled={loading || isSaving}>
                {isSaving ? 'Saving…' : 'Save Changes'}
              </SaveBtn>
              <CancelBtn onClick={onClose}>Cancel</CancelBtn>
            </ActionGroup>
          </Footer>
        </FormPanel>

      </ModalContent>
    </Overlay>
  );
};
