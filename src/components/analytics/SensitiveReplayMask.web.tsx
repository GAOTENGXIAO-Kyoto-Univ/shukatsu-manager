import type { ReactNode } from 'react';

export function SensitiveReplayMask({ children }: { children: ReactNode }) {
  return (
    <div className="ph-sensitive" style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
