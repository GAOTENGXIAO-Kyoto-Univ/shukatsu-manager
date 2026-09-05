import { useEffect, useState } from 'react';

function currentMinuteBucket() {
  return Math.floor(Date.now() / 60_000);
}

export function useTimeBucket() {
  const [timeBucket, setTimeBucket] = useState(currentMinuteBucket);

  useEffect(() => {
    const refresh = () => setTimeBucket(currentMinuteBucket());
    const interval = window.setInterval(refresh, 60_000);

    function refreshWhenVisible() {
      if (document.visibilityState === 'visible') refresh();
    }

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  return timeBucket;
}
