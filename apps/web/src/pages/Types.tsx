import type { Temperament } from "@llmbti/core";

import { TypeCard } from "../components/TypeCard";
import { ALL_TYPES, TEMPERAMENT_LABEL, temperamentOf } from "../data/typeMeta";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { temperamentVar } from "../theme";

const GROUPS: Temperament[] = ["NT", "NF", "SJ", "SP"];

export function Types() {
  useDocumentTitle("16종 도감");
  return (
    <>
      <section className="hero hero-small">
        <p className="eyebrow dim">
          <span className="px">// types</span>
        </p>
        <h1 className="page-title">16종 도감</h1>
        <p className="hero-sub">
          몸 색은 기질 4그룹, 눈은 E/I와 T/F, 머리 위 소품은 별명.
        </p>
      </section>

      {GROUPS.map((group) => (
        <section key={group} className="section">
          <h2 className="section-title group-title" style={{ color: temperamentVar(group) }}>
            <span className="px">{group}</span>
            <span className="group-label">{TEMPERAMENT_LABEL[group]}</span>
          </h2>
          <div className="grid grid-2">
            {ALL_TYPES.filter((t) => temperamentOf(t) === group).map((t) => (
              <TypeCard key={t} type={t} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
