import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import styled, { css, keyframes } from 'styled-components';
import {
  FaChevronLeft,
  FaChevronRight,
  FaBars,
  FaTimes,
  FaExpand,
  FaCompress,
  FaSearch,
  FaCheckCircle,
  FaRedo,
} from 'react-icons/fa';
import {
  fetchMangaInfo,
  fetchMangaRead,
  Manga,
  MangaReadPage,
  Episode,
  buildImageProxyUrl,
  buildHentaiImageProxyUrl,
  useAuth,
  useSettings,
  syncMangaReadProgress,
  MangaBookmarkButton,
} from '../index';
import {
  saveLastMangaVisited,
  addReadChapterIfMissing,
  setLastReadChapter,
  getLastReadChapter,
} from '../lib/mangaHistory';

type MangaChapter = Episode & { url?: string };

function getChapterShortLabel(chapter: MangaChapter) {
  if (typeof chapter.number === 'number') return `CH ${chapter.number}`;
  if (chapter.title?.trim()) return chapter.title.trim();
  if (chapter.id) {
    const parts = chapter.id.split('/');
    return parts[parts.length - 1] || chapter.id;
  }
  return 'Chapter';
}

function getChapterHeading(chapter: MangaChapter) {
  if (typeof chapter.number === 'number') return `Chapter ${chapter.number}`;
  if (chapter.title?.trim()) return chapter.title.trim();
  if (chapter.id) {
    const parts = chapter.id.split('/');
    const last = parts[parts.length - 1];
    return last ? `Chapter ${last}` : chapter.id;
  }
  return 'Chapter';
}

/** Resolve AniList chapter progress from number, title, list index, or id slug. */
function getChapterProgressForAniList(
  chapter: MangaChapter,
  chapterList: MangaChapter[],
): number {
  if (typeof chapter.number === 'number' && chapter.number > 0) {
    return chapter.number;
  }
  const parsed = parseInt(String(chapter.number ?? ''), 10);
  if (!Number.isNaN(parsed) && parsed > 0) return parsed;

  const titleMatch = chapter.title?.match(/(\d+(?:\.\d+)?)/);
  if (titleMatch) {
    const fromTitle = parseFloat(titleMatch[1]);
    if (!Number.isNaN(fromTitle) && fromTitle > 0) return Math.floor(fromTitle);
  }

  const idx = chapterList.findIndex(
    (c) => c.id === chapter.id || (c.url && c.url === chapter.url),
  );
  if (idx >= 0) return idx + 1;

  if (chapter.id) {
    const slug = chapter.id.split('/').filter(Boolean).pop() ?? '';
    const fromSlug = parseFloat(slug.replace(/[^\d.]/g, ''));
    if (!Number.isNaN(fromSlug) && fromSlug > 0) return Math.floor(fromSlug);
  }

  return 0;
}

/* ─── Animations ─────────────────────────────────────────── */
const slideInRight = keyframes`
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
`;
const slideOutRight = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
`;
const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;
const spin = keyframes`
  to { transform: rotate(360deg); }
`;

/* ══════════════════════════════════════════════════════════
   LAYOUT
══════════════════════════════════════════════════════════ */
const PageShell = styled.div`
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  background: var(--global-primary-bg);
  color: var(--global-text);
  overflow: hidden;
`;

/* ─── Compact single-row header ──────────────────────────── */
const TopBar = styled.header<{ $hidden?: boolean }>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0 0.6rem;
  height: 3rem;
  background: var(--global-secondary-bg);
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  transition: transform 0.28s ease, opacity 0.28s ease;
  will-change: transform;
  z-index: 10;

  ${({ $hidden }) =>
    $hidden &&
    css`
      transform: translateY(-100%);
      opacity: 0;
      pointer-events: none;
      position: absolute;
      top: 0; left: 0; right: 0;
    `}
`;

/* ─── Buttons ─────────────────────────────────────────────── */
const Btn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: none;
  border-radius: var(--global-border-radius, 6px);
  padding: 0.4rem 0.65rem;
  background: transparent;
  color: var(--global-text);
  cursor: pointer;
  font-size: 0.82rem;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;

  &:hover { background: rgba(255,255,255,0.08); color: var(--global-text); }
  &:disabled { opacity: 0.3; cursor: not-allowed; }
  svg { font-size: 0.75rem; }

  @media (max-width: 767px) {
    padding: 0.38rem 0.5rem;
    font-size: 0.78rem;
  }
`;

const PrimaryBtn = styled(Btn)`
  background: var(--primary-accent);
  color: #fff;
  box-shadow: 0 0 8px rgba(138, 43, 226, 0.4);
  &:hover:not(:disabled) { opacity: 0.85; background: var(--primary-accent); }
`;

const PurpleBtn = styled(Btn)`
  background: rgba(109, 40, 217, 0.9);
  color: #fff;
  &:hover { background: rgba(109, 40, 217, 1); }
`;

const Sep = styled.div`
  width: 1px;
  height: 1.2rem;
  background: var(--global-border);
  flex-shrink: 0;
  @media (max-width: 767px) { display: none; }
`;

/* Spacer — hidden on mobile so MobileLabel fills the gap instead */
const Grow = styled.div`
  flex: 0 0 0;
  min-width: 0;
  @media (max-width: 767px) { display: none; }
`;

/* ─── Desktop center block ────────────────────────────────── */
const TitleBlock = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  width: 100%;
  max-width: none;
  min-width: 0;
  gap: 0.12rem;
  @media (max-width: 767px) { display: none; }
`;

const TitleMain = styled.span`
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--global-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const ProgRow = styled.div`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  max-width: 100%;
`;

const ProgTrack = styled.div<{ $pct: number }>`
  flex: 1;
  height: 3px;
  background: rgba(255,255,255,0.2);
  border-radius: 99px;
  overflow: hidden;
  &::after {
    content: '';
    display: block;
    height: 100%;
    width: ${({ $pct }) => $pct}%;
    background: var(--primary-accent);
    transition: width 0.35s ease;
  }
`;

const ProgLabel = styled.span`
  font-size: 0.64rem;
  color: var(--global-text-muted, rgba(255,255,255,0.4));
  white-space: nowrap;
  flex-shrink: 0;
`;

/* ─── Mobile compact label ────────────────────────────────── */
/*
 * flex: 1 here + Grow hidden on mobile = this element fills all
 * remaining horizontal space → text naturally centres between
 * the Back button on the left and the nav controls on the right.
 */
const MobileLabel = styled.div`
  display: none;
  @media (max-width: 767px) {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    align-items: center;
  }
`;

const MobileLabelMain = styled.span`
  font-size: 0.76rem;
  font-weight: 700;
  color: var(--global-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
`;

const MobileLabelSub = styled.span`
  font-size: 0.62rem;
  color: var(--global-text-muted, rgba(255,255,255,0.4));
  white-space: nowrap;
`;

/* ══════════════════════════════════════════════════════════
   READER BODY
══════════════════════════════════════════════════════════ */
const ReaderBody = styled.div`
  display: flex;
  flex: 1;
  overflow: hidden;
  min-height: 0;
`;

/* ─── Pages column ────────────────────────────────────────── */
const PagesColumn = styled.main<{ $blurred?: boolean }>`
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  background: #000;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  transition: filter 0.15s ease;

  /* 4px breathing room on each side of the page strip */
  padding: 0 4px;

  @media (max-width: 767px) { 
    padding: 0 0 3rem 4px; 
  }

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }

  @media (max-width: 767px) {
    &::-webkit-scrollbar { width: 4px; }
  }

  ${({ $blurred }) => $blurred && css`filter: blur(3px); pointer-events: none;`}
`;

const PageWrapper = styled.div`
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  margin: 0 auto;
  position: relative;
  line-height: 0;
  & + & { margin-top: 2px; }
`;

const MangaImg = styled.img<{ $visible?: boolean }>`
  width: 100%;
  max-width: 100%;
  height: auto;
  display: block;
  background: #111;
  pointer-events: none;
  touch-action: pan-y;
  opacity: ${({ $visible }) => ($visible ? 1 : 0)};
  transition: opacity 0.2s ease;
`;

const PageNum = styled.div`
  position: absolute;
  bottom: 6px;
  right: 8px;
  background: rgba(0,0,0,0.55);
  color: rgba(255,255,255,0.55);
  font-size: 0.64rem;
  padding: 1px 6px;
  border-radius: 99px;
  pointer-events: none;
  user-select: none;
`;

const LoadingCell = styled.div`
  width: 100%;
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111;
`;

const PlaceholderCell = styled.div`
  width: 100%;
  min-height: 400px;
  background: #111;
`;

const Spinner = styled.div`
  width: 26px;
  height: 26px;
  border: 2.5px solid rgba(255,255,255,0.08);
  border-top-color: var(--primary-accent);
  border-radius: 50%;
  animation: ${spin} 0.75s linear infinite;
`;

const ErrorCell = styled.div`
  width: 100%;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  background: #0c0c0c;
`;

const ErrorMsg = styled.p`
  margin: 0;
  color: #f87171;
  font-size: 0.8rem;
`;

const RetryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  border: 1px solid rgba(248,113,113,0.35);
  background: transparent;
  color: #f87171;
  padding: 0.28rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  cursor: pointer;
  &:hover { background: rgba(248,113,113,0.08); }
`;

/* ─── Empty states ────────────────────────────────────────── */
const Empty = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  color: var(--global-text-muted, rgba(255,255,255,0.35));
  font-size: 0.9rem;
  min-height: 60vh;
`;

/* ─── End of chapter ─────────────────────────────────────── */
const EocCard = styled.div`
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  background: var(--global-secondary-bg);
  border-top: 1px solid rgba(255,255,255,0.06);
  padding: 2.5rem 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
`;

const EocIcon = styled.div`
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(var(--primary-accent-rgb, 138,43,226), 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--primary-accent);
  font-size: 1.3rem;
`;

const EocTitle = styled.h3`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 800;
  color: var(--primary-accent);
`;

const EocSub = styled.p`
  margin: 0;
  font-size: 0.82rem;
  color: var(--global-text-muted, rgba(255,255,255,0.4));
`;

const EocBtnRow = styled.div`
  display: flex;
  gap: 0.65rem;
  flex-wrap: nowrap;
  justify-content: center;
  width: 100%;
  max-width: 640px;
`;

const EocBtn = styled.button<{ $primary?: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  flex: 1 1 0;
  min-width: 0;
  border: 1px solid var(--global-border);
  border-radius: var(--global-border-radius, 8px);
  padding: 0.55rem 1.2rem;
  white-space: nowrap;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
  background: ${({ $primary }) => ($primary ? 'var(--primary-accent)' : 'var(--global-card-bg)')};
  color: ${({ $primary }) => ($primary ? '#fff' : 'var(--global-text)')};
  &:hover { opacity: 0.82; transform: translateY(-1px); }
`;

/* ══════════════════════════════════════════════════════════
   SIDEBAR
══════════════════════════════════════════════════════════ */
const DesktopSidebar = styled.aside<{ $collapsed?: boolean }>`
  width: ${({ $collapsed }) => ($collapsed ? '0' : '260px')};
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--global-secondary-bg);
  border-left: 1px solid var(--global-border);
  transition: width 0.25s cubic-bezier(0.4,0,0.2,1);
  @media (max-width: 767px) { display: none; }
`;

const Overlay = styled.div<{ $visible: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  z-index: 298;
  backdrop-filter: blur(2px);
  display: ${({ $visible }) => ($visible ? 'block' : 'none')};
  animation: ${fadeIn} 0.18s ease;
`;

const MobileDrawer = styled.aside<{ $open: boolean; $closing: boolean }>`
  position: fixed;
  top: 0; right: 0; bottom: 0;
  width: min(75vw, 300px);
  z-index: 299;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--global-primary-bg);
  border-left: 1px solid var(--global-border);
  transform: translateX(100%);

  ${({ $open, $closing }) =>
    $open && !$closing &&
    css`animation: ${slideInRight} 0.2s cubic-bezier(0.25,0.46,0.45,0.94) forwards;`}
  ${({ $closing }) =>
    $closing &&
    css`animation: ${slideOutRight} 0.2s cubic-bezier(0.55,0,1,0.45) forwards;`}
`;

/* Sidebar internals */
const SbHead = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 0.85rem;
  border-bottom: 1px solid var(--global-border);
`;

const SbSection = styled.div`
  flex-shrink: 0;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--global-border);
`;

const SbSectionLabel = styled.p`
  margin: 0 0 0.4rem;
  font-size: 0.63rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--global-text-muted, rgba(255,255,255,0.35));
`;

const ProvRow = styled.div`
  display: flex;
  gap: 0.35rem;
`;

const ProvBtn = styled.button<{ $active?: boolean }>`
  flex: 1;
  border: none;
  border-radius: 6px;
  padding: 0.42rem 0.35rem;
  font-size: 0.76rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  background: ${({ $active }) => ($active ? 'var(--primary-accent)' : 'var(--global-card-bg)')};
  color: ${({ $active }) => ($active ? '#fff' : 'var(--global-text-muted)')};
  &:hover { opacity: 0.85; }
`;

const SearchWrap = styled.div`
  flex-shrink: 0;
  position: relative;
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid var(--global-border);

  svg {
    position: absolute;
    left: 1.25rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--global-text-muted);
    font-size: 0.7rem;
    pointer-events: none;
  }
`;

const SearchInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  background: var(--global-card-bg);
  border: 1px solid var(--global-border);
  border-radius: 6px;
  padding: 0.4rem 0.65rem 0.4rem 1.8rem;
  color: var(--global-text);
  font-size: 0.8rem;
  outline: none;
  transition: border-color 0.15s;
  &::placeholder { color: var(--global-text-muted); }
  &:focus { border-color: var(--primary-accent); }
`;

const SbChapterHeader = styled.div`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.85rem 0.28rem;
`;

const SbChLabel = styled.span`
  font-size: 0.63rem;
  text-transform: uppercase;
  letter-spacing: 0.09em;
  color: var(--global-text-muted, rgba(255,255,255,0.35));
`;

const SbChCount = styled.span`
  background: var(--global-card-bg);
  color: var(--global-text-muted);
  font-size: 0.68rem;
  padding: 1px 6px;
  border-radius: 99px;
`;

const ChapterList = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.3rem;
  display: flex;
  flex-direction: column;
  gap: 1px;

  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
  &:hover { scrollbar-color: var(--global-text-muted) transparent; }

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: transparent; border-radius: 99px; }
  &:hover::-webkit-scrollbar-thumb { background: var(--global-border); }
`;

const ChBtn = styled.button<{ $active?: boolean }>`
  width: 100%;
  text-align: left;
  border: none;
  border-left: 2px solid ${({ $active }) => ($active ? 'var(--primary-accent)' : 'transparent')};
  border-radius: 5px;
  padding: 0.5rem 0.65rem;
  font-size: 0.8rem;
  cursor: pointer;
  transition: background 0.13s, color 0.13s;
  background: ${({ $active }) =>
    $active ? 'rgba(var(--primary-accent-rgb, 138,43,226), 0.15)' : 'transparent'};
  color: ${({ $active }) => ($active ? '#fff' : 'var(--global-text)')};

  &:hover {
    background: rgba(var(--primary-accent-rgb, 138,43,226), 0.1);
    color: #fff;
  }
`;

const ChMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 0.45rem;

  .num {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--global-text-muted);
    flex-shrink: 0;
  }
  .ttl {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 0.8rem;
    color: var(--global-text);
  }
`;

const SbEmpty = styled.div`
  padding: 1.5rem 1rem;
  text-align: center;
  color: var(--global-text-muted);
  font-size: 0.82rem;
`;

/* ─── Mobile bottom progress ──────────────────────────────── */
const MobileProgress = styled.div<{ $blurred?: boolean }>`
  display: none;

  @media (max-width: 767px) {
    display: flex;
    position: fixed;
    bottom: 0; left: 0; right: 0;
    z-index: 50;
    align-items: center;
    gap: 0.6rem;
    padding: 0.42rem 0.85rem;
    background: var(--global-secondary-bg);
    backdrop-filter: blur(10px);
    border-top: 1px solid var(--global-border);
    transition: filter 0.15s;
    ${({ $blurred }) => $blurred && css`filter: blur(3px); pointer-events: none;`}
  }
`;

const MbPct = styled.span`
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--primary-accent);
  min-width: 30px;
`;

const MbPages = styled.span`
  font-size: 0.68rem;
  color: var(--global-text-muted);
  min-width: 42px;
  text-align: right;
`;

/* ══════════════════════════════════════════════════════════
   PAGE STATE
══════════════════════════════════════════════════════════ */
interface PageState {
  loaded: boolean;
  loading: boolean;
  error: boolean;
  visible: boolean;
  retryTs: number;
}

/* ══════════════════════════════════════════════════════════
   COMPONENT
══════════════════════════════════════════════════════════ */
function Read() {
  const { animeId } = useParams();
  const navigate = useNavigate();
  // FIX: pull the setter too — this was previously read-only, which is why
  // chapter/provider changes never made it into the URL.
  const [searchParams, setSearchParams] = useSearchParams();
  const { isLoggedIn } = useAuth();
  const { settings } = useSettings();

  const [mangaInfo, setMangaInfo] = useState<Manga | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<MangaChapter | null>(null);
  const [visibleChapter, setVisibleChapter] = useState<MangaChapter | null>(null);
  const selectedChapterRef = useRef<MangaChapter | null>(null);
  const providerSwitchRef = useRef(false);
  const [readPages, setReadPages] = useState<MangaReadPage[]>([]);
  const [provider, setProvider] = useState<'mangahere' | 'mangapill' | 'hentaireadio' | 'hentai20'>('mangahere');
  const [availableProviders, setAvailableProviders] = useState<Array<'mangahere' | 'mangapill' | 'hentaireadio' | 'hentai20'>>([]);
  const [isHentaiManga, setIsHentaiManga] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);

  useEffect(() => {
    selectedChapterRef.current = selectedChapter;
  }, [selectedChapter]);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageStates, setPageStates] = useState<PageState[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarClosing, setSidebarClosing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const activeChapterRef = useRef<HTMLButtonElement | null>(null);
  const pagesColRef = useRef<HTMLDivElement | null>(null);
  const lastScrollY = useRef(0);
  const scrollRaf = useRef<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Throttle: only one AniList progress sync per chapter id.
  const syncedChaptersRef = useRef<Set<string>>(new Set());
  // Tracks chapter ids we've already restored scroll position for, so the
  // resume effect only runs once per chapter (and never fights the observer).
  const restoredScrollRef = useRef<Set<string>>(new Set());

  const chapterIdParam = searchParams.get('chapterId') || '';
  const providerParam = searchParams.get('provider');

  /* ── Derived ── */
  const chapters = useMemo(
    () => ((mangaInfo?.chapters ?? []) as MangaChapter[]).slice(0, 250),
    [mangaInfo]
  );

  const filteredChapters = useMemo(() => {
    const q = searchTerm.toLowerCase();
    if (!q) return chapters;
    return chapters.filter((c) =>
      getChapterHeading(c).toLowerCase().includes(q) ||
      getChapterShortLabel(c).toLowerCase().includes(q)
    );
  }, [chapters, searchTerm]);

  const currentChapter = visibleChapter;
  const pageCount = readPages.length;
  const progressPct = pageCount > 0 ? Math.round(((currentPage + 1) / pageCount) * 100) : 0;

  const prevChapter = useMemo(() => {
    if (!currentChapter) return null;
    const idx = chapters.findIndex((c) => c.id === currentChapter.id);
    return idx > 0 ? chapters[idx - 1] : null;
  }, [chapters, currentChapter]);

  const nextChapter = useMemo(() => {
    if (!currentChapter) return null;
    const idx = chapters.findIndex((c) => c.id === currentChapter.id);
    return idx >= 0 && idx < chapters.length - 1 ? chapters[idx + 1] : null;
  }, [chapters, currentChapter]);

  /* ── Mobile detect ── */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /* ── Provider init ── */
  useEffect(() => {
    if (providerParam === 'mangapill' || providerParam === 'mangahere' || providerParam === 'hentaireadio' || providerParam === 'hentai20') {
      setProvider(providerParam); return;
    }
    const stored = localStorage.getItem('manga-provider-preference');
    if (stored === 'mangapill' || stored === 'mangahere' || stored === 'hentaireadio' || stored === 'hentai20') {
      setProvider(stored as 'mangahere' | 'mangapill' | 'hentaireadio' | 'hentai20');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Sidebar collapse persist ── */
  useEffect(() => {
    const v = localStorage.getItem('manga-sidebar-collapsed');
    if (v !== null) setSidebarCollapsed(v === 'true');
  }, []);
  useEffect(() => {
    localStorage.setItem('manga-sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  /*
   * FIX: URL sync helper.
   * Writes the current chapter + provider into the URL via `replace` so the
   * address bar always reflects what's on screen (refresh / share / browser
   * back-forward all work), without spamming history on every page-scroll.
   * Uses the functional form of setSearchParams so this callback never needs
   * `searchParams` as a dependency (avoids stale closures / extra re-creates).
   */
  const updateUrl = useCallback((chapter: MangaChapter | null, providerVal: string) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (chapter?.id) {
        params.set('chapterId', chapter.id);
      } else {
        params.delete('chapterId');
      }
      params.set('provider', providerVal);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  /* FIX: single place that changes chapter + keeps the URL in sync. */
  const goToChapter = useCallback((chapter: MangaChapter | null) => {
    if (!chapter) return;
    providerSwitchRef.current = false;
    setSelectedChapter(chapter);
    setVisibleChapter(chapter);
    updateUrl(chapter, provider);
    if (isMobile) closeSidebarRef.current?.();
  }, [provider, updateUrl, isMobile]);

  // Ref indirection so goToChapter doesn't need closeSidebar in its deps
  // before closeSidebar is declared below.
  const closeSidebarRef = useRef<(() => void) | null>(null);

  /* ── Fetch manga info ── */
  useEffect(() => {
    if (!animeId) return;
    // FIX: cancellation guard — prevents an older, slower request from a
    // rapid provider/chapter switch overwriting state set by a newer one.
    let cancelled = false;

    setIsLoading(true);
    setError(null);

    const hasEntries = (data: Partial<Manga> | null | undefined) => {
      const chapters = (data as Manga | undefined)?.chapters ?? [];
      return Array.isArray(chapters) && chapters.length > 0;
    };

    (async () => {
      try {
        const aniListData = await fetchMangaInfo(animeId, provider).catch(() => null as Manga | null);
        if (cancelled) return;

        const isHentai = (aniListData?.genres?.some((g: string) => g.toLowerCase() === 'hentai') || aniListData?.isAdult === true) || provider === 'hentaireadio' || provider === 'hentai20';
        setIsHentaiManga(isHentai);

        const candidates: Array<'mangahere' | 'mangapill' | 'hentaireadio' | 'hentai20'> = isHentai
          ? ['hentaireadio', 'hentai20']
          : (provider === 'mangapill' ? ['mangapill', 'mangahere'] : ['mangahere', 'mangapill']);

        const probeResults = await Promise.allSettled(
          candidates.map(async (candidate) => {
            const data = await fetchMangaInfo(animeId, candidate);
            return { candidate, data, hasData: hasEntries(data) };
          }),
        );
        if (cancelled) return;

        const viable: Array<'mangahere' | 'mangapill' | 'hentaireadio' | 'hentai20'> = [];
        const dataMap: Partial<Record<'mangahere' | 'mangapill' | 'hentaireadio' | 'hentai20', Manga>> = {};
        let fallbackData: Manga | null = null;

        for (const result of probeResults) {
          if (result.status === 'fulfilled') {
            const { candidate, data, hasData } = result.value;
            if (hasData) {
              viable.push(candidate);
              dataMap[candidate] = data as Manga;
            }
            if (!fallbackData) fallbackData = (data as Manga) ?? null;
          }
        }

        setAvailableProviders(viable);

        const chosenProvider = viable.includes(provider as any)
          ? provider
          : viable[0] ?? candidates[0] ?? provider;
        const data = dataMap[chosenProvider] ?? fallbackData ?? aniListData ?? null;

        if (data) {
          setMangaInfo(data);
          if (chosenProvider !== provider) {
            providerSwitchRef.current = true;
            setProvider(chosenProvider);
          }

          const chs = (data?.chapters ?? []) as MangaChapter[];
          if (!chs.length) {
            setSelectedChapter(null);
            setVisibleChapter(null);
            return;
          }

          const previousChapter = selectedChapterRef.current;
          const chapterSlug = chapterIdParam.split('/').filter(Boolean).pop() || '';

          const findBySlug = (chapter: MangaChapter) =>
            chapter.id === chapterIdParam ||
            chapter.url === chapterIdParam ||
            (chapterSlug && (chapter.id.endsWith(chapterSlug) || chapter.url?.endsWith(chapterSlug)));

          const findByPrevious = (chapter: MangaChapter) =>
            previousChapter && (
              chapter.id === previousChapter.id ||
              chapter.url === previousChapter.url ||
              (typeof previousChapter.number === 'number' && chapter.number === previousChapter.number) ||
              (previousChapter.title?.trim() && chapter.title?.trim() === previousChapter.title.trim()) ||
              (previousChapter.number && chapter.number === previousChapter.number)
            );

          const lastRead = chapterIdParam ? null : getLastReadChapter(animeId);
          const findByLastRead = (chapter: MangaChapter) =>
            !!lastRead && (
              chapter.id === lastRead.id ||
              chapter.url === lastRead.url ||
              chapter.url === lastRead.id ||
              (lastRead.number != null && chapter.number === lastRead.number)
            );

          const matchedChapter = chs.find((c) => chapterIdParam && findBySlug(c))
            || (previousChapter ? chs.find(findByPrevious) : null)
            || (lastRead ? chs.find(findByLastRead) : null)
            || chs[0] || null;

          if (cancelled) return;
          setSelectedChapter(matchedChapter);
          if (matchedChapter) setVisibleChapter(matchedChapter);
        } else if (!cancelled) {
          setError('Unable to load manga data');
        }
      } catch (err: unknown) {
        if (cancelled) return;
        setError(
          typeof err === 'object' && err !== null && 'message' in err
            ? (err as { message: string }).message : 'Unable to load manga data'
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [animeId, provider, chapterIdParam]);

  /* ── Persist provider ── */
  useEffect(() => {
    localStorage.setItem('manga-provider-preference', provider);
  }, [provider]);

  /* ── Track manga reading history ── */
  useEffect(() => {
    if (!animeId || !selectedChapter || !mangaInfo) return;

    saveLastMangaVisited(animeId, {
      timestamp: Date.now(),
      titleEnglish: mangaInfo.title?.english || mangaInfo.title?.userPreferred || '',
      titleRomaji: mangaInfo.title?.romaji || '',
      // Do not overwrite a previously-saved AniList poster from Info page.
    });

    addReadChapterIfMissing(animeId, {
      id: selectedChapter.id,
      number: selectedChapter.number,
      title: selectedChapter.title || '',
      image: selectedChapter.image || mangaInfo.image || '',
      description: selectedChapter.description || '',
      imageHash: selectedChapter.imageHash || '',
      airDate: new Date().toISOString(),
      url: selectedChapter.url,
    });

    // Per-manga pointer to the last-opened chapter, so re-entering the reader
    // (with no ?chapterId=) resumes where the user left off instead of ch.1.
    // Mirrors the anime side's `last-watched-{animeId}`.
    setLastReadChapter(animeId, {
      id: selectedChapter.id,
      number: selectedChapter.number,
      title: selectedChapter.title || '',
      url: selectedChapter.url,
    });
  }, [animeId, selectedChapter, mangaInfo]);

  /* ── Track reading progress ── */
  useEffect(() => {
    if (!selectedChapter || !pageCount) return;

    const readingTimes = JSON.parse(
      localStorage.getItem('all_reading_times') || '{}',
    );
    const progressPercentage = Math.round(((currentPage + 1) / pageCount) * 100);
    readingTimes[selectedChapter.id] = {
      playbackPercentage: Math.min(progressPercentage, 100),
    };
    localStorage.setItem('all_reading_times', JSON.stringify(readingTimes));

    // ── Sync to AniList when the chapter is essentially finished ──
    // We sync once per chapter (throttled by syncedChaptersRef), mirroring the
    // anime Player's one-shot-per-episode pattern. syncMangaReadProgress
    // auto-promotes PLANNING→CURRENT and →COMPLETED on the final chapter.
    if (
      settings.aniListSync &&
      isLoggedIn &&
      animeId &&
      progressPercentage >= 95 &&
      !syncedChaptersRef.current.has(selectedChapter.id)
    ) {
      const mediaId = parseInt(animeId, 10);
      const chapterProgress = getChapterProgressForAniList(selectedChapter, chapters);

      if (!Number.isNaN(mediaId) && chapterProgress > 0) {
        syncedChaptersRef.current.add(selectedChapter.id);
        const totalChapters = mangaInfo?.totalChapters ?? undefined;

        const accessToken = localStorage.getItem('accessToken');
        if (accessToken) {
          void syncMangaReadProgress(accessToken, mediaId, chapterProgress, totalChapters)
            .then(() => {
              console.log('✅ [AniList] Manga progress saved — chapter', chapterProgress);
            })
            .catch((err) => {
              console.error('❌ [AniList] Failed to sync manga progress:', err);
              // Allow a retry on failure.
              syncedChaptersRef.current.delete(selectedChapter.id);
            });
        }
      }
    }
  }, [selectedChapter, currentPage, pageCount, animeId, mangaInfo, chapters, settings.aniListSync, isLoggedIn]);

  /* ── Fetch pages ── */
  useEffect(() => {
    if (!selectedChapter) {
      if (providerSwitchRef.current) return;
      setReadPages([]);
      setPageError(null);
      return;
    }
    // FIX: cancellation guard — ignore a response if the chapter has already
    // changed again by the time it resolves (fixes "wrong chapter's pages
    // flash in" when clicking Next/Prev quickly).
    let cancelled = false;

    setIsPageLoading(true);
    setPageError(null);
    setCurrentPage(0);
    if (pagesColRef.current) pagesColRef.current.scrollTop = 0;

    const chapterFetchId = provider === 'mangapill'
      ? (selectedChapter.url || selectedChapter.id)
      : selectedChapter.id;

    fetchMangaRead(chapterFetchId, provider)
      .then((pages: MangaReadPage[]) => {
        if (cancelled) return;
        const arr = Array.isArray(pages) ? pages : [];
        setReadPages(arr);
        setPageStates(arr.map((_, i) => ({
          loaded: false, loading: i < 3, error: false, visible: i < 3, retryTs: 0,
        })));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPageError(
          typeof err === 'object' && err !== null && 'message' in err
            ? (err as { message: string }).message : 'Unable to load chapter pages'
        );
        setReadPages([]);
        setPageStates([]);
      })
      .finally(() => { if (!cancelled) setIsPageLoading(false); });

    return () => { cancelled = true; };
  }, [selectedChapter, provider]);

  /* ── Restore reading position ──
     Read.tsx writes all_reading_times[chapterId] = { playbackPercentage } on
     scroll but previously never read it back, so reopening a chapter always
     started at page 0. This effect runs once per chapter, after its pages
     have loaded, and:
       1. computes the target page from the stored percentage,
       2. primes image visibility around that page (the observer only loads
          images as they scroll into view, so a mid-chapter jump would otherwise
          show blank cells),
       3. scrolls the column to the target page. */
  useEffect(() => {
    if (!selectedChapter || readPages.length === 0) return;
    if (restoredScrollRef.current.has(selectedChapter.id)) return;

    // Skip provider switches — we don't want to fight an intentional reset.
    if (providerSwitchRef.current) {
      providerSwitchRef.current = false;
      restoredScrollRef.current.add(selectedChapter.id);
      return;
    }

    let pct = 0;
    try {
      const all = JSON.parse(localStorage.getItem('all_reading_times') || '{}');
      pct = all[selectedChapter.id]?.playbackPercentage ?? 0;
    } catch { pct = 0; }

    // < 5% means the user barely read it — start fresh at the top.
    if (pct < 5) {
      restoredScrollRef.current.add(selectedChapter.id);
      return;
    }

    const total = readPages.length;
    const targetIdx = Math.min(
      total - 1,
      Math.max(0, Math.floor((pct / 100) * total)),
    );

    // Prime visibility for the target page ±1 so images load before scroll.
    setPageStates((prev) => {
      const next = [...prev];
      [targetIdx - 1, targetIdx, targetIdx + 1].forEach((i) => {
        if (i >= 0 && i < next.length) {
          next[i] = { ...next[i], visible: true, loading: !next[i].loaded };
        }
      });
      return next;
    });

    restoredScrollRef.current.add(selectedChapter.id);
    setCurrentPage(targetIdx);

    // Defer the scroll until the primed pages have rendered.
    const raf = requestAnimationFrame(() => {
      const col = pagesColRef.current;
      if (!col) return;
      const el = col.querySelector(`[data-idx="${targetIdx}"]`) as HTMLElement | null;
      if (el) {
        el.scrollIntoView({ block: 'start', behavior: 'auto' });
      } else {
        // Fallback: jump proportionally if the element isn't queryable yet.
        col.scrollTop = (col.scrollHeight - col.clientHeight) * (pct / 100);
      }
    });
    return () => cancelAnimationFrame(raf);
  }, [selectedChapter, readPages]);

  /* ── IntersectionObserver ── */
  useEffect(() => {
    observerRef.current?.disconnect();
    if (!readPages.length || !pagesColRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .map((e) => {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            const rect = e.boundingClientRect;
            const dist = Math.abs(rect.top + rect.height / 2 - window.innerHeight / 2);
            return { idx, dist, ratio: e.intersectionRatio };
          })
          .filter((e) => Number.isFinite(e.idx))
          .sort((a, b) => b.ratio - a.ratio || a.dist - b.dist);

        if (vis.length) {
          const np = vis[0].idx;
          setCurrentPage(np);
          setPageStates((prev) => {
            const next = [...prev];
            [np - 1, np, np + 1, np + 2].forEach((i) => {
              if (i >= 0 && i < next.length && !next[i].visible) {
                next[i] = { ...next[i], visible: true, loading: !next[i].loaded };
              }
            });
            return next;
          });
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px -25% 0px' }
    );

    readPages.forEach((_, i) => {
      const el = pagesColRef.current!.querySelector(`[data-idx="${i}"]`);
      if (el) observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, [readPages]);

  /* ── Mobile scroll → hide header ── */
  useEffect(() => {
    if (!isMobile) { setShowHeader(true); return; }
    const col = pagesColRef.current;
    if (!col) return;
    const onScroll = () => {
      if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
      scrollRaf.current = requestAnimationFrame(() => {
        const y = col.scrollTop;
        if (y < 80) { setShowHeader(true); lastScrollY.current = y; return; }
        if (Math.abs(y - lastScrollY.current) < 8) return;
        setShowHeader(y < lastScrollY.current);
        lastScrollY.current = y;
      });
    };
    col.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      col.removeEventListener('scroll', onScroll);
      // FIX: also cancel any in-flight rAF from the scroll handler on cleanup.
      if (scrollRaf.current) cancelAnimationFrame(scrollRaf.current);
    };
  }, [isMobile, readPages]);

  /* ── Fullscreen events ── */
  useEffect(() => {
    const fn = () =>
      setIsFullscreen(!!(document.fullscreenElement || (document as any).webkitFullscreenElement));
    document.addEventListener('fullscreenchange', fn);
    document.addEventListener('webkitfullscreenchange', fn);
    return () => {
      document.removeEventListener('fullscreenchange', fn);
      document.removeEventListener('webkitfullscreenchange', fn);
    };
  }, []);

  /* ── Scroll active chapter into view ── */
  useEffect(() => {
    if ((sidebarOpen || (!isMobile && !sidebarCollapsed)) && activeChapterRef.current) {
      // FIX: store the timeout id and clear it on cleanup so a stale scroll
      // doesn't fire after the sidebar/chapter changes again or unmounts.
      const t = setTimeout(() => activeChapterRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' }), 60);
      return () => clearTimeout(t);
    }
  }, [sidebarOpen, sidebarCollapsed, isMobile, currentChapter]);

  /* ── Body scroll lock ── */
  useEffect(() => {
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyOverscroll = document.body.style.overscrollBehavior;
    const prevHtmlOverscroll = document.documentElement.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.overscrollBehavior = prevBodyOverscroll;
      document.documentElement.style.overscrollBehavior = prevHtmlOverscroll;
    };
  }, []);

  /* ── Actions ── */
  const closeSidebar = useCallback(() => {
    setSidebarClosing(true);
    setTimeout(() => { setSidebarOpen(false); setSidebarClosing(false); }, 220);
  }, []);

  // Keep the ref used by goToChapter pointed at the latest closeSidebar.
  useEffect(() => {
    closeSidebarRef.current = closeSidebar;
  }, [closeSidebar]);

  const handleProviderChange = useCallback((nextProvider: 'mangahere' | 'mangapill' | 'hentaireadio' | 'hentai20') => {
    if (nextProvider === provider) return;

    // Prevent switching away from hentai providers for hentai manga
    if (isHentaiManga && nextProvider !== 'hentaireadio' && nextProvider !== 'hentai20') {
      console.warn('⚠️ Cannot switch away from hentai providers for hentai content');
      return;
    }

    providerSwitchRef.current = true;
    setProvider(nextProvider);
    setSelectedChapter(null);
    setVisibleChapter(null);
    setReadPages([]);
    setPageStates([]);
    setPageError(null);
    setIsPageLoading(false);
    setCurrentPage(0);
    if (pagesColRef.current) pagesColRef.current.scrollTop = 0;
    // FIX: the provider param (and stale chapterId, since chapter ids are
    // provider-specific) needs to be reflected in the URL too.
    updateUrl(null, nextProvider);
  }, [provider, isHentaiManga, updateUrl]);

  const toggleFullscreen = useCallback(() => {
    // FIX: guard against browsers/contexts where neither API exists instead
    // of calling `.call` on `undefined` and throwing.
    if (isFullscreen) {
      const exit = document.exitFullscreen || (document as any).webkitExitFullscreen;
      exit?.call(document);
    } else {
      const el = document.documentElement;
      const request = el.requestFullscreen || (el as any).webkitRequestFullscreen;
      request?.call(el);
    }
  }, [isFullscreen]);

  const updatePage = (idx: number, patch: Partial<PageState>) =>
    setPageStates((prev) => {
      const next = [...prev];
      if (next[idx]) next[idx] = { ...next[idx], ...patch };
      return next;
    });

  /* ── Sidebar content (shared) ── */
  const SidebarContent = () => (
    <>
      {isMobile && (
        <SbHead>
          <Btn onClick={closeSidebar} style={{ padding: '0.3rem' }}>
            <FaTimes />
          </Btn>
        </SbHead>
      )}

      {availableProviders.length > 1 && (
        <SbSection>
          <SbSectionLabel>Provider</SbSectionLabel>
          <ProvRow>
            {!isHentaiManga && (
              <>
                <ProvBtn $active={provider === 'mangahere'} onClick={() => handleProviderChange('mangahere')}>
                  Mangahere
                </ProvBtn>
                <ProvBtn $active={provider === 'mangapill'} onClick={() => handleProviderChange('mangapill')}>
                  Mangapill
                </ProvBtn>
              </>
            )}
            <ProvBtn $active={provider === 'hentaireadio'} onClick={() => handleProviderChange('hentaireadio')}>
              HentaiRadio
            </ProvBtn>
            <ProvBtn $active={provider === 'hentai20'} onClick={() => handleProviderChange('hentai20')}>
              Hentai20
            </ProvBtn>
          </ProvRow>
        </SbSection>
      )}

      <SearchWrap>
        <FaSearch />
        <SearchInput
          type='text'
          placeholder='Search chapters…'
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </SearchWrap>

      <SbChapterHeader>
        <SbChLabel>Chapters</SbChLabel>
        <SbChCount>{chapters.length}</SbChCount>
      </SbChapterHeader>

      <ChapterList>
        {isLoading && <SbEmpty>Loading…</SbEmpty>}
        {error && <SbEmpty>{error}</SbEmpty>}
        {!isLoading && !error && filteredChapters.length === 0 && (
          <SbEmpty>{searchTerm ? `No results for "${searchTerm}"` : 'No chapters available.'}</SbEmpty>
        )}
        {!isLoading && !error && filteredChapters.map((ch) => {
          const isActive = currentChapter?.id === ch.id;
          return (
            <ChBtn
              key={ch.id}
              $active={isActive}
              ref={isActive ? activeChapterRef : null}
              onClick={() => goToChapter(ch)}
            >
              <ChMeta>
                <span className='num'>{getChapterShortLabel(ch)}</span>
                <span className='ttl'>{ch.title || getChapterHeading(ch)}</span>
              </ChMeta>
            </ChBtn>
          );
        })}
      </ChapterList>
    </>
  );

  /* ── Render ── */
  return (
    <PageShell>

      {/* ── HEADER ── */}
      <TopBar $hidden={isMobile && !showHeader}>

        {/* Back */}
        <Btn onClick={() => navigate(`/info/${animeId}`)} title='Go back'>
          <FaChevronLeft />
          {!isMobile && 'Back'}
        </Btn>

        <Sep />

        {/* Desktop spacer — centers the title block */}
        <Grow />

        {/* Desktop: centred title + progress bar */}
        <TitleBlock>
          <TitleMain title={mangaInfo?.title?.userPreferred || ''}>
            {currentChapter ? getChapterHeading(currentChapter) : '—'}
          </TitleMain>
          {pageCount > 0 && (
            <ProgRow>
              <ProgLabel>{currentPage + 1} / {pageCount}</ProgLabel>
              <ProgTrack $pct={progressPct} />
              <ProgLabel style={{ color: 'var(--primary-accent)', fontWeight: 700 }}>
                {progressPct}%
              </ProgLabel>
            </ProgRow>
          )}
        </TitleBlock>

        {/*
          Mobile: chapter label — flex:1 fills all space between Back and the
          right-side controls because <Grow> is hidden on mobile.
        */}
        <MobileLabel>
          <MobileLabelMain>{currentChapter ? getChapterShortLabel(currentChapter) : '—'}</MobileLabelMain>
          <MobileLabelSub>{mangaInfo?.title?.userPreferred || 'Read Manga'}</MobileLabelSub>
        </MobileLabel>

        {/* Desktop spacer — hidden on mobile */}
        <Grow />

        {/* Prev / Next */}
        <Btn
          onClick={() => goToChapter(prevChapter)}
          disabled={!prevChapter}
          title='Previous chapter'
        >
          <FaChevronLeft />
          {!isMobile && 'Prev'}
        </Btn>

        <PrimaryBtn
          onClick={() => goToChapter(nextChapter)}
          disabled={!nextChapter}
          title='Next chapter'
        >
          {!isMobile && 'Next'}
          <FaChevronRight />
        </PrimaryBtn>

        {animeId && (
          <MangaBookmarkButton mangaId={animeId} variant='toolbar' />
        )}

        <Sep />

        {/* Fullscreen — desktop only (hidden on mobile via PurpleBtn CSS) */}
        <PurpleBtn onClick={toggleFullscreen} title='Toggle fullscreen'>
          {isFullscreen ? <FaCompress /> : <FaExpand />}
        </PurpleBtn>

        <Sep />

        {/* Chapters toggle */}
        <Btn
          onClick={isMobile ? () => setSidebarOpen(true) : () => setSidebarCollapsed((v) => !v)}
          title='Chapters'
        >
          <FaBars />
          {!isMobile && ' Chapters'}
        </Btn>

      </TopBar>

      {/* ── READER BODY ── */}
      <ReaderBody>

        {/* Pages — 2px padding on each side creates a subtle gutter */}
        <PagesColumn ref={pagesColRef} $blurred={sidebarOpen && isMobile}>

          {isLoading && <Empty>Loading manga reader…</Empty>}
          {!isLoading && error && <Empty>{error}</Empty>}
          {!isLoading && !error && !currentChapter && <Empty>No chapters available.</Empty>}
          {!isLoading && !error && currentChapter && isPageLoading && <Empty>Loading chapter…</Empty>}
          {!isLoading && !error && currentChapter && pageError && <Empty>{pageError}</Empty>}
          {!isLoading && !error && currentChapter && !isPageLoading && !pageError && pageCount === 0 && (
            <Empty>No pages available for this chapter.</Empty>
          )}

          {!isLoading && !error && pageCount > 0 && (
            <>
              {readPages.map((page, idx) => {
                const ps = pageStates[idx];
                return (
                  // FIX: page.page is not guaranteed unique/stable across
                  // providers — use the array index instead (safe here since
                  // the whole readPages array is replaced wholesale per
                  // chapter, never spliced in place).
                  <PageWrapper key={idx} data-idx={idx}>
                    {ps?.loading && !ps?.loaded && <LoadingCell><Spinner /></LoadingCell>}
                    {ps?.error ? (
                      <ErrorCell>
                        <ErrorMsg>Page {idx + 1} failed to load</ErrorMsg>
                        <RetryBtn
                          onClick={() => updatePage(idx, { error: false, loading: true, visible: true, retryTs: Date.now() })}
                        >
                          <FaRedo style={{ fontSize: '0.65rem' }} /> Retry
                        </RetryBtn>
                      </ErrorCell>
                    ) : (ps?.visible || ps?.loaded) ? (
                      <MangaImg
                        src={
                          (provider === 'hentaireadio' || provider === 'hentai20'
                            ? buildHentaiImageProxyUrl(page.img, page.headerForImage?.Referer)
                            : buildImageProxyUrl(page.img, provider, page.headerForImage?.Referer)) +
                          (ps?.retryTs ? `&_t=${ps.retryTs}` : '')
                        }
                        alt={`Page ${idx + 1}`}
                        $visible={ps?.loaded}
                        onLoad={() => updatePage(idx, { loaded: true, loading: false, error: false })}
                        onError={() => updatePage(idx, { loaded: false, loading: false, error: true })}
                        loading='lazy'
                      />
                    ) : (
                      <PlaceholderCell />
                    )}
                    {ps?.loaded && <PageNum>{idx + 1} / {pageCount}</PageNum>}
                  </PageWrapper>
                );
              })}

              <EocCard>
                <EocIcon><FaCheckCircle /></EocIcon>
                <EocTitle>Chapter Complete!</EocTitle>
                <EocSub>Ready for the next chapter?</EocSub>
                <EocBtnRow>
                  {prevChapter && (
                    <EocBtn onClick={() => goToChapter(prevChapter)}>
                      <FaChevronLeft /> Previous Chapter
                    </EocBtn>
                  )}
                  {nextChapter && (
                    <EocBtn $primary onClick={() => goToChapter(nextChapter)}>
                      Next Chapter <FaChevronRight />
                    </EocBtn>
                  )}
                </EocBtnRow>
              </EocCard>
            </>
          )}
        </PagesColumn>

        {/* Desktop sidebar */}
        <DesktopSidebar $collapsed={sidebarCollapsed}>
          <SidebarContent />
        </DesktopSidebar>

        {/* Mobile drawer */}
        <Overlay $visible={sidebarOpen} onClick={closeSidebar} />
        {(sidebarOpen || sidebarClosing) && isMobile && (
          <MobileDrawer $open={sidebarOpen} $closing={sidebarClosing}>
            <SidebarContent />
          </MobileDrawer>
        )}

      </ReaderBody>

      {/* Mobile bottom progress bar */}
      <MobileProgress $blurred={sidebarOpen}>
        <MbPct>{progressPct}%</MbPct>
        <ProgTrack $pct={progressPct} style={{ flex: 1 }} />
        <MbPages>{currentPage + 1} / {pageCount || '—'}</MbPages>
      </MobileProgress>

    </PageShell>
  );
}

export default Read;