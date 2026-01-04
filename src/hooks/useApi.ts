import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// ==================== Types ====================

export interface ScheduleEvent {
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  location?: string | null;
  type: string;
  description?: string | null;
}

export interface CollectionStats {
  document_count: number;
  storage_size_bytes: number;
  storage_size_formatted: string;
  embedding_dimension: number;
  collection_name: string;
  chroma_status: string;
  health: string;
  last_updated: string;
}

export interface RAGDocument {
  id: string;
  text: string;
  metadata: Record<string, string>;
  distance?: number;
}

export interface ChatMessage {
  reply: string;
  k: number;
  hits: number;
  contexts: Array<{
    text: string;
    metadata: Record<string, string>;
  }>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface DocumentListResponse {
  total: number;
  limit: number;
  offset: number;
  documents: RAGDocument[];
}

export interface BatchIngestResponse {
  ok: boolean;
  imported: number;
  skipped: number;
  message?: string;
}

// ==================== API Helpers ====================

const API_BASE = "/api";

async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "请求失败" }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  return response.json();
}

// ==================== Agent/Chat Hooks ====================

export function useChat() {
  return useMutation<
    ChatMessage,
    Error,
    { message: string; k?: number; messages?: ChatTurn[] }
  >({
    mutationFn: async ({ message, k = 5, messages }) => {
      return fetchApi<ChatMessage>(`${API_BASE}/agent/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, messages, k }),
      });
    },
  });
}

// ==================== Schedule Hooks ====================

export function useEvents() {
  return useQuery<ScheduleEvent[]>({
    queryKey: ["events"],
    queryFn: async () => {
      const response = await fetchApi<{ events: ScheduleEvent[] }>(
        `${API_BASE}/schedule/events`,
      );
      return response.events || [];
    },
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation<ScheduleEvent, Error, Omit<ScheduleEvent, "id">>({
    mutationFn: async (event) => {
      return fetchApi<ScheduleEvent>(`${API_BASE}/schedule/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(event),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation<
    ScheduleEvent,
    Error,
    { id: string; data: Partial<ScheduleEvent> }
  >({
    mutationFn: async ({ id, data }) => {
      return fetchApi<ScheduleEvent>(`${API_BASE}/schedule/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await fetchApi(`${API_BASE}/schedule/events/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useSearchSchedule() {
  return useMutation<ScheduleEvent[], Error, string>({
    mutationFn: async (query) => {
      const response = await fetchApi<{ events: ScheduleEvent[] }>(
        `${API_BASE}/schedule/search?q=${encodeURIComponent(query)}`,
      );
      return response.events || [];
    },
  });
}

// ==================== Debug/RAG Hooks ====================

export function useCollectionStats() {
  return useQuery<CollectionStats>({
    queryKey: ["collection-stats"],
    queryFn: async () => {
      try {
        return await fetchApi<CollectionStats>(`${API_BASE}/debug/stats`);
      } catch {
        // Fallback to ping endpoint
        const pingData = await fetchApi<{
          result_count: number;
          storage_size: number;
          storage_size_formatted: string;
          model_dim: number;
          collection_name: string;
          status: string;
          health: string;
        }>(`${API_BASE}/debug/ping_chroma`);
        return {
          document_count: pingData.result_count || 0,
          storage_size_bytes: pingData.storage_size || 0,
          storage_size_formatted: pingData.storage_size_formatted || "0 B",
          embedding_dimension: pingData.model_dim || 1024,
          collection_name: pingData.collection_name || "campus_acts",
          chroma_status: pingData.status === "ok" ? "ok" : "error",
          health: pingData.health || "degraded",
          last_updated: new Date().toISOString(),
        };
      }
    },
  });
}

export function useDocuments(options?: { limit?: number; offset?: number }) {
  return useQuery<DocumentListResponse>({
    queryKey: ["documents", options],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.limit) params.set("limit", options.limit.toString());
      if (options?.offset) params.set("offset", options.offset.toString());
      return fetchApi<DocumentListResponse>(
        `${API_BASE}/debug/documents?${params.toString()}`,
      );
    },
  });
}

export function useRagSearch() {
  return useMutation<RAGDocument[], Error, { query: string; k?: number }>({
    mutationFn: async ({ query, k = 10 }) => {
      const response = await fetchApi<
        { results?: RAGDocument[] } | RAGDocument[]
      >(`${API_BASE}/debug/rag/search?q=${encodeURIComponent(query)}&k=${k}`);
      return Array.isArray(response)
        ? response
        : (response as { results?: RAGDocument[] }).results || [];
    },
  });
}

export function useIngestDocument() {
  const queryClient = useQueryClient();
  return useMutation<
    { ok: boolean; message?: string },
    Error,
    { text: string; metadata: Record<string, string> }
  >({
    mutationFn: async (doc) => {
      return fetchApi(`${API_BASE}/debug/rag/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(doc),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["collection-stats"] });
    },
  });
}

export function useBatchIngest() {
  const queryClient = useQueryClient();
  return useMutation<
    BatchIngestResponse,
    Error,
    { documents: unknown[]; options?: { skip_duplicates?: boolean } }
  >({
    mutationFn: async ({ documents, options }) => {
      return fetchApi<BatchIngestResponse>(`${API_BASE}/debug/batch_ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents, options }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["collection-stats"] });
    },
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await fetchApi(`${API_BASE}/debug/documents/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["collection-stats"] });
    },
  });
}

export function useDeleteAllDocuments() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean; deleted_count: number }, Error>({
    mutationFn: async () => {
      return fetchApi(`${API_BASE}/debug/documents`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["collection-stats"] });
    },
  });
}

export function useResetCollection() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, Error>({
    mutationFn: async () => {
      return fetchApi(`${API_BASE}/debug/reset`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["collection-stats"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

export function useSeedSchedule() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean; count: number }, Error>({
    mutationFn: async () => {
      return fetchApi(`${API_BASE}/debug/schedule/seed`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["collection-stats"] });
    },
  });
}

export function useExportCollection() {
  return useMutation<{ count: number; documents: RAGDocument[] }, Error>({
    mutationFn: async () => {
      return fetchApi(`${API_BASE}/debug/export`);
    },
  });
}
