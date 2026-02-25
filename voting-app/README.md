# 🍽️ vote-eat | 메뉴 수합(아아 하나 추가요!)

> 점심 메뉴, 링크 하나로 실시간 수합!  
> 메뉴판 사진 공유, 가격 계산, 주문 요약 복사까지.

🔗 **서비스 링크**: [https://vote-eat.web.app](https://vote-eat.web.app)

---

## 📌 프로젝트 소개

회사나 모임에서 점심 메뉴를 정할 때, "뭐 먹을래?" 질문에 카톡이 도배되는 경험 있으시죠?

**vote-eat**은 링크 하나로 메뉴를 수합하는 실시간 투표 서비스입니다.
- 투표방을 만들고 링크를 공유하면, 누구나 접속해서 메뉴를 고를 수 있어요.
- 투표 현황이 실시간으로 모든 사용자에게 동기화됩니다.

---

## ✨ 주요 기능

| 기능 | 설명 |
|---|---|
| 🗳️ **실시간 투표** | 이름과 메뉴를 입력하면 즉시 모든 사용자에게 반영 |
| ➕ **빠른 참여** | 이미 있는 메뉴에 "+참여" 버튼으로 바로 합류 |
| 📸 **메뉴 사진 공유** | 메뉴판 사진을 업로드하면 캐러셀로 같이 보기 |
| 💰 **가격 계산** | 메뉴별 가격 입력 → 항목별 소계 + 총 예상 금액 자동 계산 |
| 📋 **주문 복사** | 메뉴만 or 사람 포함, 두 가지 형식으로 클립보드 복사 |
| 📤 **공유 팝업** | 링크 복사 + QR 코드 + 네이티브 공유(카카오톡, AirDrop 등) |
| 🏠 **투표방 관리** | 방 생성/삭제, 내 투표방 목록 (localStorage 기반) |
| ⏰ **24시간 자동 만료** | 미사용 방은 24시간 후 자동 삭제 |
| 🔒 **보안** | Firestore 규칙 + 클라이언트 쿨다운으로 악의적 트래픽 방어 |
| 🌙 **다크모드** | 시스템 설정 자동 감지 + 수동 토글 |
| 💬 **사용자 피드백** | 의견 보내기 (버그/기능 제안/기타) → 관리자 페이지에서 조회·삭제 |
| ⚙️ **관리자 페이지** | 전체 서비스 / 사진 업로드 on·off 원격 제어 + 피드백 관리 |
| 📱 **PWA 지원** | 모바일 홈화면에 추가하면 앱처럼 사용 가능 |

---

## 🛠️ 기술 스택

| 분류 | 기술 |
|---|---|
| Frontend | React 19, React Router DOM, qrcode.react |
| Backend | Firebase Firestore (실시간 DB), Firebase Storage (이미지) |
| Hosting | Firebase Hosting |
| SEO | sitemap.xml, robots.txt, OG/Twitter 메타 태그 |
| 보안 | Firestore Security Rules, 클라이언트 쿨다운 |

---

## 🚀 설치 & 실행

### 1. 클론

```bash
git clone https://github.com/zerocola355ml/menu_collector.git
cd menu_collector/voting-app
```

### 2. 의존성 설치

```bash
npm install
```

### 3. 환경 변수 설정

프로젝트 루트(`voting-app/`)에 `.env` 파일을 생성하고 Firebase 설정값을 입력하세요.

```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
REACT_APP_ADMIN_KEY=your_admin_key
```

### 4. 로컬 실행

```bash
npm start
```

→ [http://localhost:3000](http://localhost:3000) 에서 확인

### 5. 빌드 & 배포

```bash
npm run build
firebase deploy --only hosting
```

---

## 📁 프로젝트 구조

```
menu_collector/
└── voting-app/
    ├── firebase.json          ← Firebase Hosting + Firestore Rules 설정
    ├── firestore.rules        ← Firestore 보안 규칙
    ├── .firebaserc            ← Firebase 프로젝트/타겟 매핑
    ├── package.json           ← 의존성 관리
    ├── public/
    │   ├── index.html         ← HTML 엔트리포인트 (OG태그, SEO 메타)
    │   ├── sitemap.xml        ← 검색엔진용 사이트맵
    │   ├── robots.txt         ← 크롤러 규칙
    │   └── manifest.json      ← PWA 설정
    └── src/
        ├── index.js           ← React Router 설정 & DOM 렌더링
        ├── firebase.js        ← Firebase 초기화 (환경 변수에서 로드)
        ├── roomStorage.js     ← localStorage 방 목록 관리
        ├── themeUtils.js      ← 다크모드 테마 관리 유틸리티
        ├── HomePage.js/css    ← 랜딩 페이지 (방 생성 + 내 투표방 목록)
        ├── App.js/css         ← 투표 페이지 (핵심 로직 전체)
        ├── AdminPage.js/css   ← 관리자 페이지 (서비스/업로드 on·off)
        └── index.css          ← 글로벌 CSS + 다크모드 변수
```

---

## 📝 개발 로그

| 날짜 | 내용 |
|---|---|
| 2026-02-13 | 🎉 프로젝트 초기 생성 — React + Firebase(Firestore) 기반 실시간 투표 앱 |
| 2026-02-13 | 📸 Firebase Storage 연동 — 이미지 업로드 + 캐러셀 + 실시간 동기화 |
| 2026-02-13 | 🖼️ 이미지 전체화면 모달 + 개별 삭제 기능 |
| 2026-02-13 | 🗑️ 투표 항목/투표자 삭제 기능 (0명 시 자동 삭제) |
| 2026-02-13 | ➕ 빠른 참여 ("+ 참여" 버튼) 기능 |
| 2026-02-13 | ↻ 전체 초기화(리셋) 버튼 |
| 2026-02-13 | 💰 메뉴 가격 입력 & 총 금액 계산 기능 |
| 2026-02-13 | 🏠 그룹(방) 기능 — react-router-dom 도입, 서브컬렉션 구조 전환 |
| 2026-02-22 | 📷 이미지 자동 압축 — Canvas API (최대 1920px, JPEG 70%) |
| 2026-02-22 | 🌐 공개 서비스 모드 — 투표방 생성/공유/관리 UI 리뉴얼 |
| 2026-02-22 | ⏰ 24시간 자동 만료 — 미사용 방 자동 삭제 + 만료 시간 안내 |
| 2026-02-22 | 📱 PWA & OG 태그 — 홈화면 추가, 카카오톡 미리보기 |
| 2026-02-22 | 📋 주문 요약 복사 — 메뉴만/사람 포함 두 가지 형식 |
| 2026-02-23 | 🔍 SEO 최적화 — sitemap, robots.txt, Google/네이버 등록 |
| 2026-02-23 | 🔒 보안 강화 — Firestore 규칙 + 클라이언트 쿨다운 |
| 2026-02-23 | 🔑 GitHub 연동 — API 키 .env 분리, 초기 커밋 |
| 2026-02-23 | 🌙 다크모드 — 시스템 설정 자동 감지 + 수동 토글, 전체 UI 대응 |
| 2026-02-23 | 📱 반응형 UI 개선 — 480px/360px 브레이크포인트 보강 |
| 2026-02-25 | 📤 공유 팝업 — 링크 복사 + QR 코드 + 네이티브 공유 (Web Share API) |
| 2026-02-25 | ⚙️ 관리자 페이지 — 전체 서비스 / 사진 업로드 on·off 원격 제어 |
| 2026-02-25 | 💬 사용자 피드백 — 투표·홈 페이지에서 의견 전송, 관리자 페이지에서 조회·삭제 |

---

## 📄 라이선스

MIT License
