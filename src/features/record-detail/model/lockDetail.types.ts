export type LockDetailData = {
  recordId: number;
  userId: number;
  place: {
    placeId: number;
    legalDongName: string | null;
    latitude: number;
    longitude: number;
    legalDongCode: string | null;
  };
  music: {
    musicTrackId: number;
    title: string;
    artistName: string;
    albumImageUrl: string;
    externalUrl: string;
  };
  weatherCondition: WeatherCondition | null;
  temperature: number | null;
  moodScore: number;
  comment: string | null;
  photoUrl: string;
  createdAt: string;
};

export type WeatherCondition =
  'CLEAR' | 'CLOUDY' | 'OVERCAST' | 'RAIN' | 'SNOW' | 'RAIN_SNOW' | 'SHOWER';
