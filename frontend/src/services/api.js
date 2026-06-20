import axios from 'axios';

// استفاده از متغیر محیطی برای آدرس پایه API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api/`;

// ایجاد یک نمونه اختصاصی از Axios
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// اضافه کردن توکن به درخواست‌ها
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// هندل کردن رفرش توکن در صورت انقضا (401 Unauthorized)
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // بررسی این‌که آیا درخواست برای نقاط پایانی احراز هویت است یا خیر
    const isAuthRequest = originalRequest.url && (
      originalRequest.url.includes('token/') || 
      originalRequest.url.includes('token')
    );

    // اگر ارور 401 بود، قبلا تلاش مجدد نکرده بودیم و درخواست مربوط به احراز هویت نبود
    if (error.response?.status === 401 && !originalRequest._retry && !isAuthRequest) {
      originalRequest._retry = true;
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        try {
          // درخواست رفرش توکن
          const response = await axios.post(`${API_BASE_URL}token/refresh/`, {
            refresh: refreshToken
          });
          
          const newAccessToken = response.data.access;
          localStorage.setItem('access_token', newAccessToken);
          
          // آپدیت کردن هدر درخواست اصلی و اجرای مجدد آن
          originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // اگر رفرش توکن هم منقضی شده بود، کاربر باید لاگ‌اوت شود
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        // بدون رفرش توکن، توکن‌های نامعتبر را پاک کرده و در صورت نیاز ریدایرکت می‌کنیم
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
