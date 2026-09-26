export type RecordLocation = {
  latitude: number;
  longitude: number;
  legalDongCode: string | null;
  legalDongName: string | null;
};

export type SelectedMusic = {
  externalTrackId: string;
  title: string;
  artistName: string;
  albumImageUrl: string;
  externalUrl: string;
};

export type RecordCreatePayload = {
  location: RecordLocation;
  music: SelectedMusic;
  moodScore: number;
  comment: string | null;
  uploadId: number;
};
