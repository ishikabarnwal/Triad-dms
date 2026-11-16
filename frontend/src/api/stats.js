import client from "./client";

export const getStats = (params) => client.get("/stats", { params });
