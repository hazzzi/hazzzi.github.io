---
title: SQLite면 충분하다
date: 2026-02-18
description: 사이드 프로젝트에 PostgreSQL이 필요한가
issue: 4
---

## 습관적인 선택

새 프로젝트를 시작하면 자동으로 PostgreSQL을 고른다. Docker Compose에 `postgres:16` 이미지를 넣고, `.env`에 `DATABASE_URL`을 적고, Prisma나 Drizzle로 ORM을 세팅한다.

그런데 한 번도 스스로에게 물어본 적이 없다. **이 프로젝트에 정말 PostgreSQL이 필요한가?**

## SQLite의 실제 성능

흔한 오해가 있다. SQLite는 느리다, 동시성이 안 된다, 프로덕션에서는 못 쓴다.

벤치마크를 보자.

| 작업 | SQLite (WAL) | PostgreSQL |
|------|------------:|----------:|
| 단순 SELECT | 0.003ms | 0.15ms |
| INSERT 1000행 | 12ms | 45ms |
| JOIN 쿼리 | 0.8ms | 1.2ms |
| 동시 읽기 10개 | 문제 없음 | 문제 없음 |

로컬 파일이니까 네트워크 오버헤드가 0이다. 대부분의 읽기 작업에서 SQLite가 빠르다.

## WAL 모드를 쓰면 된다

SQLite의 가장 큰 약점은 쓰기 잠금이다. 한 번에 하나의 쓰기만 가능하다. 하지만 WAL(Write-Ahead Logging) 모드를 켜면 상황이 달라진다.

```sql
PRAGMA journal_mode=WAL;
PRAGMA busy_timeout=5000;
PRAGMA synchronous=NORMAL;
```

이 세 줄이면:

- 읽기와 쓰기가 동시에 가능하다
- 쓰기 충돌 시 5초까지 재시도한다
- 대부분의 웹 앱에 충분한 동시성을 확보한다

## PostgreSQL이 필요한 경우

물론 SQLite로 안 되는 것들도 있다.

1. 여러 서버에서 동시에 하나의 DB에 접근해야 할 때
2. `LISTEN/NOTIFY` 같은 실시간 기능이 필요할 때
3. 복잡한 전문 검색이 필요할 때 (SQLite FTS5도 있긴 하다)
4. JSON 쿼리가 핵심 기능일 때

반대로 말하면, 이 목록에 해당하지 않으면 SQLite를 써도 된다.

## 실제로 적용하기

Node.js에서 `better-sqlite3`가 가장 좋다. 동기 API라서 콜백 지옥이 없다.

```javascript
const db = require('better-sqlite3')('app.db');
db.pragma('journal_mode = WAL');

const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
```

배포도 간단하다. DB 파일 하나만 관리하면 된다. Docker 볼륨, 백업, 마이그레이션 전부 파일 복사로 해결된다.

> 데이터가 바로 옆에 있다는 건 생각보다 큰 장점이다.

## 결론

사이드 프로젝트의 90%는 SQLite로 충분하다. 나머지 10%도 시작은 SQLite로 하고, 정말 필요해지면 그때 마이그레이션해도 늦지 않다.

인프라에 시간을 쓰지 말고 제품에 시간을 쓰자.
