import axios from "@/utils/AxiosInstance";
export type ContentSection = "homepage" | "about" | "bulletin" | "events" | "subscriptions" | "guide";
export type ContentPayload = Record<string, any>;
export interface PublishingMeta {
    section: ContentSection;
    revision: number;
    baseVersion: string;
    hasDraft: boolean;
    draftCount: number;
    savedAt: string | null;
    lastPublished: string | null;
    upcoming?: number;
    hidden?: number;
}
export interface PublishingDocument extends PublishingMeta {
    itemMeta?:Record<string,{savedAt?:string;lastPublished?:string}>;
    resolvedKey?:string;
    payload: ContentPayload;
    published: ContentPayload;
}
export const publishingKeys = { all: ["publishing"] as const, summary: ["publishing", "summary"] as const, document: (section: ContentSection) => ["publishing", section] as const };
export const getPublishingSummary = async (signal?: AbortSignal) => (await axios.get<PublishingMeta[]>("/api/admin/publishing", { signal })).data;
export const getPublishingDocument = async (section: ContentSection, signal?: AbortSignal) => (await axios.get<PublishingDocument>(`/api/admin/publishing/${section}`, { signal })).data;
export const savePublishingDocument = async (section: ContentSection, action: "draft" | "publish" | "discard", document: PublishingDocument, payload: ContentPayload,itemKey?:string) => {
    const body = { revision: document.revision, baseVersion: document.baseVersion, payload,itemKey };
    const url = `/api/admin/publishing/${section}/${action === "publish" ? "publish" : "draft"}`;
    return (action === "discard" ? await axios.delete<PublishingDocument>(url, { data: body }) : action === "publish" ? await axios.post<PublishingDocument>(url, body) : await axios.put<PublishingDocument>(url, body)).data;
};

export const publishAllDocuments=async(documents:{section:ContentSection;revision:number;baseVersion:string;payload:ContentPayload}[])=>(await axios.post<PublishingDocument[]>("/api/admin/publishing/publish-all",{documents})).data;
