#!/bin/bash

servicename="hotdeal_js"
containername="hotdeal_js_container"

if ! command -v docker &> /dev/null; then
    echo "Docker가 설치되어 있지 않습니다. Docker를 설치한 후 다시 시도해주세요."
    exit 1
fi

# docker-compose 확인 추가
if ! command -v docker-compose &> /dev/null; then
    echo "docker-compose가 설치되어 있지 않습니다. docker-compose를 설치한 후 다시 시도해주세요."
    exit 1
fi

if [ "$(docker ps -a -q -f name=$containername)" ]; then
    while true; do
        echo
        echo "1. 컨테이너 시작"
        echo "2. 컨테이너 종료"
        echo "3. 컨테이너 삭제"
        echo "4. 컨테이너 상태 확인"
        echo "5. 쉘 종료"
        read -p "원하는 작업 번호를 선택해주세요: " choice

        case $choice in
        1)
            docker compose start $containername
            echo "컨테이너가 시작되었습니다."
            ;;
        2)
            docker compose stop $containername
            echo "컨테이너가 종료되었습니다."
            ;;
        3)
            docker compose down --rmi all
            echo "컨테이너와 이미지가 삭제되었습니다."
            break
            ;;
        4)
            docker ps
            read -n 1 -s -r -p "아무 키나 눌러 진행하세요."
            ;;
        5)
            break
            ;;
        *)
            echo "올바른 번호를 선택해주세요."
            ;;
        esac
    done
    exit 0
elif [ -f /etc/systemd/system/$servicename.service ]; then
    while true; do
        echo
        echo "1. 서비스 시작"
        echo "2. 서비스 중지"
        echo "3. 서비스 삭제"
        echo "4. 서비스 상태 확인"
        echo "5. 로그 출력 (파일로)"
        echo "6. 종료"
        read -p "원하는 작업 번호를 선택해주세요: " choice

        case $choice in
        1)
            sudo systemctl start $servicename.service
            echo "$servicename.service 서비스가 시작되었습니다."
            ;;
        2)
            sudo systemctl stop $servicename.service
            echo "$servicename.service 서비스가 중지되었습니다."
            ;;
        3)
            sudo systemctl stop $servicename.service
            sudo systemctl disable $servicename.service
            sudo rm /etc/systemd/system/$servicename.service
            sudo systemctl daemon-reload
            sudo systemctl reset-failed
            echo "$servicename.service 서비스가 삭제되었습니다."
            exit
            ;;
        4)
            sudo systemctl status $servicename.service
            read -n 1 -s -r -p "아무 키나 눌러 진행하세요."
            ;;
        5)
            log_filename="${servicename}_log.txt"
            sudo journalctl -u ${servicename}.service > $log_filename
            echo "로그가 ${log_filename} 파일에 저장되었습니다."
            read -n 1 -s -r -p "아무 키나 눌러 진행하세요."
            ;;
        6)
            break
            ;;
        *)
            echo "올바른 번호를 선택해주세요."
            ;;
        esac
    done
    exit 0
else
    echo "설치 방법을 선택해주세요:"
    echo "1. Docker로 실행"
    echo "2. 서버에 직접 설치"
    read -p "선택 (1 또는 2): " install_choice

    if [ "$install_choice" == "1" ]; then
        echo "Docker로 실행을 선택하셨습니다."
        # Docker 관련 명령어 추가
        if ! command -v docker &> /dev/null; then
            echo "Docker가 설치되어 있지 않습니다. Docker를 설치한 후 다시 시도해주세요."
            exit 1
        fi
        echo "Docker 설치 확인!"
        docker compose up -d --build
        exit 0
    elif [ "$install_choice" == "2" ]; then
        echo "서버에 직접 설치를 선택하셨습니다."
        # 기존 코드 계속 실행
        if [ ! -f /etc/systemd/system/$servicename.service ]; then
            echo "sqlite3 설치 확인중..."
            if ! command -v sqlite3 &> /dev/null; then
                echo "sqlite3가 설치되어 있지 않습니다. sqlite3를 설치한 후 다시 시도해주세요."
                exit 1
            fi
            echo "sqlite3 설치 확인!"

            echo "node.js 설치 확인중..."
            if ! command -v node &> /dev/null; then
                echo "node.js가 설치되어 있지 않습니다. node.js를 설치한 후 다시 시도해주세요."
                exit 1
            fi
            echo "node.js 설치 확인!"

            echo "npm 설치 확인중..."
            if ! command -v npm &> /dev/null; then
                echo "npm이 설치되어 있지 않습니다. npm을 설치한 후 다시 시도해주세요."
                exit 1
            fi
            echo "npm 설치 확인!"

            echo "필수 패키지 설치 확인중..."
            current_directory=$(pwd)
            required_packages=("axios@1.7.2" "cheerio@1.0.0-rc.12" "discord.js@14.15.3" "sqlite3@5.1.7")
            for package in "${required_packages[@]}"; do
                package_name=$(echo $package | cut -d'@' -f1)
                if ! npm list "$package_name" --depth=0 &> /dev/null; then
                    echo "$package가 설치되어 있지 않습니다. 설치를 진행합니다."
                    npm install "$package" --prefix "$current_directory"
                else
                    echo "$package가 이미 설치되어 있습니다."
                fi
            done
            echo "필수 패키지 설치 확인 완료!"

            username=$(whoami)
            groupname=$(id -gn $username)
            node_path=$(which node)
            echo "[Unit]
            Description=HotDeal Service

            [Service]
            WorkingDirectory=$current_directory
            ExecStart=$node_path $current_directory/main.js
            Restart=always
            User=$username
            Group=$groupname

            [Install]
            WantedBy=multi-user.target" | sudo tee /etc/systemd/system/$servicename.service > /dev/null

            sudo systemctl enable $servicename.service
            echo "$servicename.service가 정상적으로 생성되었습니다."
        fi
    else
        echo "잘못된 선택입니다. 1 또는 2를 선택해주세요."
        exit 1
    fi
fi