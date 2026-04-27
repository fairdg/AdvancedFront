import { api } from "./client";
import type { Inspection, Pagination } from "./patient";

export type ConsultationCommentRequest = {
  content: string;
  parentId?: string;
};

export type ConsultationInspection = Inspection & {
  consultations?: unknown[];
};

export type ConsultationInspectionsResponse = {
  inspections: ConsultationInspection[];
  pagination: Pagination;
};

export type ConsultationInspectionsQuery = {
  page: number;
  pageSize: number;
  icdRoots?: string[];
  grouped?: boolean;
};

export async function getConsultationInspections(
  params: ConsultationInspectionsQuery
): Promise<ConsultationInspectionsResponse> {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("current", String(params.page));
  search.set("pageSize", String(params.pageSize));
  search.set("size", String(params.pageSize));
  if (params.icdRoots?.length) {
    for (const root of params.icdRoots) search.append("icdRoots", root);
  }
  if (params.grouped) search.set("grouped", "true");
  const json = await api<unknown>(`/api/consultation?${search.toString()}`, { method: "GET" });

  if (Array.isArray(json)) {
    return {
      inspections: json as ConsultationInspection[],
      pagination: { size: params.pageSize, count: 1, current: params.page },
    };
  }

  if (json && typeof json === "object") {
    const record = json as Record<string, unknown>;
    const inspections =
      (Array.isArray(record.inspections) ? record.inspections : null) ??
      (Array.isArray(record.items) ? record.items : null) ??
      (Array.isArray(record.data) ? record.data : null) ??
      [];

    const pagination =
      (record.pagination && typeof record.pagination === "object" ? (record.pagination as Pagination) : null) ??
      {
        size: params.pageSize,
        count: 1,
        current: params.page,
      };

    return {
      inspections: inspections as ConsultationInspection[],
      pagination,
    };
  }

  return {
    inspections: [],
    pagination: { size: params.pageSize, count: 1, current: params.page },
  };
}

export async function createConsultationComment(
  consultationId: string,
  body: ConsultationCommentRequest
): Promise<unknown> {
  return api(`/api/consultation/${consultationId}/comment`, { method: "POST", json: body });
}

export async function updateConsultationComment(commentId: string, body: Pick<ConsultationCommentRequest, "content">): Promise<unknown> {
  return api(`/api/consultation/comment/${commentId}`, { method: "PUT", json: body });
}
