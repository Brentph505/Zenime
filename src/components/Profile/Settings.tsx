import React, { useState, useEffect, useMemo } from 'react';
import styled, { css } from 'styled-components';
import {
  IoLanguageOutline,
  IoTextOutline,
  IoPersonOutline,
  IoStarOutline,
  IoKeyOutline,
  IoPlayOutline,
  IoPlayForwardOutline,
  IoPlaySkipForwardOutline,
  IoSyncOutline,
  IoServerOutline,
  IoRefreshOutline,
  IoTrashOutline,
  IoChevronDown,
  IoFilmOutline,
  IoColorPaletteOutline,
  IoArchiveOutline,
  IoWarningOutline,
  IoSearchOutline,
  IoEyeOffOutline,
  IoTvOutline,
  IoAppsOutline,
} from 'react-icons/io5';
import { useSettings } from '../../index';
import { useAuth } from '../../client/useAuth';

/* ─── Types ─────────────────────────────────────────────────────────────── */

interface Preferences {
  defaultLanguage: string;
  titleLanguage: string;
  characterNameLanguage: string;
  ratingSource: string;
  openKeyboardShortcuts: string;
  autoskipIntroOutro: string;
  autoPlay: string;
  autoNext: string;
  aniListSync: string;
  defaultServers: string;
  restoreDefaultPreferences: string;
  clearContinueWatching: string;
  hideSpoilers: string;
}

type BoolKey = 'autoskipIntroOutro' | 'autoPlay' | 'autoNext' | 'aniListSync' | 'hideSpoilers';
const BOOL_KEYS: BoolKey[] = [
  'autoskipIntroOutro',
  'autoPlay',
  'autoNext',
  'aniListSync',
  'hideSpoilers',
];
const isBoolKey = (k: string): k is BoolKey => BOOL_KEYS.includes(k as BoolKey);

const DEFAULT_SETTINGS = {
  autoSkip: false,
  autoPlay: true,
  autoNext: false,
  defaultLanguage: 'sub',
  defaultServers: 'default',
  aniListSync: false,
  syncThreshold: 80,
  watchOrInfo: 'Watch' as const,
  titleLanguage: 'English (Attack on Titan)',
  characterNameLanguage: 'Romaji (Zoldyck Killua)',
  hideSpoilers: false,
};

/* ─── Section / Row definitions ─────────────────────────────────────────── */

interface SectionDef {
  id: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  groups: GroupDef[];
}

interface GroupDef {
  title?: string;
  danger?: boolean;
  keys: string[];
}

interface RowDef {
  icon: React.ReactNode;
  label: string;
  description: string;
}

const ROW_META: Record<string, RowDef> = {
  titleLanguage: {
    icon: <IoTextOutline />,
    label: 'Title language',
    description: 'Preferred language for anime and manga titles.',
  },
  characterNameLanguage: {
    icon: <IoPersonOutline />,
    label: 'Character name language',
    description: 'Show character names in Romaji or Native script.',
  },
  ratingSource: {
    icon: <IoStarOutline />,
    label: 'Rating source',
    description: 'Where to pull scores and ratings from.',
  },
  openKeyboardShortcuts: {
    icon: <IoKeyOutline />,
    label: 'Keyboard shortcuts',
    description: 'View the full list of keyboard shortcuts.',
  },
  defaultLanguage: {
    icon: <IoLanguageOutline />,
    label: 'Default language',
    description: 'Subbed or dubbed audio by default.',
  },
  defaultServers: {
    icon: <IoServerOutline />,
    label: 'Default servers',
    description: 'Preferred video source for streaming.',
  },
  autoskipIntroOutro: {
    icon: <IoPlayForwardOutline />,
    label: 'Auto-skip intro / outro',
    description: 'Automatically skip openings and endings.',
  },
  autoPlay: {
    icon: <IoPlayOutline />,
    label: 'Auto-play',
    description: 'Start playback automatically when a video loads.',
  },
  autoNext: {
    icon: <IoPlaySkipForwardOutline />,
    label: 'Auto-next episode',
    description: 'Play the next episode when the current one ends.',
  },
  aniListSync: {
    icon: <IoSyncOutline />,
    label: 'Auto sync with AniList',
    description:
      'Automatically sync anime episode and manga chapter progress to your AniList account while you watch or read. (Requires AniList login)',
  },
  syncThreshold: {
    icon: <IoSyncOutline />,
    label: 'Sync threshold',
    description:
      'Minimum episode progress percentage to update AniList. (Default: 80%)',
  },
  hideSpoilers: {
    icon: <IoEyeOffOutline />,
    label: 'Hide spoilers',
    description:
      'Block episode images, titles and descriptions throughout the app to prevent exposure to potential spoilers.',
  },
  watchOrInfo: {
    icon: <IoTvOutline />,
    label: 'Watch or Info page',
    description:
      'Choose whether to go to the info page or watch page when selecting an anime.',
  },
  restoreDefaultPreferences: {
    icon: <IoRefreshOutline />,
    label: 'Restore default preferences',
    description: 'Reset all settings back to their defaults.',
  },
  clearContinueWatching: {
    icon: <IoTrashOutline />,
    label: 'Clear continue watching',
    description: 'Erase all local watch and read history. Cannot be undone.',
  },
};

/* ─── Styled components ──────────────────────────────────────────────────── */

/* Shell — horizontal split. border-radius: inherit clips inner content
   cleanly inside the modal card's rounded corners. */
const Shell = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  border-radius: inherit;

  @media (min-width: 769px) {
    flex-direction: row;
  }
`;

/* ── Sidebar ── */
const Sidebar = styled.nav`
  /* Mobile: horizontal icon tabs */
  display: flex;
  width: 100%;
  flex-shrink: 0;
  border-bottom: 1px solid var(--global-border);
  flex-direction: row;
  overflow-x: auto;
  overflow-y: visible;
  padding: 0 0.3rem 0;
  gap: 0.125rem;
  flex-wrap: nowrap;
  height: auto;
  align-items: center;
  /* No extra margin — Body padding handles the gap */
  margin-top: 0;

  &::-webkit-scrollbar { height: 0; }

  /* Desktop: vertical sidebar */
  @media (min-width: 769px) {
    width: 14rem;
    border-right: 1px solid var(--global-border);
    border-bottom: none;
    flex-direction: column;
    overflow-y: auto;
    padding: 0.9rem 0.6rem;
    gap: 0.15rem;
    height: auto;
    margin-top: 0;
  }
`;

const SearchWrap = styled.div`
  position: relative;
  flex-shrink: 0;
  /* Hide on mobile, show on desktop */
  display: none;

  @media (min-width: 769px) {
    display: block;
    margin-bottom: 0.55rem;
  }
`;

const SearchIconSpan = styled.span`
  position: absolute;
  left: 0.6rem;
  top: 50%;
  transform: translateY(-50%);
  color: var(--global-text-muted);
  display: flex;
  align-items: center;
  font-size: 0.85rem;
  pointer-events: none;
`;

const SearchInput = styled.input`
  width: 100%;
  box-sizing: border-box;
  padding: 0.48rem 0.75rem 0.48rem 2rem;
  background: var(--global-card-bg, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--global-border);
  border-radius: var(--global-border-radius);
  color: var(--global-text);
  font-size: 0.78rem;
  outline: none;
  transition: border-color 0.15s;

  &::placeholder {
    color: var(--global-text-muted);
    opacity: 0.7;
  }
  &:focus {
    border-color: var(--primary-accent);
  }
`;

const NavItem = styled.button<{ $active: boolean; $color: string }>`
  /* Mobile: icon-only tabs */
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  width: auto;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  cursor: pointer;
  text-align: center;
  border-bottom: 2.5px solid
    ${({ $active, $color }) => ($active ? $color : 'transparent')};
  transition: background 0.15s, border-color 0.15s;
  flex-shrink: 0;
  min-width: 3rem;
  height: 3rem;

  &:hover {
    background: var(--global-tertiary-bg);
  }

  /* Desktop: full-width with labels */
  @media (min-width: 769px) {
    width: 100%;
    justify-content: flex-start;
    gap: 0.6rem;
    border-left: 2.5px solid
      ${({ $active, $color }) => ($active ? $color : 'transparent')};
    border-bottom: none;
    border-radius: var(--global-border-radius);
    padding: 0.52rem 0.6rem;
    min-width: auto;
    height: auto;
    background: ${({ $active }) =>
      $active ? 'var(--global-secondary-bg)' : 'transparent'};

    &:hover {
      background: var(--global-secondary-bg);
    }
  }
`;

const NavIconBadge = styled.span<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  border-radius: 0;
  background: transparent;
  color: ${({ $color }) => $color};
  font-size: 1.3rem;
  flex-shrink: 0;

  @media (min-width: 769px) {
    width: 1.85rem;
    height: 1.85rem;
    border-radius: 8px;
    background: ${({ $color }) => $color}25;
    font-size: 1rem;
  }
`;

const NavLabel = styled.span<{ $active: boolean }>`
  /* Hidden on mobile */
  display: none;
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.055em;
  text-transform: uppercase;
  color: ${({ $active }) =>
    $active ? 'var(--global-text)' : 'var(--global-text-muted)'};
  white-space: nowrap;
  transition: color 0.15s;

  /* Shown on desktop */
  @media (min-width: 769px) {
    display: inline;
  }
`;

/* ── Content panel ── */
const Content = styled.div`
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  overflow-x: hidden;
  /* Consistent padding regardless of content length */
  padding: 1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  /* Ensure this doesn't exceed available space */
  min-height: 0;

  &::-webkit-scrollbar { width: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: var(--global-div, #30363d);
    border-radius: 99px;
  }

  @media (min-width: 769px) {
    padding: 1.35rem 1.6rem;
    gap: 1.1rem;
  }
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding-bottom: 0.1rem;
`;

const SectionIconBadge = styled.span<{ $color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 8px;
  background: ${({ $color }) => $color}25;
  color: ${({ $color }) => $color};
  font-size: 1rem;
  flex-shrink: 0;
`;

const SectionLabel = styled.h3`
  margin: 0;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--global-text);
`;

/* ── Group (optional titled sub-section above a card) ── */
const Group = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
`;

const GroupHead = styled.div`
  padding: 0 0.15rem;
`;

const GroupTitle = styled.span<{ $danger?: boolean }>`
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.055em;
  color: ${({ $danger }) => ($danger ? '#f87171' : 'var(--global-text-muted)')};
  display: flex;
  align-items: center;
  gap: 0.3rem;

  svg { font-size: 0.8rem; }
`;

/* ── Card ── */
const Card = styled.div<{ $danger?: boolean }>`
  background: var(--global-secondary-bg);
  border: 1px solid
    ${({ $danger }) =>
      $danger ? 'rgba(239,68,68,0.3)' : 'var(--global-border)'};
  border-radius: var(--global-border-radius);
  overflow: hidden;
`;

/* ── Row — stays horizontal on all screen sizes for clean label+control layout ── */
const Row = styled.div<{ $last?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.95rem 1.2rem;
  transition: background 0.1s;
  ${({ $last }) =>
    !$last && css`border-bottom: 1px solid var(--global-border);`}

  &:hover { background: var(--global-card-bg); }

  @media (max-width: 480px) {
    /* Keep horizontal — avoids toggles/selects stacking awkwardly below labels */
    flex-direction: row;
    align-items: center;
    gap: 0.75rem;
    padding: 0.8rem 1rem;
  }
`;

const RowInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
`;

const RowName = styled.div`
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--global-text);

  @media (max-width: 480px) {
    font-size: 0.8rem;
  }
`;

const RowDesc = styled.div`
  font-size: 0.71rem;
  color: var(--global-text-muted);
  line-height: 1.45;
  max-width: 26rem;

  @media (max-width: 480px) {
    font-size: 0.65rem;
  }
`;

const ControlSlot = styled.div`
  display: flex;
  align-items: center;
  flex-shrink: 0;
`;

/* ── Toggle switch ── */
const ToggleTrack = styled.button<{ $on: boolean }>`
  position: relative;
  width: 3rem;
  height: 1.65rem;
  border-radius: 999px;
  background: ${({ $on }) => ($on ? 'var(--primary-accent)' : 'var(--global-card-bg)')};
  border: 1px solid
    ${({ $on }) => ($on ? 'var(--primary-accent)' : 'var(--global-border)')};
  cursor: pointer;
  padding: 0;
  transition: background 0.2s, border-color 0.2s;
  flex-shrink: 0;
`;

const ToggleThumb = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: ${({ $on }) => ($on ? 'calc(100% - 1.35rem - 0.18rem)' : '0.18rem')};
  width: 1.35rem;
  height: 1.35rem;
  border-radius: 50%;
  background: ${({ $on }) => ($on ? '#fff' : 'var(--global-text-muted)')};
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  transition: left 0.2s, background 0.2s;
`;

/* ── Select dropdown ── */
const SelectWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const StyledSelect = styled.select`
  appearance: none;
  -webkit-appearance: none;
  background: var(--global-card-bg);
  color: var(--global-text);
  font-size: 0.8rem;
  font-weight: 500;
  width: 13rem;
  padding: 0.45rem 2rem 0.45rem 0.75rem;
  border: 1px solid var(--global-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  outline: none;
  transition: border-color 0.15s;

  &:hover,
  &:focus { border-color: var(--primary-accent); }

  option {
    background: var(--global-secondary-bg);
    color: var(--global-text);
  }

  /* On mobile, constrain width so it fits the horizontal row */
  @media (max-width: 480px) {
    width: auto;
    max-width: 10rem;
    font-size: 0.75rem;
  }
`;

const ChevronIcon = styled(IoChevronDown)`
  position: absolute;
  right: 0.6rem;
  pointer-events: none;
  font-size: 0.8rem;
  color: var(--global-text-muted);
`;

/* ── Range slider + value box ── */
const SliderWrap = styled.div`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;

  @media (max-width: 480px) {
    flex-direction: column;
    align-items: stretch;
    gap: 0.5rem;
  }
`;

const StyledRange = styled.input<{ $pct: number }>`
  -webkit-appearance: none;
  appearance: none;
  width: 9rem;
  height: 4px;
  border-radius: 99px;
  outline: none;
  cursor: pointer;
  background: linear-gradient(
    to right,
    var(--primary-accent) 0%,
    var(--primary-accent) ${({ $pct }) => $pct}%,
    var(--global-border) ${({ $pct }) => $pct}%,
    var(--global-border) 100%
  );

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: var(--primary-accent);
    box-shadow: 0 0 0 3px var(--global-primary-bg), 0 0 0 4.5px var(--primary-accent);
    cursor: pointer;
    transition: box-shadow 0.15s;
  }

  &:focus::-webkit-slider-thumb {
    box-shadow: 0 0 0 3px var(--global-primary-bg), 0 0 0 5.5px var(--primary-accent);
  }

  @media (max-width: 480px) {
    width: 100%;
  }
`;

const ValueBox = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 3.6rem;
  padding: 0.35rem 0.5rem;
  border: 1px solid var(--global-border);
  border-radius: var(--global-border-radius);
  background: var(--global-card-bg);
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--global-text);
  font-variant-numeric: tabular-nums;
`;

/* ── Pill button group ── */
const PillGroup = styled.div`
  display: flex;
  border-radius: var(--global-border-radius);
  border: 1px solid var(--global-border);
  overflow: hidden;
`;

const PillBtn = styled.button<{ $active?: boolean }>`
  padding: 0.42rem 0.95rem;
  font-size: 0.78rem;
  font-weight: 600;
  border: none;
  background: ${({ $active }) => ($active ? 'var(--primary-accent)' : 'transparent')};
  color: ${({ $active }) => ($active ? '#fff' : 'var(--global-text-muted)')};
  cursor: pointer;
  transition: background 0.15s, color 0.15s;

  & + & { border-left: 1px solid var(--global-border); }

  &:hover {
    background: ${({ $active }) =>
      $active ? 'var(--primary-accent)' : 'var(--global-tertiary-bg)'};
    color: ${({ $active }) => ($active ? '#fff' : 'var(--global-text)')};
  }
`;

/* ── Action button ── */
const ActionBtn = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.45rem 0.9rem;
  border-radius: var(--global-border-radius);
  border: 1px solid
    ${({ $danger }) => ($danger ? 'rgba(239,68,68,0.4)' : 'var(--global-border)')};
  background: transparent;
  color: ${({ $danger }) => ($danger ? '#f87171' : 'var(--global-text)')};
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  svg { font-size: 0.85rem; }

  &:hover {
    background: ${({ $danger }) =>
      $danger ? 'rgba(239,68,68,0.1)' : 'var(--global-tertiary-bg)'};
    border-color: ${({ $danger }) =>
      $danger ? 'rgba(239,68,68,0.6)' : 'var(--primary-accent)'};
  }
  &:active { transform: scale(0.97); }
`;

/* ── Static pill (non-interactive) ── */
const StaticPill = styled.span`
  font-size: 0.75rem;
  padding: 0.4rem 0.75rem;
  border-radius: var(--global-border-radius);
  background: var(--global-card-bg);
  color: var(--global-text-muted);
  border: 1px solid var(--global-border);
`;

/* ── Empty state ── */
const EmptyRow = styled.div`
  padding: 1.2rem 1.2rem;
  font-size: 0.82rem;
  color: var(--global-text-muted);
`;

/* ════════════════════════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════════════════════════ */

interface SettingsProps {
  onSectionChange?: (label: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onSectionChange }) => {
  const { settings, setSettings } = useSettings();
  const { isLoggedIn } = useAuth();

  const [activeSection, setActiveSection] = useState('general');
  const [search, setSearch] = useState('');
  const [syncThreshold, setSyncThreshold] = useState(
    settings.syncThreshold ?? 80,
  );
  const [watchOrInfo, setWatchOrInfo] = useState<'Watch' | 'Info'>(
    settings.watchOrInfo ?? 'Watch',
  );

  const [preferences, setPreferences] = useState<Preferences>({
    defaultLanguage: settings.defaultLanguage ?? 'Sub',
    titleLanguage: settings.titleLanguage ?? 'English (Attack on Titan)',
    characterNameLanguage: settings.characterNameLanguage ?? 'Romaji (Zoldyck Killua)',
    ratingSource: 'Anilist',
    openKeyboardShortcuts: '',
    autoskipIntroOutro: settings.autoSkip ? 'Enabled' : 'Disabled',
    autoPlay: settings.autoPlay ? 'Enabled' : 'Disabled',
    autoNext: settings.autoNext ? 'Enabled' : 'Disabled',
    aniListSync: settings.aniListSync ? 'Enabled' : 'Disabled',
    defaultServers: 'Default',
    restoreDefaultPreferences: '',
    clearContinueWatching: '',
    hideSpoilers: settings.hideSpoilers ? 'Enabled' : 'Disabled',
  });

  // Sync syncThreshold changes to settings context
  useEffect(() => {
    setSettings({ syncThreshold });
  }, [syncThreshold]);

  // Sync watchOrInfo changes to settings context
  useEffect(() => {
    setSettings({ watchOrInfo });
  }, [watchOrInfo]);

  // Sync titleLanguage changes to settings context
  useEffect(() => {
    setSettings({ titleLanguage: preferences.titleLanguage });
  }, [preferences.titleLanguage]);

  // Sync characterNameLanguage changes to settings context
  useEffect(() => {
    setSettings({ characterNameLanguage: preferences.characterNameLanguage });
  }, [preferences.characterNameLanguage]);

  useEffect(() => {
    setPreferences((prev) => ({
      ...prev,
      defaultLanguage: settings.defaultLanguage,
      titleLanguage: settings.titleLanguage,
      characterNameLanguage: settings.characterNameLanguage,
      defaultServers:
        settings.defaultServers === 'default' ? 'Default' : settings.defaultServers,
      autoskipIntroOutro: settings.autoSkip ? 'Enabled' : 'Disabled',
      autoPlay: settings.autoPlay ? 'Enabled' : 'Disabled',
      autoNext: settings.autoNext ? 'Enabled' : 'Disabled',
      aniListSync: settings.aniListSync ? 'Enabled' : 'Disabled',
      hideSpoilers: settings.hideSpoilers ? 'Enabled' : 'Disabled',
    }));
  }, [settings]);

  // Disable aniListSync if user logs out
  useEffect(() => {
    if (!isLoggedIn && settings.aniListSync) {
      setSettings({ aniListSync: false });
      setPreferences((prev) => ({
        ...prev,
        aniListSync: 'Disabled',
      }));
    }
  }, [isLoggedIn]);

  /* Sections definition */
  const sections: SectionDef[] = [
    {
      id: 'general',
      icon: <IoAppsOutline />,
      label: 'App Behavior',
      color: '#ec4899',
      groups: [
        {
          keys: [
            'titleLanguage',
            'characterNameLanguage',
            'ratingSource',
            'openKeyboardShortcuts',
          ],
        },
      ],
    },
    {
      id: 'appearance',
      icon: <IoColorPaletteOutline />,
      label: 'Appearance',
      color: '#8b5cf6',
      groups: [{ keys: ['hideSpoilers', 'watchOrInfo'] }],
    },
    {
      id: 'media',
      icon: <IoFilmOutline />,
      label: 'Media Settings',
      color: '#ef4444',
      groups: [
        {
          title: 'Playback & sync',
          keys: ['autoskipIntroOutro', 'autoPlay', 'autoNext', 'aniListSync', 'syncThreshold'],
        },
      ],
    },
    {
      id: 'data',
      icon: <IoArchiveOutline />,
      label: 'Data',
      color: '#f59e0b',
      groups: [
        { keys: ['restoreDefaultPreferences'] },
        { title: 'Danger zone', danger: true, keys: ['clearContinueWatching'] },
      ],
    },
  ];

  /* Notify parent of active section label (for breadcrumb) */
  useEffect(() => {
    const s = sections.find((s) => s.id === activeSection);
    onSectionChange?.(s?.label ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  /* Option lists */
  const getOptions = (key: string): string[] => {
    switch (key) {
      case 'defaultLanguage':
        return ['Sub', 'Dub'];
      case 'titleLanguage':
        return [
          'English (Attack on Titan)',
          'Romaji (Shingeki no Kyojin)',
          'Native (進撃の巨人)',
        ];
      case 'characterNameLanguage':
        return [
          'Romaji (Zoldyck Killua)',
          'Native (キルア=ゾルディック)',
          'English (Killua Zoldyck)',
        ];
      case 'ratingSource':
        return ['Anilist', 'IMDb', 'MyAnimeList'];
      case 'defaultServers':
        return ['Default', 'Vidstreaming', 'Gogo'];
      default:
        return [];
    }
  };

  /* Change handlers */
  const handlePreferenceChange = (key: keyof Preferences, value: string) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    switch (key) {
      case 'autoskipIntroOutro': setSettings({ autoSkip: value === 'Enabled' }); break;
      case 'autoPlay':           setSettings({ autoPlay: value === 'Enabled' }); break;
      case 'autoNext':           setSettings({ autoNext: value === 'Enabled' }); break;
      case 'aniListSync':        setSettings({ aniListSync: value === 'Enabled' }); break;
      case 'hideSpoilers':       setSettings({ hideSpoilers: value === 'Enabled' }); break;
      case 'defaultLanguage':    setSettings({ defaultLanguage: value.toLowerCase() }); break;
      case 'defaultServers':     setSettings({ defaultServers: value.toLowerCase() }); break;
      case 'titleLanguage':      setSettings({ titleLanguage: value }); break;
      case 'characterNameLanguage': setSettings({ characterNameLanguage: value }); break;
    }
  };

  const handleToggle = (key: BoolKey) => {
    const next = preferences[key] === 'Enabled' ? 'Disabled' : 'Enabled';
    handlePreferenceChange(key, next);
  };

  const handleRestoreDefaults = () => {
    if (!window.confirm('Restore all preferences to their defaults? Your current settings will be overwritten.')) {
      return;
    }
    // Setting the full defaults through the context persists every key via
    // the provider's storage effect — no manual localStorage.removeItem race.
    setSettings(DEFAULT_SETTINGS);
    // Keep local form state in sync immediately (the settings effect below
    // also reconciles, but this avoids a one-render flicker).
    setSyncThreshold(DEFAULT_SETTINGS.syncThreshold);
    setWatchOrInfo(DEFAULT_SETTINGS.watchOrInfo);
    setPreferences({
      defaultLanguage: 'Sub',
      titleLanguage: DEFAULT_SETTINGS.titleLanguage,
      characterNameLanguage: DEFAULT_SETTINGS.characterNameLanguage,
      ratingSource: 'Anilist',
      openKeyboardShortcuts: '',
      autoskipIntroOutro: DEFAULT_SETTINGS.autoSkip ? 'Enabled' : 'Disabled',
      autoPlay: DEFAULT_SETTINGS.autoPlay ? 'Enabled' : 'Disabled',
      autoNext: DEFAULT_SETTINGS.autoNext ? 'Enabled' : 'Disabled',
      aniListSync: DEFAULT_SETTINGS.aniListSync ? 'Enabled' : 'Disabled',
      defaultServers: 'Default',
      restoreDefaultPreferences: '',
      clearContinueWatching: '',
      hideSpoilers: DEFAULT_SETTINGS.hideSpoilers ? 'Enabled' : 'Disabled',
    });
  };

  const handleClearContinueWatching = () => {
    if (!window.confirm('Clear all continue-watching and reading history? This cannot be undone.'))
      return;
    [
      'watched-episodes',
      'watched-episodes-cache',
      'read-chapters',
      'last-anime-visited',
      'last-manga-visited',
      'all_episode_times',
      'all_reading_times',
    ].forEach((k) => localStorage.removeItem(k));
  };

  /* Control renderer */
  const renderControl = (key: string) => {
    if (key === 'openKeyboardShortcuts') {
      return <StaticPill>Open</StaticPill>;
    }

    if (isBoolKey(key)) {
      const on = preferences[key] === 'Enabled';
      const isDisabled = key === 'aniListSync' && !isLoggedIn;
      
      return (
        <ToggleTrack
          $on={on && !isDisabled}
          onClick={() => !isDisabled && handleToggle(key)}
          aria-label={ROW_META[key]?.label}
          role="switch"
          aria-checked={on && !isDisabled}
          style={{ opacity: isDisabled ? 0.5 : 1, cursor: isDisabled ? 'not-allowed' : 'pointer' }}
        >
          <ToggleThumb $on={on && !isDisabled} />
        </ToggleTrack>
      );
    }

    if (key === 'syncThreshold') {
      return (
        <SliderWrap>
          <StyledRange
            type="range"
            min={0}
            max={100}
            $pct={syncThreshold}
            value={syncThreshold}
            onChange={(e) => setSyncThreshold(Number(e.target.value))}
            aria-label="Sync threshold"
          />
          <ValueBox>{syncThreshold}%</ValueBox>
        </SliderWrap>
      );
    }

    if (key === 'watchOrInfo') {
      return (
        <PillGroup>
          <PillBtn
            $active={watchOrInfo === 'Watch'}
            onClick={() => setWatchOrInfo('Watch')}
          >
            Watch
          </PillBtn>
          <PillBtn
            $active={watchOrInfo === 'Info'}
            onClick={() => setWatchOrInfo('Info')}
          >
            Info
          </PillBtn>
        </PillGroup>
      );
    }

    if (key === 'restoreDefaultPreferences') {
      return (
        <ActionBtn onClick={handleRestoreDefaults}>
          <IoRefreshOutline /> Restore
        </ActionBtn>
      );
    }

    if (key === 'clearContinueWatching') {
      return (
        <ActionBtn $danger onClick={handleClearContinueWatching}>
          <IoTrashOutline /> Clear
        </ActionBtn>
      );
    }

    const opts = getOptions(key);
    if (opts.length) {
      // If the stored value doesn't exactly match an option (e.g. a legacy
      // short form like 'Romaji'), fall back to the first option so the
      // <select> is never in an uncontrolled/blank state.
      const current = preferences[key as keyof Preferences];
      const selected = opts.includes(current) ? current : opts[0];
      return (
        <SelectWrap>
          <StyledSelect
            value={selected}
            onChange={(e) =>
              handlePreferenceChange(key as keyof Preferences, e.target.value)
            }
            aria-label={ROW_META[key]?.label}
          >
            {opts.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </StyledSelect>
          <ChevronIcon />
        </SelectWrap>
      );
    }

    return null;
  };

  /* Active section + search filter */
  const active = sections.find((s) => s.id === activeSection) ?? sections[0];

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return active.groups;
    return active.groups
      .map((g) => ({
        ...g,
        keys: g.keys.filter((k) => {
          const m = ROW_META[k];
          return (
            m?.label.toLowerCase().includes(q) ||
            m?.description.toLowerCase().includes(q)
          );
        }),
      }))
      .filter((g) => g.keys.length > 0);
  }, [search, active]);

  const changeSection = (id: string) => {
    setActiveSection(id);
    setSearch('');
  };

  /* ── Render ── */
  return (
    <Shell>
      {/* Sidebar */}
      <Sidebar>
        <SearchWrap>
          <SearchIconSpan>
            <IoSearchOutline />
          </SearchIconSpan>
          <SearchInput
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </SearchWrap>

        {sections.map((s) => (
          <NavItem
            key={s.id}
            $active={activeSection === s.id}
            $color={s.color}
            onClick={() => changeSection(s.id)}
          >
            <NavIconBadge $color={s.color}>{s.icon}</NavIconBadge>
            <NavLabel $active={activeSection === s.id}>{s.label}</NavLabel>
          </NavItem>
        ))}
      </Sidebar>

      {/* Content */}
      <Content>
        <SectionHead>
          <SectionIconBadge $color={active.color}>{active.icon}</SectionIconBadge>
          <SectionLabel>{active.label}</SectionLabel>
        </SectionHead>

        {filteredGroups.length === 0 ? (
          <Card>
            <EmptyRow>No settings match &ldquo;{search}&rdquo;</EmptyRow>
          </Card>
        ) : (
          filteredGroups.map((group, gi) => (
            <Group key={`${active.id}-${gi}`}>
              {group.title && (
                <GroupHead>
                  <GroupTitle $danger={group.danger}>
                    {group.danger && <IoWarningOutline />}
                    {group.title}
                  </GroupTitle>
                </GroupHead>
              )}

              <Card $danger={group.danger}>
                {group.keys.map((key, i) => {
                  const meta = ROW_META[key];
                  if (!meta) return null;
                  return (
                    <Row key={key} $last={i === group.keys.length - 1}>
                      <RowInfo>
                        <RowName>{meta.label}</RowName>
                        <RowDesc>{meta.description}</RowDesc>
                      </RowInfo>
                      <ControlSlot>{renderControl(key)}</ControlSlot>
                    </Row>
                  );
                })}
              </Card>
            </Group>
          ))
        )}
      </Content>
    </Shell>
  );
};