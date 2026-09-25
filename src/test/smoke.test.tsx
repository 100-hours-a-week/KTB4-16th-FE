import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/** jsdom과 Testing Library가 React 요소를 렌더링하는지 검증한다. */
function Fixture() {
  return <h1>MULO 테스트 환경</h1>;
}

describe('test setup', () => {
  it('renders a React element in jsdom', () => {
    render(<Fixture />);

    expect(screen.getByRole('heading', { name: 'MULO 테스트 환경' })).toBeInTheDocument();
  });
});
