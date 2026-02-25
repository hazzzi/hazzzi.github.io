---
title: 인스타그램 DM 자동화 삽질기
date: 2026-02-25
description: Meta API로 DM 봇 만들다가 겪은 일들
---

## 발단

인스타그램 DM을 자동으로 보내고 싶었다. 단순한 요구사항이었는데 과정은 단순하지 않았다.

## Meta API의 세계

Meta Business Suite에서 API 키를 발급받아야 한다. 문제는:

- 비즈니스 계정이 필요하다
- 앱 검수를 받아야 한다
- 권한 승인까지 **2주**가 걸린다

> 개인 프로젝트인데 비즈니스 계정이라니

## 결국 선택한 방법

공식 API 대신 다른 방법을 찾았다.

1. Selenium으로 브라우저 자동화
2. 로그인 → DM 페이지 이동 → 메시지 전송
3. 랜덤 딜레이로 봇 탐지 회피

```python
from selenium import webdriver
import time
import random

driver = webdriver.Chrome()
driver.get("https://instagram.com")
time.sleep(random.uniform(2, 4))
```

## 교훈

- 공식 API가 항상 정답은 아니다
- 하지만 비공식 방법은 언제든 막힐 수 있다
- ~~결국 수동으로 보내는 게 제일 빠르다~~
