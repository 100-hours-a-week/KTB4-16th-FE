import { describe, expect, it, vi } from 'vitest';

import { getUploadSignedUrl } from './getUploadSignedUrl';

describe('getUploadSignedUrl', () => {
  it('requests the authenticated upload preview URL and returns signedUrl', async () => {
    const signedUrl = 'https://storage.example/photo.jpg?signature=temporary';
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue({
      message: '사진 조회 URL 발급 성공',
      data: { signedUrl },
    });

    await expect(getUploadSignedUrl(77, fetchAuthenticatedJson)).resolves.toBe(signedUrl);
    expect(fetchAuthenticatedJson).toHaveBeenCalledWith('/uploads/77/signed-url');
  });

  it.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid uploadId %s before making a request',
    async (uploadId) => {
      const fetchAuthenticatedJson = vi.fn();

      await expect(getUploadSignedUrl(uploadId, fetchAuthenticatedJson)).rejects.toThrow(
        '유효한 사진 업로드 정보가 필요합니다.',
      );
      expect(fetchAuthenticatedJson).not.toHaveBeenCalled();
    },
  );

  it.each([
    { message: 'ok', data: {} },
    { message: 'ok', data: { signedUrl: '' } },
    { message: 'ok', data: { signedUrl: '   ' } },
  ])('rejects malformed signed URL responses', async (response) => {
    const fetchAuthenticatedJson = vi.fn().mockResolvedValue(response);

    await expect(getUploadSignedUrl(77, fetchAuthenticatedJson)).rejects.toThrow(
      '사진 미리보기 URL 응답 형식이 올바르지 않습니다.',
    );
  });
});
