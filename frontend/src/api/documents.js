import client from "./client";

/** Every non-reserved param is a metadata filter, so params are passed through as-is. */
export const listDocuments = (params) => client.get("/documents", { params });

export const getDocument = (id) => client.get(`/documents/${id}`);

export const getMetadataFields = () => client.get("/metadata-fields");

export function uploadDocument({ file, title, metadata }, onProgress) {
  const form = new FormData();
  form.append("file", file);
  if (title) {
    form.append("title", title);
  }
  form.append("metadata", JSON.stringify(metadata));
  return client.post("/documents/upload", form, {
    onUploadProgress: (event) => {
      if (onProgress && event.total) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    },
  });
}

/** Files are fetched as blobs so the auth header is sent; the caller turns them into object URLs. */
export const downloadDocument = (id) => client.get(`/documents/${id}/download`, { responseType: "blob" });

export const previewDocument = (id) => client.get(`/documents/${id}/preview`, { responseType: "blob" });
