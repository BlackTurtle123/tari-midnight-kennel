import { VARIANTS } from "../shared/game";
import { canineSvg } from "./canineRenderer";
export function CanineArt({variant = 0, genes, name, className = ""}: {variant?: number; genes?: string; name?: string; className?: string}) {
  const v = VARIANTS[variant] || VARIANTS[0];
  const genome = genes ?? v.genes;
  return <img className={`canine-art ${className}`} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(canineSvg(genome))}`} alt={`${name ?? v.name} · ${genome}`} />;
}
export function DoorArt({ index }: { index: number }) {
  const colors = ["#eda867", "#b9abe7", "#9ac6ad"];
  return (
    <svg
      viewBox="0 0 240 210"
      role="img"
      aria-label={
        ["A pumpkin porch", "A moonlit doorway", "A haunted crypt"][index]
      }
    >
      <ellipse cx="120" cy="197" rx="87" ry="8" fill="#302c3b" opacity=".1" />
      <path
        d="M55 191V78Q55 14 120 14Q185 14 185 78V191"
        fill={colors[index]}
        stroke="#302c3b"
        strokeWidth="5"
      />
      <path d="M72 191V80Q72 33 120 33Q168 33 168 80V191Z" fill="#35303e" />
      <path
        d="M84 187V82Q84 45 120 45Q156 45 156 82V187Z"
        fill={colors[index]}
        opacity=".4"
      />
      <path d="M120 48V185M87 137H153" stroke="#302c3b" strokeWidth="4" />
      <circle cx="142" cy="148" r="6" fill="#f6cf6b" />
      {index === 0 ? (
        <g>
          <ellipse
            cx="55"
            cy="174"
            rx="31"
            ry="25"
            fill="#ed924a"
            stroke="#302c3b"
            strokeWidth="4"
          />
          <path
            d="M55 149V137M39 170L48 161L54 172M59 173L66 163L73 175M43 182L66 184"
            stroke="#302c3b"
            strokeWidth="4"
            fill="#302c3b"
          />
        </g>
      ) : index === 1 ? (
        <path
          d="M196 26Q171 50 199 63Q158 69 166 41Q173 24 196 26"
          fill="#f4cf7c"
          stroke="#302c3b"
          strokeWidth="3"
        />
      ) : (
        <g>
          <path
            d="M181 151Q180 126 203 126Q228 126 227 151V188L216 182L204 189L193 183L181 189Z"
            fill="#f7f2e5"
            stroke="#302c3b"
            strokeWidth="4"
          />
          <circle cx="196" cy="149" r="3" />
          <circle cx="213" cy="149" r="3" />
        </g>
      )}
      <path
        d="M34 59V77M25 68H43M202 98V112M195 105H209"
        stroke="#302c3b"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
