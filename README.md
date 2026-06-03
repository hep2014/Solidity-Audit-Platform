
## Требования для запуска

Для полного запуска проекта необходимы:
- Docker
- Docker Compose;
- доступ к /var/run/docker.sock, так как backend-worker запускает контейнеры через Docker
- свободные порты (8000 для backend API, 5173 для frontend)
- достаточный объем памяти для контейнеров. Рекомендуется не менее 6–8 ГБ свободной RAM, особенно при запуске Mythril и Echidna.

В docker-compose.yml для backend-api и backend-worker должен быть указан корректный абсолютный путь к локальному storage на хосте:
```
DOCKER_HOST_STORAGE_DIR: /home/hep2014/PycharmProjects/solidity/backend/storage
DOCKER_CONTAINER_STORAGE_DIR: /app/storage
```
Значение ```DOCKER_HOST_STORAGE_DIR``` необходимо заменить на путь, соответствующий локальному расположению проекта.

## Полный запуск проекта

Сначала необходимо собрать образы:
```
docker compose --profile analyzers build --no-cache slither-analyzer foundry-analyzer mythril-analyzer echidna-analyzer
```
После этого можно собрать и запустить основные сервисы:
```
docker compose build --no-cache backend-api backend-worker
docker compose up -d
```
После запуска будут доступны:
```
Frontend: http://localhost:5173
Backend API: http://localhost:8000
Swagger/OpenAPI: http://localhost:8000/docs
```
Для проверки состояния backend можно открыть:
```
http://localhost:8000/health/live
http://localhost:8000/health/ready
```

## Запуск с выводом логов в терминал

Для запуска всех основных сервисов с выводом логов:
```
docker compose up
```
Для фонового запуска:
```
docker compose up -d
```

## Просмотр логов через Docker Compose

Посмотреть логи всех сервисов:
```
docker compose logs -f
```
Посмотреть логи backend API:
```
docker compose logs -f backend-api
```
Посмотреть логи Celery worker:
```
docker compose logs -f backend-worker
```
Посмотреть логи frontend:
```
docker compose logs -f frontend
```
Посмотреть логи PostgreSQL:
```
docker compose logs -f postgres
```
Посмотреть логи Redis:
```
docker compose logs -f redis
```

## Остановка проекта

Остановить контейнеры:
```
docker compose down
```
Остановить контейнеры и удалить volumes базы данных и Redis:
```
docker compose down -v
```

## Документация проекта

Whitepaper проекта находится в файле:
```
docs/whitepaper.pdf
```

Презентация проекта находится в файле:
```
docs/solution.pdf
```

docs/whitepaper.pdf

Презентация проекта находится в файле:

docs/solution.pdf
