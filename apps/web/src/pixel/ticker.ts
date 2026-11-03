/**
 * 페이지당 rAF 루프 하나. 캐릭터 캔버스가 여럿이어도 (도감 16장) 프레임 콜백은 한 루프에서 돈다.
 * 구독자가 없으면 루프를 멈추고, 탭이 숨겨지면 멈췄다가 돌아오면 다시 돈다.
 */

type TickFn = (now: number) => void;

const subscribers = new Set<TickFn>();
let raf = 0;
let listening = false;

function loop(now: number) {
  raf = 0;
  for (const fn of subscribers) fn(now);
  if (subscribers.size > 0 && !document.hidden) raf = requestAnimationFrame(loop);
}

function start() {
  if (raf || subscribers.size === 0 || document.hidden) return;
  raf = requestAnimationFrame(loop);
}

function stop() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
}

function onVisibility() {
  if (document.hidden) stop();
  else start();
}

/** 틱마다 fn(now) 를 부른다. 돌려주는 함수로 해제. */
export function subscribeTick(fn: TickFn): () => void {
  subscribers.add(fn);
  if (!listening) {
    document.addEventListener("visibilitychange", onVisibility);
    listening = true;
  }
  start();
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0) stop();
  };
}

/** 테스트·디버그용 */
export function tickerSubscriberCount(): number {
  return subscribers.size;
}
