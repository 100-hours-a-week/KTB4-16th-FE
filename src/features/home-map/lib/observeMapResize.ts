import type { KakaoMap } from './kakaoMap';

/** 이동·확대와 크기 갱신을 구분할 수 있도록 중심과 가시 영역을 함께 비교한다. */
function viewportKey(map: KakaoMap): string {
  const center = map.getCenter();
  const bounds = map.getBounds();
  const southwest = bounds.getSouthWest();
  const northeast = bounds.getNorthEast();
  return [
    center.getLat(),
    center.getLng(),
    southwest.getLat(),
    southwest.getLng(),
    northeast.getLat(),
    northeast.getLng(),
  ].join(',');
}

/** 실제 지도 요소 크기만 관찰하고 relayout으로 생긴 idle을 사용자 이동과 구분한다. */
export function observeMapResize(container: HTMLElement, map: KakaoMap, onRelayout: () => void) {
  let active = true;
  let resizing = false;
  let resizeViewport: string | null = null;
  let { width, height } = container.getBoundingClientRect();

  /** 중심·선택은 보존하고 숨겨진 요소나 같은 크기의 반복 관찰은 건너뛴다. */
  function resizeMap() {
    if (!active) return;
    const nextSize = container.getBoundingClientRect();
    if (
      nextSize.width <= 0 ||
      nextSize.height <= 0 ||
      (width === nextSize.width && height === nextSize.height)
    )
      return;
    width = nextSize.width;
    height = nextSize.height;
    const center = map.getCenter();
    resizing = true;
    try {
      map.relayout();
      map.setCenter(center);
      resizeViewport = viewportKey(map);
    } finally {
      resizing = false;
    }
    // idle 중복은 억제하되 새로 노출된 bounds의 조회는 별도 경로로 한 번 요청한다.
    onRelayout();
  }

  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resizeMap);
  observer?.observe(container);
  if (!observer) window.addEventListener('resize', resizeMap);

  return {
    /** 동일한 크기 갱신에서 발생한 동기·비동기 idle만 무시한다. */
    isResizeIdle() {
      if (resizing) return true;
      if (resizeViewport === null) return false;
      if (viewportKey(map) === resizeViewport) return true;
      resizeViewport = null;
      return false;
    },
    /** 해제 뒤 지연된 observer 콜백도 SDK에 접근하지 못하게 한다. */
    disconnect() {
      active = false;
      observer?.disconnect();
      if (!observer) window.removeEventListener('resize', resizeMap);
    },
  };
}
