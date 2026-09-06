import type { AnalyticsPage } from './types';

function withoutQueryOrHash(pathname: string) {
  return pathname.split(/[?#]/, 1)[0] || '/';
}

export function analyticsPageForPathname(pathname: string): AnalyticsPage | null {
  const path = withoutQueryOrHash(pathname);

  if (path === '/') return 'dashboard';
  if (path === '/companies') return 'companies';
  if (path === '/calendar') return 'calendar';
  if (path === '/profile') return 'profile';
  if (path === '/knowledge' || path.startsWith('/knowledge/')) return 'knowledge';
  if (/^\/applications\/[^/]+\/interviews\/[^/]+\/?$/.test(path)) {
    return 'interview_detail';
  }
  if (/^\/applications\/[^/]+(?:\/research)?\/?$/.test(path)) {
    return 'application_detail';
  }

  return null;
}

export function privacySafePathname(pathname: string) {
  const page = analyticsPageForPathname(pathname);
  return page ? `/${page}` : withoutQueryOrHash(pathname);
}
