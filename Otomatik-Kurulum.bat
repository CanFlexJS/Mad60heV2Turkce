@echo off
setlocal EnableDelayedExpansion
title Mad60 HE / FGG-HUB Turkce Yama Kurulumu
color 0B

echo =========================================================
echo       Mad60 HE / FGG-HUB Turkce Yama Otomatik Kurucu
echo       Gelistirici: Desh - Instagram: @desh.flow
echo =========================================================
echo.

:: 1. Yonetici Haklari Kontrolu
if "%1"=="elevated" goto skip_elevation
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [BILGI] Yonetici haklari isteniyor, lutfen onay verin...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/k \"\"%~f0\"\" elevated' -Verb RunAs"
    exit /b
)
:skip_elevation

cd /d "%~dp0"

:: 2. Calisan FGG-HUB uygulamasini kapat
echo [1/4] Arka planda calisan FGG-HUB kontrol ediliyor...
taskkill /F /T /IM "FGG-HUB.exe" >nul 2>&1
ping 127.0.0.1 -n 2 >nul

:: 3. FGG-HUB Kurulum Dizinini Tespit Et
echo [2/4] FGG-HUB kurulum dizini tespit ediliyor...
set "TARGET_DIR="
set "EXE_PATH="

if exist "C:\Program Files\FGG-HUB\FGG-HUB\resources\app.asar" (
    set "TARGET_DIR=C:\Program Files\FGG-HUB\FGG-HUB\resources"
    set "EXE_PATH=C:\Program Files\FGG-HUB\FGG-HUB\FGG-HUB.exe"
    goto dir_found
)
if exist "C:\Program Files\FGG-HUB\resources\app.asar" (
    set "TARGET_DIR=C:\Program Files\FGG-HUB\resources"
    set "EXE_PATH=C:\Program Files\FGG-HUB\FGG-HUB.exe"
    goto dir_found
)
if exist "%LOCALAPPDATA%\Programs\FGG-HUB\resources\app.asar" (
    set "TARGET_DIR=%LOCALAPPDATA%\Programs\FGG-HUB\resources"
    set "EXE_PATH=%LOCALAPPDATA%\Programs\FGG-HUB\FGG-HUB.exe"
    goto dir_found
)
if exist "%LOCALAPPDATA%\Programs\FGG-HUB\FGG-HUB\resources\app.asar" (
    set "TARGET_DIR=%LOCALAPPDATA%\Programs\FGG-HUB\FGG-HUB\resources"
    set "EXE_PATH=%LOCALAPPDATA%\Programs\FGG-HUB\FGG-HUB.exe"
    goto dir_found
)

:ask_path
echo.
echo [UYARI] FGG-HUB konumu otomatik bulunamadi.
echo Lutfen FGG-HUB klasorunu girin:
set /p "CUSTOM_DIR=> "
if not defined CUSTOM_DIR goto ask_path
set "CUSTOM_DIR=%CUSTOM_DIR:"=%"

if exist "%CUSTOM_DIR%\resources\app.asar" (
    set "TARGET_DIR=%CUSTOM_DIR%\resources"
    set "EXE_PATH=%CUSTOM_DIR%\FGG-HUB.exe"
    goto dir_found
)
if exist "%CUSTOM_DIR%\FGG-HUB\resources\app.asar" (
    set "TARGET_DIR=%CUSTOM_DIR%\FGG-HUB\resources"
    set "EXE_PATH=%CUSTOM_DIR%\FGG-HUB\FGG-HUB.exe"
    goto dir_found
)
if exist "%CUSTOM_DIR%\app.asar" (
    set "TARGET_DIR=%CUSTOM_DIR%"
    goto dir_found
)

echo.
echo [HATA] Girilen klasorde resources veya app.asar bulunamadi!
echo Lutfen tekrar deneyin.
goto ask_path

:dir_found
echo [BILGI] Kurulum hedefi: %TARGET_DIR%
echo.

:: 4. app.asar Dosyasi Kontrolu
set "SOURCE_ASAR=%~dp0app.asar"
if not exist "%SOURCE_ASAR%" if exist "%~dp0Mad60HE-Turkce-Yama\app.asar" set "SOURCE_ASAR=%~dp0Mad60HE-Turkce-Yama\app.asar"

if exist "%SOURCE_ASAR%" goto have_asar

echo [BILGI] app.asar bu klasorde bulunamadi.
echo [BILGI] Guncel Turkce yama GitHub uzerinden indiriliyor...
echo [BILGI] Lutfen bekleyin...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object Net.WebClient).DownloadFile('https://github.com/CanFlexJS/Mad60heV2Turkce/releases/download/v1.0.1/app.asar', '%~dp0app.asar')"

if exist "%~dp0app.asar" (
    set "SOURCE_ASAR=%~dp0app.asar"
    echo [BILGI] app.asar basariyla indirildi!
    echo.
    goto have_asar
)

color 0C
echo.
echo [HATA] Otomatik indirme basarisiz oldu!
echo Lutfen https://github.com/CanFlexJS/Mad60heV2Turkce/releases sayfasindan
echo app.asar dosyasini manuel indirip bu dosyanin yanina koyun.
echo.
pause
exit /b

:have_asar
:: 5. Orijinal Dosyanin Yedegini Al
echo [3/4] Orijinal dosya yedekleniyor...
if not exist "%TARGET_DIR%\app.asar.bak" (
    if exist "%TARGET_DIR%\app.asar" (
        copy /Y "%TARGET_DIR%\app.asar" "%TARGET_DIR%\app.asar.bak" >nul
        echo [BILGI] Orijinal dosya app.asar.bak olarak yedeklendi.
    )
) else (
    echo [BILGI] Mevcut yedek dosya korundu.
)

:: 6. Turkce Yamayi Kopyala
echo [4/4] Turkce yama kopyalaniyor...
copy /Y "%SOURCE_ASAR%" "%TARGET_DIR%\app.asar" >nul

if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [HATA] Kopyalama basarisiz oldu! FGG-HUB programini kapatip tekrar deneyin.
    pause
    exit /b
)

color 0A
echo.
echo =========================================================
echo       TEBRIKLER! Turkce Yama Basariyla Kuruldu!
echo       Gelistirici: Desh - Instagram: @desh.flow
echo =========================================================
echo.
echo Orijinal haline donmek isterseniz:
echo "%TARGET_DIR%\app.asar.bak" dosyasinin adini "app.asar" yapabilirsiniz.
echo.
set /p "RUN_APP=FGG-HUB uygulamasini simdi baslatmak ister misiniz? [E/H]: "
if /i "%RUN_APP%"=="E" (
    if exist "%EXE_PATH%" start "" "%EXE_PATH%"
)

echo.
echo Kurulum tamamlandi. Pencereyi kapatabilirsiniz.
pause
