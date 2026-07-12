# ScoreLink 디자인 시스템 — D 스위스 모노 (확정)

시안 5종 비교 끝에 확정된 테마. 흑백 + 레드 단일 포인트, 무라운드, 얇은 직각 선. `prototype-reference.html`의 CSS가 픽셀 레퍼런스.

## 1. 원칙

1. 색은 먹(#111)과 화이트가 기본, **레드(#e3372e)는 단 하나의 포인트 컬러** — 현재/선택/추가/삭제 등 "주의가 필요한 상태"에만.
2. **라운드 없음에 가깝게**: border-radius 2~3px 고정.
3. **먹선 2px은 영역의 시작을 알리는 곳에만** (헤더 하단, 버튼줄 상단, 박 헤더 상단). 나머지 구분선은 1px 헤어라인.
4. 아이콘은 24 viewBox, **1.5px stroke, butt cap, miter join** — 둥근 캡 금지.
5. 세리프 이탤릭(Georgia)은 코드 이름 전용.

## 2. 컬러 토큰

```css
--ink:     #111;      /* 기본 텍스트/선/프라이머리 */
--mut:     #b0b0b0;   /* 비활성 텍스트 */
--mut2:    #666;      /* 보조 텍스트 (캡션, eyebrow) */
--line:    #e4e4e4;   /* 헤어라인 */
--line2:   #d6d6d6;   /* 헤어라인 (버튼 구분) */
--red:     #e3372e;   /* 유일한 포인트 */
--cell:    #f2f2f2;   /* 패드 기본 셀 */
--celldb:  #e8e8e8;   /* 정박 셀 */
--celldk:  #e0e0e0;   /* ♯행 셀 */
--celldkdb:#d6d6d6;   /* ♯행 정박 셀 */
--on:      #8f8f8f;   /* 켜진 셀 */
--rest:    #c4b28e;   /* 쉼표 행 켜진 셀 (탠) */
```
악보 내부: 보표/마디선 #c9c9c9, 쉼표 #8a8a8a, 코드 텍스트 #555, 음영 red opacity 0.055.

## 3. 타이포그래피

- 패밀리: `"Pretendard","Helvetica Neue","Apple SD Gothic Neo",sans-serif`. 코드 이름만 `Georgia,serif` italic.
- 스케일: 제목 17px/700(편집) · 22px/700(열람 히어로), eyebrow 9px/letter-spacing .22em, 칩·배지 10.5~11px/600~700, 버튼 라벨 9.5px, 캡션 8px/letter-spacing .1em, 셀 행 라벨 8.5px, 토스트 12px.
- eyebrow와 캡션은 자간을 넓게 (스위스 룩의 핵심).

## 4. 컴포넌트 규격

### 헤더/컨트롤
- `chip`: 1px ink 테두리, radius 2, 높이 32, padding 5px 9px.
- `icon-btn`: 32×32, 1px ink 테두리, radius 2. **켜짐 상태(.on) = 배경 ink + 아이콘 white** (메트로놈/반주 토글).
- 팝오버(템포/반주): 1.5px ink 테두리, radius 2, 그림자 `0 6px 18px rgba(0,0,0,.15)`, 내부 버튼은 1px line2 세로 구분, 선택 상태 = ink 반전.

### 악보
- 카드형 아님(편집) / 1px ink 테두리 카드(열람). 플레이헤드: 2px 레드 세로선 + 상단 역삼각 캐럿.

### 코드 행
- 슬롯: 1.5px ink 테두리, min-height 32, Georgia italic 13.5px. 빈 슬롯: 1px 점선(line2) + mut "＋". 피커 열린 슬롯: ink 반전.
- 마디별 반주 버튼: 1px line2 테두리, 2줄("반주" 8px mut2 / 값 9.5px 700 ink), 끔이면 값 mut.

### 코드 피커
- 1.5px ink 외곽, 헤더 하단 1px ink, 행 사이 1px line, 셀 사이 1px line 세로 구분. 선택 = ink 반전. 푸터 [지우기(red) | 완료].

### 드럼 패드
- 컨테이너: 1px ink 테두리, radius 3, padding 8.
- 박 헤더: 각 그룹 상단 **2px ink 보더** + 박 번호 11px/700.
- 셀: 높이 15px(쉼표 행 16px), radius 1.5, 그룹 간 gap 7px, 셀 간 gap 2px. 상태색은 §2 토큰. 선택 셀: red 배경 + **1.5px ink 아웃라인(inset)**.
- 스크롤 영역 높이 156px. 쉼표 행 상단 1px ink 구분.

### 마디 이동 바 / 스테퍼
- 1.5px ink 테두리 세그먼트, 내부 1px line2 구분. 추가 모드 화살표는 red ＋.
- 스테퍼: 현재 값 칸은 **상하(세로형) 또는 좌우(가로형) 1.5px red 보더**로 강조. 버튼에 셰브런(1.5px stroke) + 다음 값 라벨(8~9px mut2). 비활성 opacity 0.35(전체) / 0.3(방향 버튼).

### 6버튼줄
- 상단 2px ink. 버튼 세로 구성(아이콘 위+라벨 아래), 1px line2 구분. 프라이머리(마디 재생)=ink 반전, 삭제=red 텍스트, 내비=바탕 #f5f5f5, 추가 모드=red 700.

### 토스트
- 하단 중앙 고정, ink 배경 white 12px, radius 3, 1.5초.

## 5. 아이콘 패스 (24 viewBox, stroke 1.5, butt/miter)

```
prev   M15 5 L8 12 L15 19
next   M9 5 L16 12 L9 19
play   M8 5.5 L18 12 L8 18.5 Z            (fill)
pause  M8.5 5 V19 | M15.5 5 V19
plus   M12 5 V19 | M5 12 H19
up     M6 15 L12 8.5 L18 15
down   M6 9 L12 15.5 L18 9
undo   M8.5 13.5 L4 9 L8.5 4.5 | M4 9 H14.5 a4.7 4.7 0 0 1 0 9.4 H11
redo   (undo 미러)
del    M5 7 H19 | M9.5 7 V4.5 H14.5 V7 | M6.5 7 L7.6 19.5 H16.4 L17.5 7 | M10.3 10.5 V16 | M13.7 10.5 V16
share  M12 14.5 V3.5 | M8 7.5 L12 3.5 L16 7.5 | M5.5 11.5 V20 H18.5 V11.5
metro  M9 4 H15 L18.5 20 H5.5 Z | M12 16 L16 7 | M8 12.5 H16
chord  (2.3r 원 3개 대각선 배치: (7,17)(12,11.8)(17,6.6) — arc 패스)
```

## 6. 악보 조판 상수

```
LINEGAP=10  (보표 선 간격)
LH=118      (시스템 세로 피치)
top=42      (단일 줄 기준 보표 첫 선 y)
코드 텍스트 y = top-24, 마디 히트영역 y = top-34, 높이 98
음자리표: SVG 패스 (약식 G클레프 — S커브 + G선 루프 + 하단 도트), x=8
노트헤드: rx5.2/ry3.9 (채움) · rx5.4/ry4 (2분 이상, 1.4px stroke)
기둥 길이 26, 점음표 dot r1.7 (x+10, y-3), 임시표 ♯ 12px red (x-16)
쉼표 SVG: 온=rect(9×3.4, D5선 아래 매달림), 2분=rect(중간선 위),
          4분=지그재그 패스 1.6px, 8분/16분=사선 기둥+고리(도트+곡선) 1~2개
```

## 7. 레이아웃

- 앱 최대폭 420px 중앙 정렬, 흰 배경, 바깥 #f0f0f0.
- 세로 흐름: 헤더(고정 높이) → 악보(내용 높이) → 패드 존(#fafafa) → 스테퍼 존(#f5f5f5) → 6버튼줄(flex 하단 고정, margin-top:auto).
- 모바일 우선: user-scalable=no, tap-highlight 제거, 스크롤 영역 overscroll-behavior:contain.
- 데스크톱(뷰포트 ≥900px): 편집은 `max-width:1120px` 2패널 그리드 `[1fr 악보 | 380px 컨트롤]`, 악보 pane 독립 스크롤. 열람은 `max-width:680px` 중앙 컬럼. 컨트롤 px 규격은 불변, padding/gap만 확대. 마우스 hover/focus 피드백 추가.
