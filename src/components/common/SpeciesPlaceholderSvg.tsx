import {
  FLESH_COLOR_MAP,
  type CategoryCode,
  type FleshColorTag,
} from '../../types/schema';

interface SpeciesPlaceholderSvgProps {
  category: CategoryCode;
  fleshColor?: FleshColorTag | null;
  cover?: string | null;
  alt: string;
  id?: string;
  className?: string;
}

type SilhouetteKind =
  | 'fish'
  | 'shark'
  | 'ray'
  | 'crustacean'
  | 'cephalopod'
  | 'bivalve'
  | 'gastropod'
  | 'other';

function silhouetteKind(category: CategoryCode, id?: string): SilhouetteKind {
  if (category === 'FI') {
    const code = id?.slice(2, 4);
    if (code === '90') return 'shark';
    if (code === '91' || code === '92') return 'ray';
    return 'fish';
  }
  switch (category) {
    case 'CR':
      return 'crustacean';
    case 'CE':
      return 'cephalopod';
    case 'BI':
      return 'bivalve';
    case 'GA':
      return 'gastropod';
    default:
      return 'other';
  }
}

function Silhouette({ kind }: { kind: SilhouetteKind }) {
  switch (kind) {
    case 'shark':
      return (
        <g>
          <path d="M30 64 C58 44 108 34 158 40 C180 43 198 52 208 62 C196 72 178 80 158 82 C112 88 58 82 30 64 Z" />
          <path d="M208 62 L232 40 L224 62 L232 84 Z" />
          <path d="M92 42 L104 16 L124 38" />
          <path d="M86 78 L100 102 L120 82" />
          <path d="M64 58 C72 60 76 64 78 68" />
          <path d="M88 55 C94 58 98 63 100 70" />
          <path d="M108 53 C114 57 118 62 120 69" />
          <circle cx="52" cy="58" r="3" />
        </g>
      );
    case 'ray':
      return (
        <g>
          <path d="M120 30 L38 58 L102 78 L120 96 L138 78 L202 58 Z" />
          <path d="M120 78 C118 94 112 104 102 112" />
          <path d="M120 78 C122 94 128 104 138 112" />
          <path d="M62 60 C80 66 96 72 108 82" />
          <path d="M178 60 C160 66 144 72 132 82" />
          <circle cx="112" cy="50" r="2.6" />
          <circle cx="128" cy="50" r="2.6" />
        </g>
      );
    case 'crustacean':
      return (
        <g>
          <path d="M72 64 C82 42 124 34 156 48 C174 56 180 70 170 80 C154 96 110 94 88 82 C78 76 70 70 72 64 Z" />
          <path d="M72 64 C54 58 42 50 34 40" />
          <path d="M72 70 C54 70 42 76 32 88" />
          <path d="M156 54 C174 48 190 48 204 56" />
          <path d="M92 48 L86 36 M108 44 L104 32 M126 42 L126 30 M144 44 L148 32" />
          <path d="M98 82 L92 94 M116 88 L112 102 M136 88 L140 102 M154 80 L162 90" />
          <circle cx="164" cy="60" r="3" />
        </g>
      );
    case 'cephalopod':
      return (
        <g>
          <path d="M120 22 C144 22 158 38 152 58 C146 76 134 84 120 86 C106 84 94 76 88 58 C82 38 96 22 120 22 Z" />
          <path d="M96 82 C88 94 84 104 78 112" />
          <path d="M108 86 C104 98 100 106 96 114" />
          <path d="M120 88 C120 100 120 108 120 116" />
          <path d="M132 86 C136 98 140 106 144 114" />
          <path d="M144 82 C152 94 156 104 162 112" />
          <path d="M88 56 C74 50 64 40 58 28" />
          <path d="M152 56 C166 50 176 40 182 28" />
          <circle cx="108" cy="52" r="2.8" />
          <circle cx="132" cy="52" r="2.8" />
        </g>
      );
    case 'bivalve':
      return (
        <g>
          <path d="M120 22 C84 22 54 44 50 74 C80 90 160 90 190 74 C186 44 156 22 120 22 Z" />
          <path d="M120 24 L120 82" />
          <path d="M120 24 C100 42 94 62 96 82" />
          <path d="M120 24 C140 42 146 62 144 82" />
          <path d="M82 60 C96 70 108 76 120 78" />
          <path d="M158 60 C144 70 132 76 120 78" />
          <path d="M50 74 C66 66 78 60 92 58" />
          <path d="M190 74 C174 66 162 60 148 58" />
        </g>
      );
    case 'gastropod':
      return (
        <g>
          <path d="M104 28 C132 24 156 40 158 66 C160 90 142 104 120 102 C100 100 86 86 88 68 C90 52 102 42 116 42 C130 42 140 52 140 64 C140 74 132 82 122 82 C114 82 108 76 108 68 C108 62 112 58 118 58" />
          <path d="M88 96 C72 98 58 106 46 114" />
          <path d="M108 102 C108 108 106 112 104 116" />
          <path d="M140 96 C154 102 166 108 176 114" />
        </g>
      );
    case 'other':
      return (
        <g>
          <path d="M40 70 C60 46 98 40 130 52 C144 58 154 66 162 74 C150 82 138 88 124 90 C92 96 58 88 40 70 Z" />
          <path d="M162 72 L190 52 L184 72 L192 90 Z" />
          <path d="M30 104 C52 94 72 94 92 104 C112 114 132 114 154 104" />
          <path d="M54 62 C64 52 78 48 92 50" />
        </g>
      );
    case 'fish':
    default:
      return (
        <g>
          <path d="M28 62 C52 36 112 30 154 60 C112 92 52 88 28 62 Z" />
          <path d="M154 60 L184 38 L178 60 L184 82 Z" />
          <path d="M90 38 L102 16 L120 36" />
          <path d="M78 80 L90 98 L108 84" />
          <path d="M72 46 C78 56 78 68 72 78" />
          <path d="M112 48 C120 56 120 68 112 76" />
          <circle cx="56" cy="58" r="3" />
        </g>
      );
  }
}

export function SpeciesPlaceholderSvg({
  category,
  fleshColor,
  cover,
  alt,
  id,
  className = '',
}: SpeciesPlaceholderSvgProps) {
  if (cover) {
    return (
      <div className={`relative overflow-hidden bg-[#E7F2F8] dark:bg-[#122B3A] ${className}`}>
        <img
          src={cover}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const meta = fleshColor ? FLESH_COLOR_MAP[fleshColor] : null;
  const pastel = meta?.pastel ?? '#E7F2F8';
  const pastelDark = meta?.pastelDark ?? '#122B3A';
  const kind = silhouetteKind(category, id);

  return (
    <div
      className={`relative isolate overflow-hidden ${className}`}
      role="img"
      aria-label={`${alt} 矢量占位图`}
    >
      <div
        className="absolute inset-0 dark:hidden"
        style={{ background: `linear-gradient(145deg, ${pastel} 0%, #FFFFFF 100%)` }}
      />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{ background: `linear-gradient(145deg, ${pastelDark} 0%, #0B1824 100%)` }}
      />

      <svg
        viewBox="0 0 240 120"
        fill="none"
        className="relative h-full w-full text-[#0B4F71]/[0.65] dark:text-[#7CC4E3]/[0.70]"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <Silhouette kind={kind} />
        <circle cx="216" cy="22" r="9" opacity="0.22" />
        <path d="M20 18 L36 18" opacity="0.3" />
        <path d="M24 24 L24 12" opacity="0.3" />
        <path d="M198 102 L214 102" opacity="0.22" />
      </svg>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.55),transparent_55%)] dark:bg-[radial-gradient(circle_at_78%_18%,rgba(56,189,248,0.10),transparent_55%)]" />
    </div>
  );
}