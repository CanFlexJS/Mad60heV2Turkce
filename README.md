# ⌨️ Mad60 HE / FGG-HUB Türkçe Dil Yaması

Bu yama, **Mad60 HE** ve **Mad60 HE v2 Dual Led** manyetik switch (Rapid Trigger) klavyelerin yönetim yazılımı olan **FGG-HUB** için hazırlanmış Türkçe arayüz ve dil desteği paketidir.

---

## 📥 İndirme Bağlantıları

> ⚠️ **ÖNEMLİ NOT:**  
> GitHub'ın sağ üstteki yeşil **`Code -> Download ZIP`** butonu büyük dosyaları (Git LFS) eksik indirdiği için indirdiğiniz dosya bozuk çıkabilir.  
> **Yamayı sorunsuz kullanmak için aşağıdaki resmi Releases bağlantısından indirin:**

* 🔗 **[📥 Türkçe Yamayı İndir (app.asar - v1.0.1)](https://github.com/CanFlexJS/Mad60heV2Turkce/releases/latest/download/app.asar)**
* 🔗 **[📦 Tüm Sürümler (GitHub Releases)](https://github.com/CanFlexJS/Mad60heV2Turkce/releases)**
* 🔗 **[⚡ Otomatik-Kurulum.bat İndir](https://raw.githubusercontent.com/CanFlexJS/Mad60heV2Turkce/main/Otomatik-Kurulum.bat)**

---

## 🚀 Kurulum Talimatları

Yamayı iki farklı yöntemle kolayca kurabilirsiniz:

### 1. Yöntem: Otomatik Kurulum (Tavsiye Edilen)
1. Yukarıdaki bağlantılardan `app.asar` dosyasını ve [`Otomatik-Kurulum.bat`](https://raw.githubusercontent.com/CanFlexJS/Mad60heV2Turkce/main/Otomatik-Kurulum.bat) dosyasını **aynı klasöre** indirin.
2. `Otomatik-Kurulum.bat` dosyasına çift tıklayın.
3. Yönetici izni ekranı geldiğinde **"Evet"** deyin.
4. Program otomatik olarak:
   - Arka plandaki FGG-HUB'ı kapatır,
   - Orijinal dosyanızı (`app.asar.bak`) olarak yedekler,
   - Türkçe yamayı kurar ve uygulamayı başlatır.

---

### 2. Yöntem: Manuel Kurulum (Elle Kopyalama)
1. **FGG-HUB** uygulamasını tamamen kapatın (Sağ alttaki sistem tepsisinden de sağ tıklayıp çıkış yapın).
2. İndirdiğiniz **`app.asar`** dosyasını kopyalayın (`Ctrl + C`).
3. Bilgisayarınızda aşağıdaki klasör yoluna gidin:
   ```text
   C:\Program Files\FGG-HUB\resources
   ```
   *(Eğer farklı bir konuma kurduysanız, programın kurulu olduğu yerdeki `resources` klasörüne gidin.)*
4. İleride geri dönebilmek için klasördeki mevcut `app.asar` dosyasının adını `app.asar.bak` olarak değiştirin.
5. Kopyaladığınız yeni `app.asar` dosyasını buraya yapıştırın (`Ctrl + V`). (Yönetici izni isterse "Devam" deyin).
6. **FGG-HUB** uygulamasını başlatın. Programınız artık Türkçe!

---

## ⏪ Yamayı Kaldırma (Orijinal Haline Dönme)

Yamayı kaldırmak ve İngilizce/Çince orijinal sürüme dönmek isterseniz:
1. `C:\Program Files\FGG-HUB\resources` klasörüne gidin.
2. Türkçe olan `app.asar` dosyasını silin.
3. Yedeklediğiniz `app.asar.bak` dosyasının adını tekrar `app.asar` yapın.

---

## ❓ Sıkça Sorulan Sorular (SSS)

**S: Program güncellendiğinde Türkçe yama silinir mi?**  
**C:** Evet, FGG-HUB üretici tarafından otomatik güncellenirse `app.asar` dosyası üzerine yazılabilir. Böyle bir durumda bu sayfadan yamayı tekrar kurmanız yeterlidir.

**S: "Erişim Reddedildi" veya "Dosya kullanımda" hatası alıyorum?**  
**C:** FGG-HUB arka planda çalışıyor olabilir. Görev Yöneticisi'ni açıp (`Ctrl + Shift + Esc`) `FGG-HUB` isimli tüm görevleri sonlandırın ve ardından kopyalama işlemini tekrarlayın.

---

## 🌟 Geliştirici & İletişim
* Hazırlayan / Çeviri: **Desh**
* Instagram: [**@desh.flow**](https://www.instagram.com/desh.flow/)
* GitHub: [CanFlexJS / Mad60heV2Turkce](https://github.com/CanFlexJS/Mad60heV2Turkce)
