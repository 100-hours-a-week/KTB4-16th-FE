/** 추천 생성 API에 전달하는 브라우저에서 확인된 현재 위치 좌표다. */
export type RecommendationCoordinates = {
  latitude: number;
  longitude: number;
};

/** 추천 플레이리스트 안의 서버 저장 음악 한 곡을 표현한다. */
export type RecommendationTrack = {
  musicTrackId: number;
  title: string;
  artistName: string;
  albumImageUrl: string;
  externalUrl: string;
};

/** 로그인 사용자의 현재 추천 플레이리스트와 서버 정렬 순서의 트랙 목록이다. */
export type RecommendationPlaylist = {
  recommendationPlaylistId: number;
  tracks: RecommendationTrack[];
};
