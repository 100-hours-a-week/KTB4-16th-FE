/** 추천 생성 API에 전달하는 브라우저에서 확인된 현재 위치 좌표다. */
export type RecommendationCoordinates = {
  latitude: number;
  longitude: number;
};

export type RecommendationAttempt = 1 | 2 | 3;

/** 이번 추천 화면에서 누적한 외부 곡 ID를 좌표와 함께 전달한다. */
export type RecommendationPlaylistRequest = RecommendationCoordinates & {
  recommendationAttempt: RecommendationAttempt;
  excludeTrackIds: string[];
};

/** 추천 플레이리스트 안의 서버 저장 음악 한 곡을 표현한다. */
export type RecommendationTrack = {
  musicTrackId: number;
  externalTrackId: string;
  title: string;
  artistName: string;
  albumImageUrl: string;
  externalUrl: string;
};

/** 현재 화면 세션에서 표시할 추천 이유·평가 ID·곡 순서를 보관한다. */
export type RecommendationPlaylist = {
  recommendReason: string | null;
  recommendationId?: number;
  tracks: RecommendationTrack[];
};
