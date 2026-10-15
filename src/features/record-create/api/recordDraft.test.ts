import { afterEach, describe, expect, it, vi } from 'vitest';

import { getCsrfToken } from '../../../shared/api/csrf';
import { deleteRecordDraft, getRecordDraft, saveRecordDraft } from './recordDraft';

vi.mock('../../../shared/api/csrf', () => ({ getCsrfToken: vi.fn() }));
afterEach(() => vi.clearAllMocks());

const snapshot = {
  location: { latitude: 37.2, longitude: 127.1, legalDongCode: null, legalDongName: null },
  music: {
    externalTrackId: 'id',
    title: 'title',
    artistName: 'artist',
    albumImageUrl: 'image',
    externalUrl: 'url',
  },
  moodScore: 0,
  comment: null,
  uploadId: 2,
};

describe('record draft API', () => {
  it('treats a 204 GET response as no draft', async () => {
    const request = vi.fn().mockResolvedValue(undefined);
    await expect(getRecordDraft(request)).resolves.toBeNull();
    expect(request).toHaveBeenCalledWith('/users/me/record-draft');
  });

  it('parses the nullable full snapshot and photo signed URL', async () => {
    const request = vi.fn().mockResolvedValue({
      message: 'ok',
      data: {
        ...snapshot,
        photoUrl: 'https://signed.test/photo',
        expiresAt: '2026-10-29T12:00:00',
      },
    });
    await expect(getRecordDraft(request)).resolves.toEqual({
      ...snapshot,
      photoUrl: 'https://signed.test/photo',
      expiresAt: '2026-10-29T12:00:00',
    });
  });

  it('sends every snapshot field on PUT with CSRF', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf');
    const request = vi.fn().mockResolvedValue({ message: 'saved' });
    await saveRecordDraft(snapshot, request);
    expect(request).toHaveBeenCalledWith('/users/me/record-draft', {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': 'csrf' },
      body: JSON.stringify(snapshot),
    });
  });

  it('deletes with CSRF', async () => {
    vi.mocked(getCsrfToken).mockResolvedValue('csrf');
    const request = vi.fn().mockResolvedValue(undefined);
    await deleteRecordDraft(request);
    expect(request).toHaveBeenCalledWith('/users/me/record-draft', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'X-XSRF-TOKEN': 'csrf' },
    });
  });
});
