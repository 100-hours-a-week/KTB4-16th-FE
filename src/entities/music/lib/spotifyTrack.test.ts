import { describe, expect, it } from 'vitest';
import { getSpotifyTrackId } from './spotifyTrack';

const id = '4uLU6hMCjMI75M1A2tKUQC';
describe('getSpotifyTrackId', () => {
  it.each([
    `https://open.spotify.com/track/${id}?si=test`,
    `https://open.spotify.com/intl-ko/track/${id}`,
  ])('accepts official track links: %s', (url) => {
    expect(getSpotifyTrackId(url)).toBe(id);
  });
  it('accepts the accumulated-recommendation Spotify identifier', () => {
    expect(getSpotifyTrackId(undefined, id)).toBe(id);
  });
  it.each([
    undefined,
    'javascript:alert(1)',
    `https://open.spotify.com.evil.test/track/${id}`,
    `https://open.spotify.com/album/${id}`,
    `https://open.spotify.com/track/123`,
    `https://evil@open.spotify.com/track/${id}`,
    `http://open.spotify.com/track/${id}`,
  ])('rejects unsupported links: %s', (url) => {
    expect(getSpotifyTrackId(url)).toBeNull();
  });
});
