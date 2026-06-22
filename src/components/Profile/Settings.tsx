import React, { useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import {
  IoArrowBack,
  IoLanguageOutline,
  IoTextOutline,
  IoPersonOutline,
  IoStarOutline,
  IoKeyOutline,
  IoPlayOutline,
  IoPlaySkipForwardOutline,
  IoSyncOutline,
  IoServerOutline,
  IoRefreshOutline,
  IoTrashOutline,
  IoClose,
  IoChevronDown,
} from 'react-icons/io5';
import { useSettings } from '../../index';

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
}

interface SettingsProps {
  onClose?: () => void;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

/* ── Layout ── */

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  width: 100%;
  animation: ${fadeIn} 0.25s ease both;
`;

const Inner = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 1.25rem 1.25rem 1.75rem;

  @media (min-width: 600px) {
    padding: 1.5rem 1.75rem 2rem;
  }
`;

/* ── Header ── */

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.875rem 1.25rem;
  border-bottom: 1px solid var(--global-border);
  background: var(--global-tertiary-bg);
  border-radius: var(--global-border-radius) var(--global-border-radius) 0 0;

  @media (min-width: 600px) {
    padding: 1rem 1.75rem;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
`;

const HeaderIcon = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  border-radius: 8px;
  background: var(--primary-accent);
  color: #ffffff;
  font-size: 0.95rem;
  flex-shrink: 0;
`;

const PageTitle = styled.h1`
  color: var(--global-text);
  font-size: 1.15rem;
  font-weight: 700;
  margin: 0;
  letter-spacing: -0.01em;

  @media (min-width: 600px) { font-size: 1.3rem; }
`;

const CloseBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border-radius: var(--global-border-radius);
  background: transparent;
  color: var(--global-text-muted);
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s;

  &:hover { background: var(--global-card-bg); color: var(--global-text); }

  svg { font-size: 1.15rem; }
`;

/* ── Section card (opaque) ── */

const Card = styled.div`
  background: var(--global-secondary-bg);
  border: 1px solid var(--global-border);
  border-radius: var(--global-border-radius);
  overflow: hidden;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--global-border);
  background: var(--global-tertiary-bg);

  svg {
    font-size: 0.95rem;
    color: var(--primary-accent);
    flex-shrink: 0;
  }
`;

const SectionLabel = styled.span`
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--global-text-muted);
`;

/* ── Row ── */

const Row = styled.div<{ $last?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem 1rem;
  transition: background 0.12s;

  ${({ $last }) =>
    !$last &&
    css`
      border-bottom: 1px solid var(--global-border);
    `}

  &:hover {
    background: var(--global-card-bg);
  }
`;

const RowLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-width: 0;
`;

const RowIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.65rem;
  height: 1.65rem;
  border-radius: 7px;
  background: var(--global-card-bg);
  color: var(--global-text-muted);
  flex-shrink: 0;

  svg { font-size: 0.85rem; }
`;

const RowName = styled.span`
  font-size: 0.85rem;
  color: var(--global-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

/* ── Select wrapper ── */

const SelectWrap = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;

  svg.chevron {
    position: absolute;
    right: 0.5rem;
    pointer-events: none;
    font-size: 0.75rem;
    color: var(--global-text-muted);
  }
`;

const StyledSelect = styled.select`
  appearance: none;
  -webkit-appearance: none;
  background: var(--global-card-bg);
  color: var(--global-text);
  font-size: 0.8rem;
  padding: 0.4rem 1.85rem 0.4rem 0.7rem;
  border: 1px solid var(--global-border);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: border-color 0.15s;
  outline: none;

  &:hover  { border-color: var(--primary-accent); }
  &:focus  { border-color: var(--primary-accent); }

  option {
    background: var(--global-secondary-bg);
    color: var(--global-text);
  }
`;

/* ── Toggle switch ── */

const ToggleTrack = styled.button<{ $on: boolean }>`
  position: relative;
  display: inline-flex;
  width: 2.5rem;
  height: 1.4rem;
  border-radius: 999px;
  background: ${({ $on }) => ($on ? 'var(--primary-accent)' : 'var(--global-card-bg)')};
  border: 1px solid ${({ $on }) => ($on ? 'var(--primary-accent)' : 'var(--global-border)')};
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  flex-shrink: 0;
  padding: 0;
`;

const ToggleThumb = styled.span<{ $on: boolean }>`
  position: absolute;
  top: 50%;
  left: ${({ $on }) => ($on ? 'calc(100% - 1.05rem - 0.2rem)' : '0.2rem')};
  transform: translateY(-50%);
  width: 1.05rem;
  height: 1.05rem;
  border-radius: 50%;
  background: ${({ $on }) => ($on ? '#ffffff' : 'var(--global-text-muted)')};
  transition: left 0.2s, background 0.2s;
`;

/* ── Action button ── */

const ActionBtn = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.4rem 0.8rem;
  border-radius: var(--global-border-radius);
  border: 1px solid ${({ $danger }) => ($danger ? 'rgba(239,68,68,0.4)' : 'var(--global-border)')};
  background: ${({ $danger }) => ($danger ? 'transparent' : 'var(--global-card-bg)')};
  color: ${({ $danger }) => ($danger ? '#f87171' : 'var(--global-text)')};
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;

  svg { font-size: 0.85rem; }

  &:hover {
    background: ${({ $danger }) => ($danger ? 'rgba(239,68,68,0.1)' : 'var(--global-tertiary-bg)')};
    border-color: ${({ $danger }) => ($danger ? 'rgba(239,68,68,0.6)' : 'var(--primary-accent)')};
  }

  &:active { transform: scale(0.97); }
`;

/* ── Disabled pill ── */

const DisabledPill = styled.span`
  font-size: 0.75rem;
  padding: 0.35rem 0.7rem;
  border-radius: var(--global-border-radius);
  background: var(--global-card-bg);
  color: var(--global-text-muted);
  border: 1px solid var(--global-border);
`;

/* ════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════ */

type BoolKey = 'autoskipIntroOutro' | 'autoPlay' | 'autoNext' | 'aniListSync';
const BOOL_KEYS: BoolKey[] = ['autoskipIntroOutro', 'autoPlay', 'autoNext', 'aniListSync'];

const isBoolKey = (k: string): k is BoolKey => BOOL_KEYS.includes(k as BoolKey);

const DEFAULT_SETTINGS = {
  autoSkip: false,
  autoPlay: true,
  autoNext: false,
  defaultLanguage: 'sub',
  defaultServers: 'default',
  aniListSync: false,
};

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const { settings, setSettings } = useSettings();

  const [preferences, setPreferences] = useState<Preferences>({
    defaultLanguage: settings.defaultLanguage,
    titleLanguage: 'Romaji',
    characterNameLanguage: 'Romaji',
    ratingSource: 'Anilist',
    openKeyboardShortcuts: 'Open',
    autoskipIntroOutro: settings.autoSkip ? 'Enabled' : 'Disabled',
    autoPlay: settings.autoPlay ? 'Enabled' : 'Disabled',
    autoNext: settings.autoNext ? 'Enabled' : 'Disabled',
    aniListSync: settings.aniListSync ? 'Enabled' : 'Disabled',
    defaultServers: 'Default',
    restoreDefaultPreferences: 'Restore',
    clearContinueWatching: 'Clear',
  });

  useEffect(() => {
    setPreferences((prev) => ({
      ...prev,
      defaultLanguage: settings.defaultLanguage,
      defaultServers: settings.defaultServers === 'default' ? 'Default' : settings.defaultServers,
      autoskipIntroOutro: settings.autoSkip ? 'Enabled' : 'Disabled',
      autoPlay: settings.autoPlay ? 'Enabled' : 'Disabled',
      autoNext: settings.autoNext ? 'Enabled' : 'Disabled',
      aniListSync: settings.aniListSync ? 'Enabled' : 'Disabled',
    }));
  }, [settings]);

  const getOptionsForPreference = (key: string): string[] => {
    switch (key) {
      case 'defaultLanguage':       return ['Sub', 'Dub'];
      case 'titleLanguage':         return ['English (Attack on Titan)', 'Romaji (Shingeki no Kyojin)', 'Native (進撃の巨人)'];
      case 'characterNameLanguage': return ['Romaji (Zoldyck Killua)', 'Native (キルア=ゾルディック)'];
      case 'ratingSource':          return ['Anilist', 'IMDb', 'MyAnimeList'];
      case 'defaultServers':        return ['Default', 'Vidstreaming', 'Gogo'];
      default:                      return [];
    }
  };

  const handlePreferenceChange = (
    preferenceName: keyof Preferences,
    value: string,
  ) => {
    setPreferences((prev) => ({ ...prev, [preferenceName]: value }));

    switch (preferenceName) {
      case 'autoskipIntroOutro': setSettings({ autoSkip: value === 'Enabled' }); break;
      case 'autoPlay':           setSettings({ autoPlay: value === 'Enabled' }); break;
      case 'autoNext':           setSettings({ autoNext: value === 'Enabled' }); break;
      case 'aniListSync':        setSettings({ aniListSync: value === 'Enabled' }); break;
      case 'defaultLanguage':    setSettings({ defaultLanguage: value.toLowerCase() }); break;
      case 'defaultServers':     setSettings({ defaultServers: value.toLowerCase() }); break;
    }
  };

  const handleToggle = (key: BoolKey) => {
    const next = preferences[key] === 'Enabled' ? 'Disabled' : 'Enabled';
    handlePreferenceChange(key, next);
  };

  // Restore all settings to defaults.
  const handleRestoreDefaults = () => {
    setSettings(DEFAULT_SETTINGS);
    ['autoSkip', 'autoPlay', 'autoNext', 'defaultLanguage', 'defaultServers', 'aniListSync'].forEach((k) => {
      localStorage.removeItem(k);
    });
  };

  // Clear all local continue-watching history (anime + manga).
  const handleClearContinueWatching = () => {
    if (!window.confirm('Clear all continue-watching and reading history? This cannot be undone.')) return;
    ['watched-episodes', 'watched-episodes-cache', 'read-chapters', 'last-anime-visited', 'last-manga-visited', 'all_episode_times', 'all_reading_times'].forEach((k) => {
      localStorage.removeItem(k);
    });
  };

  const handleClose = () => {
    onClose?.();
  };

  const rowIcon: Record<string, React.ReactNode> = {
    titleLanguage:         <IoTextOutline />,
    characterNameLanguage: <IoPersonOutline />,
    ratingSource:          <IoStarOutline />,
    openKeyboardShortcuts: <IoKeyOutline />,
    defaultLanguage:       <IoLanguageOutline />,
    defaultServers:        <IoServerOutline />,
    autoskipIntroOutro:    <IoPlaySkipForwardOutline />,
    autoPlay:              <IoPlayOutline />,
    autoNext:              <IoPlaySkipForwardOutline />,
    aniListSync:           <IoSyncOutline />,
    restoreDefaultPreferences: <IoRefreshOutline />,
    clearContinueWatching:     <IoTrashOutline />,
  };

  const label: Record<string, string> = {
    titleLanguage:             'Title language',
    characterNameLanguage:     'Character name language',
    ratingSource:              'Rating source',
    openKeyboardShortcuts:     'Keyboard shortcuts',
    defaultLanguage:           'Default language',
    defaultServers:            'Default servers',
    autoskipIntroOutro:        'Auto-skip intro / outro',
    autoPlay:                  'Auto-play',
    autoNext:                  'Auto-next episode',
    aniListSync:               'AniList sync',
    restoreDefaultPreferences: 'Restore default preferences',
    clearContinueWatching:     'Clear continue watching',
  };

  const renderControl = (key: string) => {
    if (key === 'openKeyboardShortcuts') {
      return <DisabledPill>Open</DisabledPill>;
    }

    if (isBoolKey(key)) {
      const on = preferences[key as keyof Preferences] === 'Enabled';
      return (
        <ToggleTrack $on={on} onClick={() => handleToggle(key as BoolKey)} aria-label={label[key]} role='switch' aria-checked={on}>
          <ToggleThumb $on={on} />
        </ToggleTrack>
      );
    }

    if (key === 'restoreDefaultPreferences') {
      return (
        <ActionBtn onClick={handleRestoreDefaults}>
          {rowIcon[key]} Restore
        </ActionBtn>
      );
    }

    if (key === 'clearContinueWatching') {
      return (
        <ActionBtn $danger onClick={handleClearContinueWatching}>
          {rowIcon[key]} Clear
        </ActionBtn>
      );
    }

    return (
      <SelectWrap>
        <StyledSelect
          value={preferences[key as keyof Preferences]}
          onChange={(e) => handlePreferenceChange(key as keyof Preferences, e.target.value)}
          aria-label={label[key]}
        >
          {getOptionsForPreference(key).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </StyledSelect>
        <IoChevronDown className='chevron' />
      </SelectWrap>
    );
  };

  const sections: { icon: React.ReactNode; label: string; keys: string[] }[] = [
    {
      icon: <IoTextOutline />,
      label: 'General',
      keys: ['titleLanguage', 'characterNameLanguage', 'ratingSource', 'openKeyboardShortcuts'],
    },
    {
      icon: <IoPlayOutline />,
      label: 'Media',
      keys: ['defaultLanguage', 'defaultServers', 'autoskipIntroOutro', 'autoPlay', 'autoNext', 'aniListSync'],
    },
    {
      icon: <IoRefreshOutline />,
      label: 'Data',
      keys: ['restoreDefaultPreferences', 'clearContinueWatching'],
    },
  ];

  return (
    <Wrapper>
      <Header>
        <HeaderLeft>
          <HeaderIcon><IoRefreshOutline /></HeaderIcon>
          <PageTitle>Settings</PageTitle>
        </HeaderLeft>
        {onClose && (
          <CloseBtn onClick={handleClose} aria-label='Close settings'>
            <IoClose />
          </CloseBtn>
        )}
      </Header>

      <Inner>
        {sections.map((section) => (
          <Card key={section.label}>
            <SectionHeader>
              {section.icon}
              <SectionLabel>{section.label}</SectionLabel>
            </SectionHeader>

            {section.keys.map((key, i) => (
              <Row key={key} $last={i === section.keys.length - 1}>
                <RowLeft>
                  <RowIcon>{rowIcon[key]}</RowIcon>
                  <RowName>{label[key]}</RowName>
                </RowLeft>
                {renderControl(key)}
              </Row>
            ))}
          </Card>
        ))}
      </Inner>
    </Wrapper>
  );
};
