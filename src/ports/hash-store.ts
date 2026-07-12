/**
 * HashStore 포트 — URL 해시 읽기/쓰기 (설계 문서 §2).
 */
export interface HashStore {
  /** 앞의 '#'를 제외한 해시 문자열. 없으면 빈 문자열 */
  read(): string;
  write(hash: string): void;
}
