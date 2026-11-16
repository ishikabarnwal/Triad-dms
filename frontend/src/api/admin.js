import client from "./client";

export const listFields = () => client.get("/admin/metadata-fields");
export const createField = (body) => client.post("/admin/metadata-fields", body);
export const updateField = (id, body) => client.put(`/admin/metadata-fields/${id}`, body);
export const deleteField = (id) => client.delete(`/admin/metadata-fields/${id}`);
export const reorderFields = (ids) => client.put("/admin/metadata-fields/reorder", { ids });

export const listDivisions = () => client.get("/admin/divisions");
export const createDivision = (body) => client.post("/admin/divisions", body);
export const updateDivision = (id, body) => client.put(`/admin/divisions/${id}`, body);
export const deleteDivision = (id) => client.delete(`/admin/divisions/${id}`);

export const listUsers = (params) => client.get("/admin/users", { params });
export const updateUser = (id, body) => client.put(`/admin/users/${id}`, body);

export const listAuditLogs = (params) => client.get("/admin/audit-logs", { params });
