import React from 'react';

interface GlassPanelProps {
  children: React.ReactNode;
  className?: string;
  variant?: 'minimal' | 'elevated' | 'interactive';
}

export function GlassPanel({ children, className = '', variant = 'minimal' }: GlassPanelProps) {
  const variantClasses = {
    minimal: 'bg-white/[0.06] backdrop-blur-[32px] border-white/[0.06]',
    elevated: 'bg-white/[0.10] backdrop-blur-[48px] border-white/[0.10] shadow-[0_16px_48px_rgba(0,0,0,0.12)]',
    interactive: 'bg-white/[0.12] backdrop-blur-[24px] border-white/[0.12] glass-transition hover:bg-white/[0.18] hover:backdrop-blur-[28px]',
  };

  return (
    <div
      className={`
        rounded-panel border
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
