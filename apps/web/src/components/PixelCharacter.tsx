import { useEffect, useRef, useState } from "react";

import { PALETTE, drawFrame, getAnim, getCharacter } from "../pixel/shim";
import type { PixelCharacter as PixelCharacterData } from "../pixel/shim";

const MIN_SCALE = 4;

interface Props {
  type: string;
  /** 컨테이너가 커도 이 배율은 넘지 않는다 */
  maxScale?: number;
  className?: string;
  /** 접근성 라벨. 기본값은 "{type} 캐릭터" */
  label?: string;
  /** 처음 보일 때 wave 를 한 번 하고 idle 로 돌아간다. 탭하면 다시 wave. */
  intro?: boolean;
}

/**
 * 32x32 픽셀 캐릭터를 <canvas> 에 정수 배율로 그린다.
 * 컨테이너 너비에 맞추되 최소 4배. requestAnimationFrame 으로 fps 에 맞춰 프레임을 돌리고
 * prefers-reduced-motion 이면 첫 프레임에서 멈춘다. 데이터가 없는 유형은 글자 박스를 보여 준다.
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
  // 탭할 때마다 올려서 wave 를 다시 재생한다
  const [replay, setReplay] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    const frames = character.frames;
    const idle = getAnim(character, "idle");
    const wave = intro ? getAnim(character, "wave") : [];
    const first = frames[idle[0] ?? 0];
    if (!first) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    let lastIndex = -1;
    const frameMs = 1000 / Math.max(1, character.fps);

    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const start = () => {
      stop();
      if ((frames.length < 2 && wave.length === 0) || media.matches) {
        drawFrame(ctx, first, PALETTE, scale);
        lastIndex = 0;
        return;
      }
      const origin = performance.now();
      const tick = (now: number) => {
        const n = Math.floor((now - origin) / frameMs);
        // wave 를 한 번 다 돌고 나면 idle 을 반복한다
        const index =
          n < wave.length ? (wave[n] ?? 0) : (idle[(n - wave.length) % idle.length] ?? 0);
        if (index !== lastIndex) {
          const frame = frames[index];
          if (frame) drawFrame(ctx, frame, PALETTE, scale);
          lastIndex = index;
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    start();
    media.addEventListener("change", start);
    return () => {
      stop();
      media.removeEventListener("change", start);
    };
  }, [character, scale, intro, replay]);

  return (
    <canvas
      ref={canvasRef}
      className="pixel-canvas"
      width={px}
      height={px}
      style={{ width: px, height: px, cursor: intro ? "pointer" : undefined }}
      role="img"
      aria-label={label}
      onClick={intro ? () => setReplay((r) => r + 1) : undefined}
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
