export type NormalizedRecord = {
  id: string;
  title: string;
  url: string;
  category: string | null;
  summary: string | null;
  tags: string[];
  source: string;
  fetched_at: string; // ISO timestamp
};
