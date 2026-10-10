import { Project, Totals } from "../api";
import { formatShort } from "../format";

interface Props {
  totals: Totals | null;
  projects: Project[];
  filter: number | null;
  onFilter: (id: number | null) => void;
}

export function TotalsStrip({ totals, projects, filter, onFilter }: Props) {
  const tiles: [string, number][] = totals
    ? [
        ["Today", totals.today],
        ["This week", totals.thisWeek],
        ["This month", totals.thisMonth],
        ["Last month", totals.lastMonth],
      ]
    : [];

  return (
    <section className="totals">
      <div className="totals__head">
        <h2>Totals</h2>
        <select
          value={filter ?? ""}
          onChange={(e) => onFilter(e.target.value === "" ? null : Number(e.target.value))}
        >
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="totals__tiles">
        {tiles.map(([label, secs]) => (
          <div className="tile" key={label}>
            <div className="tile__value">{formatShort(secs)}</div>
            <div className="tile__label">{label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
