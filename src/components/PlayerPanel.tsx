import { Plus, Trash2, UserRound } from "lucide-react";
import type { PlayerProfile } from "../domain/types";

type PlayerPanelProps = {
  players: PlayerProfile[];
  activePlayerId: string;
  newPlayerName: string;
  onActivePlayerChange: (playerId: string) => void;
  onNewPlayerNameChange: (name: string) => void;
  onAddPlayer: () => void;
  onDeletePlayer: () => void;
};

export function PlayerPanel({
  players,
  activePlayerId,
  newPlayerName,
  onActivePlayerChange,
  onNewPlayerNameChange,
  onAddPlayer,
  onDeletePlayer
}: PlayerPanelProps) {
  return (
    <section className="panel player-panel">
      <div className="panel-title">
        <UserRound size={18} />
        <span>Игрок</span>
      </div>

      <label>
        Профиль
        <select value={activePlayerId} onChange={(event) => onActivePlayerChange(event.target.value)}>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
      </label>

      <div className="add-player-row">
        <input
          value={newPlayerName}
          type="text"
          placeholder="Имя игрока"
          maxLength={24}
          onChange={(event) => onNewPlayerNameChange(event.target.value)}
        />
        <button type="button" onClick={onAddPlayer}>
          <Plus size={18} />
          <span>Добавить</span>
        </button>
      </div>

      <button className="danger-button" type="button" onClick={onDeletePlayer} disabled={players.length <= 1}>
        <Trash2 size={18} />
        <span>Удалить игрока</span>
      </button>
    </section>
  );
}
