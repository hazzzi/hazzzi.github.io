---
title: Oracle Cloud 무료 티어로 서버 굴리기
date: 2026-02-20
description: 평생 무료 VM에서 사이드 프로젝트 돌리는 법
---

## Oracle Cloud Free Tier

AWS, GCP 프리 티어는 1년이면 끝나지만 Oracle Cloud는 **Always Free** 티어가 있다.

무료로 받을 수 있는 것들:

- ARM 기반 VM (최대 4 OCPU, 24GB RAM)
- 200GB 블록 스토리지
- 10TB 아웃바운드 트래픽

이 정도면 사이드 프로젝트 서버로 충분하다.

## 세팅 과정

### 1. 계정 생성

카드 등록이 필요하지만 과금되지 않는다. 리전은 `서울`을 선택했다.

### 2. VM 인스턴스 생성

```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "oracle-cloud"
```

Shape은 `VM.Standard.A1.Flex`를 선택한다. ARM 인스턴스가 무료 할당량이 넉넉하다.

> 인기가 많아서 "Out of capacity" 에러가 자주 뜬다. 새벽에 시도하면 잘 된다.

### 3. 서버 설정

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose
sudo usermod -aG docker $USER
```

### 4. 방화벽 설정

Oracle Cloud는 **두 곳**에서 방화벽을 열어야 한다:

1. VCN Security List (웹 콘솔)
2. OS 레벨 iptables

```bash
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

이걸 몰라서 한 시간을 날렸다.

## 돌리고 있는 것들

- **Nginx** — 리버스 프록시
- **n8n** — 워크플로우 자동화
- **Uptime Kuma** — 모니터링

전부 Docker Compose로 관리한다. 무료 서버치고는 너무 좋다.
