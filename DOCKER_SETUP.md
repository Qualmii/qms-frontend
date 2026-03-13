# Docker Setup для QMS Frontend и API

Этот документ описывает, как правильно настроить Docker окружение для совместного запуска Frontend и API сервера.

## 🐳 Архитектура Docker

```
┌─────────────────────────────┐
│   Docker Network: qms-net   │
├─────────────────────────────┤
│                             │
│  ┌──────────────────────┐   │
│  │  qms-frontend        │   │
│  │  (Vue 3 Vite)        │   │
│  │  Port: 3000          │   │
│  │  http://qms-frontend │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │  qms-api             │   │
│  │  (Laravel)           │   │
│  │  Port: 8000          │   │
│  │  http://qms-api      │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │  Database (Optional) │   │
│  │  MySQL/PostgreSQL    │   │
│  │  Port: 3306/5432     │   │
│  └──────────────────────┘   │
│                             │
└─────────────────────────────┘

        ↓ Port Mapping
  Host Machine (localhost)
```

## 🚀 Быстрый старт

### 1. Структура проектов

Убедитесь, что оба проекта находятся в одной папке:

```
/Users/andrei/projects/
├── qms-frontend/           # Этот проект
│   ├── docker-compose.yml
│   ├── Dockerfile
│   └── ...
└── QMS-api/                # API сервер
    ├── docker-compose.yml
    ├── Dockerfile
    └── ...
```

### 2. Подготовка API сервера

Убедитесь, что ваш QMS-api/docker-compose.yml использует сеть `qms-network`:

```yaml
services:
  qms-api:
    # ... configuration ...
    networks:
      - qms-network

  # Database (если используется)
  mysql:
    # ... configuration ...
    networks:
      - qms-network

networks:
  qms-network:
    driver: bridge
```

### 3. Запуск Frontend с API

#### Вариант A: Если API уже запущен локально

```bash
cd /Users/andrei/projects/qms-frontend

# Используйте localhost
export VITE_API_URL=http://localhost:8000/api/v1
export VITE_WS_URL=http://localhost:8000

# Запустите только frontend в Docker
docker-compose up
```

#### Вариант B: Запуск обоих в Docker (рекомендуется)

1. Убедитесь, что оба проекта используют одну сеть

2. В qms-frontend/docker-compose.yml используйте имена сервисов:

```yaml
environment:
  - VITE_API_URL=http://qms-api:8000/api/v1
  - VITE_WS_URL=http://qms-api:8000
```

3. Запустите оба контейнера:

```bash
# Из папки qms-api
cd /Users/andrei/projects/QMS-api
docker-compose up -d

# Из папки qms-frontend
cd /Users/andrei/projects/qms-frontend
docker-compose up -d
```

4. Проверьте статус:

```bash
docker-compose ps
docker network ls
docker network inspect qms-network
```

## 🔧 Переменные окружения

### Development (localhost)

Когда оба сервиса работают на одной машине:

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=http://localhost:8000
```

### Docker Network

Когда оба сервиса в Docker:

```env
VITE_API_URL=http://qms-api:8000/api/v1
VITE_WS_URL=http://qms-api:8000
```

### Production

```env
VITE_API_URL=https://api.yourdomain.com/api/v1
VITE_WS_URL=wss://api.yourdomain.com
```

## 🐛 Troubleshooting

### Frontend не может подключиться к API

**Проблема:** `Failed to connect to API`

**Решение:**

1. Проверьте, запущен ли API сервер:
```bash
docker-compose ps
curl http://localhost:8000/api/v1/status
```

2. Проверьте сетевое подключение:
```bash
docker network inspect qms-network
docker exec qms-frontend ping qms-api
```

3. Проверьте переменные окружения:
```bash
docker-compose exec qms-frontend env | grep VITE
```

### WebSocket не подключается

**Проблема:** `WebSocket connection failed`

**Решение:**

1. Убедитесь, что `VITE_WS_URL` указывает на тот же хост, что и `VITE_API_URL`

2. Проверьте, что API поддерживает WebSocket:
```bash
docker logs qms-api | grep -i websocket
```

3. Проверьте правила firewall для WebSocket портов

### CORS ошибки

**Проблема:** `Cross-Origin Request Blocked`

**Решение:**

Убедитесь, что API сервер имеет правильные CORS заголовки:

```php
// В Laravel .env или config/cors.php
FRONTEND_URL=http://localhost:3000

// В config/cors.php
'allowed_origins' => ['localhost:3000', 'qms-frontend'],
'allowed_methods' => ['*'],
'allowed_headers' => ['*'],
```

### Порты уже в использовании

**Проблема:** `Port 3000 is already allocated`

**Решение:**

Измените порт в docker-compose.yml:

```yaml
ports:
  - "3001:80"  # Используйте другой порт на хосте
```

Или остановите другой сервис:

```bash
docker-compose down
lsof -i :3000
kill -9 <PID>
```

## 📊 Мониторинг и Логи

### Просмотр логов Frontend

```bash
docker-compose logs -f qms-frontend

# С фильтром
docker-compose logs -f qms-frontend | grep ERROR
```

### Проверка здоровья контейнера

```bash
docker-compose ps
docker inspect qms-frontend
```

### Подключение к контейнеру

```bash
docker-compose exec qms-frontend sh
npm run dev  # Перезапуск dev сервера
```

## 🔐 Безопасность

### Development

- API доступен на localhost:8000
- Frontend доступен на localhost:3000
- CORS включен для локального развития
- WebSocket работает без шифрования

### Production

1. Используйте HTTPS:
```env
VITE_API_URL=https://api.yourdomain.com/api/v1
VITE_WS_URL=wss://api.yourdomain.com
```

2. Используйте reverse proxy (nginx):

```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    location / {
        proxy_pass http://qms-frontend:80;
    }

    location /api/ {
        proxy_pass http://qms-api:8000;
    }

    location /socket.io/ {
        proxy_pass http://qms-api:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

3. Установите SSL сертификаты через Let's Encrypt

## 🔄 CI/CD Pipeline (GitHub Actions)

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t qms-frontend:latest .
      
      - name: Push to registry
        run: docker push qms-frontend:latest
      
      - name: Deploy
        run: docker-compose up -d
```

## 📝 Дополнительные ресурсы

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Guide](https://docs.docker.com/compose/)
- [Vue.js Docker Guide](https://v3.vuejs.org/guide/deployment.html)
- [Laravel Docker Setup](https://laravel.com/docs/10.x/deployment)

## 📞 Поддержка

Если у вас возникли проблемы:

1. Проверьте все логи
2. Убедитесь в правильности конфигурации
3. Проверьте статус сервисов
4. Скомпилируйте образы заново: `docker-compose build --no-cache`

