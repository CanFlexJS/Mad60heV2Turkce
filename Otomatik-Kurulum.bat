@echo off
setlocal EnableDelayedExpansion
title Mad60 HE / FGG-HUB Turkce Yama Kurulumu
color 0B

echo =========================================================
echo       Mad60 HE / FGG-HUB Turkce Yama Otomatik Kurucu
echo       Gelistirici: Desh (@desh.flow)
echo =========================================================
echo.

:: 1. Yonetici Haklari Kontrolu ve Yukseltme
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [BILGI] Yonetici haklari isteniyor, lutfen onay verin...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:: Calisma dizinini bat dosyasinin oldugu yere ayarla
cd /d "%~dp0"

:: 2. Calisan FGG-HUB uygulamasini kapat
echo [1/4] Arka planda calisan FGG-HUB kontrol ediliyor...
taskkill /F /T /IM "FGG-HUB.exe" >nul 2>&1
timeout /t 2 >nul

:: 3. FGG-HUB Kurulum Dizinini Tespit Et
echo [2/4] FGG-HUB kurulum dizini tespit ediliyor...
set "TARGET_DIR="
set "EXE_PATH="

if exist "C:\Program Files\FGG-HUB\FGG-HUB\resources" (
    set "TARGET_DIR=C:\Program Files\FGG-HUB\FGG-HUB\resources"
    set "EXE_PATH=C:\Program Files\FGG-HUB\FGG-HUB\FGG-HUB.exe"
) else if exist "C:\Program Files\FGG-HUB\resources" (
    set "TARGET_DIR=C:\Program Files\FGG-HUB\resources"
    set "EXE_PATH=C:\Program Files\FGG-HUB\FGG-HUB.exe"
) else if exist "%LOCALAPPDATA%\Programs\FGG-HUB\resources" (
    set "TARGET_DIR=%LOCALAPPDATA%\Programs\FGG-HUB\resources"
    set "EXE_PATH=%LOCALAPPDATA%\Programs\FGG-HUB\FGG-HUB.exe"
) else if exist "%LOCALAPPDATA%\Programs\FGG-HUB\FGG-HUB\resources" (
    set "TARGET_DIR=%LOCALAPPDATA%\Programs\FGG-HUB\FGG-HUB\resources"
    set "EXE_PATH=%LOCALAPPDATA%\Programs\FGG-HUB\FGG-HUB\FGG-HUB.exe"
) else if exist "C:\Program Files (x86)\FGG-HUB\resources" (
    set "TARGET_DIR=C:\Program Files (x86)\FGG-HUB\resources"
    set "EXE_PATH=C:\Program Files (x86)\FGG-HUB\FGG-HUB.exe"
)

:: Eger otomatik bulunamazsa kullaniciya sor
if "%TARGET_DIR%"=="" (
    color 0E
    echo [UYARI] FGG-HUB varsayilan dizinlerde bulunamadi.
    echo Lutfen FGG-HUB'in kurulu oldugu ana klasoru girin:
    echo (Ornek: D:\Oyunlar\FGG-HUB)
    set /p "CUSTOM_DIR=> "
    if exist "!CUSTOM_DIR!\resources" (
        set "TARGET_DIR=!CUSTOM_DIR!\resources"
        set "EXE_PATH=!CUSTOM_DIR!\FGG-HUB.exe"
    ) else if exist "!CUSTOM_DIR!\FGG-HUB\resources" (
        set "TARGET_DIR=!CUSTOM_DIR!\FGG-HUB\resources"
        set "EXE_PATH=!CUSTOM_DIR!\FGG-HUB\FGG-HUB.exe"
    ) else (
        color 0C
        echo [HATA] Girilen dizinde resources klasoru bulunamadi!
        pause
        exit /b
    )
)

echo [BILGI] Kurulum hedefi: %TARGET_DIR%
echo.

:: 4. app.asar Dosyasi Kontrolu (Yoksa Otomatik Indir)
set "SOURCE_ASAR=%~dp0app.asar"

if not exist "!SOURCE_ASAR!" (
    color 0E
    echo [BILGI] app.asar bu klasorde bulunamadi.
    echo [BILGI] Guncel Turkce yama GitHub uzerinden otomatik olarak indiriliyor...
    echo [BILGI] Lutfen bekleyin (Boyut: ~212 MB, baglanti hiziniza gore 10-30 sn surebilir)...
    echo.
    powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $wc = New-Object Net.WebClient; $wc.DownloadFile('https://github.com/CanFlexJS/Mad60heV2Turkce/releases/download/v1.0.1/app.asar', '!SOURCE_ASAR!')"
    
    if not exist "!SOURCE_ASAR!" (
        color 0C
        echo [HATA] Otomatik indirme basarisiz oldu!
        echo Lutfen GitHub Releases sayfasindan app.asar dosyasini manuel olarak indirin:
        echo https://github.com/CanFlexJS/Mad60heV2Turkce/releases
        pause
        exit /b
    )
    echo [BILGI] app.asar basariyla indirildi!
    echo.
)

:: 5. Orijinal dosyanin yedegini al
echo [3/4] Orijinal dosya yedekleniyor...
if exist "%TARGET_DIR%\app.asar" (
    if not exist "%TARGET_DIR%\app.asar.bak" (
        copy /Y "%TARGET_DIR%\app.asar" "%TARGET_DIR%\app.asar.bak" >nul
        echo [BILGI] Orijinal dosya app.asar.bak olarak yedeklendi.
    ) else (
        echo [BILGI] Daha once alinmis yedek bulundu, korundu.
    )
)

:: 6. Turkce yamayi kopyala
echo [4/4] Turkce yama (Desh) kopyalaniyor...
copy /Y "!SOURCE_ASAR!" "%TARGET_DIR%\app.asar" >nul

if %errorLevel% equ 0 (
    color 0A
    echo.
    echo =========================================================
    echo       TEBRIKLER! Turkce Yama Basariyla Kuruldu!
    echo       Gelistirici: Desh (Instagram: @desh.flow)
    echo =========================================================
    echo.
    echo Orijinal haline donmek isterseniz:
    echo "%TARGET_DIR%\app.asar.bak" dosyasinin adini "app.asar" yapabilirsiniz.
    echo.
    set /p "RUN_APP=FGG-HUB uygulamasini simdi baslatmak ister misiniz? (E/H): "
    if /i "!RUN_APP!"=="E" (
        if exist "!EXE_PATH!" (
            start "" "!EXE_PATH!"
        )
    )
) else (
    color 0C
    echo.
    echo [HATA] app.asar dosyasi kopyalanirken bir sorun olustu!
    echo Lutfen FGG-HUB'in kapali oldugundan emin olun.
)

echo.
pause
