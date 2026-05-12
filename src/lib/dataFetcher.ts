import { createClient } from "./supabase";

export interface TopicItem {
  id?: string;
  subject: string;
  unit: string;
  topics: string[];
}

export interface ResourceItem {
  id: string;
  title: string;
  file_url: string;
  created_at: string;
  subject_name: string;
}

import topicsData from "../../public/Content/topics.json";

export function getTopics(): TopicItem[] {
  return topicsData as TopicItem[];
}

export async function getTopicsFromDB(
  branch: string,
  semester: number,
): Promise<TopicItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("subjects")
    .select("*")
    .eq("branch", branch)
    .eq("semester", semester);

  if (error) {
    console.error("Error fetching subjects:", error);
    return [];
  }

  // Assuming `topics` or similar might be structured differently,
  // you might want a topics column array. Let's return raw for now and adapt topics logic if needed.
  return data || [];
}

export async function getResourcesFromDB(
  branch: string,
  semester: number,
): Promise<ResourceItem[]> {
  const supabase = createClient();

  // Let's perform a join query to grab subjects AND their resources filtering by branch/sem
  const { data, error } = await supabase
    .from("resources")
    .select(
      `
      id,
      title,
      file_url,
      created_at,
      subjects!inner(
        name,
        branch,
        semester
      )
    `,
    )
    .eq("subjects.branch", branch)
    .eq("subjects.semester", semester);

  if (error) {
    console.error("Error fetching resources:", error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    title: item.title,
    file_url: item.file_url,
    created_at: item.created_at,
    subject_name: item.subjects.name,
  }));
}
