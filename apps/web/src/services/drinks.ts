import { get, post } from "./request";
import type { DrinkRecord } from "../types/api";

export const drinksApi = {
  create: (
    roomId: string,
    productId: string,
    userId: string,
    quantity: number,
  ) =>
    post<{ record: DrinkRecord }>(`/rooms/${roomId}/drinks`, {
      productId,
      userId,
      quantity,
    }).then((r) => r.record),

  list: (roomId: string) =>
    get<{ items: DrinkRecord[] }>(`/rooms/${roomId}/drinks`).then(
      (r) => r.items,
    ),
};
