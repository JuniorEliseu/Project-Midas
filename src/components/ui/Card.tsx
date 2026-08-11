import React from 'react';
import clsx from 'clsx';

interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  hoverEffect?: boolean;
  title?: string | React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  className,
  glow = false,
  hoverEffect = false,
  title,
  subtitle,
  action,
  ...props
}) => {
  return (
    <div
      className={clsx(
        'rounded-xl p-5 transition-all duration-200',
        hoverEffect ? 'glass-panel-hover' : 'glass-panel',
        glow && 'glow-card shadow-glow-primary/20 border-brand-primary/30',
        className
      )}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-gray-200/60 dark:border-gray-800/80">
          <div>
            {typeof title === 'string' ? (
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                {title}
              </h3>
            ) : (
              title
            )}
            {subtitle && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
};
