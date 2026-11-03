import { describe, expect, it } from "vitest";

import { BADGE_LABELS, badgeChip, badgeChips } from "./badgeLabels";

describe("badgeLabels", () => {
  it("maps a known key to its Korean label", () => {
    const chip = badgeChip("forcePusher", { forceCount: 12 });
    expect(chip.known).toBe(true);
    expect(chip.label).toBe("--force 장인");
    expect(chip.value).toBe("12번");
  });

  it("shows nightRatio as a percent integer", () => {
    const chip = badgeChip("nightOwl", { nightRatio: 40 });
    expect(chip.value).toBe("40%");
  });

  it("drops the number when the stat is missing", () => {
    const chip = badgeChip("forcePusher", {});
    expect(chip.label).toBe("--force 장인");
    expect(chip.value).toBeNull();
  });

  it("renders unknown keys raw instead of throwing", () => {
    const chip = badgeChip("someFutureBadge", { someFutureBadge: 3 });
    expect(chip.known).toBe(false);
    expect(chip.label).toBe("someFutureBadge");
    expect(chip.value).toBeNull();
  });

  it("keeps order and length for a list", () => {
    const chips = badgeChips(["nightOwl", "unknownOne", "forcePusher"]);
    expect(chips.map((c) => c.key)).toEqual(["nightOwl", "unknownOne", "forcePusher"]);
  });

  it("has no 가운뎃점 or 줄표 in labels (SPEC 8장 톤 규칙)", () => {
    for (const { label } of Object.values(BADGE_LABELS)) {
      expect(label).not.toMatch(/[·—–]/);
    }
  });
});
