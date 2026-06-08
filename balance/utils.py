def normalize_persian_text(text: str) -> str:
    """
    نرمال‌سازی متون فارسی برای جلوگیری از ثبت رکوردهای تکراری
    به‌خصوص در مورد ی و ک عربی و فاصله‌های اضافی
    """
    if not text:
        return ""
        
    replacements = {
        "ي": "ی",
        "ك": "ک",
        "ة": "ه",
        "‌": " ",  # تبدیل نیم‌فاصله به فاصله برای یکپارچگی بیشتر در جستجو
    }
    
    normalized = text.strip()
    for key, value in replacements.items():
        normalized = normalized.replace(key, value)
        
    # حذف فاصله‌های اضافی بین کلمات
    return " ".join(normalized.split())
