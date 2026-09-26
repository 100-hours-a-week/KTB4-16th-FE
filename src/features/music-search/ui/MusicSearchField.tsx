import { useState, type FormEvent } from 'react';

import { ApiError } from '../../../shared/api/apiError';
import { searchMusic } from '../api/musicSearchApi';
import type { MusicSearchRequest, MusicSearchResult } from '../model/musicSearch.types';
import './musicSearchField.css';

interface MusicSearchFieldProps {
  request: MusicSearchRequest;
  onSelect: (track: MusicSearchResult) => void;
}

/** 음악 검색 오류를 사용자에게 안전한 안내 문구로 변환한다. */
function getSearchErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 429 || error.code === 'MUSIC_SEARCH_RATE_LIMITED') {
      return '검색 요청이 많아요. 잠시 후 다시 검색해 주세요.';
    }

    if (error.code === 'INVALID_SEARCH_QUERY') {
      return error.message;
    }
  }

  return '음악을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

/** 검색어 입력, 결과 목록, 선택 이벤트만 소유하는 음악 검색 UI다. */
export function MusicSearchField({ request, onSelect }: MusicSearchFieldProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MusicSearchResult[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  /** 검색어를 검증해 API를 요청하고 결과·오류 상태를 갱신한다. */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setResults(null);
    setErrorMessage(null);

    if (query.trim().length < 2) {
      setErrorMessage('검색어는 2자 이상 입력해 주세요.');
      return;
    }

    setIsSearching(true);

    try {
      setResults(await searchMusic(request, query));
    } catch (error) {
      setErrorMessage(getSearchErrorMessage(error));
    } finally {
      setIsSearching(false);
    }
  };

  /** 선택된 음악을 상위 작성 폼에 전달하고 현재 검색 목록을 닫는다. */
  const handleSelect = (track: MusicSearchResult) => {
    onSelect(track);
    setResults(null);
  };

  return (
    <div className="music-search">
      <form className="music-search-form" onSubmit={(event) => void handleSubmit(event)}>
        <label className="sr-only" htmlFor="music-search-query">
          음악 검색어
        </label>
        <input
          id="music-search-query"
          maxLength={255}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="곡 제목이나 아티스트 검색"
          type="search"
          value={query}
        />
        <button disabled={isSearching} type="submit">
          {isSearching ? '검색 중…' : '음악 검색'}
        </button>
      </form>
      {errorMessage ? <p role="alert">{errorMessage}</p> : null}
      {results?.length === 0 ? <p role="status">검색 결과가 없어요.</p> : null}
      {results && results.length > 0 ? (
        <ul className="music-search-results" aria-label="음악 검색 결과">
          {results.map((track) => (
            <li key={track.externalTrackId}>
              <button type="button" onClick={() => handleSelect(track)}>
                <img alt="" src={track.albumImageUrl} />
                <span>
                  <strong>{track.title}</strong>
                  <small>{track.artistName}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
