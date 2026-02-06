import React from 'react';

interface InsightItemProps {
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function InsightItem({ children, icon }: InsightItemProps) {
  return (
    <li className="flex gap-2 text-sm text-overlay-text leading-snug">
      {icon && (
        <span className="mt-0.5 shrink-0 text-overlay-text-muted">{icon}</span>
      )}
      <span>{children}</span>
    </li>
  );
}
