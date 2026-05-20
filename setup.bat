@echo off
rem ------------------------------------------------------------
rem Setup script for WhatsApp Baileys API (Windows)
rem ------------------------------------------------------------

rem 1. Install npm dependencies
npm install
if %errorlevel% neq 0 (
  echo Error installing dependencies. && exit /b %errorlevel%
)

rem 2. Create .env from example if not existing
if not exist .env (
  copy .env.example .env
  echo .env created from .env.example
) else (
  echo .env already exists, skipping copy
)

rem 3. Start development server (nodemon)
npm run dev
