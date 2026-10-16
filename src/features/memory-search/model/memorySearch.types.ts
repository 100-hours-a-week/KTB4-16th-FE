export interface MemoryRecordCard {
  recordId: number;
  musicTrackId: number;
  title: string;
  artistName: string;
  placeId: number;
  placeName: string | null;
  date: string;
  weatherCondition: string | null;
  albumImageUrl: string;
}

export interface SuggestedMemoryRecordCard extends MemoryRecordCard {
  matchedConditions: string[];
}

export interface MemorySearchResult {
  answer: string;
  records: MemoryRecordCard[];
  suggestedRecords: SuggestedMemoryRecordCard[];
}

export interface MemorySearchTurn extends MemorySearchResult {
  query: string;
}
