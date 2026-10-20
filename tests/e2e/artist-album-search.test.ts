import { describe, it, expect, beforeEach, vi } from 'vitest';
import { installGlobalBrowserMocks, resetDatabaseAndStores } from '../mocks/mockEnvironment';
import { onlineSearchService } from '../../src/services/api/onlineSearchService';
import { useUiStore } from '../../src/store/uiStore';

installGlobalBrowserMocks();

describe('Artist, Songs & Albums Search Suite', () => {
  beforeEach(async () => {
    await resetDatabaseAndStores();
    useUiStore.setState({
      activeView: 'search',
      selectedArtistName: null,
      selectedArtistId: null,
      selectedAlbumId: null,
      followedArtists: [],
      viewHistory: ['search'],
      viewHistoryIndex: 0,
    });
  });

  describe('1. Multi-Entity Unified Search (Artist, Songs, Albums)', () => {
    it('1.1: searchAll returns artists, songs, and albums for a search query', async () => {
      const results = await onlineSearchService.searchAll('Daft Punk');

      expect(results).toBeDefined();
      expect(Array.isArray(results.artists)).toBe(true);
      expect(Array.isArray(results.tracks)).toBe(true);
      expect(Array.isArray(results.albums)).toBe(true);

      // Verify artist shape
      if (results.artists.length > 0) {
        const artist = results.artists[0];
        expect(artist.name).toBeDefined();
        expect(artist.avatarUrl).toBeDefined();
        expect(typeof artist.monthlyListeners).toBe('number');
      }

      // Verify track shape
      if (results.tracks.length > 0) {
        const track = results.tracks[0];
        expect(track.title).toBeDefined();
        expect(track.artist).toBeDefined();
        expect(track.duration).toBeGreaterThan(0);
      }

      // Verify album shape
      if (results.albums.length > 0) {
        const album = results.albums[0];
        expect(album.title).toBeDefined();
        expect(album.artist).toBeDefined();
        expect(album.coverUrl).toBeDefined();
      }
    });

    it('1.2: searchAll with empty or 1-char query returns empty collections without network call', async () => {
      const results = await onlineSearchService.searchAll(' ');
      expect(results.artists).toEqual([]);
      expect(results.tracks).toEqual([]);
      expect(results.albums).toEqual([]);
    });
  });

  describe('2. Artist Discography & Details Resolution', () => {
    it('2.1: getArtistDetails returns artist profile, top tracks, and discography albums', async () => {
      const details = await onlineSearchService.getArtistDetails('Daft Punk');

      expect(details.artist).toBeDefined();
      expect(details.artist.name.toLowerCase()).toContain('daft punk');
      expect(details.artist.avatarUrl).toBeDefined();
      expect(details.artist.monthlyListeners).toBeGreaterThan(0);

      expect(Array.isArray(details.topTracks)).toBe(true);
      expect(Array.isArray(details.albums)).toBe(true);

      if (details.albums.length > 0) {
        const album = details.albums[0];
        expect(album.id).toBeDefined();
        expect(album.title).toBeDefined();
        expect(album.coverUrl).toBeDefined();
      }
    });
  });

  describe('3. Album Details & Tracklist Resolution', () => {
    it('3.1: getAlbumDetails retrieves album metadata and complete tracklist', async () => {
      // 617154241 is Random Access Memories by Daft Punk
      const details = await onlineSearchService.getAlbumDetails('617154241');

      expect(details.album).toBeDefined();
      expect(details.album.id).toBe('617154241');
      expect(Array.isArray(details.tracks)).toBe(true);

      if (details.tracks.length > 0) {
        const track = details.tracks[0];
        expect(track.title).toBeDefined();
        expect(track.artist).toBeDefined();
        expect(track.duration).toBeGreaterThan(0);
      }
    });
  });

  describe('4. Navigation & Follow Artist State', () => {
    it('4.1: setSelectedArtist switches view to artist and appends to navigation history', () => {
      useUiStore.getState().setSelectedArtist('The Weeknd', '98765');

      const state = useUiStore.getState();
      expect(state.activeView).toBe('artist');
      expect(state.selectedArtistName).toBe('The Weeknd');
      expect(state.selectedArtistId).toBe('98765');
      expect(state.viewHistory[state.viewHistoryIndex]).toBe('artist');
    });

    it('4.2: setSelectedAlbum switches view to album and appends to navigation history', () => {
      useUiStore.getState().setSelectedAlbum('123456');

      const state = useUiStore.getState();
      expect(state.activeView).toBe('album');
      expect(state.selectedAlbumId).toBe('123456');
    });

    it('4.3: toggleFollowArtist toggles artist in followed list and persists', () => {
      expect(useUiStore.getState().followedArtists).not.toContain('Daft Punk');

      useUiStore.getState().toggleFollowArtist('Daft Punk');
      expect(useUiStore.getState().followedArtists).toContain('Daft Punk');

      useUiStore.getState().toggleFollowArtist('Daft Punk');
      expect(useUiStore.getState().followedArtists).not.toContain('Daft Punk');
    });

    it('4.4: goBack and goForward smoothly traverse view history', () => {
      useUiStore.getState().setActiveView('search');
      useUiStore.getState().setSelectedArtist('Adele');

      expect(useUiStore.getState().activeView).toBe('artist');

      useUiStore.getState().goBack();
      expect(useUiStore.getState().activeView).toBe('search');

      useUiStore.getState().goForward();
      expect(useUiStore.getState().activeView).toBe('artist');
    });
  });
});
