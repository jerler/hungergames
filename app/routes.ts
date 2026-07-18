import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("create", "routes/create.tsx"),
  route("create/reaping", "routes/reaping.tsx"),
  route("games/:gameId/play", "routes/game-play.tsx"),
  route("games/:gameId/results", "routes/game-results.tsx"),
  route("join", "routes/join.tsx"),
  route("rooms/:roomCode", "routes/room.tsx"),
] satisfies RouteConfig;
