import { badgeChips } from "../data/badgeLabels";

interface Props {
  badges: string[];
  stats: Record<string, number>;
}

export function Badges({ badges, stats }: Props) {
  if (badges.length === 0) return null;
  const chips = badgeChips(badges, stats);
  return (
    <ul className="chips" aria-label="통계 배지">
      {chips.map((chip) => (
        <li key={chip.key} className={chip.known ? "chip" : "chip chip-raw"} title={chip.key}>
          <span>{chip.label}</span>
          {chip.value && <span className="chip-value">{chip.value}</span>}
        </li>
      ))}
    </ul>
  );
}
