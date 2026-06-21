/**
 * NotificationsPanel.tsx
 *
 * Right-edge slide-in panel showing the signed-in viewer's AniList
 * notifications. Lives inside the Navbar so it's globally available (no route).
 *
 * Mirrors the Read.tsx slide-in pattern (Overlay + animated aside with
 * $open/$closing + body scroll lock) but is not gated on mobile — it works at
 * all viewport widths.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import styled, { css, keyframes } from 'styled-components';
import { Link } from 'react-router-dom';
import {
  FaBell, FaTimes, FaCircleNotch, FaRegCommentDots,
} from 'react-icons/fa';
import {
  FaUserPlus, FaHeart, FaAt, FaTv, FaArrowsRotate, FaExclamation,
} from 'react-icons/fa6';
import { useNotifications } from '../../hooks/useNotifications';
import type { AniListNotification } from '../../client/authService';

// ─── Animations ───────────────────────────────────────────────────────────────
const slideInRight = keyframes`
  from { transform: translateX(100%); }
  to   { transform: translateX(0); }
`;
const slideOutRight = keyframes`
  from { transform: translateX(0); }
  to   { transform: translateX(100%); }
`;
const fadeIn = keyframes`from { opacity: 0; } to { opacity: 1; }`;

// ─── Layout ───────────────────────────────────────────────────────────────────
const Overlay = styled.div<{ $visible: boolean }>`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 400;
  backdrop-filter: blur(2px);
  display: ${({ $visible }) => ($visible ? 'block' : 'none')};
  animation: ${fadeIn} 0.18s ease;
`;

const Drawer = styled.aside<{ $open: boolean; $closing: boolean }>`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(92vw, 400px);
  z-index: 401;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--global-primary-bg, #0a0a0c);
  border-left: 1px solid var(--global-border, rgba(255,255,255,0.08));
  box-shadow: -8px 0 32px rgba(0, 0, 0, 0.4);
  transform: translateX(100%);

  ${({ $open, $closing }) =>
    $open && !$closing &&
    css`animation: ${slideInRight} 0.22s cubic-bezier(0.25,0.46,0.45,0.94) forwards;`}
  ${({ $closing }) =>
    $closing &&
    css`animation: ${slideOutRight} 0.2s cubic-bezier(0.55,0,1,0.45) forwards;`}
`;

const Header = styled.header`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
  border-bottom: 1px solid var(--global-border, rgba(255,255,255,0.08));
  background: var(--global-secondary-bg, #111827);
`;

const HeaderTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--global-text, #e5e7eb);
  font-size: 0.9rem;
  font-weight: 700;
  svg { color: var(--primary-accent, #c084fc); }
`;

const CloseBtn = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--global-text-muted, #9ca3af);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
  &:hover { background: rgba(255,255,255,0.08); color: var(--global-text); }
`;

const ScrollArea = styled.div`
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 0.5rem 0;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 99px; }
`;

const SectionLabel = styled.div`
  padding: 0.75rem 1rem 0.35rem;
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--global-text-muted, #9ca3af);
`;

const NotifRow = styled(Link)`
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.6rem 1rem;
  text-decoration: none;
  color: var(--global-text, #e5e7eb);
  transition: background 0.13s;
  border-left: 2px solid transparent;

  &:hover {
    background: rgba(255,255,255,0.04);
    border-left-color: var(--primary-accent, #c084fc);
  }
`;

const NotifRowExternal = styled.a`
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  padding: 0.6rem 1rem;
  text-decoration: none;
  color: var(--global-text, #e5e7eb);
  transition: background 0.13s;
  border-left: 2px solid transparent;

  &:hover {
    background: rgba(255,255,255,0.04);
    border-left-color: var(--primary-accent, #c084fc);
  }
`;

const IconWrap = styled.span`
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(124,58,237,0.14);
  color: var(--primary-accent, #c084fc);
  font-size: 0.8rem;
`;

const Avatar = styled.img`
  flex-shrink: 0;
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  object-fit: cover;
`;

const Cover = styled.img`
  flex-shrink: 0;
  width: 1.85rem;
  height: 2.55rem;
  border-radius: 4px;
  object-fit: cover;
  background: var(--global-card-bg, #1f2937);
`;

const Body = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
`;

const Text = styled.p`
  margin: 0;
  font-size: 0.8rem;
  line-height: 1.35;
  strong { font-weight: 700; }
  em { font-style: normal; color: var(--primary-accent, #c084fc); font-weight: 600; }
`;

const Time = styled.span`
  font-size: 0.66rem;
  color: var(--global-text-muted, #9ca3af);
`;

const Status = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  padding: 3rem 1.5rem;
  text-align: center;
  color: var(--global-text-muted, #9ca3af);
  font-size: 0.85rem;
`;

const Spinner = styled(FaCircleNotch)`
  animation: spin 0.7s linear infinite;
  @keyframes spin { to { transform: rotate(360deg); } }
  font-size: 1.4rem;
  color: var(--primary-accent, #c084fc);
`;

const RetryBtn = styled.button`
  border: 1px solid var(--global-border, rgba(255,255,255,0.12));
  background: transparent;
  color: var(--global-text, #e5e7eb);
  padding: 0.35rem 0.9rem;
  border-radius: 6px;
  font-size: 0.78rem;
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.06); }
`;

const LoadMoreBtn = styled.button`
  display: block;
  width: calc(100% - 2rem);
  margin: 0.5rem 1rem 1rem;
  padding: 0.55rem;
  border: 1px solid var(--global-border, rgba(255,255,255,0.12));
  border-radius: 6px;
  background: transparent;
  color: var(--global-text-muted, #9ca3af);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  &:hover { background: rgba(255,255,255,0.06); color: var(--global-text); }
  &:disabled { opacity: 0.6; cursor: not-allowed; }
`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Humanized relative time, e.g. "2h ago", "Just now", "3d ago". */
function timeAgo(unixSeconds: number): string {
  if (!unixSeconds) return '';
  const diff = Math.max(0, Date.now() / 1000 - unixSeconds);
  if (diff < 60) return 'Just now';
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** Bucket a timestamp into a section label. */
function dayBucket(unixSeconds: number): 'Today' | 'This Week' | 'Earlier' {
  if (!unixSeconds) return 'Earlier';
  const diffDays = (Date.now() / 1000 - unixSeconds) / 86400;
  if (diffDays < 1) return 'Today';
  if (diffDays < 7) return 'This Week';
  return 'Earlier';
}

interface RenderedNotif {
  icon: React.ReactNode;
  avatar?: string;
  cover?: string;
  html: React.ReactNode;
  /** Internal link (/info/:id) or external anilist.co URL. */
  to?: string;
  external?: boolean;
}

/** Map an AniList notification to a readable row. */
function renderNotification(n: AniListNotification): RenderedNotif {
  const user = n.user?.name;
  const media = n.media?.title;
  const ctx = n.context?.trim();
  const ep = n.episode;

  switch (n.type) {
    case 'AIRING':
      return {
        icon: <FaTv />,
        cover: n.media?.coverImage,
        to: n.media ? `/info/${n.media.id}` : undefined,
        html: <>New <em>episode {ep}</em> of <strong>{media}</strong> aired{ctx ? ` · ${ctx}` : ''}</>,
      };
    case 'FOLLOWING':
      return {
        icon: <FaUserPlus />,
        avatar: n.user?.avatar,
        to: user ? `https://anilist.co/user/${user}` : undefined,
        external: true,
        html: <><strong>{user}</strong> started following you</>,
      };
    case 'ACTIVITY_MESSAGE':
    case 'ACTIVITY_REPLY':
    case 'ACTIVITY_REPLY_SUBSCRIBED':
      return {
        icon: <FaRegCommentDots />,
        avatar: n.user?.avatar,
        to: n.activityUrl,
        external: true,
        html: <><strong>{user}</strong> replied to your activity{ctx ? ` · ${ctx}` : ''}</>,
      };
    case 'ACTIVITY_MENTION':
      return {
        icon: <FaAt />,
        avatar: n.user?.avatar,
        to: n.activityUrl,
        external: true,
        html: <><strong>{user}</strong> mentioned you{ctx ? ` · ${ctx}` : ''}</>,
      };
    case 'ACTIVITY_LIKE':
      return {
        icon: <FaHeart />,
        avatar: n.user?.avatar,
        to: n.activityUrl,
        external: true,
        html: <><strong>{user}</strong> liked your activity{ctx ? ` · ${ctx}` : ''}</>,
      };
    case 'THREAD_COMMENT':
    case 'THREAD_COMMENT_REPLY':
    case 'THREAD_COMMENT_MENTION':
    case 'THREAD_COMMENT_LIKE':
      return {
        icon: <FaRegCommentDots />,
        avatar: n.user?.avatar,
        to: n.activityUrl,
        external: true,
        html: <><strong>{user}</strong> {n.type.includes('LIKE') ? 'liked' : 'commented on'} your forum post{ctx ? ` · ${ctx}` : ''}</>,
      };
    case 'MEDIA_DATA_CHANGE':
      return {
        icon: <FaArrowsRotate />,
        cover: n.media?.coverImage,
        to: n.media ? `/info/${n.media.id}` : undefined,
        html: <><strong>{media}</strong> data was updated{ctx ? ` · ${ctx}` : ''}</>,
      };
    case 'MEDIA_MERGE':
      return {
        icon: <FaArrowsRotate />,
        cover: n.media?.coverImage,
        to: n.media ? `/info/${n.media.id}` : undefined,
        html: <><strong>{media}</strong> was merged{ctx ? ` · ${ctx}` : ''}</>,
      };
    case 'MEDIA_DELETION':
      return {
        icon: <FaExclamation />,
        html: <>A media entry was deleted{n.reason ? ` · ${n.reason}` : ''}</>,
      };
    case 'RELATED_MEDIA_ADDITION':
      return {
        icon: <FaTv />,
        cover: n.media?.coverImage,
        to: n.media ? `/info/${n.media.id}` : undefined,
        html: <>New related media <strong>{media}</strong> was added</>,
      };
    default:
      return {
        icon: <FaBell />,
        html: ctx ? <>{ctx}</> : <>New notification</>,
      };
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

interface NotificationsPanelProps {
  open: boolean;
  closing: boolean;
  onClose: () => void;
  /** Called to fetch + clear badge; receives a token getter + markRead. */
  isLoggedIn: boolean;
  getToken: () => string | null;
  markRead: () => void;
}

export const NotificationsPanel: React.FC<NotificationsPanelProps> = ({
  open, closing, onClose, isLoggedIn, getToken, markRead,
}) => {
  const {
    items, loading, loadingMore, error, hasNextPage, loaded, load, loadMore,
  } = useNotifications(isLoggedIn, getToken, markRead);

  const bodyPrev = useRef<string>('');
  // Fetch on first open.
  useEffect(() => {
    if (open && isLoggedIn) void load();
  }, [open, isLoggedIn, load]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    bodyPrev.current = prev;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  // Group items into time buckets, preserving order within each.
  const grouped = useMemo(() => {
    const buckets: Record<'Today' | 'This Week' | 'Earlier', AniListNotification[]> = {
      'Today': [], 'This Week': [], 'Earlier': [],
    };
    items.forEach((n) => buckets[dayBucket(n.createdAt)].push(n));
    return buckets;
  }, [items]);

  const hasAny = items.length > 0;

  const renderItem = (n: AniListNotification) => {
    const r = renderNotification(n);
    const key = n.id;
    const thumb = r.cover
      ? <Cover src={r.cover} alt='' loading='lazy' />
      : r.avatar
        ? <Avatar src={r.avatar} alt='' loading='lazy' />
        : <IconWrap>{r.icon}</IconWrap>;
    const content = (
      <Body>
        <Text>{r.html}</Text>
        <Time>{timeAgo(n.createdAt)}</Time>
      </Body>
    );
    if (r.to && r.external) {
      return (
        <NotifRowExternal key={key} href={r.to} target='_blank' rel='noopener noreferrer'>
          {thumb}{content}
        </NotifRowExternal>
      );
    }
    if (r.to) {
      return (
        <NotifRow key={key} to={r.to} onClick={onClose}>
          {thumb}{content}
        </NotifRow>
      );
    }
    return (
      <NotifRowExternal key={key} as='div' href='#' onClick={(e) => e.preventDefault()}>
        {thumb}{content}
      </NotifRowExternal>
    );
  };

  return (
    <>
      <Overlay $visible={open} onClick={onClose} />
      {(open || closing) && (
        <Drawer $open={open} $closing={closing} role='dialog' aria-label='Notifications'>
          <Header>
            <HeaderTitle>
              <FaBell size={14} /> Notifications
            </HeaderTitle>
            <CloseBtn onClick={onClose} aria-label='Close notifications'>
              <FaTimes />
            </CloseBtn>
          </Header>

          <ScrollArea>
            {loading && (
              <Status>
                <Spinner />
                <span>Loading…</span>
              </Status>
            )}

            {!loading && error && (
              <Status>
                <span>{error}</span>
                <RetryBtn onClick={() => void load()}>Retry</RetryBtn>
              </Status>
            )}

            {!loading && !error && loaded && !hasAny && (
              <Status>
                <FaBell size={28} style={{ opacity: 0.3 }} />
                <span>You're all caught up!</span>
              </Status>
            )}

            {!loading && !error && hasAny && (
              <>
                {(['Today', 'This Week', 'Earlier'] as const).map((label) =>
                  grouped[label].length > 0 ? (
                    <div key={label}>
                      <SectionLabel>{label}</SectionLabel>
                      {grouped[label].map(renderItem)}
                    </div>
                  ) : null,
                )}

                {hasNextPage && (
                  <LoadMoreBtn onClick={() => void loadMore()} disabled={loadingMore}>
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </LoadMoreBtn>
                )}
              </>
            )}
          </ScrollArea>
        </Drawer>
      )}
    </>
  );
};

export default NotificationsPanel;
