import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Sentry from '@sentry/react';

import App from './App';
import { AppProviders } from './app/providers/AppProviders';
import './app/styles/global.css';
import { env } from './shared/config/env';

if (env.sentryDsn) {
  Sentry.init({ dsn: env.sentryDsn });
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('React root element를 찾을 수 없습니다.');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>,
);
