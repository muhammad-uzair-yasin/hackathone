export interface SummaryDocument {
  file: string;
  markdown: string;
  preview: string;
  session?: Record<string, unknown>;
}
