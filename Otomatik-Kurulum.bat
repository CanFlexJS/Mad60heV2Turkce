@echo off
chcp 65001 >nul
title Mad60 HE / FGG-HUB Turkce Yama Kurulumu
color 0B

echo =========================================================
echo       Mad60 HE / FGG-HUB Turkce Yama Otomatik Kurucu
echo       Gelistirici: CanFlexJS
echo =========================================================
echo.

:: Yonetici haklari kontrolu
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [BILGI] Yonetici haklari isteniyor...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

:: app.asar kontrolu (bat ile ayni dizinde olmali)
if not exist "%~dp0app.asar" (
    color 0C
    echo [HATA] app.asar dosyasi bu klasorde bulunamadi!
    echo.
    echo Lutfen GitHub Releases kismindan indirdiginiz app.asar dosyasini
    echo bu kurulum dosyasinin (Otomatik-Kurulum.bat) yanina koyup tekrar calistirin.
    echo.
    pause
    exit /b
)

echo [1/4] Arka planda calisan FGG-HUB kontrol ediliyor...
taskkill /F /IM "FGG-HUB.exe" >nul 2>&1
timeout /t 2 >nul

echo [2/4] FGG-HUB kurulum dizini tespit ediliyor...
set "TARGET_DIR="

if exist "C:\Program Files\FGG-HUB\resources" (
    set "TARGET_DIR=C:\Program Files\FGG-HUB\resources"
    set "EXE_PATH=C:\Program Files\FGG-HUB\FGG-HUB.exe"
) else if exist "C:\Program Files\FGG-HUB\FGG-HUB\resources" (
    set "TARGET_DIR=C:\Program Files\FGG-HUB\FGG-HUB\resources"
    set "EXE_PATH=C:\Program Files\FGG-HUB\FGG-HUB\FGG-HUB.exe"
) else if exist "C:\Program Files (x86)\FGG-HUB\resources" (
    set "TARGET_DIR=C:\Program Files (x86)\FGG-HUB\resources"
    set "EXE_PATH=C:\Program Files (x86)\FGG-HUB\FGG-HUB.exe"
)

if "%TARGET_DIR%"=="" (
    color 0E
    echo [UYARI] FGG-HUB varsayilan dizinde bulunamadi.
    echo Lutfen FGG-HUB'in kurulu oldugu ana klasoru girin:
    echo (Ornek: D:\Oyunlar\FGG-HUB)
    set /p "CUSTOM_DIR=> "
    if exist "%CUSTOM_DIR%\resources" (
        set "TARGET_DIR=%CUSTOM_DIR%\resources"
        set "EXE_PATH=%CUSTOM_DIR%\FGG-HUB.exe"
    ) else (
        color 0C
        echo [HATA] Girilen dizinde resources klasoru bulunamadi!
        pause
        exit /b
    )
)

echo [BILGI] Kurulum hedefi: %TARGET_DIR%
echo.

echo [3/4] Orijinal dosya yedekleniyor...
if exist "%TARGET_DIR%\app.asar" (
    if not exist "%TARGET_DIR%\app.asar.bak" (
        copy /Y "%TARGET_DIR%\app.asar" "%TARGET_DIR%\app.asar.bak" >nul
        echo [BILGI] Orijinal dosya app.asar.bak olarak yedeklendi.
    ) else (
        echo [BILGI] Daha onceden alinmis yedek bulundu, korundu.
    )
)

echo [4/4] Turkce yama (app.asar) kopyalaniyor...
copy /Y "%~dp0app.asar" "%TARGET_DIR%\app.asar" >nul

if %errorLevel% equ 0 (
    color 0A
    echo.
    echo =========================================================
    echo       TEBRIKLER! Turkce Yama Basariyla Kuruldu!
    echo =========================================================
    echo.
    echo Eger orijinal haline donmek isterseniz:
    echo "%TARGET_DIR%\app.asar.bak" dosyasinin adini "app.asar" yapabilirsiniz.
    echo.
    set /p "RUN_APP=FGG-HUB uygulamasini simdi baslatmak ister misiniz? (E/H): "
    if /i "%RUN_APP%"=="E" (
        if exist "%EXE_PATH%" (
            start "" "%EXE_PATH%"
        )
    )
) else (
    color 0C
    echo.
    echo [HATA] app.asar dosyasi kopyalanirken bir sorun olustu!
    echo Lutfen FGG-HUB'in tamamen kapali oldugundan emin olun.
)

echo.
pause
