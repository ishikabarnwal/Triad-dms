import client from "./client";

export const searchDocuments = (params) => client.get("/search", { params });
