import { useEffect, useRef, useState } from "react";

import { createPlayer, seedFrom } from "../pixel/player";
import type { Player } from "../pixel/player";
import { PALETTE, drawFrame, getCharacter } from "../pixel/shim";
import type { PixelCharacter as PixelCharacterData } from "../pixel/shim";
import { subscribeTick } from "../pixel/ticker";

const MIN_SCALE = 4;

/** 같은 페이지에 같은 유형이 여럿이어도 시드가 다르게 */
let instanceCounter = 0;

interface Props {
  type: string;
  /** 컨테이너가 커도 이 배율은 넘지 않는다 */
  maxScale?: number;
  className?: string;
  /** 접근성 라벨. 기본값은 "{type} 캐릭터" */
  label?: string;
  /** 처음 보일 때 wave 를 한 번 하고 스케줄러로 넘어간다. 탭하면 다시 wave. */
  intro?: boolean;
}

/**
 * 32x32 픽셀 캐릭터를 <canvas> 에 정수 배율로 그린다.
 * 컨테이너 너비에 맞추되 최소 4배. 프레임 선택은 pixel/player.ts (idle + 타이밍 깜빡임 + 행동 스케줄러 + wave) 가 하고
 * 여기서는 페이지 공용 ticker 에 붙어 그리기만 한다. prefers-reduced-motion 이면 첫 프레임에서 멈춘다.
 * 데이터가 없는 유형은 글자 박스를 보여 준다.
 */
export function PixelCharacter({ type, maxScale = 12, className, label, intro = true }: Props) {
  const character = getCharacter(type);
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(MIN_SCALE);

  useEffect(() => {
    const el = boxRef.current;
    if (!el || !character) return;
    const fit = () => {
      const width = el.clientWidth;
      const next = Math.max(MIN_SCALE, Math.min(maxScale, Math.floor(width / character.size)));
      setScale(next);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [character, maxScale]);

  return (
    <div ref={boxRef} className={["pixel-box", className].filter(Boolean).join(" ")}>
      {character ? (
        <Canvas
          character={character}
          scale={scale}
          label={label ?? `${type} 캐릭터`}
          intro={intro}
        />
      ) : (
        <Placeholder type={type} />
      )}
    </div>
  );
}

function Canvas({
  character,
  scale,
  label,
  intro,
}: {
  character: PixelCharacterData;
  scale: number;
  label: string;
  intro: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const px = character.size * scale;
  // 탭 핸들러가 현재 플레이어에 닿도록
  const tapRef = useRef<(() => void) | null>(null);
  // 플레이어는 캐릭터·intro 가 같으면 스케일이 바뀌어도 이어 간다 (wave 가 다시 시작되지 않게).
  const playerRef = useRef<{ key: string; player: Player } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const frames = character.frames;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let unsubscribe: (() => void) | null = null;
    let lastIndex = -1;
    let lastTransform = "";
    // reduced motion 은 여기서 처리한다 (구독 안 함). 플레이어는 항상 평소대로 만든다.
    const key = `${character.id}|${intro}`;
    if (playerRef.current?.key !== key) {
      playerRef.current = {
        key,
        player: createPlayer(character, performance.now(), {
          intro,
          // 같은 페이지에 같은 유형이 여럿이어도 제각각 움직이게 인스턴스마다 다른 시드
          seed: seedFrom(`${character.id}#${instanceCounter++}#${Math.random()}`),
        }),
      };
    }
    const player = playerRef.current.player;

    const paint = (index: number, dx = 0, dy = 0) => {
      if (index !== lastIndex) {
        const frame = frames[index];
        if (frame) drawFrame(ctx, frame, PALETTE, scale);
        lastIndex = index;
      }
      const transform = dx || dy ? `translate(${dx * scale}px, ${-dy}px)` : "";
      if (transform !== lastTransform) {
        canvas.style.transform = transform;
        lastTransform = transform;
      }
    };
    const stop = () => {
      unsubscribe?.();
      unsubscribe = null;
    };
    const start = () => {
      stop();
      lastIndex = -1;
      if (media.matches) {
        playerRef.current = null;
        paint(player.plan.idle[0] ?? 0);
        return;
      }
      unsubscribe = subscribeTick((now) => {
        const f = player.frame(now);
        paint(f.index, f.dx, f.dy);
      });
    };

    tapRef.current = () => {
      if (media.matches) return;
      player.tap(performance.now());
    };

    start();
    media.addEventListener("change", start);
    return () => {
      stop();
      tapRef.current = null;
      media.removeEventListener("change", start);
    };
  }, [character, scale, intro]);

  // 언마운트하면 플레이어를 버린다
  useEffect(() => () => {
    playerRef.current = null;
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pixel-canvas"
      width={px}
      height={px}
      style={{ width: px, height: px, cursor: intro ? "pointer" : undefined }}
      role="img"
      aria-label={label}
      onClick={intro ? () => tapRef.current?.() : undefined}
    />
  );
}

function Placeholder({ type }: { type: string }) {
  return (
    <div className="pixel-placeholder" role="img" aria-label={`${type} 캐릭터 준비 중`}>
      <span className="px">{type}</span>
      <span className="pixel-placeholder-note">준비 중</span>
    </div>
  );
}
