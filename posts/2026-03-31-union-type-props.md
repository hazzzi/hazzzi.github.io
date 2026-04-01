---
title: Union Type으로 예측 가능한 컴포넌트 Props 설계하기
date: 2026-03-31
description: 경우의 수를 줄이는 타입 설계
draft: false
issue: 8
---

> 사내 프론트엔드 기술 공유에서 발표했던 내용을 블로그용으로 다듬었습니다.

## 정의역과 치역

수학과 컴포넌트 사이에 얼마나 관련이 있나 싶겠지만, 한 발 떨어져서 같은 범주로 바라보면 좋을 것 같아서 먼저 소개하려고 합니다.

수학에서 함수(function)는 두 집합 사이의 관계를 정의하는 개념입니다. 집합 X와 Y가 있을 때, 함수 f는 X의 원소를 Y의 원소에 대응시키는 관계로, 수식으로는 `y = f(x)`라고 표현합니다. 여기서 `x`는 **정의역(domain)**, `f(x)`는 **치역(range)**에 해당합니다.

컴퓨터 공학에서도 함수는 특정 입력을 받아 출력을 반환하는 구조로 동작합니다. 여기서 동일한 입력에 대해 항상 동일한 출력을 반환하는 함수를 순수함수(pure function)라고 부릅니다.

## 예측 가능한 컴포넌트를 만드는 방법

그렇다면 이 수학적 함수 개념과 예측 가능한 컴포넌트는 어떤 관련이 있을까요?

리액트 컴포넌트는 자바스크립트 **함수**이며, props는 **정의역**이고, props를 통해 출력되는 UI가 **치역**에 해당한다고 볼 수 있습니다. 그리고 리액트는 컴포넌트가 순수함수처럼 동작하길 기대합니다 — 동일한 props가 들어오면 동일한 UI가 나옵니다.

순수함수가 예측 가능한 이유는 입력이 명확하기 때문입니다. 반대로 말하면, **props**(정의역)가 모호하면 **어떤 UI**(치역)가 나올지도 모호해집니다. props를 명확히 정의하고 제한할 수 있다면, UI도 예측할 수 있을 것입니다.

### Union Type 설명

이를 정의하기 위해 타입스크립트의 **Union Type**을 이용하려고 합니다.

API 호출 상태를 표현하는 경우를 예시로, 성공과 로딩 두 가지 상태를 정의해보겠습니다.

```tsx
type Status = 'success' | 'loading';
```

이 `status`를 이용해서 데이터를 가진 `Response` 타입을 구성해본다면

```tsx
type Response = {
  status: 'success' | 'loading';
  data: object | null;
}
```

여기까지만 보았을 때는 이러한 구조가 논리적으로 보일 수 있습니다. **"성공했을 때 `data`가 존재한다"**와 **"로딩 중일 때 `data`가 존재하지 않는다"**라는 조건을 가지고 경우의 수를 생각해본다면 아래 표와 같이 객체를 작성해볼 수 있습니다.

| **status** | **data** | |
| --- | --- | --- |
| 성공 | O | `{ status: 'success', data: object }` |
| 로딩 | X | `{ status: 'loading', data: null }` |

하지만 타입스크립트는 위의 비즈니스 맥락을 추론할 수 없기 때문에, **"성공했지만 `data`가 없고" "로딩이지만 `data`가 존재하는"** 상황도 에러로 취급하지 않습니다.

| **status** | **data** | |
| --- | --- | --- |
| 성공 | X | `{ status: 'success', data: null }` |
| 로딩 | O | `{ status: 'loading', data: object }` |

이 불일치는 **status**가 두 가지 값을 가질 수 있고, **data** 역시 두 가지 값을 가질 수 있기 때문에 발생합니다. 가능한 조합의 총 개수는 네 가지가 됩니다.

$$2 \times 2 = 4$$

런타임에서는 발생하지 않을 상황도 타입으로는 허용되기 때문에, 프로퍼티가 많아질수록 비즈니스 맥락 없이는 어떤 결과가 생길지 예측할 수 없게 됩니다.

이러한 상황에서 경우의 수를 줄이기 위해, 타입을 더하는 방법으로 타입을 구체화해보겠습니다.

```tsx
type Success = { status: 'success'; data: object }
type Loading = { status: 'loading'; data: null }

type Response = Success | Loading
```

Union Type(합타입)으로 정의하면, 각 상황에 대해 하나의 경우의 수만 가지므로 `Response` 타입의 경우의 수는 총 두 가지입니다.

$$1 + 1 = 2$$

일치하는 타입만 정의함으로써, 예측 불가능했던 상황을 방지할 수 있습니다.

(이 개념에 대해서 궁금하다면 "discriminated union" 또는 "tagged union"에 대해서 검색해보세요.)

## 리액트 컴포넌트의 Props로 확장하기

앞에서 살펴본 방법을 리액트 컴포넌트의 `props`에 적용해보겠습니다.

### Alert 컴포넌트 예시

알림 UI를 나타내는 Alert 컴포넌트가 있고, 다음과 같은 비즈니스 요구사항이 있습니다:

- **성공 알림**: 메시지와 확인 버튼이 있다.
- **에러 알림**: 메시지와 상세 설명이 있고, 재시도할 수 있다.
- **로딩 알림**: 메시지와 진행률이 표시되며, 사용자가 조작할 수 없다.

```tsx
// Alert.tsx
type AlertProps = {
  message: string;
  description?: string;
  progress?: number;
  onAction?: () => void;
};

function Alert({ message, description, progress, onAction }: AlertProps) {
  return (
    <div className="alert">
      <p>{message}</p>
      {description && <p>{description}</p>}
      {progress !== undefined && <progress value={progress} max={100} />}
      {onAction && <button onClick={onAction}>확인</button>}
    </div>
  );
}
```

이 컴포넌트를 사용하는 부분에서는 다음과 같이 값을 넘겨주게 될 것입니다.

```tsx
<Alert message={message} description={desc} progress={prog} onAction={() => {}} />
```

`Alert`의 사용부만 보았을 때 이 알림이 어떻게 그려질지 명확히 알기 어렵습니다. `props`를 가지고 나타낼 수 있는 UI의 경우의 수를 계산해보면 다음과 같습니다.

| | **description** | **progress** | **onAction** | **출력 UI** |
| --- | --- | --- | --- | --- |
| 1 | X | X | X | 메시지 |
| 2 | X | X | O | 메시지 [확인] |
| 3 | O | X | X | 메시지 설명 |
| 4 | O | X | O | 메시지 설명 [확인] |
| 5 | X | O | X | 메시지 진행률 |
| 6 | X | O | O | 메시지 진행률 [확인] |
| 7 | O | O | X | 메시지 설명 진행률 |
| 8 | O | O | O | 메시지 설명 진행률 [확인] |

```tsx
function Alert({ message, description, progress, onAction }: AlertProps) {
  return (
    <div className="alert">
      <p>{message}</p>                                           {/* 항상 표시(1) */}
      {description && <p>{description}</p>}                      {/* 있을 때만(2) */}
      {progress !== undefined && <progress value={progress} />}  {/* 있을 때만(2) */}
      {onAction && <button onClick={onAction}>확인</button>}     {/* 있을 때만(2) */}
    </div>
  );
}
```

$$1 \times 2 \times 2 \times 2 = 8$$

비즈니스 요구사항은 세 가지이지만, 컴포넌트가 표현할 수 있는 UI의 경우의 수는 여덟 가지가 됩니다. 지금은 간단한 `Alert`이지만, 요구사항이 늘어나면 프로퍼티 수만큼 경우의 수는 기하급수적으로 커질 것입니다.

비즈니스 맥락 없이 이 코드를 마주한다면 어떤 UI가 화면에 그려질지 예측할 수 있을까요?

### Union Type으로 리팩토링하기

비즈니스 요구사항에 맞추어 `props`를 다시 정의하고, `AlertProps`를 합타입으로 구성해보겠습니다.

```tsx
type SuccessAlert = {  // 성공: 메시지와 확인 버튼
  type: 'success';
  message: string;
  onConfirm: () => void;
};

type ErrorAlert = {  // 에러: 메시지, 상세 설명, 재시도 버튼
  type: 'error';
  message: string;
  description: string;
  onRetry: () => void;
};

type LoadingAlert = {  // 로딩: 메시지와 진행률
  type: 'loading';
  message: string;
  progress: number;
};

type AlertProps = SuccessAlert | ErrorAlert | LoadingAlert;
```

$$1 + 1 + 1 = 3$$

각 상황에 맞는 상태만 받을 수 있게 되면서, 불필요한 경우의 수가 사라졌습니다. 리팩토링 전에는 여덟 가지의 UI를 표현할 수 있었지만, 이제 필요한 세 가지의 UI만 표현합니다.

사용하는 부분에서도 `type`으로 알림의 유형을 명확히 알 수 있고, 어떤 값이 필요한지 구체적으로 이해할 수 있게 되었습니다.

```tsx
<Alert type="success" message="저장되었습니다" onConfirm={() => {}} />
<Alert type="error" message="요청 실패" description="서버 연결을 확인해주세요" onRetry={() => {}} />
<Alert type="loading" message="업로드 중..." progress={45} />
```

아래 코드는 `Alert`의 구현부입니다.

```tsx
function Alert(props: AlertProps) {
  switch (props.type) {
    case 'success':
      return (
        <div className="alert success">
          <p>{props.message}</p>
          <button onClick={props.onConfirm}>확인</button>
        </div>
      );
    case 'error':
      return (
        <div className="alert error">
          <p>{props.message}</p>
          <p>{props.description}</p>
          <button onClick={props.onRetry}>재시도</button>
        </div>
      );
    case 'loading':
      return (
        <div className="alert loading">
          <p>{props.message}</p>
          <progress value={props.progress} max={100} />
        </div>
      );
    default: {
      const _exhaustiveCheck: never = props;
      return _exhaustiveCheck;
    }
  }
}
```

## 정리

합타입을 활용해 각 상태에 맞는 타입을 설계하면, props의 경우의 수를 줄이고 예측 가능한 UI를 만들 수 있습니다. 사람의 머리로 경우의 수를 계산할 필요가 없어집니다. 이 구조는 자연스럽게 각 컴포넌트가 하나의 책임만 갖게 되고, 필요한 값만 받게 되면서 SOLID 원칙의 단일 책임 원칙(SRP)이나 인터페이스 분리 원칙(ISP)과도 맞닿아 있습니다. 경우의 수를 줄이면 책임도 명확해집니다.

## 참고

- [React - Thinking in React](https://react.dev/learn/thinking-in-react#step-3-find-the-minimal-but-complete-representation-of-ui-state)
- [ts-pattern](https://github.com/gvergnaud/ts-pattern)
- [TypeScript - Union Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#union-types)
