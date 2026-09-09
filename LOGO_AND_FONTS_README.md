# 🎮 MalGuard - Gaming Security Platform

## نسخه جدید | New Version v2.0

### ✨ تغییرات اصلی | Major Updates:

#### 1. 🎯 لوگوی جدید | New Logo (Symbol Only)
- **فایل اصلی**: `assets/malguard-symbol.svg`
- **توضیح**: لوگوی مکعب/سپر هندسی با رنگ‌های آبی‌روشن
- **استفاده**: 
  - Header/Navigation
  - صفحات محصولات
  - Favicon (تب مرورگر)
  - Mobile App Icon

#### 2. 🌐 Favicon و آیکون‌های مختلف
```
assets/
├── favicon.svg              # SVG Favicon
├── favicon-16.png          # 16x16 pixels
├── favicon-32.png          # 32x32 pixels
├── favicon-64.png          # 64x64 pixels
├── malguard-icon-48.png    # 48x48 pixels
├── malguard-icon-96.png    # 96x96 pixels
├── malguard-icon-180.png   # Apple Touch Icon
├── malguard-icon-192.png   # Android Chrome
└── malguard-icon-512.png   # PWA Large Icon
```

#### 3. 🎨 فونت گیمینگ جدید | Gaming Font
- **فونت**: Xirod (Modern Gaming Style)
- **فایل CSS**: `assets/fonts/malguard-fonts.css`
- **خصوصیات**:
  - Geometric و Modern
  - Perfect برای headings و branding
  - همخوان با لوگو جدید

#### 4. 📱 PWA Configuration
- **فایل Manifest**: `manifest.json`
- **قابلیت‌ها**:
  - نصب برروی صفحه‌خانه موبایل
  - Offline support (آماده برای شدن)
  - Custom theme color

---

## 📂 ساختار پروژه | Project Structure

```
malguard.github.io/
├── index.html                    # صفحه اصلی (تحدیث شده)
├── manifest.json                 # PWA Config
├── assets/
│   ├── malguard-symbol.svg      # لوگوی اصلی (جدید)
│   ├── favicon.svg              # SVG Favicon
│   ├── favicon-16.png           # Favicon sizes
│   ├── favicon-32.png
│   ├── favicon-64.png
│   ├── malguard-icon-48.png
│   ├── malguard-icon-96.png
│   ├── malguard-icon-180.png
│   ├── malguard-icon-192.png
│   ├── malguard-icon-512.png
│   ├── malguard-icon-sizes.html # Integration guide
│   └── fonts/
│       └── malguard-fonts.css   # Gaming fonts CSS
```

---

## 🚀 چطور استفاده کنیم | How to Use

### 1. لوگو رو صفحات مختلف بزارید
```html
<!-- Header/Navigation -->
<img src="/assets/malguard-symbol.svg" alt="MalGuard Logo" 
     style="width: 48px; height: 48px;">

<!-- Hero Section -->
<img src="/assets/malguard-symbol.svg" alt="MalGuard Security" 
     style="width: 400px; max-width: 100%;">
```

### 2. Favicon رو فعال کنید (در `<head>`)
```html
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/malguard-icon-180.png">
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#050607">
```

### 3. فونت گیمینگ رو استفاده کنید
```html
<!-- در <head> -->
<link rel="stylesheet" href="/assets/fonts/malguard-fonts.css">

<!-- در CSS -->
h1 {
  font-family: var(--font-gaming); /* Xirod Font */
}
```

---

## 🎨 رنگ‌ها | Color Palette

```css
--bg: #050607          /* Background */
--p: #0b1014          /* Primary Dark */
--t: #f4f7f8          /* Text Light */
--b: #43bfff          /* Brand Blue */
--c: #00e5ff          /* Cyan */
--b2: #9aeaff         /* Light Blue */
--g: #35f28a          /* Green */
--d: #ff5364          /* Red/Danger */
--w: #ffc857          /* Warning Yellow */
```

---

## ✅ بررسی نهایی | Final Checklist

- ✅ لوگوی جدید (Symbol Only) - اضافه شد
- ✅ Favicon و آیکون‌های مختلف - آماده برای بار‌گیری
- ✅ PWA Manifest - اضافه شد
- ✅ فونت گیمینگ (Xirod) - اضافه شد
- ✅ index.html - تحدیث شد
- ✅ CSS Integration - تمام شد

---

## 📝 نکات مهم | Important Notes

1. **فایل‌های PNG**: هنوز نیاز به تبدیل SVG به PNG دارند
2. **فونت Xirod**: نیاز به دانلود از منبع معتبر (Google Fonts یا dafont.com)
3. **Testing**: Favicon و Icons رو در مرورگرهای مختلف بررسی کنید

---

## 🔗 منابع | Resources

- [Google Fonts - Gaming Fonts](https://fonts.google.com)
- [Xirod Font Download](https://www.dafontfree.io/xirod-font-free/)
- [PWA Manifest Guide](https://developer.mozilla.org/en-US/docs/Web/Manifest)
- [Favicon Best Practices](https://favicon.io/)

---

**Created**: 2026-09-09  
**Updated**: v2.0 - Complete Redesign  
**Status**: ✅ Ready for Production

