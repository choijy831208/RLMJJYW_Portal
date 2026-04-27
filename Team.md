# TeamStudy 3-Agent 협업 프로젝트 계획

## 1. 프로젝트 목표

`TeamStudy`는 하나의 작업을 세 에이전트가 역할 분담하여 처리하는 협업형 AI 프로젝트다.

- `Planning Agent`: 요구사항을 해석하고 실행 계획, 우선순위, 승인 기준을 만든다.
- `Development Agent`: 계획을 바탕으로 구현하고 변경 내용을 설명한다.
- `Verification Agent`: 구현 결과를 검증하고 버그, 누락, 리스크를 찾아낸다.

핵심 목표는 단순한 순차 실행이 아니라, 세 에이전트가 서로 의견을 주고받고 토론한 뒤 공유 상태를 업데이트하면서 더 안전하고 정확한 결과물을 만드는 것이다.

## 2. 최적화 원칙

1. 작은 단위로 계획하고 구현한다.
2. 모든 결정은 근거와 함께 기록한다.
3. 개발보다 먼저 승인 기준을 정의한다.
4. 검증 결과가 실패하면 계획으로 되돌아간다.
5. 토론은 길게 끌지 않고 최대 2회 왕복 후 결정한다.
6. 공유 문서와 상태 파일을 단일 진실 공급원으로 사용한다.
7. 에이전트별 책임은 분리하되, 중요한 결정은 상호 검토한다.

## 3. 권장 폴더 구조

```text
TeamStudy/
  Team.md
  README.md
  agents/
    planning.md
    development.md
    verification.md
  workspace/
    requirements.md
    plan.md
    implementation-notes.md
    verification-report.md
    decision-log.md
  state/
    task-board.json
    messages.jsonl
    memory.json
  evals/
    checklist.md
    test-cases.md
```

## 4. 전체 아키텍처

```text
User Request
    |
    v
Planning Agent
    |
    | plan, acceptance criteria, risks
    v
Development Agent <---- discussion ----> Verification Agent
    |                                  |
    | implementation notes             | test result, issues
    v                                  v
Shared State / Task Board / Decision Log
    |
    v
Final Update
```

세 에이전트는 직접 파일을 수정하거나 메시지를 남길 수 있지만, 최종 상태는 항상 `state/task-board.json`, `workspace/decision-log.md`, `workspace/verification-report.md`에 반영한다.

## 5. 에이전트 역할 정의

### 5.1 Planning Agent

책임:

- 사용자 요청을 요구사항으로 정리한다.
- 작업 범위, 우선순위, 마일스톤을 만든다.
- 개발자가 구현해야 할 작업 카드를 생성한다.
- 검증자가 확인해야 할 승인 기준을 작성한다.
- 개발 및 검증 과정에서 발견된 이슈를 바탕으로 계획을 업데이트한다.

입력:

- 사용자 요청
- 현재 작업 상태
- 개발 노트
- 검증 리포트

출력:

- `workspace/requirements.md`
- `workspace/plan.md`
- `state/task-board.json`
- `workspace/decision-log.md`

판단 기준:

- 요구사항이 모호하면 먼저 질문을 만든다.
- 구현 가능한 단위로 작업을 쪼갠다.
- 승인 기준 없이 개발로 넘기지 않는다.

### 5.2 Development Agent

책임:

- 계획에 따라 기능을 구현한다.
- 변경 파일, 변경 이유, 예상 영향 범위를 기록한다.
- 구현 중 계획과 충돌하는 부분을 발견하면 토론 요청을 보낸다.
- 검증 실패 사항을 수정한다.

입력:

- `workspace/plan.md`
- `state/task-board.json`
- Planning Agent의 결정 사항
- Verification Agent의 피드백

출력:

- 실제 코드 또는 문서 변경
- `workspace/implementation-notes.md`
- 작업 카드 상태 업데이트

판단 기준:

- 한 번에 너무 큰 변경을 하지 않는다.
- 기존 구조와 스타일을 우선 따른다.
- 검증 가능한 결과물을 남긴다.

### 5.3 Verification Agent

책임:

- 승인 기준에 따라 결과물을 검증한다.
- 테스트 케이스, 체크리스트, 수동 검토 항목을 만든다.
- 버그, 누락, 회귀 가능성을 찾아낸다.
- 통과, 조건부 통과, 실패 중 하나로 판정한다.

입력:

- `workspace/requirements.md`
- `workspace/plan.md`
- `workspace/implementation-notes.md`
- 변경된 결과물

출력:

- `workspace/verification-report.md`
- `evals/checklist.md`
- `evals/test-cases.md`
- 작업 카드 검증 상태

판단 기준:

- 요구사항 충족 여부를 먼저 본다.
- 구현 의도보다 실제 동작을 기준으로 판단한다.
- 실패 시 재현 조건과 수정 제안을 함께 남긴다.

## 6. 메시지 프로토콜

모든 에이전트 메시지는 `state/messages.jsonl`에 한 줄 JSON 형식으로 기록한다.

```json
{
  "id": "msg-0001",
  "task_id": "task-001",
  "from": "planning",
  "to": "development",
  "type": "request",
  "status": "open",
  "summary": "요구사항을 기준으로 초기 구현을 요청합니다.",
  "evidence": ["workspace/plan.md"],
  "risks": ["요구사항이 일부 모호함"],
  "next_action": "구현 가능성 검토 후 implementation-notes.md 업데이트",
  "created_at": "2026-04-27T00:00:00+09:00"
}
```

권장 메시지 타입:

- `request`: 작업 요청
- `proposal`: 대안 제안
- `question`: 확인 질문
- `objection`: 반대 또는 리스크 제기
- `decision`: 결정 사항
- `result`: 작업 결과
- `verification`: 검증 결과

## 7. 작업 카드 상태 모델

`state/task-board.json`은 아래 구조를 사용한다.

```json
{
  "tasks": [
    {
      "id": "task-001",
      "title": "초기 요구사항 정리",
      "owner": "planning",
      "status": "done",
      "priority": "high",
      "acceptance_criteria": [
        "핵심 목표가 3문장 이하로 정리되어 있다.",
        "개발 및 검증 기준이 명확하다."
      ],
      "blocked_by": [],
      "updated_at": "2026-04-27T00:00:00+09:00"
    }
  ]
}
```

상태 값:

- `todo`: 아직 시작하지 않음
- `in_progress`: 진행 중
- `blocked`: 다른 결정이나 작업에 막힘
- `review`: 검증 대기
- `changes_requested`: 수정 필요
- `done`: 완료

## 8. 협업 워크플로우

### 8.1 1단계: 요청 접수

Planning Agent가 사용자 요청을 분석한다.

산출물:

- 요구사항 요약
- 목표
- 비목표
- 제약 조건
- 예상 리스크

완료 조건:

- `workspace/requirements.md`가 작성된다.
- 초기 작업 카드가 생성된다.

### 8.2 2단계: 계획 수립

Planning Agent가 작업을 작은 단위로 나누고 승인 기준을 만든다.

산출물:

- `workspace/plan.md`
- `state/task-board.json`
- 초기 `decision-log.md`

완료 조건:

- Development Agent가 구현 가능한 수준으로 작업이 쪼개져 있다.
- Verification Agent가 검증 가능한 기준을 확보했다.

### 8.3 3단계: 사전 토론

Development Agent와 Verification Agent가 계획을 검토한다.

토론 질문:

- 구현 범위가 과도하지 않은가?
- 승인 기준이 검증 가능한가?
- 실패 가능성이 높은 부분은 무엇인가?
- 더 단순한 구현 경로가 있는가?

완료 조건:

- 반대 의견이 없거나, 반대 의견이 `decision-log.md`에 정리되어 있다.
- Planning Agent가 최종 계획을 업데이트했다.

### 8.4 4단계: 구현

Development Agent가 작업 카드 단위로 구현한다.

규칙:

- 한 작업 카드는 하나의 명확한 변경 목표만 가진다.
- 구현 후 변경 요약을 남긴다.
- 검증 방법을 같이 적는다.

완료 조건:

- `workspace/implementation-notes.md`가 업데이트된다.
- 작업 상태가 `review`로 변경된다.

### 8.5 5단계: 검증

Verification Agent가 승인 기준과 실제 결과를 비교한다.

판정:

- `pass`: 승인 기준 충족
- `conditional_pass`: 경미한 이슈가 있지만 진행 가능
- `fail`: 수정 필요

완료 조건:

- `workspace/verification-report.md`가 작성된다.
- 실패 항목은 `changes_requested` 상태로 되돌린다.

### 8.6 6단계: 업데이트 및 반복

Planning Agent가 검증 결과를 반영해 다음 행동을 결정한다.

결정:

- 완료 처리
- 수정 작업 생성
- 요구사항 재정의
- 사용자 확인 요청

완료 조건:

- `decision-log.md`에 결정이 기록된다.
- 모든 필수 작업이 `done` 상태가 된다.

## 9. 토론 규칙

1. 반대 의견은 반드시 근거와 대안을 포함한다.
2. 같은 쟁점은 최대 2회 왕복만 토론한다.
3. 합의가 안 되면 Verification Agent가 리스크를 정리하고 Planning Agent가 결정한다.
4. 결정된 내용은 `decision-log.md`에 남긴다.
5. 새로운 요구사항이 나오면 기존 작업에 끼워 넣지 않고 새 작업 카드로 만든다.

## 10. 에이전트별 기본 프롬프트

### Planning Agent Prompt

```text
당신은 Planning Agent입니다.
사용자 요청을 실행 가능한 요구사항과 작업 계획으로 바꿉니다.
항상 목표, 비목표, 제약 조건, 승인 기준, 작업 카드를 작성하세요.
개발과 검증에서 나온 피드백을 반영해 계획을 업데이트하세요.
결정 사항은 decision-log.md에 남기세요.
```

### Development Agent Prompt

```text
당신은 Development Agent입니다.
Planning Agent의 계획과 작업 카드를 기준으로 구현합니다.
변경은 작고 검증 가능하게 유지하세요.
구현 중 모호하거나 위험한 부분은 토론 메시지로 남기세요.
작업 후 변경 요약, 수정 파일, 검증 방법을 implementation-notes.md에 기록하세요.
```

### Verification Agent Prompt

```text
당신은 Verification Agent입니다.
요구사항, 계획, 승인 기준을 기준으로 결과물을 검증합니다.
통과 여부를 pass, conditional_pass, fail 중 하나로 판정하세요.
실패 시 재현 조건, 영향도, 수정 제안을 verification-report.md에 기록하세요.
```

## 11. 의사결정 매트릭스

| 상황 | 최종 결정권자 | 필수 참여자 |
| --- | --- | --- |
| 요구사항 변경 | Planning Agent | Development, Verification |
| 구현 방식 선택 | Development Agent | Planning, Verification |
| 품질 통과 여부 | Verification Agent | Development |
| 일정 및 우선순위 변경 | Planning Agent | Verification |
| 릴리스 가능 여부 | Planning Agent | Development, Verification |

## 12. 검증 체크리스트

기능 검증:

- 요구사항을 모두 충족했는가?
- 승인 기준이 실제로 확인되었는가?
- 실패 케이스가 고려되었는가?

구조 검증:

- 기존 프로젝트 구조와 어울리는가?
- 불필요하게 복잡한 설계가 들어가지 않았는가?
- 변경 범위가 작업 카드 목적과 일치하는가?

협업 검증:

- 중요한 결정이 기록되었는가?
- 반대 의견과 해결 방식이 남아 있는가?
- 다음 작업자가 이어서 볼 수 있는 상태인가?

## 13. 추천 구현 단계

### Phase 1: 파일 기반 수동 협업

목표:

- Markdown과 JSON 파일만으로 세 에이전트 협업 흐름을 만든다.

구현:

- `agents/*.md`에 에이전트별 프롬프트 작성
- `workspace/*.md`에 산출물 기록
- `state/task-board.json`으로 작업 상태 관리
- `state/messages.jsonl`로 대화 기록

장점:

- 빠르게 시작할 수 있다.
- 디버깅이 쉽다.
- 자동화 전에 협업 규칙을 안정화할 수 있다.

### Phase 2: 간단한 오케스트레이터 추가

목표:

- 에이전트 실행 순서와 메시지 라우팅을 자동화한다.

권장 구조:

```text
orchestrator/
  index.js
  agents.js
  state.js
  router.js
```

핵심 기능:

- 현재 작업 상태 읽기
- 다음에 실행할 에이전트 결정
- 메시지 저장
- 산출물 업데이트
- 실패 시 이전 단계로 되돌리기

### Phase 3: 평가 및 자동 검증

목표:

- Verification Agent의 품질을 높이고 반복 가능한 평가 체계를 만든다.

구현:

- `evals/test-cases.md`에 대표 시나리오 작성
- `evals/checklist.md`에 고정 검증 항목 작성
- 변경마다 검증 리포트 생성
- 실패 패턴을 `memory.json`에 누적

## 14. 최적 실행 루프

```text
1. Planning Agent: 요구사항 정리
2. Planning Agent: 작업 카드와 승인 기준 생성
3. Development Agent: 구현 가능성 검토
4. Verification Agent: 검증 가능성 및 리스크 검토
5. Planning Agent: 계획 확정
6. Development Agent: 작은 단위 구현
7. Verification Agent: 검증
8. Planning Agent: 완료 또는 수정 결정
9. 세 에이전트: 공유 상태 업데이트
10. 다음 작업으로 반복
```

## 15. 성공 기준

이 프로젝트가 잘 작동한다고 볼 수 있는 기준:

- 사용자 요청이 항상 작업 카드로 변환된다.
- 각 작업 카드에는 승인 기준이 있다.
- 개발 결과에는 구현 노트가 있다.
- 검증 결과에는 통과 여부와 근거가 있다.
- 실패한 작업은 자동으로 수정 루프로 돌아간다.
- 모든 중요한 결정은 `decision-log.md`에 남는다.
- 최종 결과는 사용자가 이해할 수 있는 요약으로 제공된다.

## 16. 초기 작업 목록

1. `agents/planning.md`, `agents/development.md`, `agents/verification.md` 작성
2. `workspace/requirements.md` 템플릿 작성
3. `workspace/plan.md` 템플릿 작성
4. `workspace/implementation-notes.md` 템플릿 작성
5. `workspace/verification-report.md` 템플릿 작성
6. `state/task-board.json` 초기 구조 작성
7. `state/messages.jsonl` 메시지 기록 방식 확정
8. 첫 샘플 요청으로 전체 루프 테스트

## 17. 권장 최소 템플릿

### requirements.md

```md
# Requirements

## Goal

## Non-Goals

## Constraints

## User Stories

## Risks
```

### plan.md

```md
# Plan

## Summary

## Tasks

## Acceptance Criteria

## Open Questions

## Decisions
```

### implementation-notes.md

```md
# Implementation Notes

## Changed Files

## What Changed

## Why

## How To Verify

## Known Limitations
```

### verification-report.md

```md
# Verification Report

## Verdict

## Checked Criteria

## Issues

## Reproduction

## Recommendation
```

## 18. 운영 팁

- 처음부터 완전 자동화를 목표로 하지 말고 파일 기반 협업을 먼저 안정화한다.
- 각 에이전트의 출력 형식을 고정하면 이후 자동화가 쉬워진다.
- 토론은 자유롭게 하되 결정은 구조화된 문서에만 남긴다.
- Verification Agent는 친절한 리뷰어가 아니라 엄격한 품질 담당자로 운영한다.
- Planning Agent는 모든 피드백을 받아들이는 역할이 아니라 최종 범위를 조정하는 역할이다.
- Development Agent는 빠른 구현보다 추적 가능한 구현을 우선한다.

## 19. 최종 권장안

가장 효율적인 시작 방식은 `파일 기반 3-Agent 협업 시스템`이다.

처음에는 Markdown과 JSON만으로 계획, 개발, 검증 루프를 만들고, 협업 규칙이 안정화된 뒤 Node.js 또는 Python 기반 오케스트레이터를 추가한다. 이렇게 하면 초기 복잡도를 낮추면서도 나중에 자동화, 평가, UI 확장까지 자연스럽게 이어갈 수 있다.

최종 목표 구조는 다음과 같다.

```text
Planning Agent가 방향을 잡고,
Development Agent가 작게 구현하고,
Verification Agent가 엄격하게 검증하며,
세 에이전트가 공유 상태를 업데이트하면서 반복 개선한다.
```
