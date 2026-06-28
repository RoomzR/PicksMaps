import type { WebSocket } from "ws";
import type { Match } from "../shared/types.js";
import { getPublicMatchView } from "../shared/types.js";

type Client = {
  ws: WebSocket;
  matchId: string;
  userId?: number;
};

const clients = new Set<Client>();

export function subscribeClient(
  ws: WebSocket,
  matchId: string,
  userId?: number
): void {
  const client: Client = { ws, matchId, userId };
  clients.add(client);

  ws.on("close", () => clients.delete(client));
  ws.on("error", () => clients.delete(client));
}

export function broadcastMatch(match: Match): void {
  const payload = JSON.stringify({
    type: "match_update",
    data: getPublicMatchView(match),
  });

  for (const client of clients) {
    if (client.matchId !== match.id || client.ws.readyState !== 1) continue;
    const view = getPublicMatchView(match, client.userId);
    client.ws.send(
      JSON.stringify({ type: "match_update", data: view })
    );
  }
}

export function broadcastMatchToUser(match: Match, userId: number): void {
  for (const client of clients) {
    if (
      client.matchId !== match.id ||
      client.userId !== userId ||
      client.ws.readyState !== 1
    )
      continue;
    const view = getPublicMatchView(match, userId);
    client.ws.send(
      JSON.stringify({ type: "match_update", data: view })
    );
  }
}
