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

  /** 结束酒局：进入 15 分钟冷静期（仅房主） */
  end: (id: string) =>
    post<{ room: Room }>(`/rooms/${id}/end`).then((r) => r.room),

  /** 撤销结束：冷静期内恢复为进行中（仅房主） */
  cancelEnd: (id: string) =>
    post<{ room: Room }>(`/rooms/${id}/cancel-end`).then((r) => r.room),

  members: (id: string) =>
    get<{ items: RoomMember[] }>(`/rooms/${id}/members`).then((r) => r.items),
};
