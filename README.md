# TeamStudy Family Portal

HTML, CSS, JavaScript만 사용하는 로컬 저장 기반 가족포털입니다.

## 실행

`index.html`을 브라우저에서 열면 바로 실행됩니다.

```text
TeamStudy/index.html
```

## 기본 포털

- 로그인 메인 포털
- 스케줄 포털
- 자산 포트폴리오 포털
- 뉴스 포털
- 가족 할일 포털
- 에이전트 회의 포털
- 설정 포털

`가족 할일 포털`은 Planning, Development, Verification 에이전트 토론 결과로 추가된 포털입니다.

## 모바일 최적화

- 핸드폰에서는 포털 메뉴가 하단 고정 탭으로 표시됩니다.
- iPhone 안전영역을 고려해 하단 여백을 자동 보정합니다.
- 입력창은 모바일 브라우저 자동 확대를 줄이도록 16px 이상으로 조정했습니다.
- 핵심 집계 카드는 작은 화면에서 2열 또는 1열로 자동 전환됩니다.
- 상단바는 스크롤 중에도 접근하기 쉽도록 모바일에서 고정됩니다.

## 저장 방식

브라우저 `localStorage`에만 저장합니다.

- `teamstudy.family.auth`
- `teamstudy.family.profile`
- `teamstudy.family.session`
- `teamstudy.family.schedule`
- `teamstudy.family.assets`
- `teamstudy.family.news`
- `teamstudy.family.tasks`
- `teamstudy.family.agents`

설정 포털에서 JSON 내보내기와 가져오기를 할 수 있습니다.

## 로그인 방식

처음 로그인할 때 입력한 `가족 코드`와 `비밀번호`가 이 브라우저의 가족 공간 열쇠가 됩니다.

- 다음 로그인부터 같은 가족 코드와 비밀번호를 입력해야 합니다.
- 구성원 이름은 표시 이름이며, 비워두면 기존 대표 구성원을 사용합니다.
- 비밀번호 원문은 저장하지 않고 로컬 해시만 저장합니다.
- 서버 인증이 아니므로 같은 브라우저 안에서만 보호됩니다.
- 비밀번호를 잊으면 로그인 화면의 `로컬 초기화`로 이 브라우저의 포털 데이터를 삭제하고 다시 만들 수 있습니다.

## 에이전트 운영

에이전트 회의 포털의 `회의 실행` 버튼을 누르면 현재 데이터 상태를 기준으로 세 에이전트가 역할별 판단을 남깁니다.

- Planning Agent: 포털 범위와 다음 우선순위 판단
- Development Agent: 구현과 저장 상태 점검
- Verification Agent: 데이터 누락과 검증 리스크 점검

회의 결과는 `localStorage`의 `teamstudy.family.agents`에 저장됩니다.
