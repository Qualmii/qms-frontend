# QMS Frontend - Quick Start Guide

## 🎯 Быстрый старт за 5 минут

### Шаг 1: Подготовка (1 минута)

```bash
# Убедиться, что Node.js версия 20.19+
node --version

# Если нет, установить через nvm
# curl https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
# nvm install 20.19.0
# nvm use 20.19.0
```

### Шаг 2: Установка зависимостей (2 минуты)

```bash
cd /Users/andrei/projects/qms-frontend

# Установить npm зависимости
npm install --legacy-peer-deps
```

### Шаг 3: Конфигурация (1 минута)

```bash
# Создать файл .env.local
cat > .env.local << EOF
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=http://localhost:8000
NODE_ENV=development
EOF
```

### Шаг 4: Запуск (1 минута)

```bash
# Убедиться, что API работает на порту 8000
curl http://localhost:8000/api/v1/status

# Запустить frontend
npm run dev

# Открыть http://localhost:5173
```

**Готово! 🎉**

---

## 🐳 Docker Quick Start

### Один контейнер (если API уже работает)

```bash
docker-compose up
# http://localhost:3000
```

### Оба контейнера (рекомендуется)

```bash
# Из папки QMS-api
cd ../QMS-api
docker-compose up -d

# Из папки qms-frontend
cd ../qms-frontend
docker-compose up -d

# Проверить статус
docker-compose ps
```

---

## 🧪 Тестирование функций

### 1. Аутентификация

```
1. Откройте http://localhost:5173
2. Нажмите "Sign up"
3. Заполните форму регистрации
4. На email придет код подтверждения
5. Введите код и готово!
```

### 2. Чаты

```
1. На главной странице нажмите кнопку "+"
2. Поищите пользователя
3. Выберите и создайте чат
4. Отправьте сообщение
```

### 3. Звонки

```
1. Откройте чат
2. Нажмите иконку телефона (аудио) или видеокамеры (видео)
3. Получите доступ к микрофону/камере
4. Звонок начнется
```

### 4. Профиль

```
1. Нажмите иконку шестеренки в заголовке
2. Откроется страница настроек
3. Отредактируйте username
4. Установите статус
5. Выберите язык
```

---

## 📁 Основные файлы проекта

| Файл | Описание |
|------|---------|
| `src/App.vue` | Корневой компонент |
| `src/components/` | UI компоненты |
| `src/stores/` | Pinia хранилища (состояние) |
| `src/services/` | API, WebSocket, WebRTC |
| `src/views/` | Страницы приложения |
| `package.json` | Зависимости проекта |
| `vite.config.ts` | Конфигурация Vite |
| `.env.example` | Пример переменных окружения |

---

## 🔧 Полезные команды

```bash
# Разработка
npm run dev          # Запуск dev сервера
npm run build        # Production build

# Проверка качества
npm run type-check   # Проверка TypeScript
npm run lint         # Проверка кода

# Форматирование
npm run format       # Автоматическое форматирование
```

---

## 🐛 Типичные проблемы

### "Cannot find module 'vue'"
```bash
npm install --legacy-peer-deps
```

### "Port 5173 already in use"
```bash
npm run dev -- --port 5174
```

### "API is not responding"
```bash
# Убедиться, что API запущен
curl http://localhost:8000/api/v1/status
```

### "WebSocket connection failed"
```bash
# Проверить VITE_WS_URL в .env.local
cat .env.local | grep VITE_WS_URL
```

---

## 📚 Где найти информацию

- **Полная документация:** `README.md`
- **Список функций:** `FEATURES.md`
- **Docker инструкции:** `DOCKER_SETUP.md`
- **Этот гайд:** `QUICK_START.md`

---

## 🚀 Развертывание

### Build для production

```bash
npm run build
# Файлы в папке dist/
```

### Запуск на сервере

```bash
# Скопировать dist/ на веб-сервер
scp -r dist/ user@server:/var/www/qms-frontend

# Или использовать Docker
docker build -t qms-frontend .
docker run -p 3000:80 qms-frontend
```

---

## 💡 Советы

1. **Используйте Vue DevTools** для отладки состояния
2. **Откройте Network tab** в DevTools для мониторинга API
3. **Проверяйте Console** на наличие ошибок
4. **Обновите страницу** (Ctrl+R) если что-то не работает

---

## 📞 Нужна помощь?

1. Проверьте файлы документации
2. Посмотрите на консоль браузера (F12)
3. Проверьте Network tab
4. Убедитесь, что API работает
5. Пересоберите проект

**Happy coding! 🎉**

