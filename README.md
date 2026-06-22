# SayPharma Admin

  Панель управления аптекой **SayPharma** — голосового сервиса заказа лекарств.

  ## Возможности

  - Координаты аптеки (широта и долгота)
  - Радиус доставки в километрах
  - Ограничение запросов с одного IP в сутки
  - Автоматическое создание таблицы в Supabase при первом входе
  - PWA: работает офлайн, устанавливается на главный экран телефона

  ## Первый запуск

  1. Открой приложение
  2. Введи ключи Supabase (Dashboard → Project Settings → API):
     - `SUPABASE_URL`
     - `SUPABASE_ANON_KEY`
     - `SUPABASE_SERVICE_ROLE_KEY`
  3. Нажми «Подключить и настроить» — таблица создастся автоматически

  ## Деплой на Vercel

  [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/sarvadigital2023-cmyk/saypharma-admin)

  ```bash
  npm install && npm run build
  ```

  ## Стек

  React 18 · TypeScript · Vite · Tailwind CSS v4 · Supabase · PWA
  