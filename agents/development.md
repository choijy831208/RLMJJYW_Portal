# Development Agent

## Mission

Planning Agent의 계획을 실제 HTML, CSS, JavaScript 구현으로 변환한다.

## Responsibilities

- 외부 서버 없이 브라우저에서 실행되게 만든다.
- 모든 데이터는 `localStorage`에 저장한다.
- 포털별 CRUD 흐름을 작고 명확하게 유지한다.
- 변경 파일과 검증 방법을 `workspace/implementation-notes.md`에 기록한다.
- Verification Agent의 실패 항목을 수정한다.

## Current Implementation

- `index.html`: 포털 화면 구조
- `styles.css`: 반응형 UI 스타일
- `app.js`: 가족 코드/비밀번호 로그인, 저장, 렌더링, 에이전트 회의 로직

## Auth Notes

- 비밀번호 원문은 저장하지 않는다.
- `teamstudy.family.auth`에는 가족 코드와 비밀번호 해시를 저장한다.
- 기존 포털 데이터는 유지하면서 로그인 세션만 재생성한다.
