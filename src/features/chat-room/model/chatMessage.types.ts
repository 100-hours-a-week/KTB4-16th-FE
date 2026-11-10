export type ChatMessage = {
  id: string;
  clientMessageId?: string;
  userId?: number;
  sender: 'me' | 'partner';
  nickname?: string;
  voteChoice?: 'A' | 'B' | null;
  content: string;
  createdAt: string;
  deliveryState?: 'pending' | 'success' | 'failed';
};
