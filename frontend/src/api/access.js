import client from "./client";

export const requestAccess = (docId, reason) => client.post("/access/request", { doc_id: docId, reason });

export const approveRequest = (requestId, expiresInDays, note) =>
  client.post("/access/approve", { request_id: requestId, expires_in_days: expiresInDays || null, note });

export const rejectRequest = (requestId, note) => client.post("/access/reject", { request_id: requestId, note });

export const revokeRequest = (requestId, note) => client.post("/access/revoke", { request_id: requestId, note });

export const getInbox = (params) => client.get("/access/inbox", { params });

export const getMyRequests = (params) => client.get("/access/mine", { params });

export const getPendingCount = () => client.get("/access/pending-count");
