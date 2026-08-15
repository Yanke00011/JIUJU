import { get, post } from "./request";
import type { JoinRoomResult, Room, RoomMember } from "../types/api";

export const roomsApi = {
  list: () => get<{ items: Room[] }>("/rooms").then((r) => r.items),

  detail: (id: string) =>
    get<{ room: Room }>(`/rooms/${id}`).then((r) => r.room),

  create: (name: string) =>
    post<{ room: Room }>("/rooms", { name }).then((r) => r.room),

  join: (inviteCode: string) =>
    post<JoinRoomResult>("/rooms/join", { inviteCode }),

  members: (id: string) =>
    get<{ items: RoomMember[] }>(`/rooms/${id}/members`).then((r) => r.items),
};
