import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global fix for browser scroll-chaining lag inside table containers
document.addEventListener('wheel', (e) => {
  const container = e.target.closest('.table-container');
  if (!container) return;

  const { scrollTop, scrollHeight, clientHeight } = container;
  const isAtTop = scrollTop <= 0;
  const isAtBottom = Math.ceil(scrollTop + clientHeight) >= scrollHeight - 1;

  if ((e.deltaY > 0 && isAtBottom) || (e.deltaY < 0 && isAtTop)) {
    e.preventDefault();
    
    // Find nearest scrollable parent
    let scrollParent = container.parentElement;
    while (scrollParent && scrollParent !== document.body && scrollParent !== document.documentElement) {
      const style = window.getComputedStyle(scrollParent);
      if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
        break;
      }
      scrollParent = scrollParent.parentElement;
    }

    if (scrollParent && scrollParent !== document.body && scrollParent !== document.documentElement) {
      scrollParent.scrollBy({ top: e.deltaY, behavior: 'smooth' });
    } else {
      window.scrollBy({ top: e.deltaY, behavior: 'smooth' });
    }
  }
}, { passive: false });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
