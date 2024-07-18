# 베이스 이미지 설정 (slim 버전)
FROM node:20.11.0-slim

# 작업 디렉토리 설정
WORKDIR /app

# 패키지 파일 복사
COPY package*.json ./

# npm 패키지 설치
RUN npm install

# sqlite3 설치
RUN apt-get update && apt-get install -y sqlite3

# 나머지 파일 복사
COPY . .

# 애플리케이션 시작
CMD ["npm", "start"]