export type CopilotMessage = {
  text?: string;
  author?: string;
  messageType?: string;
  createdAt?: string;
  timestamp?: string;
  messageId?: string;
  adaptiveCards?: Array<{
    type?: string;
    body?: Array<{ type?: string; text?: string; wrap?: boolean }>;
  }>;
  sourceAttributions?: Array<{
    providerDisplayName?: string;
    seeMoreUrl?: string;
  }>;
};

export type CopilotChatOverview = {
  conversationId: string;
  chatName?: string;
  createTimeUtc?: number;
  updateTimeUtc?: number;
  tone?: string;
  isLegacyWebChat?: boolean;
};

export type CopilotGetChatsResponse = {
  chats?: CopilotChatOverview[];
  totalCountOfSavedChats?: number;
  syncState?: string | null;
};

export type CopilotConversationRaw = {
  conversationId: string;
  chatName?: string;
  createTimeUtc?: number;
  updateTimeUtc?: number;
  tone?: string;
  isLegacyWebChat?: boolean;
  messages?: CopilotMessage[];
};

export type CopilotConversationItem = {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
};

export type CopilotMappingNode = {
  id: string;
  parent: string | null;
  children: string[];
  message: {
    id: string;
    author: { role: string };
    content: { content_type: string; parts: string[] };
    create_time: number | null;
  } | null;
};

export type CopilotConversationDetail = {
  id: string;
  title: string;
  create_time: number;
  update_time: number;
  mapping: Record<string, CopilotMappingNode>;
  current_node: string | null;
  _copilot?: {
    tone?: string;
    isLegacyWebChat?: boolean;
    messages: CopilotMessage[];
  };
};

export type CopilotExportBundle = {
  conversations: CopilotConversationItem[];
  details: CopilotConversationDetail[];
  warnings: string[];
};
