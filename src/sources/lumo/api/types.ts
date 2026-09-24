/** Flattened Lumo conversation shaped for shared markdown/storage helpers. */
export type LumoConversationItem = {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  space_id?: string;
  starred?: boolean;
};

export type LumoConversationDetail = LumoConversationItem & {
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
};

export type LumoExportBundle = {
  conversations: LumoConversationItem[];
  details: LumoConversationDetail[];
  warnings: string[];
};
