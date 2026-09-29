import { expect, test } from 'vitest';

/**
 * 배포 전 index.html에 Google Analytics와 Microsoft Clarity 추적 코드가
 * 누락되거나 다른 측정 ID로 바뀌지 않았는지 검증한다.
 * Vite의 ?raw import는 런타임 번들에 포함하지 않고, 테스트에서만 HTML 원문을 읽는다.
 */
import indexHtml from '../../index.html?raw';

test('loads Google Analytics and Microsoft Clarity from the document head', () => {
  const parsedDocument = new DOMParser().parseFromString(indexHtml, 'text/html');

  expect(
    parsedDocument.head.querySelector(
      'script[src="https://www.googletagmanager.com/gtag/js?id=G-HF5GWRDZS7"]',
    ),
  ).not.toBeNull();
  expect(parsedDocument.head.textContent).toMatch(
    /gtag\(\s*['"]config['"]\s*,\s*['"]G-HF5GWRDZS7['"]\s*\)/,
  );
  expect(parsedDocument.head.textContent).toMatch(
    /['"]clarity['"]\s*,\s*['"]script['"]\s*,\s*['"]ypptowttqb['"]/,
  );
});
