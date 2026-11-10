/**
 * 릭 모음 md 를 시드 계정의 커뮤니티 릭 행으로 바꾸는 순수 함수.
 * 규칙 번호는 docs/features/seed-licks/03-spec.md 의 R1 ~ R8 이다.
 * 파일과 프로세스는 만지지 않는다. 입력은 (파일명, 문자열) 쌍이다.
 */
import { decodeSong } from '../src/core/codec';
import type { Song } from '../src/core/types';

export interface ParsedLick {
  file: string;
  section: string;
  number: number;
  name: string;
  suffix: string;
  meta: string;
  hash: string;
}

type Place = Pick<ParsedLick, 'file' | 'section' | 'number'>;

const HEADING = /^### (\d+)\. (.*)$/;
const LINK = /https:\/\/lickshare\.pages\.dev\/\?mode=view#(v2[A-Za-z0-9_-]+)/;

const isBoundary = (line: string): boolean => line.startsWith('## ') || line.startsWith('### ');

// 항목 번호는 섹션마다 1부터 다시 시작하므로 섹션 키까지 적어야 위치가 정해진다
const where = (p: Place): string => `${p.file} ${p.section} ${p.number}번 항목`;

// 섹션 이름은 '## ' 뒤부터 ' (' 앞까지, 키는 그 이름의 마지막 토큰이다
const sectionKey = (line: string): string => {
  const name = line.slice(3).split(' (')[0] ?? '';
  return name.trim().split(/\s+/).at(-1) ?? '';
};

/** R1: md 한 파일의 항목을 문서 순서대로 뽑는다 */
export const parseLicks = (file: string, text: string): ParsedLick[] => {
  const lines = text.split('\n');
  const licks: ParsedLick[] = [];
  let section = '';
  lines.forEach((line, i) => {
    if (line.startsWith('## ')) section = sectionKey(line);
    const heading = HEADING.exec(line);
    if (!heading) return;
    const number = Number(heading[1]);
    const at = where({ file, section, number });
    // 릭 이름 안에도 ' — ' 가 올 수 있어 탐욕 매칭으로 마지막 구분자에서 나눈다
    const title = /^(.*) — (.*)$/.exec(heading[2] ?? '');
    if (!title) throw new Error(`${at}: 헤딩에 ' — ' 접미가 없다`);
    const [, name = '', suffix = ''] = title;
    const rest = lines.slice(i + 1);
    const end = rest.findIndex(isBoundary);
    const body = end < 0 ? rest : rest.slice(0, end);
    const hash = LINK.exec(body.join('\n'))?.[1];
    if (!hash) throw new Error(`${at}: 다음 헤딩 전까지 악보 링크가 없다`);
    licks.push({
      file,
      section,
      number,
      name,
      suffix,
      meta: body.find((l) => l.trim() !== '') ?? '',
      hash,
    });
  });
  return licks;
};

/** R2: 앱에서 열리지 않는 해시가 하나라도 있으면 부분 출력 없이 전체를 멈춘다 */
export const decodeLick = (lick: ParsedLick): Song => {
  const song = decodeSong(lick.hash);
  if (!song) throw new Error(`${where(lick)}: 해시를 디코딩하지 못했다 (${lick.hash})`);
  return song;
};
