import React from 'react';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  name?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'primary' | 'danger' | 'emerald' | 'violet' | 'teal';
  className?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  id,
  name,
  label,
  description,
  size = 'md',
  tone = 'primary',
  className = '',
}) => {
  const handleToggle = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      onChange(!checked);
    }
  };

  // Tone colors for active state
  const activeTrackTones: Record<string, string> = {
    primary: 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/25',
    teal: 'bg-gradient-to-r from-teal-600 to-emerald-600 shadow-teal-500/25',
    danger: 'bg-gradient-to-r from-rose-500 to-red-600 shadow-rose-500/25',
    emerald: 'bg-gradient-to-r from-emerald-500 to-teal-600 shadow-emerald-500/25',
    violet: 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-500/25',
  };

  const ringTones: Record<string, string> = {
    primary: 'focus-visible:ring-blue-500/50',
    teal: 'focus-visible:ring-teal-500/50',
    danger: 'focus-visible:ring-rose-500/50',
    emerald: 'focus-visible:ring-emerald-500/50',
    violet: 'focus-visible:ring-purple-500/50',
  };

  // Size variations
  const sizeConfig = {
    sm: {
      track: 'w-9 h-5 p-0.5',
      thumb: 'w-4 h-4',
      translate: 'translate-x-4',
      labelClass: 'text-xs',
      descClass: 'text-[11px]',
    },
    md: {
      track: 'w-11 h-6 p-0.5',
      thumb: 'w-5 h-5',
      translate: 'translate-x-5',
      labelClass: 'text-sm',
      descClass: 'text-xs',
    },
    lg: {
      track: 'w-14 h-7.5 p-1',
      thumb: 'w-5.5 h-5.5',
      translate: 'translate-x-6.5',
      labelClass: 'text-base',
      descClass: 'text-xs',
    },
  }[size];

  const switchButton = (
    <button
      type="button"
      id={id}
      name={name}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={handleToggle}
      onKeyDown={handleKeyDown}
      className={`group relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
        ringTones[tone]
      } ${
        disabled ? 'cursor-not-allowed opacity-50' : 'active:scale-95'
      } ${
        checked
          ? `${activeTrackTones[tone]} shadow-sm`
          : 'bg-slate-300 hover:bg-slate-400/80'
      } ${sizeConfig.track}`}
    >
      <span className="sr-only">{typeof label === 'string' ? label : 'Toggle'}</span>
      <span
        aria-hidden="true"
        className={`pointer-events-none inline-block rounded-full bg-white shadow-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-active:scale-105 flex items-center justify-center ${
          sizeConfig.thumb
        } ${checked ? sizeConfig.translate : 'translate-x-0'}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
            checked
              ? tone === 'danger'
                ? 'bg-rose-500 scale-100'
                : tone === 'teal'
                ? 'bg-teal-500 scale-100'
                : tone === 'emerald'
                ? 'bg-emerald-500 scale-100'
                : 'bg-blue-600 scale-100'
              : 'bg-slate-300 scale-75'
          }`}
        />
      </span>
    </button>
  );

  if (!label && !description) {
    return <span className={className}>{switchButton}</span>;
  }

  return (
    <div
      onClick={handleToggle}
      className={`flex items-start justify-between gap-4 cursor-pointer select-none ${
        disabled ? 'cursor-not-allowed opacity-60' : ''
      } ${className}`}
    >
      <div className="min-w-0 flex-1">
        {label && <p className={`font-semibold text-slate-900 leading-snug ${sizeConfig.labelClass}`}>{label}</p>}
        {description && <p className={`text-slate-500 mt-0.5 leading-relaxed ${sizeConfig.descClass}`}>{description}</p>}
      </div>
      <div className="shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
        {switchButton}
      </div>
    </div>
  );
};
