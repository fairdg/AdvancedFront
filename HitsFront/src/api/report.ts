import { api } from "./client";

export type IcdRootsReportFilters = {
  start: string;
  end: string;
  icdRoots: string[];
};

export type IcdRootsReportRecord = {
  patientName: string;
  patientBirthdate: string;
  gender: "Male" | "Female";
  visitsByRoot: Record<string, number>;
};

export type IcdRootsReportResponse = {
  filters: IcdRootsReportFilters;
  records: IcdRootsReportRecord[];
  summaryByRoot: Record<string, number>;
};

export type IcdRootsReportQuery = {
  start: string;
  end: string;
  icdRoots?: string[];
};

export async function getIcdRootsReport(
  params: IcdRootsReportQuery
): Promise<IcdRootsReportResponse> {
  const search = new URLSearchParams();
  search.set("start", params.start);
  search.set("end", params.end);
  for (const rootId of params.icdRoots ?? []) {
    if (rootId.trim()) search.append("icdRoots", rootId.trim());
  }

  try {
    return await api<IcdRootsReportResponse>(`/api/report/icdrootsreport?${search.toString()}`, {
      method: "GET",
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("400")) {
      return {
        filters: {
          start: params.start,
          end: params.end,
          icdRoots: params.icdRoots ?? [],
        },
        records: [],
        summaryByRoot: {},
      };
    }
    throw error;
  }
}
