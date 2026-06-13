import { useState } from 'react';

interface Props {
  /** Bank name — used for the initials fallback and alt text. */
  name: string;
  logo?: string;
  /** Brand colour for the fallback avatar background. */
  color?: string;
  size?: number;
  className?: string;
}

// Renders a bank logo, gracefully degrading to a coloured initials avatar when
// the logo URL is missing or fails to load.
export default function BankLogo({ name, logo, color = '#9ca3af', size = 24, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim()?.[0] ?? '?').toUpperCase();

  const base = `inline-flex items-center justify-center rounded-md overflow-hidden flex-shrink-0 ${className}`;
  const style = { width: size, height: size };

  if (!logo || failed) {
    return (
      <span
        className={base}
        style={{ ...style, background: color, color: '#fff', fontSize: size * 0.5, fontWeight: 700 }}
        aria-label={name}
      >
        {initial}
      </span>
    );
  }

  return (
    <span className={base} style={{ ...style, background: '#fff', border: '1px solid #f0f0f0' }}>
      <img
        src={logo}
        alt={name}
        width={size}
        height={size}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onError={() => setFailed(true)}
        loading="lazy"
      />
    </span>
  );
}
