# Implementation Notes

## Changed Files

- `index.html`
- `styles.css`
- `app.js`
- `README.md`
- `agents/*.md`
- `workspace/*.md`
- `state/*.json`
- `evals/*.md`

## What Changed

로컬 HTML 기반 가족포털을 구현했다.

구성:

- 로그인 세션
- 가족 코드와 비밀번호 기반 로컬 인증
- 메인 대시보드
- 스케줄 CRUD
- 자산 포트폴리오 CRUD
- 뉴스 클립 CRUD
- 가족 할일 CRUD
- 에이전트 회의 로그
- 설정 데이터 내보내기와 가져오기
- 모바일 하단 탭 내비게이션
- 모바일 안전영역과 터치 영역 보정

## Why

Team.md의 3-Agent 협업 계획을 실제 실행 가능한 정적 앱으로 연결하기 위해 구현했다.

## How To Verify

1. `index.html`을 브라우저에서 연다.
2. 가족 코드와 비밀번호를 입력해 로그인한다.
3. 각 포털에서 항목을 저장한다.
4. 새로고침 후 데이터가 유지되는지 확인한다.
5. 에이전트 포털에서 회의를 실행한다.
6. 설정 포털에서 JSON 내보내기를 확인한다.
7. 핸드폰 크기에서 하단 탭, 상단바, 입력창이 겹치지 않는지 확인한다.

## Known Limitations

- 외부 뉴스 API 연동은 없다.
- 가족 코드와 비밀번호는 서버 인증이 아니라 브라우저 로컬 보호 기능이다.
- 여러 기기 간 동기화는 지원하지 않는다.
