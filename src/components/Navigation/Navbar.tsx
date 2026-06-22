import React, { useRef, useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import {
  useNavigate,
  useSearchParams,
  Link,
  useLocation,
} from 'react-router-dom';
import { DropDownSearch, useAuth } from '../../index';
import { fetchAdvancedSearch, type Anime } from '../..';
import { FiSun, FiMoon, FiX, FiUser, FiSettings, FiBell, FiLogOut /* FiMenu */ } from 'react-icons/fi';
import { GoCommandPalette } from 'react-icons/go';
import { IoIosSearch } from 'react-icons/io';
import { CgProfile } from 'react-icons/cg';
import { NotificationsPanel } from './NotificationsPanel';
import { SettingsOverlay } from '../Profile/SettingsOverlay';

const StyledNavbar = styled.div<{ $isExtended?: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  text-align: center;
  margin: 0;
  padding: 1rem;
  background-color: var(--global-primary-bg-tr);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  z-index: 100;
  animation: fadeIn('var(--global-primary-bg-tr)') 0.5s ease-in-out;
  transition: 0.1s ease-in-out;

  @media (max-width: 500px) {
    padding: 1rem 0.5rem;
  }
`;

const NavbarWrapper = styled.div`
  max-width: 105rem;
  margin: auto;
`;

const TopContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: space-between;
`;

const LogoImg = styled(Link)`
  width: 7rem;
  font-size: 1.2rem;
  font-weight: bold;
  text-decoration: none;
  color: var(--global-text);
  content: var(--logo-text-transparent);
  cursor: pointer;
  transition:
    color 0.2s ease-in-out,
    transform 0.2s ease-in-out;

  &:hover,
  &:active,
  &:focus {
    color: black;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }

  @media (max-width: 500px) {
    max-width: 6rem;
  }
`;

const InputContainer = styled.div<{ $isVisible: boolean }>`
  display: flex;
  flex: 1;
  max-width: 35rem;
  height: 1.2rem;
  align-items: center;
  padding: 0.6rem;
  border-radius: var(--global-border-radius);
  background-color: var(--global-div);
  animation: fadeIn 0.1s ease-in-out;
  animation: slideDropDown 0.5s ease;

  @media (max-width: 1000px) {
    max-width: 30rem;
  }

  @media (max-width: 500px) {
    max-width: 100%;
    margin-top: 1rem;
    display: ${({ $isVisible }) => ($isVisible ? 'flex' : 'none')};
  }
`;

const RightContent = styled.div`
  gap: 0.5rem;
  display: flex;
  align-items: center;
  height: 2rem;
`;

// Wraps the profile button so the unread-notification badge can anchor to it.
// Inherits the parent's 2rem height so the inner StyledButton (height: 100%)
// matches the size of the dark/light-mode button next to it.
const ProfileButtonWrap = styled.div`
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 100%;
`;

const NotifBadge = styled.div`
  position: absolute;
  top: -0.35rem;
  right: -0.35rem;
  min-width: 1.05rem;
  height: 1.05rem;
  padding: 0 0.3rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ef4444;
  color: #ffffff;
  font-size: 0.6rem;
  font-weight: 700;
  border-radius: 999px;
  line-height: 1;
  text-decoration: none;
  border: 1.5px solid var(--global-primary-bg, #0a0a0c);
  z-index: 2;
  pointer-events: auto;
  transition: transform 0.15s ease;
  &:hover { transform: scale(1.08); }
`;

// ── Profile dropdown card ─────────────────────────────────────────────────────
// Opaque background (not --global-div-tr, which is only ~50% alpha and would
// make the dropdown see-through). Falls back to the theme's primary surface.
const ProfileMenu = styled.div`
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 230px;
  background: var(--global-secondary-bg, #161b22);
  border: 1px solid var(--global-border, rgba(255,255,255,0.08));
  border-radius: var(--global-border-radius, 8px);
  box-shadow: 0 12px 36px var(--global-card-shadow, rgba(0,0,0,0.45));
  backdrop-filter: blur(12px);
  overflow: hidden;
  z-index: 200;
  animation: profileMenuIn 0.18s ease both;
  @keyframes profileMenuIn {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
`;

const ProfileMenuHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.75rem 0.85rem;
  background: var(--global-tertiary-bg, #21262d);
  border-bottom: 1px solid var(--global-border, rgba(255,255,255,0.08));
`;

const ProfileMenuAvatar = styled.img`
  width: 2.3rem;
  height: 2.3rem;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
`;

const ProfileMenuName = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;
`;

const ProfileMenuUsername = styled.span`
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--global-text, #e5e7eb);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ProfileMenuSub = styled.span`
  font-size: 0.62rem;
  color: var(--global-text-muted, #9ca3af);
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const ProfileMenuItem = styled.button<{ $danger?: boolean }>`
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0.6rem 0.85rem;
  background: none;
  border: none;
  color: ${({ $danger }) => ($danger ? '#f87171' : 'var(--global-text, #c9d1d9)')};
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;

  /* Works in both themes — the var flips with the .dark-mode class. */
  &:hover { background: var(--global-tertiary-bg, #21262d); }
  svg { font-size: 0.9rem; opacity: 0.85; flex-shrink: 0; }
`;

const ProfileMenuItemBadge = styled.span`
  margin-left: auto;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.35rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #ef4444;
  color: #fff;
  font-size: 0.62rem;
  font-weight: 700;
  border-radius: 999px;
`;

const ProfileMenuDivider = styled.div`
  height: 1px;
  background: var(--global-border, rgba(255,255,255,0.08));
  margin: 2px 0;
`;

const Icon = styled.div<{ $isFocused: boolean }>`
  margin: 0;
  padding: 0 0.25rem;
  color: var(--global-text);
  opacity: ${({ $isFocused }) => ($isFocused ? 1 : 0.5)};
  font-size: 1.2rem;
  transition: opacity 0.2s;
  max-height: 100%;
  display: flex;
  align-items: center;
`;

const SearchInput = styled.input`
  background: transparent;
  border: none;
  color: var(--global-text);
  display: inline-block;
  font-size: 0.85rem;
  outline: 0;
  padding: 0;
  max-height: 100%;
  display: flex;
  align-items: center;
  padding-top: 0;
  width: 100%;
  transition:
    border-color 0.2s ease-in-out,
    box-shadow 0.2s ease-in-out;
`;

const ClearButton = styled.button<{ $query: string }>`
  background: transparent;
  border: none;
  color: var(--global-text);
  font-size: 1.2rem;
  cursor: pointer;
  opacity: ${({ $query }) => ($query ? 0.5 : 0)};
  visibility: ${({ $query }) => ($query ? 'visible' : 'hidden')};
  transition:
    color 0.2s,
    opacity 0.2s;
  max-height: 100%;
  display: flex;
  align-items: center;

  &:hover,
  &:active,
  &:focus {
    color: var(--global-text);
    opacity: 1;
  }
`;

const StyledButton = styled.button<{ isInputToggle?: boolean }>`
  background: transparent;
  background-color: var(--global-div);
  color: var(--global-text);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 1.2rem 0.6rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--global-border-radius);
  width: 100%;
  height: 100%;
  transition:
    color 0.2s ease-in-out,
    transform 0.1s ease-in-out;
  border: none;

  &:active {
    transform: scale(0.9);
  }

  @media (max-width: 500px) {
    display: flex;
    margin: ${({ isInputToggle }) => (isInputToggle ? '0' : '0')};
  }
`;

const SlashToggleBtn = styled.div<{ $isFocused: boolean }>`
  font-size: 1.2rem;
  cursor: pointer;
  opacity: ${({ $isFocused }) => ($isFocused ? 1 : 0.5)};

  &:hover,
  &:active,
  &:focus {
    opacity: 1;
  }

  @media (max-width: 1000px) {
    display: none;
  }
`;

const detectUserTheme = () => {
  if (
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return true;
  }
  return false;
};

const saveThemePreference = (isDarkMode: boolean) => {
  localStorage.setItem('themePreference', isDarkMode ? 'dark' : 'light');
};

const getInitialThemePreference = () => {
  const storedThemePreference = localStorage.getItem('themePreference');

  if (storedThemePreference) {
    return storedThemePreference === 'dark';
  }

  return detectUserTheme();
};

export const Navbar = () => {
  const { isLoggedIn, userData, unreadNotifications, logout, markNotificationsRead } = useAuth();
  const [isPaddingExtended, setIsPaddingExtended] = useState(false);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [inputContainerWidth, setInputContainerWidth] = useState(0);
  const [searchParams, setSearchParams] = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const navbarRef = useRef(null);
  const dropdownRef = useRef<HTMLDivElement>(null); // Ref for the dropdown container
  const [searchResults, setSearchResults] = useState<Anime[]>([]);
  const debounceTimeout = useRef<Timer | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // ── Profile dropdown + notifications panel state ──
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsClosing, setNotificationsClosing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [search, setSearch] = useState({
    isSearchFocused: false,
    searchQuery: searchParams.get('query') || '',
    isDropdownOpen: false,
  });
  const [isInputVisible, setIsInputVisible] = useState(false); // Default to false
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 500);
  const fetchSearchResults = async (query: string) => {
    if (!query.trim()) return;

    try {
      const fetchedData = await fetchAdvancedSearch(query, 1, 5); // Fetch first 5 results for the dropdown
      const formattedResults = fetchedData.results.map((anime: Anime) => ({
        id: anime.id, // Make sure to include the ID field
        title: anime.title,
        image: anime.image,
        type: anime.type,
        totalEpisodes: anime.totalEpisodes,
        rating: anime.rating,
      }));
      setSearchResults(formattedResults);
    } catch (error) {
      console.error('Failed to fetch search results:', error);
      setSearchResults([]);
    }
  };

  const handleCloseDropdown = () => {
    setSearch((prevState) => ({
      ...prevState,
      isDropdownOpen: false,
    }));
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      dropdownRef.current &&
      !dropdownRef.current.contains(event.target as Node)
    ) {
      handleCloseDropdown();
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  });

  const [isDarkMode, setIsDarkMode] = useState(getInitialThemePreference());

  useEffect(() => {
    document.documentElement.classList.toggle('dark-mode', isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = useCallback(() => {
    const newIsDarkMode = !isDarkMode;
    setIsDarkMode(newIsDarkMode);
    saveThemePreference(newIsDarkMode);
  }, [isDarkMode, setIsDarkMode]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === '/' && inputRef.current) {
        e.preventDefault();
        inputRef.current.focus();
        setSearch((prevState) => ({
          ...prevState,
          isSearchFocused: true,
        }));
      } else if (e.key === 'Escape' && inputRef.current) {
        inputRef.current.blur();
        setSearch((prevState) => ({
          ...prevState,
          isSearchFocused: false,
        }));
        handleCloseDropdown(); // Close dropdown on Escape key
      } else if (e.shiftKey && e.key.toLowerCase() === 'd') {
        if (document.activeElement !== inputRef.current) {
          e.preventDefault();
          toggleTheme();
        }
      }
    },
    [toggleTheme],
  );

  useEffect(() => {
    const listener = handleKeyDown as EventListener;
    document.addEventListener('keydown', listener);
    return () => {
      document.removeEventListener('keydown', listener);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    setSearch({ ...search, searchQuery: searchParams.get('query') || '' });
  }, [searchParams]);

  const navigateWithQuery = useCallback(
    (value: string) => {
      if (location.pathname == '/search') {
        const params = new URLSearchParams();

        params.set('query', value);
        setSearchParams(params, { replace: true });
      } else {
        navigate(value ? `/search?query=${value}` : '/search');
      }
    },
    [navigate, location.pathname, setSearchParams],
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearch({ ...search, searchQuery: newValue });

    if (debounceTimeout.current) clearTimeout(debounceTimeout.current);

    debounceTimeout.current = setTimeout(() => {
      fetchSearchResults(newValue);
      setSearch((prevState) => ({
        ...prevState,
        isDropdownOpen: true,
      }));
    }, 300);
  };

  const handleKeyDownOnInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent default form submission behavior
      if (selectedIndex !== null && searchResults[selectedIndex]) {
        // Navigate to the selected search result if it exists
        const animeId = searchResults[selectedIndex].id;
        navigate(`/watch/${animeId}`);
        handleCloseDropdown();
      } else {
        // Fallback to navigating with the search query if the selected index is not in searchResults
        navigateWithQuery(search.searchQuery);
      }
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      setSearch((prevState) => ({
        ...prevState,
        isDropdownOpen: false,
      }));
      if (inputRef.current) {
        inputRef.current.blur();
      }
    }
  };

  useEffect(() => {
    // Function to update the width
    const updateWidth = () => {
      if (inputContainerRef.current) {
        setInputContainerWidth(inputContainerRef.current.offsetWidth);
      }
    };

    // Update width on mount
    updateWidth();

    // Add event listener for window resize
    window.addEventListener('resize', updateWidth);

    // Cleanup function to remove the event listener
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  useEffect(() => {
    // This effect runs when the location.pathname changes or enter is pressed (Hide the InputContainer)
    if (isMobileView) {
      setIsInputVisible(false);
    }
  }, [location.pathname, isMobileView]);

  const handleClearSearch = () => {
    setSearch((prevState) => ({
      ...prevState,
      searchQuery: '',
    }));
    setSearchResults([]);
    setSearch((prevState) => ({
      ...prevState,
      isDropdownOpen: false, // Close dropdown when search is cleared
    }));
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  useEffect(() => {
    function handleResize() {
      setIsMobileView(window.innerWidth < 500);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  //navigate to profile
  const navigateToProfile = () => {
    // Check if the current location's pathname is not '/profile' before navigating
    if (location.pathname !== '/profile') {
      navigate('/profile');
    }
  };

  // ── Profile dropdown: close on outside click ──
  useEffect(() => {
    if (!profileMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [profileMenuOpen]);

  // ── Notifications panel open/close (slide-out animation, then unmount) ──
  const openNotifications = () => {
    setProfileMenuOpen(false);
    setNotificationsOpen(true);
    setNotificationsClosing(false);
  };

  const closeNotifications = useCallback(() => {
    setNotificationsClosing(true);
    setTimeout(() => {
      setNotificationsOpen(false);
      setNotificationsClosing(false);
    }, 200);
  }, []);

  // Token getter for the panel (reads the same key useAuth uses).
  const getAccessToken = useCallback(() => {
    try { return localStorage.getItem('accessToken'); } catch { return null; }
  }, []);

  // ESC closes whichever overlay is open.
  useEffect(() => {
    if (!profileMenuOpen && !notificationsOpen && !settingsOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setProfileMenuOpen(false);
        if (notificationsOpen) closeNotifications();
        if (settingsOpen) setSettingsOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [profileMenuOpen, notificationsOpen, settingsOpen, closeNotifications]);

  return (
    <>
      <StyledNavbar $isExtended={isPaddingExtended} ref={navbarRef}>
        <NavbarWrapper>
          <TopContainer>
            <LogoImg
              title='MIRURO.tv'
              to='/home'
              onClick={() => window.scrollTo(0, 0)}
            >
              見るろ の 久遠
            </LogoImg>

            {/* Render InputContainer within the navbar for screens larger than 500px */}
            {!isMobileView && (
              <InputContainer
                ref={inputContainerRef}
                $isVisible={isInputVisible}
              >
                <Icon $isFocused={search.isSearchFocused}>
                  <IoIosSearch />
                </Icon>
                <SearchInput
                  type='text'
                  placeholder='Search Anime'
                  value={search.searchQuery}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDownOnInput}
                  onFocus={() => {
                    setSearch((prevState) => ({
                      ...prevState,
                      isDropdownOpen: true,
                      isSearchFocused: true,
                    }));
                  }}
                  ref={inputRef}
                  aria-label='Search Anime'
                />
                <DropDownSearch
                  searchResults={searchResults}
                  onClose={handleCloseDropdown}
                  isVisible={search.isDropdownOpen}
                  selectedIndex={selectedIndex}
                  setSelectedIndex={setSelectedIndex}
                  searchQuery={search.searchQuery}
                  containerWidth={inputContainerWidth}
                />

                <ClearButton
                  $query={search.searchQuery}
                  onClick={handleClearSearch}
                  aria-label='Clear Search'
                >
                  <FiX />
                </ClearButton>
                <Icon $isFocused={search.isSearchFocused}>
                  <GoCommandPalette />
                </Icon>
              </InputContainer>
            )}
            <RightContent>
              {isMobileView && (
                <StyledButton
                  onClick={() => {
                    setIsInputVisible((prev) => !prev);
                    setIsPaddingExtended((prev) => !prev); // Toggle padding extension when toggling input visibility
                  }}
                  aria-label='Toggle Search Input'
                >
                  <IoIosSearch />
                </StyledButton>
              )}
              <StyledButton onClick={toggleTheme} aria-label='Toggle Dark Mode'>
                {isDarkMode ? <FiSun /> : <FiMoon />}
              </StyledButton>
              <ProfileButtonWrap>
                <StyledButton
                  onClick={() => {
                    if (isLoggedIn) setProfileMenuOpen((o) => !o);
                    else navigateToProfile();
                  }}
                  aria-label='Profile'
                  aria-expanded={profileMenuOpen}
                >
                  {isLoggedIn && userData ? (
                    <img
                      src={userData.avatar.large}
                      alt={`${userData.name}'s avatar`}
                      style={{
                        width: '25px',
                        height: '25px',
                        borderRadius: '50%',
                      }}
                    />
                  ) : (
                    <CgProfile />
                  )}
                </StyledButton>

                {isLoggedIn && unreadNotifications > 0 && (
                  <NotifBadge
                    title={`${unreadNotifications} unread notification${unreadNotifications === 1 ? '' : 's'}`}
                    aria-label={`${unreadNotifications} unread notifications`}
                  >
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </NotifBadge>
                )}

                {profileMenuOpen && isLoggedIn && (
                  <ProfileMenu ref={profileMenuRef} role='menu'>
                    <ProfileMenuHeader>
                      <ProfileMenuAvatar
                        src={userData?.avatar.large}
                        alt={userData?.name ?? 'avatar'}
                      />
                      <ProfileMenuName>
                        <ProfileMenuUsername>{userData?.name ?? 'User'}</ProfileMenuUsername>
                        <ProfileMenuSub>AniList Member</ProfileMenuSub>
                      </ProfileMenuName>
                    </ProfileMenuHeader>

                    <ProfileMenuItem
                      onClick={() => { setProfileMenuOpen(false); navigate('/profile'); }}
                    >
                      <FiUser /> Profile
                    </ProfileMenuItem>
                    <ProfileMenuItem
                      onClick={() => { setProfileMenuOpen(false); setSettingsOpen(true); }}
                    >
                      <FiSettings /> Settings
                    </ProfileMenuItem>
                    <ProfileMenuItem onClick={openNotifications}>
                      <FiBell /> Notifications
                      {unreadNotifications > 0 && (
                        <ProfileMenuItemBadge>
                          {unreadNotifications > 99 ? '99+' : unreadNotifications}
                        </ProfileMenuItemBadge>
                      )}
                    </ProfileMenuItem>
                    <ProfileMenuDivider />
                    <ProfileMenuItem $danger onClick={() => { setProfileMenuOpen(false); logout(); }}>
                      <FiLogOut /> Log out
                    </ProfileMenuItem>
                  </ProfileMenu>
                )}
              </ProfileButtonWrap>
            </RightContent>
          </TopContainer>

          {isMobileView && isInputVisible && (
            <InputContainer $isVisible={isInputVisible}>
              <Icon $isFocused={search.isSearchFocused}>
                <IoIosSearch />
              </Icon>
              <SearchInput
                type='text'
                placeholder='Search Anime'
                value={search.searchQuery}
                onChange={handleInputChange}
                onKeyDown={handleKeyDownOnInput}
                onFocus={() => {
                  setSearch((prevState) => ({
                    ...prevState,
                    isDropdownOpen: true,
                    isSearchFocused: true,
                  }));
                }}
                ref={inputRef}
              />
              <DropDownSearch
                searchResults={searchResults}
                onClose={handleCloseDropdown}
                isVisible={search.isDropdownOpen}
                selectedIndex={selectedIndex}
                setSelectedIndex={setSelectedIndex}
                searchQuery={search.searchQuery}
                containerWidth={inputContainerWidth}
              />

              <ClearButton
                $query={search.searchQuery}
                onClick={handleClearSearch}
              >
                <FiX />
              </ClearButton>
              <SlashToggleBtn $isFocused={search.isSearchFocused}>
                <GoCommandPalette />
              </SlashToggleBtn>
            </InputContainer>
          )}
        </NavbarWrapper>
      </StyledNavbar>

      {isLoggedIn && (
        <NotificationsPanel
          open={notificationsOpen}
          closing={notificationsClosing}
          onClose={closeNotifications}
          isLoggedIn={isLoggedIn}
          getToken={getAccessToken}
          markRead={markNotificationsRead}
        />
      )}

      <SettingsOverlay open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Conditionally render InputContainer below the navbar for mobile view when visibility is toggled */}
    </>
  );
};
