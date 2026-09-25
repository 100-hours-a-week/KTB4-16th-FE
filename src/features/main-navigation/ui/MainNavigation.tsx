import { NavLink } from 'react-router';

import './mainNavigation.css';

type NavigationIconName = 'home' | 'dashboard' | 'report' | 'group' | 'profile';

type MainNavigationProps = {
  activeItem?: NavigationIconName;
};

const navigationItems: ReadonlyArray<{
  icon: NavigationIconName;
  label: string;
  to: string;
}> = [
  { icon: 'home', label: '홈', to: '/' },
  { icon: 'dashboard', label: '대시보드', to: '/dashboard' },
  { icon: 'report', label: '리포트', to: '/report' },
  { icon: 'group', label: '그룹', to: '/group' },
  { icon: 'profile', label: '마이페이지', to: '/mypage' },
];

/** 주요 화면으로 이동하고 현재 URL에 맞는 활성 탭을 표시한다. */
export function MainNavigation({ activeItem }: MainNavigationProps) {
  return (
    <nav className="main-bottom-nav" aria-label="주요 메뉴">
      {navigationItems.map(({ icon, label, to }) => (
        <NavLink
          aria-current={activeItem === icon ? 'page' : undefined}
          className={({ isActive }) =>
            `main-bottom-nav-link${isActive || activeItem === icon ? ' is-active' : ''}`
          }
          end={to === '/'}
          key={to}
          to={to}
        >
          <NavigationIcon name={icon} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

/** 하단 메뉴 의미를 유지하는 동일한 선 굵기의 outline 아이콘을 제공한다. */
function NavigationIcon({ name }: { name: NavigationIconName }) {
  if (name === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m3.5 10.5 8.5-7 8.5 7v9a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5a1.5 1.5 0 0 1-1.5-1.5Z" />
      </svg>
    );
  }

  if (name === 'dashboard') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
    );
  }

  if (name === 'report') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6 3.5h8.5L19 8v12.5H6Z" />
        <path d="M14.5 3.5V8H19M9 16.5v-3m3 3v-5m3 5v-2" />
      </svg>
    );
  }

  if (name === 'group') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 20c.4-3.1 2.4-5 5.5-5s5.1 1.9 5.5 5M16.5 5.5a3 3 0 0 1 0 5M16 15.1c2.4.3 3.9 1.9 4.4 4.9" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c.6-4.1 3.2-6.2 7.5-6.2s6.9 2.1 7.5 6.2" />
    </svg>
  );
}
