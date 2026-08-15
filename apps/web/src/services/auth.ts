import { get, post } from "./request";
import type { LoginResult, User } from "../types/api";

export const authApi = {
  login: (username: string, password: string) =>
    post<LoginResult>("/auth/login", { username, password }),

  register: (username: string, password: string, nickname: string) =>
    post<{ user: User }>("/auth/register", { username, password, nickname }),

  me: () => get<{ user: User }>("/users/me"),
};
