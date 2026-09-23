ARG NODE_VERSION=24.21.0-alpine

# =========================================
# 1: 리액트 애플리케이션 빌드 스테이지
# =========================================

# 경량화된 Node.js 이미지를 빌드를 위해 사용
FROM node:${NODE_VERSION} AS builder
 
# 작업 디렉토리 설정
WORKDIR /app
 
# Docker 레이어 캐싱을 최적화하기 위해 먼저 종속성 매니페스트를 복사
COPY package.json package-lock.json ./
 
# 프로젝트 의존성 설치 (Docker BuildKit 캐시 마운트를 활용)
RUN --mount=type=cache,target=/root/.npm npm ci
 
# 나머지 소스코드를 컨테이너로 복사
COPY . .
 
# 리액트 앱 Build
RUN npm run build
 
# =========================================
# 2: 서빙용 정적 파일 스테이지
# =========================================

# 앱 실행을 위해 새로운 이미지를 시작
FROM node:${NODE_VERSION} AS runner
 
# Node.js가 프로덕션 모드로 실행되도록 한다
ENV NODE_ENV=production
 
# 작업 디렉토리 설정
WORKDIR /app
 
# 빌더 단계에서 생성된 프로덕션 파일만 복사
COPY --link --from=builder /app/dist ./dist
 
# 정적 빌드를 제공하는 데 필요한 패키지(고정 버전)만 설치(전역 설치나 개발 종속성은 설치X)
RUN --mount=type=cache,target=/root/.npm npm install serve@^14.2.6 --omit=dev
 
# 보안 강화를 위해 루트 권한을 낮춘다
USER node
 
# 컨테이너가 사용할 포트 명시
EXPOSE 3000
 
# 정적 빌드를 호스팅하는 프로세스를 시작
CMD ["npx", "serve", "-s", "dist", "-l", "3000"]
