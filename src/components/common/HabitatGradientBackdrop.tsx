import type { Salinity } from '../../types/schema';

const LAYERS: readonly Salinity[] = [
  'saltwater',
  'freshwater',
  'brackish',
  'diadromous',
];

interface HabitatGradientBackdropProps {
  active: Salinity | null;
  className?: string;
}

/**
 * Four stacked gradient layers. Only opacity changes, which keeps the
 * cross-fade smooth in Safari and on mobile (background-image is not tweened).
 */
export function HabitatGradientBackdrop({
  active,
  className = '',
}: HabitatGradientBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {LAYERS.map((layer) => (
        <div
          key={layer}
          className={`absolute inset-0 habitat-${layer} ${
            active === layer ? 'is-active' : ''
          }`}
          style={{
            opacity: active === layer ? 1 : 0,
            transition: 'opacity 480ms cubic-bezier(0.22, 1, 0.36, 1)',
            willChange: 'opacity',
          }}
        />
      ))}
    </div>
  );
}