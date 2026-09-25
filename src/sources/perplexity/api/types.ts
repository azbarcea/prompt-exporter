/** Raw shapes from Perplexity's undocumented /rest/thread APIs. */

export type ThreadListItem = {
  uuid: string;
  title?: string | null;
  slug?: string | null;
  last_query_datetime?: string | null;
  query_str?: string | null;
  answer_preview?: string | null;
  query_count?: number;
  collection?: {
    uuid?: string;
    title?: string;
    slug?: string;
    emoji?: string;
  } | null;
  total_threads?: number;
  has_next_page?: boolean;
};

export type ThreadListRequest = {
  limit: number;
  ascending: boolean;
  offset: number;
  search_term: string;
  exclude_asi: boolean;
  include_assets: boolean;
};

export type MarkdownBlock = {
  progress?: string;
  answer?: string;
};

export type WebResult = {
  name?: string;
  url?: string;
  snippet?: string;
};

export type WebResultBlock = {
  progress?: string;
  web_results?: WebResult[];
};

export type ThreadBlock = {
  intended_usage?: string;
  markdown_block?: MarkdownBlock | null;
  web_result_block?: WebResultBlock | null;
};

export type ThreadEntry = {
  uuid: string;
  query_str?: string | null;
  display_model?: string | null;
  search_focus?: string | null;
  bookmark_state?: string | null;
  blocks?: ThreadBlock[];
  related_queries?: string[];
  entry_created_datetime?: string | null;
  entry_updated_datetime?: string | null;
  thread_title?: string | null;
};

export type ThreadMetadata = {
  title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  mode?: string | null;
  thread_status?: string | null;
};

export type ThreadDetailResponse = {
  entries?: ThreadEntry[];
  has_next_page?: boolean;
  next_cursor?: string | null;
  status?: string;
  thread_metadata?: ThreadMetadata;
};

/** Flattened list row for StorageService index / list CLI. */
export type PerplexityConversationItem = {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  slug?: string;
  space_id?: string;
};

/** ChatGPT-compatible mapping tree for shared markdown/storage. */
export type PerplexityConversationDetail = PerplexityConversationItem & {
  mapping: Record<
    string,
    {
      id: string;
      parent: string | null;
      children: string[];
      message: {
        id: string;
        author: { role: string };
        content: { content_type: string; parts: string[] };
        create_time?: number;
      } | null;
    }
  >;
  current_node: string | null;
  /** Preserve raw API payload for debugging / future fields. */
  _perplexity?: {
    slug?: string;
    entries: ThreadEntry[];
  };
};

export type PerplexityExportBundle = {
  conversations: PerplexityConversationItem[];
  details: PerplexityConversationDetail[];
  warnings: string[];
};
