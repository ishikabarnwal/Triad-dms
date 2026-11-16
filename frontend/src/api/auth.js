import client from "./client";

export const login = (identifier, password) => client.post("/auth/login", { identifier, password });

export const register = (body) => client.post("/auth/register", body);

export const me = () => client.get("/auth/me");

/** Public list of divisions, used by the signup form. */
export const getDivisions = () => client.get("/divisions");
