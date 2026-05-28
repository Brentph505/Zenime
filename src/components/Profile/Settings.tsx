import React, { useState, useEffect } from 'react';
import styled, { keyframes, css } from 'styled-components';
import { useNavigate } from 'react-router-dom';
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
  openButton: string;
}

interface SettingsProps {
  onClose?: () => void;
}

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.6; }
`;

/* ── Layout ── */

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 1.5rem 1rem 3rem;
  animation: ${fadeIn} 0.25s ease both;
`;

const Inner = styled.div`
  width: 100%;
  max-width: 46rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

/* ── Header ── */

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding-bottom: 0.25rem;
`;

const BackBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: var(--global-border-radius);
  background: var(--global-div);
  color: var(--global-text);
  border: none;
  cursor: pointer;
  flex-shrink: 0;
  transition: background 0.15s, transform 0.1s;

  &:hover  { background: var(--global-div-tr); }
  &:active { transform: scale(0.94); }

  svg { font-size: 1.1rem; }
`;

const PageTitle = styled.h1`
  color: var(--global-text);
  font-size: 1.35rem;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
`;

/* ── Section card ── */

const Card = styled.div`
  background: var(--global-div-tr);
  border-radius: var(--global-border-radius);
  overflow: hidden;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.125rem 0.75rem;
  border-bottom: 1px solid rgba(128, 128, 128, 0.12);

  svg {
    font-size: 1rem;
    opacity: 0.55;
    flex-shrink: 0;
  }
`;

const SectionLabel = styled.span`
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--global-text);
  opacity: 0.45;
`;

/* ── Row ── */

const Row = styled.div<{ last?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.8rem 1.125rem;
  transition: background 0.12s;

  ${({ last }) =>
    !last &&
    css`
      border-bottom: 1px solid rgba(128, 128, 128, 0.08);
    `}

  &:hover {
    background: rgba(128, 128, 128, 0.04);
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
  width: 1.75rem;
  height: 1.75rem;
  border-radius: calc(var(--global-border-radius) * 0.6);
  background: rgba(128, 128, 128, 0.1);
  color: var(--global-text);
  flex-shrink: 0;

  svg { font-size: 0.9rem; opacity: 0.8; }
`;

const RowName = styled.span`
  font-size: 0.875rem;
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
    right: 0.45rem;
    pointer-events: none;
    font-size: 0.75rem;
    opacity: 0.5;
  }
`;

const StyledSelect = styled.select`
  appearance: none;
  -webkit-appearance: none;
  background: var(--global-div);
  color: var(--global-text);
  font-size: 0.8rem;
  padding: 0.35rem 1.75rem 0.35rem 0.65rem;
  border: 1px solid rgba(128, 128, 128, 0.18);
  border-radius: var(--global-border-radius);
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  outline: none;

  &:hover  { border-color: rgba(128, 128, 128, 0.35); }
  &:focus  { border-color: rgba(128, 128, 128, 0.5); }
`;

/* ── Toggle switch ── */

const ToggleTrack = styled.label<{ on: boolean }>`
  position: relative;
  display: inline-flex;
  width: 2.4rem;
  height: 1.35rem;
  border-radius: 999px;
  background: ${({ on }) => (on ? 'var(--global-text)' : 'rgba(128,128,128,0.2)')};
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;

  input { position: absolute; opacity: 0; width: 0; height: 0; }
`;

const ToggleThumb = styled.span<{ on: boolean }>`
  position: absolute;
  top: 0.175rem;
  left: ${({ on }) => (on ? 'calc(100% - 1rem - 0.175rem)' : '0.175rem')};
  width: 1rem;
  height: 1rem;
  border-radius: 50%;
  background: ${({ on }) =>
    on ? 'var(--global-div-tr)' : 'rgba(128,128,128,0.55)'};
  transition: left 0.2s, background 0.2s;
`;

/* ── Action button ── */

const ActionBtn = styled.button<{ danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 500;
  padding: 0.35rem 0.75rem;
  border-radius: var(--global-border-radius);
  border: 1px solid
    ${({ danger }) =>
      danger
        ? 'rgba(239,68,68,0.35)'
        : 'rgba(128,128,128,0.2)'};
  background: transparent;
  color: ${({ danger }) =>
    danger ? 'rgba(239,68,68,0.85)' : 'var(--global-text)'};
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;

  svg { font-size: 0.85rem; }

  &:hover {
    background: ${({ danger }) =>
      danger ? 'rgba(239,68,68,0.08)' : 'rgba(128,128,128,0.08)'};
    border-color: ${({ danger }) =>
      danger ? 'rgba(239,68,68,0.6)' : 'rgba(128,128,128,0.4)'};
  }

  &:active { transform: scale(0.97); }
`;

/* ── Disabled pill ── */

const DisabledPill = styled.span`
  font-size: 0.75rem;
  padding: 0.3rem 0.65rem;
  border-radius: var(--global-border-radius);
  background: var(--global-div);
  color: var(--global-text);
  opacity: 0.6;
  border: 1px solid rgba(128, 128, 128, 0.15);
`;

/* ════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════ */

type BoolKey = 'autoskipIntroOutro' | 'autoPlay' | 'autoNext' | 'aniListSync';
const BOOL_KEYS: BoolKey[] = ['autoskipIntroOutro', 'autoPlay', 'autoNext', 'aniListSync'];

const isBoolKey = (k: string): k is BoolKey => BOOL_KEYS.includes(k as BoolKey);

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const navigate = useNavigate();
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
    openButton: 'Open',
  });

  useEffect(() => {
    setPreferences((prev) => ({
      ...prev,
      defaultLanguage: settings.defaultLanguage,
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
      case 'autoskipIntroOutro':    return ['Enabled', 'Disabled'];
      case 'autoPlay':              return ['Enabled', 'Disabled'];
      case 'defaultServers':        return ['Default', 'Vidstreaming', 'Gogo'];
      case 'autoNext':              return ['Enabled', 'Disabled'];
      case 'aniListSync':           return ['Enabled', 'Disabled'];
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
      case 'defaultLanguage':    setSettings({ defaultLanguage: value }); break;
      case 'defaultServers':     setSettings({ defaultServers: value }); break;
    }
  };

  const handleToggle = (key: BoolKey) => {
    const next = preferences[key] === 'Enabled' ? 'Disabled' : 'Enabled';
    handlePreferenceChange(key, next);
  };

  const handleGoback = () => {
    if (onClose) { onClose(); return; }
    navigate('/profile');
  };

  const rowIcon: Record<string, React.ReactNode> = {
    titleLanguage:         <IoTextOutline />,
    characterNameLanguage: <IoPersonOutline />,
    ratingSource:          <IoStarOutline />,
    openKeyboardShortcuts: <IoKeyOutline />,
    defaultLanguage:       <IoLanguageOutline />,
    defaultServers:        <IoServerOutline />,
  autoskipIntroOutro:    <IoPlaySkipForwardOutline />,
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

  const renderControl = (key: string, isLast: boolean) => {
    if (key === 'openKeyboardShortcuts') {
      return <DisabledPill>Open</DisabledPill>;
    }

    if (isBoolKey(key)) {
      const on = preferences[key as keyof Preferences] === 'Enabled';
      return (
        <ToggleTrack on={on} onClick={() => handleToggle(key as BoolKey)}>
          <input type="checkbox" checked={on} readOnly />
          <ToggleThumb on={on} />
        </ToggleTrack>
      );
    }

    if (key === 'restoreDefaultPreferences' || key === 'clearContinueWatching') {
      const isDanger = key === 'clearContinueWatching';
      return (
        <ActionBtn
          danger={isDanger}
          onClick={() =>
            handlePreferenceChange(
              key as keyof Preferences,
              key === 'restoreDefaultPreferences' ? 'Restore' : 'Clear',
            )
          }
        >
          {rowIcon[key]}
          {key === 'restoreDefaultPreferences' ? 'Restore' : 'Clear'}
        </ActionBtn>
      );
    }

    return (
      <SelectWrap>
        <StyledSelect
          value={preferences[key as keyof Preferences]}
          onChange={(e) =>
            handlePreferenceChange(key as keyof Preferences, e.target.value)
          }
        >
          {getOptionsForPreference(key).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </StyledSelect>
        <IoChevronDown className="chevron" />
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
      label: 'Other',
      keys: ['restoreDefaultPreferences', 'clearContinueWatching'],
    },
  ];

  return (
    <Wrapper>
      <Inner>
        <Header>
          <BackBtn onClick={handleGoback} aria-label="Go back">
            <IoArrowBack />
          </BackBtn>
          <PageTitle>Settings</PageTitle>
        </Header>

        {sections.map((section) => (
          <Card key={section.label}>
            <SectionHeader>
              {section.icon}
              <SectionLabel>{section.label}</SectionLabel>
            </SectionHeader>

            {section.keys.map((key, i) => (
              <Row key={key} last={i === section.keys.length - 1}>
                <RowLeft>
                  <RowIcon>{rowIcon[key]}</RowIcon>
                  <RowName>{label[key]}</RowName>
                </RowLeft>
                {renderControl(key, i === section.keys.length - 1)}
              </Row>
            ))}
          </Card>
        ))}
      </Inner>
    </Wrapper>
  );
};