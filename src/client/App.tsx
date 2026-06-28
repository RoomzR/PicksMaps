import { useCallback, useEffect, useState } from "react";
import {
  connectWs,
  createMatch,
  fetchMatch,
  getMatchIdFromUrl,
  getTelegramUser,
  joinTeam,
  pickSide,
  vetoMap,
  copyToClipboard,
  haptic,
} from "./api";
import { useTelegramUser } from "./useTelegramUser";
import type { PublicMatch, MatchFormat } from "./types";

type Screen = "admin" | "match";

export default function App() {
  const [screen, setScreen] = useState<Screen>("match");
  const [matchId, setMatchId] = useState<string | null>(null);
  const [match, setMatch] = useState<PublicMatch | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createdLink, setCreatedLink] = useState<string | null>(null);
  const { userId, userName, ready: tgReady, inTelegram, hasAuth } = useTelegramUser();

  useEffect(() => {
    const id = getMatchIdFromUrl();
    if (id) {
      setMatchId(id);
      setScreen("match");
    } else {
      setScreen("admin");
      setLoading(false);
    }
  }, []);

  const loadMatch = useCallback(async (id: string) => {
    try {
      const data = await fetchMatch(id, userId);
      setMatch(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!matchId) return;
    loadMatch(matchId);

    const ws = connectWs(matchId, userId, (data) => {
      setMatch(data);
    });

    return () => ws.close();
  }, [matchId, userId, loadMatch]);

  if (screen === "admin" && !matchId) {
    return (
      <AdminPanel
        userId={userId}
        userName={userName}
        tgReady={tgReady}
        inTelegram={inTelegram}
        onCreated={(m, link) => {
          setMatch(m);
          setMatchId(m.id);
          setCreatedLink(link);
          setScreen("match");
          setLoading(false);
          window.Telegram?.WebApp?.showAlert?.(
            `Матч создан!\n\nСсылка:\n${link}`
          );
        }}
      />
    );
  }

  if (loading) return <div className="loader">Загрузка...</div>;
  if (error && !match) return <div className="error">{error}</div>;
  if (!match) return <div className="error">Матч не найден</div>;

  return (
    <MatchView
      match={match}
      error={error}
      createdLink={createdLink}
      onJoin={async (team) => {
        try {
          haptic("medium");
          const updated = await joinTeam(match.id, team);
          setMatch(updated);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Ошибка");
        }
      }}
      onVeto={async (map) => {
        try {
          haptic("heavy");
          const updated = await vetoMap(match.id, map);
          setMatch(updated);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Ошибка");
        }
      }}
      onSide={async (side) => {
        try {
          haptic("medium");
          const updated = await pickSide(match.id, side);
          setMatch(updated);
          setError(null);
        } catch (e) {
          setError(e instanceof Error ? e.message : "Ошибка");
        }
      }}
    />
  );
}

function AdminPanel({
  userId,
  userName,
  tgReady,
  inTelegram,
  onCreated,
}: {
  userId?: number;
  userName?: string;
  tgReady: boolean;
  inTelegram: boolean;
  onCreated: (match: PublicMatch, link: string) => void;
}) {
  const [format, setFormat] = useState<MatchFormat>("bo3");
  const [teamA, setTeamA] = useState("");
  const [teamB, setTeamB] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!teamA.trim() || !teamB.trim()) {
      setError("Введите названия обеих команд");
      return;
    }

    const user = getTelegramUser();
    setLoading(true);
    setError(null);
    try {
      const { match, link } = await createMatch({
        format,
        teamAName: teamA.trim(),
        teamBName: teamB.trim(),
      });
      haptic("heavy");
      onCreated(match, link);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Ошибка создания";
      setError(msg);
      window.Telegram?.WebApp?.showAlert?.(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">PicksMaps</div>
        <div className="subtitle">Создание матча CS2</div>
        {tgReady && userId && (
          <div className="subtitle">👤 {userName || userId}</div>
        )}
        {tgReady && !userId && (
          <div className="warn-banner">
            {hasAuth ? (
              <>Не удалось авторизоваться. Откройте приложение через кнопку бота заново.</>
            ) : inTelegram ? (
              <>
                Откройте через кнопку бота (не через меню Telegram).
                <br />
                Админ: <strong>/app</strong> · Матч: ссылка → кнопка внизу
                <br />
                Или: <strong>/create bo3 Team1 vs Team2</strong>
              </>
            ) : (
              <>Откройте @picksmapsmeta_bot → /app или ссылку на матч</>
            )}
          </div>
        )}
      </header>

      <section className="card">
        <label className="label">Формат</label>
        <div className="format-grid">
          {(["bo1", "bo2", "bo3", "bo5"] as MatchFormat[]).map((f) => (
            <button
              key={f}
              className={`format-btn ${format === f ? "active" : ""}`}
              onClick={() => setFormat(f)}
            >
              {f.toUpperCase()}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <label className="label">Команда 1</label>
        <input
          className="input"
          placeholder="Название команды"
          value={teamA}
          onChange={(e) => setTeamA(e.target.value)}
        />
        <label className="label mt">Команда 2</label>
        <input
          className="input"
          placeholder="Название команды"
          value={teamB}
          onChange={(e) => setTeamB(e.target.value)}
        />
      </section>

      {error && <div className="error-banner">{error}</div>}

      <button
        className="btn btn-primary"
        onClick={handleCreate}
        disabled={loading}
      >
        {loading ? "Создание..." : "Создать матч"}
      </button>
    </div>
  );
}

function MatchView({
  match,
  error,
  createdLink,
  onJoin,
  onVeto,
  onSide,
}: {
  match: PublicMatch;
  error: string | null;
  createdLink: string | null;
  onJoin: (team: "A" | "B") => void;
  onVeto: (map: string) => void;
  onSide: (side: "CT" | "T") => void;
}) {
  return (
    <div className="app">
      <header className="header">
        <div className="logo">PicksMaps</div>
        <div className="badge">{match.formatLabel}</div>
      </header>

      {createdLink && (
        <section className="card link-card">
          <div className="label">Ссылка для капитанов</div>
          <div className="link-text">{createdLink}</div>
          <button
            className="btn btn-secondary"
            onClick={() => copyToClipboard(createdLink)}
          >
            📋 Копировать ссылку
          </button>
        </section>
      )}

      <TeamsBar match={match} />

      {error && <div className="error-banner">{error}</div>}

      {match.status === "waiting_teams" && (
        <TeamSelect match={match} onJoin={onJoin} />
      )}

      {(match.status === "veto" || match.status === "side_pick") && (
        <>
          {match.history.length === 0 && (
            <section className="card center first-ban-notice">
              🎲 <strong>{match.teamAName}</strong> банит первым
              <div className="hint">Случайный выбор при старте матча</div>
            </section>
          )}
          <StatusBar match={match} />
          {match.status === "side_pick" && match.pendingSidePick && (
            <SidePicker match={match} onSide={onSide} />
          )}
          {match.status === "veto" && (
            <MapGrid match={match} onVeto={onVeto} />
          )}
        </>
      )}

      {match.status === "finished" && <Results match={match} />}

      <History match={match} />
    </div>
  );
}

function TeamsBar({ match }: { match: PublicMatch }) {
  return (
    <div className="teams-bar">
      <div className={`team team-a ${match.userTeam === "A" ? "you" : ""}`}>
        <div className="team-name">{match.teamAName}</div>
        <CaptainBadge captain={match.captainA} />
      </div>
      <div className="vs">VS</div>
      <div className={`team team-b ${match.userTeam === "B" ? "you" : ""}`}>
        <div className="team-name">{match.teamBName}</div>
        <CaptainBadge captain={match.captainB} />
      </div>
    </div>
  );
}

function CaptainBadge({
  captain,
}: {
  captain: PublicMatch["captainA"];
}) {
  if (!captain) return <div className="captain empty">Ожидание...</div>;
  const name = captain.firstName || captain.username || "Капитан";
  return <div className="captain">👤 {name}</div>;
}

function TeamSelect({
  match,
  onJoin,
}: {
  match: PublicMatch;
  onJoin: (team: "A" | "B") => void;
}) {
  const userTeam = match.userTeam;
  const waiting =
    (match.captainA && !match.captainB) || (!match.captainA && match.captainB);

  if (userTeam) {
    return (
      <section className="card center">
        <div className="status-text">
          ✓ Вы выбрали{" "}
          <strong>
            {userTeam === "A" ? match.teamAName : match.teamBName}
          </strong>
        </div>
        {waiting && (
          <div className="hint">Ожидаем выбор второго капитана...</div>
        )}
      </section>
    );
  }

  return (
    <section className="card">
      <div className="label center">Выберите вашу команду</div>
      <div className="team-select">
        <button
          className={`team-btn team-a ${match.captainA ? "taken" : ""}`}
          disabled={!!match.captainA}
          onClick={() => onJoin("A")}
        >
          <span>{match.teamAName}</span>
          {match.captainA && <small>Занято</small>}
        </button>
        <button
          className={`team-btn team-b ${match.captainB ? "taken" : ""}`}
          disabled={!!match.captainB}
          onClick={() => onJoin("B")}
        >
          <span>{match.teamBName}</span>
          {match.captainB && <small>Занято</small>}
        </button>
      </div>
    </section>
  );
}

function StatusBar({ match }: { match: PublicMatch }) {
  const action = match.currentAction;
  const isTurn = match.isUserTurn;

  return (
    <section className={`status-bar ${isTurn ? "your-turn" : ""}`}>
      {match.status === "side_pick" ? (
        <span>🎯 Выбор стороны на {match.pendingSidePick?.map}</span>
      ) : action ? (
        <span>
          {isTurn ? "⚡ Ваш ход: " : "⏳ "}
          {action.label}
        </span>
      ) : null}
    </section>
  );
}

function SidePicker({
  match,
  onSide,
}: {
  match: PublicMatch;
  onSide: (side: "CT" | "T") => void;
}) {
  const canPick = match.isUserTurn;
  const map = match.pendingSidePick?.map;

  return (
    <section className="card center">
      <div className="label">
        {canPick
          ? `Выберите сторону на ${map}`
          : `Соперник выбирает сторону на ${map}`}
      </div>
      {canPick && (
        <div className="side-btns">
          <button className="side-btn ct" onClick={() => onSide("CT")}>
            CT
          </button>
          <button className="side-btn t" onClick={() => onSide("T")}>
            T
          </button>
        </div>
      )}
    </section>
  );
}

function MapGrid({
  match,
  onVeto,
}: {
  match: PublicMatch;
  onVeto: (map: string) => void;
}) {
  const action = match.currentAction?.action;
  const canAct = match.isUserTurn && action && action !== "decider";

  const banned = new Set(
    match.history.filter((h) => h.action === "ban").map((h) => h.map)
  );
  const picked = new Set(match.pickedMaps.map((p) => p.map));

  return (
    <section className="card">
      <div className="label">
        {canAct
          ? action === "ban"
            ? "Выберите карту для бана"
            : "Выберите карту для пика"
          : "Карты"}
      </div>
      <div className="map-grid">
        {match.maps.map((map) => {
          const isBanned = banned.has(map);
          const isPicked = picked.has(map);
          const isAvailable = match.remainingMaps.includes(map);
          const disabled = !canAct || !isAvailable;

          return (
            <button
              key={map}
              className={`map-btn ${isBanned ? "banned" : ""} ${isPicked ? "picked" : ""} ${canAct && isAvailable ? "clickable" : ""}`}
              disabled={disabled}
              onClick={() => onVeto(map)}
            >
              <span className="map-name">{map}</span>
              {isBanned && <span className="map-tag ban">BAN</span>}
              {isPicked && <span className="map-tag pick">PICK</span>}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Results({ match }: { match: PublicMatch }) {
  return (
    <section className="card">
      <div className="label">🗺 Карты матча</div>
      <div className="results">
        {match.pickedMaps.map((p, i) => (
          <div key={i} className="result-row">
            <span className="map-num">{i + 1}</span>
            <span className="result-map">{p.map}</span>
            <span className="result-pick">
              {p.pickedBy === "A" ? match.teamAName : match.teamBName}
            </span>
            <span className="result-side">
              {p.sideBy === "knife"
                ? "🔪 Knife"
                : p.side
                  ? p.side
                  : "—"}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function History({ match }: { match: PublicMatch }) {
  if (match.history.length === 0) return null;

  return (
    <section className="card history">
      <div className="label">История</div>
      <div className="history-list">
        {[...match.history].reverse().map((h, i) => (
          <div key={i} className="history-item">
            <span className={`action ${h.action}`}>
              {h.action === "ban" ? "BAN" : h.action === "pick" ? "PICK" : "DEC"}
            </span>
            <span>{h.map}</span>
            {h.side && <span className="side-tag">{h.side}</span>}
          </div>
        ))}
      </div>
    </section>
  );
}
