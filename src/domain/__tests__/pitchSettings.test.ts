import { describe, expect, it } from "vitest";
import { pitchSettingsError, resizePitch } from "../pitchSettings";
import { pitchPresets } from "../presets";

describe("Проверка размеров поля", () => {
  it("принимает все готовые форматы", () => {
    for (const pitch of Object.values(pitchPresets)) expect(pitchSettingsError(pitch)).toBeNull();
  });

  it("при изменении размеров пропорционально меняет разметку, не меняя ворота", () => {
    const narrower = resizePitch(pitchPresets["7v7"], "fieldWidth", 20);
    const resized = resizePitch(narrower, "fieldLength", 30);
    expect(resized.freeKickDistance).toBe(7);
    expect(pitchSettingsError(resized)).toContain("Дистанция стенки слишком велика");
    const smaller = { ...resized, freeKickDistance: 6.5 };
    expect(smaller).toMatchObject({ presetId: "custom", fieldWidth: 20, fieldLength: 30, goalWidth: 5, goalHeight: 2 });
    expect(smaller.markings).toMatchObject({ penaltyAreaWidth: 14, goalAreaWidth: 7, penaltyAreaDepth: 6.5, goalAreaDepth: 2.5, penaltySpotDistance: 4.5 });
    expect(pitchSettingsError(smaller)).toBeNull();
  });

  it("не разрешает ворота шире поля или вратарской и неверные пропорции поля", () => {
    const pitch = pitchPresets["7v7"];
    expect(pitchSettingsError({ ...pitch, goalWidth: 41 })).toContain("уже поля");
    expect(pitchSettingsError({ ...pitch, goalWidth: 15 })).toContain("Вратарская");
    expect(pitchSettingsError({ ...pitch, fieldLength: 20, fieldWidth: 30 })).toContain("должна быть больше");
    expect(pitchSettingsError({ ...pitch, goalHeight: 6 })).toContain("Высота ворот");
    expect(pitchSettingsError({ ...pitch, freeKickDistance: 0.5 })).toContain("не меньше 1 м");
  });
});
