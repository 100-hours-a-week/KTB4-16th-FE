import { describe, expect, it } from 'vitest';

import { hasRequiredPreferredGenres } from './genreOnboardingPolicy';

describe('hasRequiredPreferredGenres', () => {
  it('requires at least one stored, supported genre', () => {
    expect(hasRequiredPreferredGenres({ preferredGenres: ['재즈'] })).toBe(true);
    expect(hasRequiredPreferredGenres({ preferredGenres: null })).toBe(false);
    expect(hasRequiredPreferredGenres({ preferredGenres: [] })).toBe(false);
  });

  it('rejects duplicate or over-limit genre values', () => {
    expect(hasRequiredPreferredGenres({ preferredGenres: ['재즈', '재즈'] })).toBe(false);
    expect(hasRequiredPreferredGenres({ preferredGenres: ['재즈', '댄스', '발라드', 'POP'] })).toBe(
      false,
    );
  });
});
