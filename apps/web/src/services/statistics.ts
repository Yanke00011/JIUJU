import { get } from "./request";
import type { RoomStatistics } from "../types/api";

export const statisticsApi = {
  getRoomStatistics: (roomId: string) =>
    get<RoomStatistics>(`/rooms/${roomId}/statistics`),
};
