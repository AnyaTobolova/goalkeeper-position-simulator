import { Ruler, Settings2 } from "lucide-react";
import type { GoalPresetId, PitchConfig, PitchPresetId } from "../domain/types";
import { goalPresets, pitchPresets } from "../domain/presets";

type SettingsPanelProps = {
  pitch: PitchConfig;
  showDimensions: boolean;
  onPitchChange: (pitch: PitchConfig) => void;
  onShowDimensionsChange: (show: boolean) => void;
};

export function SettingsPanel({ pitch, showDimensions, onPitchChange, onShowDimensionsChange }: SettingsPanelProps) {
  function updatePitchPreset(presetId: PitchPresetId) {
    onPitchChange(pitchPresets[presetId]);
  }

  function updateGoalPreset(goalPresetId: GoalPresetId) {
    const goal = goalPresets[goalPresetId];
    onPitchChange({
      ...pitch,
      goalPresetId,
      goalWidth: goal.width,
      goalHeight: goal.height
    });
  }

  function updateNumber(key: "fieldLength" | "fieldWidth" | "goalWidth" | "goalHeight", value: string) {
    const parsed = Number(value);

    if (Number.isNaN(parsed) || parsed <= 0) {
      return;
    }

    onPitchChange({
      ...pitch,
      presetId: key.startsWith("goal") ? pitch.presetId : "custom",
      goalPresetId: key.startsWith("goal") ? "custom" : pitch.goalPresetId,
      [key]: parsed
    });
  }

  return (
    <section className="panel settings-panel">
      <div className="panel-title">
        <Settings2 size={18} />
        <span>Формат</span>
      </div>

      <label>
        Формат игры
        <select value={pitch.presetId} onChange={(event) => updatePitchPreset(event.target.value as PitchPresetId)}>
          <option value="5v5">5 на 5</option>
          <option value="7v7">7 на 7</option>
          <option value="8v8">8 на 8</option>
          <option value="9v9">9 на 9</option>
          <option value="11v11">11 на 11</option>
          <option value="futsal">Футзал</option>
          <option value="custom">Свои размеры</option>
        </select>
      </label>

      <label>
        Ворота
        <select value={pitch.goalPresetId} onChange={(event) => updateGoalPreset(event.target.value as GoalPresetId)}>
          <option value="mini_3x2">3 x 2 м</option>
          <option value="junior_5x2">5 x 2 м</option>
          <option value="adult_732x244">7,32 x 2,44 м</option>
          <option value="custom">Свои размеры</option>
        </select>
      </label>

      <div className="settings-grid">
        <label>
          Длина
          <input value={pitch.fieldLength} type="number" min="20" step="1" onChange={(event) => updateNumber("fieldLength", event.target.value)} />
        </label>
        <label>
          Ширина
          <input value={pitch.fieldWidth} type="number" min="15" step="1" onChange={(event) => updateNumber("fieldWidth", event.target.value)} />
        </label>
        <label>
          Ворота Ш
          <input value={pitch.goalWidth} type="number" min="2" step="0.1" onChange={(event) => updateNumber("goalWidth", event.target.value)} />
        </label>
        <label>
          Ворота В
          <input value={pitch.goalHeight} type="number" min="1.5" step="0.1" onChange={(event) => updateNumber("goalHeight", event.target.value)} />
        </label>
      </div>

      <button className={showDimensions ? "toggle active" : "toggle"} type="button" onClick={() => onShowDimensionsChange(!showDimensions)}>
        <Ruler size={17} />
        <span>Размеры</span>
      </button>
    </section>
  );
}
