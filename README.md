# 모바일 행사 초대장

준공식 · 기념식 · 행사용 모바일 초대장 웹앱입니다. **초대장 화면**과 **관리자 편집 사이트**가 하나의 프로젝트에 들어 있어요.

| 주소 | 용도 |
| --- | --- |
| `/` | 초대장 (로그인 없음, 기본 초대장) |
| `/invite/<주소>` | 다른 버전의 초대장 |
| `/admin` | 편집 사이트 (로그인 필요) |

화면 구성: **첫 화면**(배경 그림 + 브랜드 · 제목 · 부제) → **초대 글 카드**(INVITATION) → **행사 상세안내 + 오시는 길** 카드.

- 행사 상세안내 버튼(기본 4칸: 일시/장소 안내 · 식순 안내 · 좌석배치도 · 식사 안내)을 누르면 상세 페이지가 열려요. 오른쪽 위 집 버튼이나 휴대폰 뒤로 가기로 돌아와요.
- 버튼은 추가 · 삭제 · 순서 변경이 되고, 종류는 *일시/장소*, *시간표*, *사진 + 글* 중에서 골라요.
- 그림(첫 화면 배경, 좌석배치도, 메뉴 사진, 맨 아래 로고)과 글은 모두 편집 화면에서 바꿀 수 있어요.
- **주소만 입력하면** 네이버지도 · 카카오맵 · 티맵 길찾기 버튼이 자동으로 연결돼요 (지도 키 · 좌표 불필요). 휴대폰에서는 앱이 바로 열리고, 앱이 없으면 웹 지도(티맵은 설치 화면)로 넘어가요.
- 필요하면 사진 앨범 · 사진+글 · 자유 텍스트 페이지를 추가할 수 있어요.
- 기술: React 19 + TypeScript + Vite, Tailwind CSS v4, Framer Motion, Supabase (Postgres · Auth · Storage)

---

## 1. Supabase 준비 (약 10분)

1. [supabase.com](https://supabase.com)에서 **새 프로젝트**를 만듭니다. 리전은 `Northeast Asia (Seoul)`을 추천해요.
2. **SQL Editor**에서 `supabase/migrations/` 폴더의 SQL 파일을 **이름 순서대로** 실행합니다.
   - `20261117000000_init.sql`
   - `20261118000000_versions.sql`
3. **Authentication → Sign In / Providers → Email**: 가입 직후 바로 로그인하려면 *Confirm email*을 끄세요. 관리자 가입을 마치면 *Allow new users to sign up*을 꺼 두는 것을 권장해요.
4. **Authentication → URL Configuration**의 *Site URL*에 배포 주소를 넣습니다.
5. **Project Settings → API**에서 `Project URL`과 `Publishable key`(또는 `anon` key)를 복사합니다.

## 2. 배포 (Vercel)

1. 이 저장소를 Vercel에 **Import** 합니다 (프레임워크는 Vite로 자동 인식).
2. Environment Variables에 추가:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # 또는 anon key
   ```
3. 배포가 끝나면 `https://<도메인>/admin`에서 **관리자 계정 만들기** → 처음 가입한 계정이 관리자가 됩니다.
4. 함께 편집할 사람은 같은 방법으로 가입한 뒤, 먼저 가입한 사람이 **설정 → 관리자 추가**에서 이메일로 추가해요.

## 3. 편집하기

- 왼쪽: 페이지 목록 (드래그로 순서 변경, 숨기기 · 복제 · 삭제 · 추가)
- 가운데: 휴대폰 크기 미리보기 (버튼을 눌러 상세 페이지도 볼 수 있어요)
- 오른쪽: 선택한 페이지의 글 · 그림 · 스타일 편집. 맨 위 **기본 정보 · 전체 디자인**에서 행사 날짜 · 시간 · 색상 · 글꼴을 바꿔요.
- 자동저장되고, **게시하기**를 눌러야 초대장 링크에 반영돼요.
- **공유 · 배포**: 링크 복사, QR 코드, 카카오톡 공유, 링크 미리보기(제목 · 설명 · 대표 이미지)
- **버전**: 왼쪽 위 버전 이름 → 받는 분에 따라 내용이 다른 초대장을 주소별로 따로 만들 수 있어요.

서버 없이 모양만 보려면 `npm install && npm run dev` 후 `http://localhost:5173/`을 열면 기본 내용으로 보여요.

## 구조

```
src/invite/        초대장 화면 (첫 화면 · 초대 글 · 상세안내 카드 · 상세 페이지)
src/admin/         편집 사이트
src/lib/           콘텐츠 모델 · 기본값 · 지도 앱 연결(maps.ts) · API
supabase/          DB 스키마 · 보안 정책 · 스토리지
api/invite.js      카카오톡 링크 미리보기(OG)용 Vercel 함수
```
