"""
URL configuration for jahanpars project.
پیکربندی مسیرهای اصلی پروژه جهانپارس
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

urlpatterns = [
    # پنل مدیریت Django
    path('admin/', admin.site.urls),

    # مسیرهای API اپلیکیشن بالانس متریال
    path('api/', include('balance.urls')),

    # مسیرهای لاگین/لاگ‌اوت برای رابط مرورگر DRF (در محیط توسعه)
    path('api/auth/', include('rest_framework.urls', namespace='rest_framework')),

    # مسیرهای دریافت توکن JWT (برای فرانت‌اند)
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
]

from django.conf import settings
from django.conf.urls.static import static

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

