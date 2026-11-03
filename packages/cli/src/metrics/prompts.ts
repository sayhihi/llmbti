/**
 * 프롬프트 1개를 시그널별로 분류한다 (SPEC 6장 표의 프롬프트 기반 시그널).
 * 키워드 목록은 ⚙️ 튜닝 대상. 숫자 기준은 scoring.constants.ts에 있다.
 */

import { SHORT_IMPERATIVE_MAX_LENGTH } from "../scoring.constants";

export interface PromptFlags {
  /** 글자 수 (코드 포인트) */
  length: number;
  question: boolean;
  /** "잠깐", "아니", "stop"으로 시작 */
  interrupt: boolean;
  /** 파일 경로, 라인 번호, 코드블록, 스택트레이스 포함 */
  concrete: boolean;
  abstract: boolean;
  errorPaste: boolean;
  emotion: boolean;
  /** 20자 이하 명령형 */
  shortImperative: boolean;
  plan: boolean;
  /** 방향 전환 ("다시", "취소", "그게 아니라", "되돌려") */
  redirect: boolean;
  /** "다시" 포함 (재미용 통계 redoCount) */
  redo: boolean;
  /** 감사 표현 포함 (재미용 통계 thanksCount) */
  thanks: boolean;
}

const QUESTION_END = /[?？]\s*$/;

/** 끼어들기. "아니면"(= or)은 제외한다. */
const INTERRUPT_START = /^\s*(잠깐|잠시만|아니(?!면)|아냐|아뇨|멈춰|스톱|stop\b|wait\b|hold on\b)/i;

const FILE_PATH =
  /(?:^|[\s"'`(])(?:~|\.{1,2})?\/[\w.@-]+(?:\/[\w.@-]+)+|\b[\w-]+(?:\/[\w.-]+)+\.[a-z]{1,5}\b|\b[\w-]+\.(?:tsx?|jsx?|mjs|cjs|py|go|rs|java|kt|kts|rb|php|cs|cpp|cc|c|h|hpp|swift|md|json|ya?ml|toml|css|scss|html|sql|sh|zsh|env|lock|xml|gradle|vue|svelte)\b/i;
const LINE_NUMBER = /(?::\d+(?::\d+)?\b|\b(?:line|라인|줄)\s*\d+|\bL\d{1,5}\b)/i;
const CODE_BLOCK = /```/;
const STACK_TRACE =
  /(?:^\s*at\s+\S+.*\(?.*:\d+:\d+\)?|Traceback \(most recent call last\)|^\s+File ".*", line \d+|goroutine \d+ \[|\bCaused by:|panic:)/m;

const ABSTRACT =
  /(구조|설계|아키텍처|아키텍쳐|깔끔하게|개선|추상화|리팩토링|리팩터링|refactor|design|better|architecture|clean(?:er)? code|abstract)/i;

const ERROR_LOG =
  /(\b\w*(?:Error|Exception)\b|Traceback|npm ERR!|error\[E\d+\]|error TS\d+|\bENOENT\b|\bEACCES\b|\bECONNREFUSED\b|\bsegmentation fault\b|\bexit code \d+|\bFAILED\b|\bpanic:|✗|✘|\bfatal:|\berror:)/;

const EMOTION =
  /(고마워|고맙|감사|미안|죄송|ㅋㅋ|ㅎㅎ|ㅠ|ㅜ|부탁|수고|대박|최고|사랑|화나|짜증|\bthanks?\b|\bthank you\b|\bthx\b|\bplease\b|\bplz\b|\bsorry\b|\blol\b|\bhaha\b|\bawesome\b|\bgreat\b|[!]{2,})/i;
const EMOJI = /\p{Extended_Pictographic}/u;

const THANKS = /(고마워|고맙|감사|땡큐|\bthanks?\b|\bthank you\b|\bthx\b|\bty\b)/i;

const IMPERATIVE =
  /(고쳐|고치|해줘|해 줘|해주|해봐|해라|하자|해$|줘$|수정|지워|삭제|추가|바꿔|돌려|실행|확인|진행|계속|적용|반영|푸시|커밋|머지|배포|테스트|ㄱㄱ|ㄱ$|^fix\b|^do\b|^run\b|^go\b|^try\b|^add\b|^remove\b|^change\b|^update\b|^commit\b|^push\b|^merge\b|^deploy\b|^continue\b|^proceed\b|^next\b|^retry\b|^(yes|y|ok|okay|ㅇㅇ|ㅇㅋ|응|넵|네|예|ㄴㄴ|no|nope)[.!]*$)/i;

const PLAN =
  /(계획|플랜|\bplans?\b|\bplanning\b|단계|step[- ]by[- ]step|순서대로|로드맵|roadmap|\btodo\b|할 일 목록|체크리스트|checklist)/i;

const REDIRECT =
  /(다시|취소|그게 아니라|그게아니라|되돌려|되돌리|돌려놔|롤백|rollback|\brevert\b|\bundo\b|원래대로|하지 ?마|그만|말고)/i;

const REDO = /다시/;

export function charLength(text: string): number {
  return [...text].length;
}

export function classifyPrompt(text: string): PromptFlags {
  const trimmed = text.trim();
  const length = charLength(trimmed);
  const concrete =
    CODE_BLOCK.test(trimmed) ||
    STACK_TRACE.test(trimmed) ||
    FILE_PATH.test(trimmed) ||
    LINE_NUMBER.test(trimmed);
  const question = QUESTION_END.test(trimmed);
  return {
    length,
    question,
    interrupt: INTERRUPT_START.test(trimmed),
    concrete,
    abstract: ABSTRACT.test(trimmed),
    errorPaste: ERROR_LOG.test(trimmed) || STACK_TRACE.test(trimmed),
    emotion: EMOTION.test(trimmed) || EMOJI.test(trimmed),
    shortImperative:
      length > 0 && length <= SHORT_IMPERATIVE_MAX_LENGTH && !question && IMPERATIVE.test(trimmed),
    plan: PLAN.test(trimmed),
    redirect: REDIRECT.test(trimmed),
    redo: REDO.test(trimmed),
    thanks: THANKS.test(trimmed),
  };
}
