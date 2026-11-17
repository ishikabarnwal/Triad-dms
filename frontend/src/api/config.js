import client from "./client";

export const getPublicConfig = () => client.get("/config/public");
