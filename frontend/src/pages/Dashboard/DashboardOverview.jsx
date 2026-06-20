import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import { Skeleton } from '../../components/Skeleton';
import { toPersianDigits } from '../../utils/persianNumbers';
import JalaliDatePicker from '../../components/JalaliDatePicker';
import BalanceModal from './BalanceModal';
import GlobalBalanceTable from '../../components/GlobalBalanceTable';



/* ─── Formatter Hook/Helper ──────────────────────────────────── */
// فرمت‌کننده ایمن و زیبا برای اعداد (پشتیبانی از ارقام انگلیسی)
const formatNum = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US');
};

/* ─── SVG Icons ──────────────────────────────────────────────── */
const StatIcons = {
  inbound: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  ),
  outbound: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  approved: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0 1 12 2.944a11.955 11.955 0 0 1-8.618 3.04A12.02 12.02 0 0 0 3 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  balance: (
    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 0 0 6.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
    </svg>
  ),
  download: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
    </svg>
  ),
  pdf: (
    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
      <polyline points="14 2 14 8 20 8"></polyline>
      <line x1="16" y1="13" x2="8" y2="13"></line>
      <line x1="16" y1="17" x2="8" y2="17"></line>
      <polyline points="10 9 9 9 8 9"></polyline>
    </svg>
  ),
};

const UNIT_LABELS = {
  KG: 'کیلوگرم',
  M: 'متر',
  SQM: 'متر مربع',
  PCS: 'عدد',
};

/* ─── Main Dashboard Component ───────────────────────────────── */
const DashboardOverview = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  // Modal States
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [isInboundModalOpen, setIsInboundModalOpen] = useState(false);
  const [inboundSearchQuery, setInboundSearchQuery] = useState('');
  const [inventoryData, setInventoryData] = useState(null);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [selectedMaterialGroup, setSelectedMaterialGroup] = useState(null);

  // Outbound Modal States
  const [isOutboundModalOpen, setIsOutboundModalOpen] = useState(false);
  const [outboundSearchQuery, setOutboundSearchQuery] = useState('');
  const [outboundData, setOutboundData] = useState(null);
  const [outboundLoading, setOutboundLoading] = useState(false);
  const [selectedOutboundMaterial, setSelectedOutboundMaterial] = useState(null);
  const [selectedOutboundContractor, setSelectedOutboundContractor] = useState(null);

  // Technical Office Approval Modal States
  const [isApprovalsModalOpen, setIsApprovalsModalOpen] = useState(false);
  const [approvalsSearchQuery, setApprovalsSearchQuery] = useState('');
  const [approvalsData, setApprovalsData] = useState(null);
  const [approvalsLoading, setApprovalsLoading] = useState(false);
  const [selectedApprovalsContractor, setSelectedApprovalsContractor] = useState(null);
  const [selectedApprovalsMaterial, setSelectedApprovalsMaterial] = useState(null);
  const [apiContractors, setApiContractors] = useState([]);
  const [apiMaterials, setApiMaterials] = useState([]);

  // Balance Modal States
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);

  // Background Export Tasks List
  const [exportTasks, setExportTasks] = useState([]);
  const exportTasksRef = useRef([]);
  const pollingIntervalRef = useRef(null);

  // Keep ref updated
  useEffect(() => {
    exportTasksRef.current = exportTasks;
  }, [exportTasks]);

  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Unified Polling Effect for Multiple Downloads
  useEffect(() => {
    const hasActiveTasks = exportTasks.some(t => t.status === 'PENDING' || t.status === 'PROCESSING');

    if (!hasActiveTasks) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      return;
    }

    if (pollingIntervalRef.current) {
      return; // Already polling
    }

    pollingIntervalRef.current = setInterval(async () => {
      const currentTasks = [...exportTasksRef.current];

      const updatedTasksPromises = currentTasks.map(async (task) => {
        if (task.status !== 'PENDING' && task.status !== 'PROCESSING') {
          return task; // Don't poll completed tasks
        }

        try {
          const res = await api.get(`balance/export-status/${task.id}/`);
          const latest = res.data;

          let updatedTask = {
            ...task,
            status: latest.status,
            progress: latest.progress,
            eta: latest.eta,
            file_url: latest.file_url,
            error_message: latest.error_message
          };

          // Check if it just transitioned to SUCCESS
          if (latest.status === 'SUCCESS' && !task.downloaded) {
            updatedTask.downloaded = true;
            playChime();
            const isPdf = task.type === 'pdf';
            showSystemNotification(
              isPdf ? "گزارش PDF آماده شد! 🎉" : "گزارش موازنه آماده شد! 🎉",
              isPdf ? "فایل گزارش PDF موازنه کل با موفقیت تولید شد." : "فایل گزارش موازنه کل متریال کارگاه با موفقیت تولید شد و دانلود گردید."
            );
            showToast(isPdf ? 'تولید گزارش PDF کل با موفقیت پایان یافت.' : 'تولید گزارش موازنه کل با موفقیت پایان یافت.', 'success');

            // Trigger auto-download
            const origin = api.defaults.baseURL.replace(/\/api\/?$/, '');
            const downloadUrl = `${origin}${latest.file_url}`;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.setAttribute('download', isPdf ? 'global_material_balance.pdf' : 'global_material_balance.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();

            // Set timeout to auto-remove after 8 seconds
            setTimeout(() => {
              setExportTasks(prev => prev.filter(t => t.id !== task.id));
            }, 8000);
          } else if (latest.status === 'FAILURE') {
            const isPdf = task.type === 'pdf';
            showToast(`خطا در تولید گزارش ${isPdf ? 'PDF' : 'اکسل'}: ${latest.error_message || 'خطای سرور'}`, 'error');
          }

          return updatedTask;
        } catch (error) {
          console.error(`Error polling status for task ${task.id}:`, error);
          return task;
        }
      });

      const updatedTasks = await Promise.all(updatedTasksPromises);
      setExportTasks(updatedTasks);
    }, 2000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, [exportTasks.some(t => t.status === 'PENDING' || t.status === 'PROCESSING')]);

  // Load active export tasks on mount (Resume/Recovery)
  useEffect(() => {
    const fetchActiveTasks = async () => {
      try {
        const res = await api.get('balance/active-tasks/');
        if (res.data && Array.isArray(res.data)) {
          const tasks = res.data.map(t => ({
            id: t.task_id,
            type: t.type,
            status: t.status,
            progress: t.progress,
            eta: t.eta,
            file_url: t.file_url,
            error_message: t.error_message,
            downloaded: false
          }));
          setExportTasks(tasks);
        }
      } catch (error) {
        console.error("Error fetching active export tasks on mount", error);
      }
    };
    fetchActiveTasks();
  }, []);

  const triggerExport = (type) => {
    // Check if there is already an active running/pending task
    const activeExists = exportTasksRef.current.some(t => t.status === 'PENDING' || t.status === 'PROCESSING');

    if (activeExists) {
      const newTask = {
        id: `queued_${Date.now()}`,
        type: type,
        status: 'QUEUED',
        progress: 0,
        eta: 0,
        downloaded: false
      };
      setExportTasks(prev => [...prev, newTask]);
      showToast(`${type === 'pdf' ? 'گزارش PDF' : 'گزارش اکسل'} به صف دانلود اضافه شد.`, 'info');
      if (type === 'pdf') {
        setIsPdfModalOpen(false);
      }
    } else {
      if (type === 'pdf') {
        startPdfExport();
      } else {
        startExcelExport();
      }
    }
  };

  const startExcelExport = async (existingTaskId = null, resumeFrom = null) => {
    if (existingTaskId) {
      setExportTasks(prev => prev.map(t => t.id === existingTaskId ? { ...t, status: 'PENDING', progress: 0 } : t));
    }
    try {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
      let endpoint = 'balance/download-global/';
      if (resumeFrom) {
        endpoint += `?resume_from=${resumeFrom}`;
      }
      const response = await api.get(endpoint);
      if (response.data && response.data.task_id) {
        const taskId = response.data.task_id;
        const newTask = {
          id: taskId,
          type: 'excel',
          status: response.data.status || 'PENDING',
          progress: response.data.progress || 0,
          eta: response.data.eta || 0,
          downloaded: false
        };
        if (existingTaskId) {
          setExportTasks(prev => prev.map(t => (t.id === existingTaskId || t.id === taskId) ? newTask : t));
        } else {
          setExportTasks(prev => [...prev, newTask]);
        }
        return newTask;
      } else {
        showToast('ساختار پاسخ سرور نامعتبر است.', 'error');
        if (existingTaskId) {
          setExportTasks(prev => prev.map(t => t.id === existingTaskId ? { ...t, status: 'FAILURE', error_message: 'ساختار پاسخ سرور نامعتبر است.' } : t));
        }
      }
    } catch (error) {
      console.error("Error starting report export", error);
      showToast('خطا در شروع فرآیند دانلود گزارش.', 'error');
      if (existingTaskId) {
        setExportTasks(prev => prev.map(t => t.id === existingTaskId ? { ...t, status: 'FAILURE', error_message: 'خطا در ارتباط با سرور' } : t));
      }
    }
  };

  const startPdfExport = async (existingTaskId = null, resumeFrom = null) => {
    if (existingTaskId) {
      setExportTasks(prev => prev.map(t => t.id === existingTaskId ? { ...t, status: 'PENDING', progress: 0 } : t));
    }
    try {
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
      let endpoint = 'balance/download-global-pdf/';
      if (resumeFrom) {
        endpoint += `?resume_from=${resumeFrom}`;
      }
      const response = await api.get(endpoint);
      if (response.data && response.data.task_id) {
        const taskId = response.data.task_id;
        const newTask = {
          id: taskId,
          type: 'pdf',
          status: response.data.status || 'PENDING',
          progress: response.data.progress || 0,
          eta: response.data.eta || 0,
          downloaded: false
        };
        if (existingTaskId) {
          setExportTasks(prev => prev.map(t => (t.id === existingTaskId || t.id === taskId) ? newTask : t));
        } else {
          setExportTasks(prev => [...prev, newTask]);
        }
        setIsPdfModalOpen(false);
        return newTask;
      } else {
        showToast('ساختار پاسخ سرور نامعتبر است.', 'error');
        if (existingTaskId) {
          setExportTasks(prev => prev.map(t => t.id === existingTaskId ? { ...t, status: 'FAILURE', error_message: 'ساختار پاسخ سرور نامعتبر است.' } : t));
        }
      }
    } catch (error) {
      console.error("Error starting PDF export", error);
      showToast('خطا در شروع فرآیند دانلود فایل PDF.', 'error');
      if (existingTaskId) {
        setExportTasks(prev => prev.map(t => t.id === existingTaskId ? { ...t, status: 'FAILURE', error_message: 'خطا در ارتباط با سرور' } : t));
      }
    }
  };

  const handleCancelTask = async (taskId) => {
    try {
      if (String(taskId).startsWith('queued_')) {
        setExportTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'CANCELLED', progress: 0 } : t));
        showToast('دانلود از صف حذف گردید.', 'info');
        return;
      }
      setExportTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'CANCELLED' } : t));
      await api.post(`balance/export-status/${taskId}/cancel/`);
      showToast('دانلود گزارش لغو شد.', 'info');
    } catch (error) {
      console.error("Error cancelling task", error);
      showToast('خطا در لغو دانلود.', 'error');
    }
  };

  const handlePauseTask = async (taskId) => {
    try {
      if (String(taskId).startsWith('queued_')) {
        setExportTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'PAUSED' } : t));
        showToast('دانلود متوقف شد.', 'info');
        return;
      }
      setExportTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'PAUSED' } : t));
      await api.post(`balance/export-status/${taskId}/cancel/`);
      showToast('دانلود متوقف شد.', 'info');
    } catch (error) {
      console.error("Error pausing task", error);
      showToast('خطا در متوقف کردن دانلود.', 'error');
    }
  };

  const handleResumeTask = async (task) => {
    const activeExists = exportTasksRef.current.some(t => t.status === 'PENDING' || t.status === 'PROCESSING');
    if (activeExists) {
      setExportTasks(prev => prev.map(t => t.id === task.id ? {
        ...t,
        id: `queued_${Date.now()}`,
        status: 'QUEUED',
        progress: task.progress,
        eta: 0,
        error_message: null,
        resumeFrom: task.id
      } : t));
      showToast('دانلود به انتهای صف اضافه شد.', 'info');
    } else {
      setExportTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: 'PENDING', progress: task.progress, error_message: null } : t));
      if (task.type === 'pdf') {
        await startPdfExport(task.id, task.id);
      } else {
        await startExcelExport(task.id, task.id);
      }
      showToast('دانلود مجدداً شروع شد.', 'info');
    }
  };

  // Scheduler effect for sequential queueing
  useEffect(() => {
    const hasActiveTasks = exportTasks.some(t => t.status === 'PENDING' || t.status === 'PROCESSING');
    if (hasActiveTasks) return;

    // Find the first queued task
    const nextQueuedTask = exportTasks.find(t => t.status === 'QUEUED');
    if (!nextQueuedTask) return;

    // Trigger next queued task
    if (nextQueuedTask.type === 'pdf') {
      startPdfExport(nextQueuedTask.id, nextQueuedTask.resumeFrom);
    } else {
      startExcelExport(nextQueuedTask.id, nextQueuedTask.resumeFrom);
    }
  }, [exportTasks]);

  const handleRetryTask = async (task) => {
    // Dismiss the failed task from list
    setExportTasks(prev => prev.filter(t => t.id !== task.id));

    // Trigger task again based on type
    if (task.type === 'pdf') {
      handleDownloadPdf();
    } else {
      downloadReport('global');
    }
  };


  // Excel Modal State
  const [excelContractorSearch, setExcelContractorSearch] = useState('');
  const [selectedExcelContractor, setSelectedExcelContractor] = useState(null);
  const [showExcelDropdown, setShowExcelDropdown] = useState(false);

  // PDF Modal State
  const [pdfContractorSearch, setPdfContractorSearch] = useState('');
  const [selectedPdfContractors, setSelectedPdfContractors] = useState([]);
  const [showPdfContractorDropdown, setShowPdfContractorDropdown] = useState(false);

  const [pdfMaterialSearch, setPdfMaterialSearch] = useState('');
  const [selectedPdfMaterials, setSelectedPdfMaterials] = useState([]);
  const [showPdfMaterialDropdown, setShowPdfMaterialDropdown] = useState(false);
  const [pdfReceivedMaterialIds, setPdfReceivedMaterialIds] = useState(null);

  const [pdfFromDate, setPdfFromDate] = useState('');
  const [pdfToDate, setPdfToDate] = useState('');
  const [pdfStatus, setPdfStatus] = useState('');

  const excelDropdownRef = useRef(null);
  const pdfContractorDropdownRef = useRef(null);
  const pdfMaterialDropdownRef = useRef(null);

  const updatePdfReceivedMaterials = async (contractorsList) => {
    if (!contractorsList || contractorsList.length === 0) {
      setPdfReceivedMaterialIds(null);
      return;
    }
    try {
      const promises = contractorsList.map(c => api.get(`contractors/${c.id}/received-materials/`));
      const results = await Promise.all(promises);
      const unionIds = Array.from(new Set(results.flatMap(res => res.data)));
      setPdfReceivedMaterialIds(unionIds);

      // Clean up selected materials that are not received by any of the remaining contractors
      setSelectedPdfMaterials(prev => prev.filter(m => unionIds.includes(m.id)));
    } catch (err) {
      console.error('Error fetching received materials', err);
      setPdfReceivedMaterialIds(null);
    }
  };

  const handleAddPdfContractor = async (contractor) => {
    if (selectedPdfContractors.some(c => c.id === contractor.id)) return;
    const updated = [...selectedPdfContractors, contractor];
    setSelectedPdfContractors(updated);
    setPdfContractorSearch('');
    await updatePdfReceivedMaterials(updated);
  };

  const handleRemovePdfContractor = async (contractorId) => {
    const updated = selectedPdfContractors.filter(c => c.id !== contractorId);
    setSelectedPdfContractors(updated);
    await updatePdfReceivedMaterials(updated);
  };

  const handleAddPdfMaterial = (material) => {
    if (selectedPdfMaterials.some(m => m.id === material.id)) return;
    setSelectedPdfMaterials([...selectedPdfMaterials, material]);
    setPdfMaterialSearch('');
  };

  const handleRemovePdfMaterial = (materialId) => {
    setSelectedPdfMaterials(selectedPdfMaterials.filter(m => m.id !== materialId));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (excelDropdownRef.current && !excelDropdownRef.current.contains(event.target)) {
        setShowExcelDropdown(false);
      }
      if (pdfContractorDropdownRef.current && !pdfContractorDropdownRef.current.contains(event.target)) {
        setShowPdfContractorDropdown(false);
      }
      if (pdfMaterialDropdownRef.current && !pdfMaterialDropdownRef.current.contains(event.target)) {
        setShowPdfMaterialDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await api.get('dashboard/');
        setData(response.data);
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      } finally {
        setLoading(false);
      }
    };
    const fetchFilterData = async () => {
      try {
        const [contRes, matRes] = await Promise.all([
          api.get('contractors/'),
          api.get('materials/')
        ]);
        setApiContractors(contRes.data.results || contRes.data);
        setApiMaterials(matRes.data.results || matRes.data);
      } catch (error) {
        console.error("Error fetching filter data", error);
      }
    };
    fetchDashboardData();
    fetchFilterData();
  }, []);

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.00, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {
      console.warn("Failed to play synthesized notification chime", e);
    }
  };

  const showSystemNotification = (title, body) => {
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body
        });
      } catch (e) {
        console.warn("System notification could not be spawned", e);
      }
    }
  };

  const downloadReport = async (type = 'global') => {
    if (type === 'global') {
      triggerExport('excel');
    } else {
      handleDownloadExcel();
    }
  };


  const handleDownloadExcel = async () => {
    if (!selectedExcelContractor) {
      showToast('لطفاً یک پیمانکار انتخاب کنید', 'error');
      return;
    }

    try {
      showToast('در حال آماده سازی گزارش...', 'info');
      const response = await api.get(`balance/download/?contractor_id=${selectedExcelContractor.id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `balance_${selectedExcelContractor.first_name}_${selectedExcelContractor.last_name}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('گزارش با موفقیت دانلود شد', 'success');
      setIsExcelModalOpen(false);
    } catch (error) {
      console.error("Error downloading report", error);
      showToast('خطا در دانلود گزارش.', 'error');
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const hasFilters = selectedPdfContractors.length > 0 || selectedPdfMaterials.length > 0 || pdfFromDate || pdfToDate || pdfStatus;

      if (!hasFilters) {
        triggerExport('pdf');
        return;
      }

      // Synchronous generation for filtered PDF (normal behaviour)
      showToast('در حال تولید فایل PDF...', 'info');
      let urlStr = 'balance/download-pdf/?';
      const params = new URLSearchParams();
      if (selectedPdfContractors.length > 0) {
        params.append('contractor_ids', selectedPdfContractors.map(c => c.id).join(','));
      }
      if (selectedPdfMaterials.length > 0) {
        params.append('material_ids', selectedPdfMaterials.map(m => m.id).join(','));
      }
      if (pdfFromDate) params.append('from_date', pdfFromDate);
      if (pdfToDate) params.append('to_date', pdfToDate);
      if (pdfStatus) params.append('status', pdfStatus);

      const response = await api.get(`${urlStr}${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'balance_report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      showToast('گزارش PDF با موفقیت دانلود شد', 'success');
      setIsPdfModalOpen(false);
    } catch (error) {
      console.error("Error downloading report", error);
      showToast('خطا در دانلود فایل PDF.', 'error');
    }
  };

  const handleOpenInboundModal = async () => {
    setIsInboundModalOpen(true);
    if (!inventoryData) {
      setInventoryLoading(true);
      try {
        const response = await api.get('balance/inventory/');
        setInventoryData(response.data);
      } catch (error) {
        console.error("Error fetching inventory data", error);
        showToast('خطا در دریافت موجودی و ورودی‌های انبار.', 'error');
      } finally {
        setInventoryLoading(false);
      }
    }
  };

  const handleCloseInboundModal = () => {
    setIsInboundModalOpen(false);
    setInboundSearchQuery('');
    setSelectedMaterialGroup(null);
  };

  const handleOpenOutboundModal = async () => {
    setIsOutboundModalOpen(true);
    if (!outboundData) {
      setOutboundLoading(true);
      try {
        const response = await api.get('balance/contractor-outbound/');
        setOutboundData(response.data);
      } catch (error) {
        console.error("Error fetching outbound data", error);
        showToast('خطا در دریافت اطلاعات خروجی انبار.', 'error');
      } finally {
        setOutboundLoading(false);
      }
    }
  };

  const handleCloseOutboundModal = () => {
    setIsOutboundModalOpen(false);
    setOutboundSearchQuery('');
    setSelectedOutboundMaterial(null);
    setSelectedOutboundContractor(null);
  };

  const handleOpenApprovalsModal = async () => {
    setIsApprovalsModalOpen(true);
    if (!approvalsData) {
      setApprovalsLoading(true);
      try {
        const response = await api.get('balance/contractor-approvals/');
        setApprovalsData(response.data);
      } catch (error) {
        console.error("Error fetching approvals data", error);
        showToast('خطا در دریافت اطلاعات تاییدیه‌های دفتر فنی.', 'error');
      } finally {
        setApprovalsLoading(false);
      }
    }
  };

  const handleCloseApprovalsModal = () => {
    setIsApprovalsModalOpen(false);
    setApprovalsSearchQuery('');
    setSelectedApprovalsContractor(null);
    setSelectedApprovalsMaterial(null);
  };

  if (loading) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', paddingTop: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div>
            <Skeleton width="180px" height="32px" style={{ marginBottom: '8px' }} />
            <Skeleton width="300px" height="18px" />
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Skeleton width="120px" height="40px" />
            <Skeleton width="120px" height="40px" />
            <Skeleton width="120px" height="40px" />
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '2rem', height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--text-dim)' }}>در حال بارگذاری اطلاعات...</div>
        </div>
      </div>
    );
  }

  // محاسبه موازنه متریال به تفکیک واحدها
  const balanceObj = {};
  if (data) {
    const allUnits = new Set([
      ...Object.keys(data.total_in || {}),
      ...Object.keys(data.total_out || {}),
      ...Object.keys(data.total_approved || {})
    ]);
    allUnits.forEach(unit => {
      const outQty = data.total_out?.[unit] || 0;
      const appQty = data.total_approved?.[unit] || 0;
      balanceObj[unit] = outQty - appQty;
    });
  }

  const renderCardUnits = (totalsObj, isBalance = false) => {
    if (!totalsObj || Object.keys(totalsObj).length === 0) {
      return <div className="kpi-empty-text">داده‌ای ثبت نشده است</div>;
    }
    return (
      <div className="kpi-card-body">
        {Object.entries(totalsObj).map(([unit, val]) => {
          let valueColor = 'var(--text-main)';
          if (isBalance) {
            if (val > 0) valueColor = 'var(--danger)';
            else if (val < 0) valueColor = 'var(--success)';
            else valueColor = 'var(--text-muted)';
          }
          return (
            <div key={unit} className="kpi-unit-row">
              <span className="kpi-unit-name">{UNIT_LABELS[unit] || unit}</span>
              <span className="kpi-unit-value" style={{ color: valueColor }}>
                {formatNum(val)}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  const getGroupedInboundMaterials = () => {
    if (!inventoryData) return [];
    const grouped = {};
    inventoryData.forEach(item => {
      const totalIn = Number(item.total_in || 0);
      if (totalIn <= 0) return;
      const name = item.name || '';
      const unit = item.unit_display || item.unit || '';
      const key = `${name}__${unit}`;
      if (!grouped[key]) {
        grouped[key] = { name, unit, total_in: 0 };
      }
      grouped[key].total_in += totalIn;
    });
    return Object.values(grouped)
      .filter(item => item.name.toLowerCase().includes(inboundSearchQuery.toLowerCase()))
      .sort((a, b) => b.total_in - a.total_in);
  };

  const getOutboundMaterialsLevel1 = () => {
    if (!outboundData) return [];
    const grouped = {};
    outboundData.forEach(item => {
      const totalQty = Number(item.total_qty || 0);
      if (totalQty <= 0) return;
      const materialName = item.material_name || '';
      const unit = item.unit || '';
      const key = `${materialName}__${unit}`;
      if (!grouped[key]) {
        grouped[key] = {
          name: materialName,
          unit: unit,
          total_qty: 0
        };
      }
      grouped[key].total_qty += totalQty;
    });
    return Object.values(grouped)
      .filter(item => item.name.toLowerCase().includes(outboundSearchQuery.toLowerCase()))
      .sort((a, b) => b.total_qty - a.total_qty);
  };

  const getOutboundContractorsLevel2 = () => {
    if (!outboundData || !selectedOutboundMaterial) return [];
    const grouped = {};
    outboundData.forEach(item => {
      const totalQty = Number(item.total_qty || 0);
      if (totalQty <= 0) return;
      if (item.material_name !== selectedOutboundMaterial.name || item.unit !== selectedOutboundMaterial.unit) return;

      const contractorId = item.contractor_id;
      const contractorName = item.contractor_name || '';
      const key = `${contractorId}`;
      if (!grouped[key]) {
        grouped[key] = {
          contractor_id: contractorId,
          contractor_name: contractorName,
          total_qty: 0
        };
      }
      grouped[key].total_qty += totalQty;
    });
    return Object.values(grouped)
      .filter(item => item.contractor_name.toLowerCase().includes(outboundSearchQuery.toLowerCase()))
      .sort((a, b) => b.total_qty - a.total_qty);
  };

  const getOutboundSpecsLevel3 = () => {
    if (!outboundData || !selectedOutboundMaterial || !selectedOutboundContractor) return [];
    return outboundData.filter(item => {
      return item.material_name === selectedOutboundMaterial.name &&
        item.unit === selectedOutboundMaterial.unit &&
        item.contractor_id === selectedOutboundContractor.contractor_id &&
        Number(item.total_qty || 0) > 0;
    });
  };

  const getApprovalsContractorsLevel1 = () => {
    if (!approvalsData) return [];
    const grouped = {};
    approvalsData.forEach(item => {
      const apprQty = Number(item.total_approved || 0);
      if (apprQty <= 0) return;
      const contractorId = item.contractor_id;
      const contractorName = item.contractor_name || '';
      const unit = item.unit || '';

      const key = `${contractorId}`;
      if (!grouped[key]) {
        grouped[key] = {
          contractor_id: contractorId,
          contractor_name: contractorName,
          units: {}
        };
      }
      if (!grouped[key].units[unit]) {
        grouped[key].units[unit] = 0;
      }
      grouped[key].units[unit] += apprQty;
    });
    return Object.values(grouped)
      .filter(item => item.contractor_name.toLowerCase().includes(approvalsSearchQuery.toLowerCase()))
      .sort((a, b) => a.contractor_name.localeCompare(b.contractor_name, 'fa'));
  };

  const getApprovalsMaterialsLevel2 = () => {
    if (!approvalsData || !selectedApprovalsContractor) return [];
    const grouped = {};
    approvalsData.forEach(item => {
      if (item.contractor_id !== selectedApprovalsContractor.contractor_id) return;

      const materialId = item.material_id;
      const materialName = item.material_name || '';
      const unit = item.unit || '';
      const deliveredQty = Number(item.total_delivered || 0);
      const approvedQty = Number(item.total_approved || 0);

      const key = `${materialId}__${unit}`;
      if (!grouped[key]) {
        grouped[key] = {
          material_id: materialId,
          name: materialName,
          unit: unit,
          total_delivered: 0,
          total_approved: 0
        };
      }
      grouped[key].total_delivered += deliveredQty;
      grouped[key].total_approved += approvedQty;
    });
    return Object.values(grouped)
      .filter(item => item.name.toLowerCase().includes(approvalsSearchQuery.toLowerCase()))
      .sort((a, b) => b.total_approved - a.total_approved);
  };

  const getApprovalsSpecsLevel3 = () => {
    if (!approvalsData || !selectedApprovalsContractor || !selectedApprovalsMaterial) return [];
    return approvalsData.filter(item => {
      return item.contractor_id === selectedApprovalsContractor.contractor_id &&
        item.material_id === selectedApprovalsMaterial.material_id &&
        item.unit === selectedApprovalsMaterial.unit &&
        (Number(item.total_delivered || 0) > 0 || Number(item.total_approved || 0) > 0);
    });
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 2.5rem)' }}>
      {/* Header */}
      <div className="page-header animate-in" style={{ flexShrink: 0 }}>
        <div>
          <h1 className="gradient-text">نمای کلی کارگاه</h1>
          <p>خلاصه وضعیت موازنه متریال و عملکرد پیمانکاران</p>
        </div>
        <div className="page-header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-excel" onClick={() => setIsExcelModalOpen(true)}>
            {StatIcons.download}
            تفکیک پیمانکاران
          </button>
          <button className="btn btn-pdf" onClick={() => setIsPdfModalOpen(true)}>
            {StatIcons.pdf}
            خروجی PDF
          </button>
          <button className="btn btn-excel" onClick={() => downloadReport('global')}>
            {StatIcons.download}
            موازنه کل
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="dashboard-kpi-grid animate-in" style={{ flexShrink: 0 }}>
        <div className="kpi-card glow-primary interactive" onClick={handleOpenInboundModal}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">ورودی انبار</span>
            <div className="kpi-card-icon">
              {StatIcons.inbound}
            </div>
          </div>
          {renderCardUnits(data?.total_in)}
        </div>

        <div className="kpi-card glow-warning interactive" onClick={handleOpenOutboundModal}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">خروجی انبار</span>
            <div className="kpi-card-icon">
              {StatIcons.outbound}
            </div>
          </div>
          {renderCardUnits(data?.total_out)}
        </div>

        <div className="kpi-card glow-success interactive" onClick={handleOpenApprovalsModal}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">تاییدیه دفتر فنی</span>
            <div className="kpi-card-icon">
              {StatIcons.approved}
            </div>
          </div>
          {renderCardUnits(data?.total_approved)}
        </div>

        <div className="kpi-card glow-warning interactive" onClick={() => setIsBalanceModalOpen(true)}>
          <div className="kpi-card-header">
            <span className="kpi-card-title">موازنه کل</span>
            <div className="kpi-card-icon">
              {StatIcons.balance}
            </div>
          </div>
          {renderCardUnits(balanceObj, true)}
        </div>
      </div>

      <GlobalBalanceTable />

      {/* Download Excel/PDF Modals */}
      <BalanceModal
        isOpen={isBalanceModalOpen}
        onClose={() => setIsBalanceModalOpen(false)}
        contractorsSummary={data?.contractors}
      />
      {/* Excel Modal */}
      {isExcelModalOpen && (
        <div className="modal-overlay" onClick={() => setIsExcelModalOpen(false)}>
          <div
            className="modal-container animate-in"
            onClick={e => {
              e.stopPropagation();
              setShowExcelDropdown(false);
            }}
            style={{ maxWidth: '800px', width: '90%', height: '500px', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header">
              <h2>دانلود گزارش تفکیک پیمانکار</h2>
              <button className="modal-close-btn" onClick={() => setIsExcelModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="form-group" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                <label className="form-label">انتخاب پیمانکار</label>
                <div className="searchable-dropdown" ref={excelDropdownRef} style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="searchable-dropdown-input"
                    placeholder="جستجوی نام پیمانکار..."
                    value={excelContractorSearch}
                    onChange={(e) => {
                      setExcelContractorSearch(e.target.value);
                      setShowExcelDropdown(true);
                      if (e.target.value === '') setSelectedExcelContractor(null);
                    }}
                    onFocus={() => setShowExcelDropdown(true)}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                  {excelContractorSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExcelContractor(null);
                        setExcelContractorSearch('');
                        setShowExcelDropdown(false);
                      }}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        padding: '0.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {showExcelDropdown && (
                    <div className="searchable-dropdown-list">
                      {apiContractors
                        .filter(c => `${c.first_name} ${c.last_name}`.includes(excelContractorSearch))
                        .map(c => (
                          <div
                            key={c.id}
                            className={`searchable-dropdown-item ${selectedExcelContractor?.id === c.id ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedExcelContractor(c);
                              setExcelContractorSearch(`${c.first_name} ${c.last_name}`);
                              setShowExcelDropdown(false);
                            }}
                          >
                            {c.first_name} {c.last_name}
                          </div>
                        ))}
                      {apiContractors.filter(c => `${c.first_name} ${c.last_name}`.includes(excelContractorSearch)).length === 0 && (
                        <div className="searchable-dropdown-item" style={{ color: 'var(--text-dim)', textAlign: 'center' }}>پیمانکاری یافت نشد</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ marginTop: 'auto' }}>
              <button className="btn btn-ghost" onClick={() => setIsExcelModalOpen(false)}>انصراف</button>
              <button className="btn btn-excel" onClick={handleDownloadExcel}>دانلود گزارش</button>
            </div>
          </div>
        </div>
      )}

      {/* PDF Modal */}
      {isPdfModalOpen && (
        <div className="modal-overlay" onClick={() => setIsPdfModalOpen(false)}>
          <div
            className="modal-container animate-in"
            onClick={e => {
              e.stopPropagation();
              setShowPdfContractorDropdown(false);
              setShowPdfMaterialDropdown(false);
            }}
            style={{ maxWidth: '1000px', width: '90%', display: 'flex', flexDirection: 'column' }}
          >
            <div className="modal-header">
              <h2>تولید فایل PDF موازنه</h2>
              <button className="modal-close-btn" onClick={() => setIsPdfModalOpen(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div className="grid grid-cols-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
                <div className="form-group">
                  <label className="form-label">از تاریخ (اختیاری)</label>
                  <JalaliDatePicker
                    name="from_date"
                    value={pdfFromDate}
                    onChange={e => setPdfFromDate(e.target.value)}
                    placeholder="انتخاب از تاریخ..."
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">تا تاریخ (اختیاری)</label>
                  <JalaliDatePicker
                    name="to_date"
                    value={pdfToDate}
                    onChange={e => setPdfToDate(e.target.value)}
                    placeholder="انتخاب تا تاریخ..."
                  />
                </div>
              </div>

              <div className="form-group" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                <label className="form-label">انتخاب پیمانکار (اختیاری)</label>
                <div className="searchable-dropdown" ref={pdfContractorDropdownRef} style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="searchable-dropdown-input"
                    placeholder="جستجو و انتخاب پیمانکاران..."
                    value={pdfContractorSearch}
                    onChange={(e) => {
                      setPdfContractorSearch(e.target.value);
                      setShowPdfContractorDropdown(true);
                    }}
                    onFocus={() => setShowPdfContractorDropdown(true)}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                  {pdfContractorSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setPdfContractorSearch('');
                        setShowPdfContractorDropdown(false);
                      }}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        padding: '0.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {showPdfContractorDropdown && (
                    <div className="searchable-dropdown-list">
                      {apiContractors
                        .filter(c => `${c.first_name} ${c.last_name}`.includes(pdfContractorSearch))
                        .map(c => {
                          const isSelected = selectedPdfContractors.some(selected => selected.id === c.id);
                          return (
                            <div
                              key={c.id}
                              className={`searchable-dropdown-item ${isSelected ? 'disabled' : ''}`}
                              onClick={() => {
                                if (isSelected) return;
                                handleAddPdfContractor(c);
                                setShowPdfContractorDropdown(false);
                              }}
                            >
                              {c.first_name} {c.last_name}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
                {selectedPdfContractors.length > 0 && (
                  <div className="selected-chips-container">
                    {selectedPdfContractors.map(c => (
                      <div key={c.id} className="selected-chip">
                        <span>{c.first_name} {c.last_name}</span>
                        <button
                          type="button"
                          className="selected-chip-remove"
                          onClick={() => handleRemovePdfContractor(c.id)}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="form-group" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
                <label className="form-label">انتخاب متریال (اختیاری)</label>
                <div className="searchable-dropdown" ref={pdfMaterialDropdownRef} style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="searchable-dropdown-input"
                    placeholder="جستجو و انتخاب متریال‌ها..."
                    value={pdfMaterialSearch}
                    onChange={(e) => {
                      setPdfMaterialSearch(e.target.value);
                      setShowPdfMaterialDropdown(true);
                    }}
                    onFocus={() => setShowPdfMaterialDropdown(true)}
                    style={{ paddingLeft: '2.5rem' }}
                  />
                  {pdfMaterialSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setPdfMaterialSearch('');
                        setShowPdfMaterialDropdown(false);
                      }}
                      style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        fontSize: '1.1rem',
                        padding: '0.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 10
                      }}
                    >
                      ✕
                    </button>
                  )}
                  {showPdfMaterialDropdown && (
                    <div className="searchable-dropdown-list">
                      {apiMaterials
                        .filter(m => {
                          if (pdfReceivedMaterialIds && !pdfReceivedMaterialIds.includes(m.id)) return false;
                          const query = pdfMaterialSearch.toLowerCase();
                          return m.name.toLowerCase().includes(query) ||
                            (m.size && m.size.toLowerCase().includes(query)) ||
                            (m.thickness && m.thickness.toLowerCase().includes(query)) ||
                            (m.material_type && m.material_type.toLowerCase().includes(query));
                        })
                        .map(m => {
                          const specs = [m.size, m.thickness, m.material_type].filter(Boolean).join(' / ');
                          const isSelected = selectedPdfMaterials.some(selected => selected.id === m.id);
                          return (
                            <div
                              key={m.id}
                              className={`searchable-dropdown-item ${isSelected ? 'disabled' : ''}`}
                              onClick={() => {
                                if (isSelected) return;
                                handleAddPdfMaterial(m);
                                setShowPdfMaterialDropdown(false);
                              }}
                            >
                              {m.name} {specs && <small style={{ color: 'var(--text-dim)', marginRight: '4px' }}>({specs})</small>} <small style={{ color: 'var(--text-dim)' }}>({m.unit_display || m.unit})</small>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
                {selectedPdfMaterials.length > 0 && (
                  <div className="selected-chips-container">
                    {selectedPdfMaterials.map(m => {
                      const specs = [m.size, m.thickness, m.material_type].filter(Boolean).join(' / ');
                      const tagLabel = specs ? `${m.name} (${specs})` : m.name;
                      return (
                        <div key={m.id} className="selected-chip">
                          <span>{tagLabel}</span>
                          <button
                            type="button"
                            className="selected-chip-remove"
                            onClick={() => handleRemovePdfMaterial(m.id)}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">وضعیت موازنه (اختیاری)</label>
                <select className="form-control" value={pdfStatus} onChange={e => setPdfStatus(e.target.value)}>
                  <option value="">همه وضعیت‌ها</option>
                  <option value="debtor">بدهکار (مازاد دریافت)</option>
                  <option value="creditor">بستانکار (کسری)</option>
                  <option value="under_review">در حال بررسی توسط دفتر فنی</option>
                  <option value="cleared">تسویه</option>
                </select>
              </div>

            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsPdfModalOpen(false)}>انصراف</button>
              <button className="btn btn-pdf" onClick={handleDownloadPdf}>تولید فایل PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Luxury Inbound Summary Modal */}
      {isInboundModalOpen && (
        <div className="luxury-modal-overlay" onClick={handleCloseInboundModal}>
          <div className="luxury-modal-container animate-in" onClick={e => e.stopPropagation()}>
            <div className="luxury-modal-header">
              <h3>خلاصه متریال‌های ورودی</h3>
              <button className="luxury-close-btn" onClick={handleCloseInboundModal}>
                ✕
              </button>
            </div>

            {/* View 1: Show search wrapper ONLY when no group is selected */}
            {!selectedMaterialGroup && (
              <div className="luxury-search-wrapper">
                <input
                  type="text"
                  className="luxury-search-input"
                  placeholder="جستجوی متریال..."
                  value={inboundSearchQuery}
                  onChange={e => setInboundSearchQuery(e.target.value)}
                />
                <span className="luxury-search-icon">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </div>
            )}

            <div className="luxury-modal-body">
              {inventoryLoading ? (
                <div className="luxury-loading-state">
                  <div className="luxury-spinner"></div>
                  <span>در حال بارگذاری جزئیات ورودی‌ها...</span>
                </div>
              ) : selectedMaterialGroup ? (
                /* View 2: Detailed Sub-Page View */
                <div className="luxury-view-fade-in">
                  <button className="luxury-back-btn" onClick={() => setSelectedMaterialGroup(null)}>
                    <span className="luxury-back-icon">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                    بازگشت به لیست
                  </button>

                  <div className="luxury-details-list">
                    {(inventoryData ? inventoryData.filter(sub => {
                      const subName = sub.name || '';
                      const subUnit = sub.unit_display || sub.unit || '';
                      return subName === selectedMaterialGroup.name && subUnit === selectedMaterialGroup.unit && Number(sub.total_in || 0) > 0;
                    }) : []).map((sub, idx) => (
                      <div key={sub.id || idx} className="luxury-sub-row animate-in">
                        <div className="luxury-sub-specs">
                          <span className="luxury-spec-badge">سایز: {sub.size || '—'}</span>
                          <span className="luxury-spec-badge">جنس: {sub.material_type || '—'}</span>
                          <span className="luxury-spec-badge">ضخامت: {sub.thickness || '—'}</span>
                        </div>
                        <div className="luxury-sub-values">
                          <div className="luxury-sub-value-item">
                            <span className="luxury-sub-value-label">ورودی:</span>
                            <span className="luxury-sub-value-qty">{formatNum(sub.total_in)}</span>
                            <span className="luxury-sub-value-unit">{sub.unit_display || sub.unit}</span>
                          </div>
                          <div className="luxury-sub-value-item">
                            <span className="luxury-sub-value-label">موجودی انبار:</span>
                            <span className="luxury-sub-value-qty" style={{ color: 'var(--accent)' }}>
                              {formatNum(sub.current_stock)}
                            </span>
                            <span className="luxury-sub-value-unit">{sub.unit_display || sub.unit}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : getGroupedInboundMaterials().length === 0 ? (
                /* View 1: Main List View Empty State */
                <div className="luxury-empty-state">
                  <span>هیچ متریال ورودی یافت نشد.</span>
                </div>
              ) : (
                /* View 1: Main List View List */
                <div className="luxury-view-fade-in">
                  {getGroupedInboundMaterials().map((item, index) => (
                    <div
                      key={index}
                      className="luxury-material-row interactive"
                      onClick={() => setSelectedMaterialGroup(item)}
                    >
                      <div className="luxury-material-left">
                        <span className="luxury-material-name">{item.name}</span>
                      </div>
                      <div className="luxury-material-value-wrapper">
                        <span className="luxury-material-qty">{formatNum(item.total_in)}</span>
                        <span className="luxury-material-unit">{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Luxury Outbound Summary Modal */}
      {isOutboundModalOpen && (
        <div className="luxury-modal-overlay" onClick={handleCloseOutboundModal}>
          <div className="luxury-modal-container animate-in" onClick={e => e.stopPropagation()}>
            <div className="luxury-modal-header">
              <h3>خلاصه متریال‌های خروجی</h3>
              <button className="luxury-close-btn" onClick={handleCloseOutboundModal}>
                ✕
              </button>
            </div>

            {/* Breadcrumbs Navigation */}
            {(selectedOutboundMaterial || selectedOutboundContractor) && (
              <div className="luxury-breadcrumb">
                <span
                  className="luxury-breadcrumb-item"
                  onClick={() => {
                    setSelectedOutboundMaterial(null);
                    setSelectedOutboundContractor(null);
                    setOutboundSearchQuery('');
                  }}
                >
                  لیست متریال‌ها
                </span>
                {selectedOutboundMaterial && (
                  <>
                    <span className="luxury-breadcrumb-separator">←</span>
                    <span
                      className={`luxury-breadcrumb-item ${!selectedOutboundContractor ? 'active' : ''}`}
                      onClick={() => {
                        if (selectedOutboundContractor) {
                          setSelectedOutboundContractor(null);
                          setOutboundSearchQuery('');
                        }
                      }}
                    >
                      {selectedOutboundMaterial.name}
                    </span>
                  </>
                )}
                {selectedOutboundContractor && (
                  <>
                    <span className="luxury-breadcrumb-separator">←</span>
                    <span className="luxury-breadcrumb-item active">
                      {selectedOutboundContractor.contractor_name}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Search Wrapper: Level 1 and Level 2 */}
            {!selectedOutboundContractor && (
              <div className="luxury-search-wrapper">
                <input
                  type="text"
                  className="luxury-search-input"
                  placeholder={!selectedOutboundMaterial ? "جستجوی متریال..." : "جستجوی پیمانکار..."}
                  value={outboundSearchQuery}
                  onChange={e => setOutboundSearchQuery(e.target.value)}
                />
                <span className="luxury-search-icon">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </div>
            )}

            <div className="luxury-modal-body">
              {outboundLoading ? (
                <div className="luxury-loading-state">
                  <div className="luxury-spinner"></div>
                  <span>در حال بارگذاری جزئیات خروجی‌ها...</span>
                </div>
              ) : !selectedOutboundMaterial ? (
                /* Level 1: List of Grouped Outbound Materials */
                <div className="luxury-view-slide-in">
                  {getOutboundMaterialsLevel1().length === 0 ? (
                    <div className="luxury-empty-state">
                      <span>هیچ متریال خروجی یافت نشد.</span>
                    </div>
                  ) : (
                    getOutboundMaterialsLevel1().map((item, index) => (
                      <div
                        key={index}
                        className="luxury-material-row interactive"
                        onClick={() => {
                          setSelectedOutboundMaterial(item);
                          setOutboundSearchQuery('');
                        }}
                      >
                        <div className="luxury-material-left">
                          <span className="luxury-material-name">{item.name}</span>
                        </div>
                        <div className="luxury-material-value-wrapper">
                          <span className="luxury-material-qty" style={{ color: 'var(--warning)' }}>{formatNum(item.total_qty)}</span>
                          <span className="luxury-material-unit">{UNIT_LABELS[item.unit] || item.unit}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : !selectedOutboundContractor ? (
                /* Level 2: List of Contractors who received the selected Material */
                <div className="luxury-view-slide-in">
                  <button
                    className="luxury-back-btn"
                    onClick={() => {
                      setSelectedOutboundMaterial(null);
                      setOutboundSearchQuery('');
                    }}
                  >
                    <span className="luxury-back-icon">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                    بازگشت به لیست متریال‌ها
                  </button>

                  <div className="luxury-detail-subtitle">
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      متریال انتخاب شده: {selectedOutboundMaterial.name}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      لیست پیمانکارانی که این متریال را تحویل گرفته‌اند:
                    </div>
                  </div>

                  {getOutboundContractorsLevel2().length === 0 ? (
                    <div className="luxury-empty-state">
                      <span>هیچ پیمانکاری یافت نشد.</span>
                    </div>
                  ) : (
                    getOutboundContractorsLevel2().map((item, index) => (
                      <div
                        key={index}
                        className="luxury-material-row interactive"
                        onClick={() => {
                          setSelectedOutboundContractor(item);
                          setOutboundSearchQuery('');
                        }}
                      >
                        <div className="luxury-material-left">
                          <span className="luxury-material-name">{item.contractor_name}</span>
                        </div>
                        <div className="luxury-material-value-wrapper">
                          <span className="luxury-material-qty" style={{ color: 'var(--warning)' }}>{formatNum(item.total_qty)}</span>
                          <span className="luxury-material-unit">{UNIT_LABELS[selectedOutboundMaterial.unit] || selectedOutboundMaterial.unit}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Level 3: Detailed Tech Specs variation for selected Contractor & Material */
                <div className="luxury-view-slide-in">
                  <button
                    className="luxury-back-btn"
                    onClick={() => {
                      setSelectedOutboundContractor(null);
                      setOutboundSearchQuery('');
                    }}
                  >
                    <span className="luxury-back-icon">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                    بازگشت به لیست پیمانکاران
                  </button>

                  <div className="luxury-detail-subtitle">
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      پیمانکار: {selectedOutboundContractor.contractor_name}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      متریال: {selectedOutboundMaterial.name} ({UNIT_LABELS[selectedOutboundMaterial.unit] || selectedOutboundMaterial.unit})
                    </div>
                  </div>

                  <div className="luxury-details-list">
                    {getOutboundSpecsLevel3().length === 0 ? (
                      <div className="luxury-empty-state">
                        <span>هیچ جزئیات تراکنشی یافت نشد.</span>
                      </div>
                    ) : (
                      getOutboundSpecsLevel3().map((sub, idx) => (
                        <div key={idx} className="luxury-sub-row animate-in">
                          <div className="luxury-sub-specs">
                            <span className="luxury-spec-badge">سایز: {sub.size || '—'}</span>
                            <span className="luxury-spec-badge">جنس: {sub.material_type || '—'}</span>
                            <span className="luxury-spec-badge">ضخامت: {sub.thickness || '—'}</span>
                          </div>
                          <div className="luxury-sub-values">
                            <div className="luxury-sub-value-item">
                              <span className="luxury-sub-value-label">تحویل شده:</span>
                              <span className="luxury-sub-value-qty" style={{ color: 'var(--warning)' }}>{formatNum(sub.total_qty)}</span>
                              <span className="luxury-sub-value-unit">{UNIT_LABELS[sub.unit] || sub.unit}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Luxury Approvals Summary Modal */}
      {isApprovalsModalOpen && (
        <div className="luxury-modal-overlay" onClick={handleCloseApprovalsModal}>
          <div className="luxury-modal-container animate-in" onClick={e => e.stopPropagation()}>
            <div className="luxury-modal-header">
              <h3>تاییدیه دفتر فنی</h3>
              <button className="luxury-close-btn" onClick={handleCloseApprovalsModal}>
                ✕
              </button>
            </div>

            {/* Breadcrumbs Navigation */}
            {(selectedApprovalsContractor || selectedApprovalsMaterial) && (
              <div className="luxury-breadcrumb">
                <span
                  className="luxury-breadcrumb-item"
                  onClick={() => {
                    setSelectedApprovalsContractor(null);
                    setSelectedApprovalsMaterial(null);
                    setApprovalsSearchQuery('');
                  }}
                >
                  لیست پیمانکاران
                </span>
                {selectedApprovalsContractor && (
                  <>
                    <span className="luxury-breadcrumb-separator">←</span>
                    <span
                      className={`luxury-breadcrumb-item ${!selectedApprovalsMaterial ? 'active' : ''}`}
                      onClick={() => {
                        if (selectedApprovalsMaterial) {
                          setSelectedApprovalsMaterial(null);
                          setApprovalsSearchQuery('');
                        }
                      }}
                    >
                      {selectedApprovalsContractor.contractor_name}
                    </span>
                  </>
                )}
                {selectedApprovalsMaterial && (
                  <>
                    <span className="luxury-breadcrumb-separator">←</span>
                    <span className="luxury-breadcrumb-item active">
                      {selectedApprovalsMaterial.name}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Search Wrapper: Level 1 and Level 2 */}
            {!selectedApprovalsMaterial && (
              <div className="luxury-search-wrapper">
                <input
                  type="text"
                  className="luxury-search-input"
                  placeholder={!selectedApprovalsContractor ? "جستجوی پیمانکار..." : "جستجوی متریال..."}
                  value={approvalsSearchQuery}
                  onChange={e => setApprovalsSearchQuery(e.target.value)}
                />
                <span className="luxury-search-icon">
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
              </div>
            )}

            <div className="luxury-modal-body">
              {approvalsLoading ? (
                <div className="luxury-loading-state">
                  <div className="luxury-spinner"></div>
                  <span>در حال بارگذاری اطلاعات تاییدیه‌ها...</span>
                </div>
              ) : !selectedApprovalsContractor ? (
                /* Level 1: List of Contractors with Approvals */
                <div className="luxury-view-slide-in">
                  {getApprovalsContractorsLevel1().length === 0 ? (
                    <div className="luxury-empty-state">
                      <span>هیچ پیمانکاری با تاییدیه دفتر فنی یافت نشد.</span>
                    </div>
                  ) : (
                    getApprovalsContractorsLevel1().map((item, index) => (
                      <div
                        key={index}
                        className="luxury-material-row interactive"
                        onClick={() => {
                          setSelectedApprovalsContractor(item);
                          setApprovalsSearchQuery('');
                        }}
                      >
                        <div className="luxury-material-left" style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                          <span className="luxury-material-name">{item.contractor_name}</span>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            <span>تایید شده:</span>
                            {Object.entries(item.units).map(([unit, val]) => (
                              <span key={unit} style={{ color: 'var(--success)', fontWeight: 600 }}>
                                {formatNum(val)} {UNIT_LABELS[unit] || unit}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : !selectedApprovalsMaterial ? (
                /* Level 2: List of Materials for Selected Contractor */
                <div className="luxury-view-slide-in">
                  <button
                    className="luxury-back-btn"
                    onClick={() => {
                      setSelectedApprovalsContractor(null);
                      setApprovalsSearchQuery('');
                    }}
                  >
                    <span className="luxury-back-icon">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                    بازگشت به لیست پیمانکاران
                  </button>

                  <div className="luxury-detail-subtitle">
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      پیمانکار: {selectedApprovalsContractor.contractor_name}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      لیست متریال‌های تحویلی و تایید شده:
                    </div>
                  </div>

                  {getApprovalsMaterialsLevel2().length === 0 ? (
                    <div className="luxury-empty-state">
                      <span>هیچ متریالی یافت نشد.</span>
                    </div>
                  ) : (
                    getApprovalsMaterialsLevel2().map((item, index) => (
                      <div
                        key={index}
                        className="luxury-material-row interactive"
                        onClick={() => {
                          setSelectedApprovalsMaterial(item);
                          setApprovalsSearchQuery('');
                        }}
                      >
                        <div className="luxury-material-left">
                          <span className="luxury-material-name">{item.name}</span>
                        </div>
                        <div className="luxury-material-value-wrapper" style={{ gap: '1rem' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>تحویلی</span>
                            <span className="luxury-material-qty" style={{ color: 'var(--warning)', fontSize: '1rem' }}>
                              {formatNum(item.total_delivered)}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.1rem' }}>
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>تایید شده</span>
                            <span className="luxury-material-qty" style={{ color: 'var(--success)', fontSize: '1rem' }}>
                              {formatNum(item.total_approved)}
                            </span>
                          </div>
                          <span className="luxury-material-unit" style={{ alignSelf: 'center' }}>
                            {UNIT_LABELS[item.unit] || item.unit}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Level 3: Tech Specs Variations */
                <div className="luxury-view-slide-in">
                  <button
                    className="luxury-back-btn"
                    onClick={() => {
                      setSelectedApprovalsMaterial(null);
                      setApprovalsSearchQuery('');
                    }}
                  >
                    <span className="luxury-back-icon">
                      <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                    بازگشت به لیست متریال‌ها
                  </button>

                  <div className="luxury-detail-subtitle">
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      پیمانکار: {selectedApprovalsContractor.contractor_name}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      متریال: {selectedApprovalsMaterial.name} ({UNIT_LABELS[selectedApprovalsMaterial.unit] || selectedApprovalsMaterial.unit})
                    </div>
                  </div>

                  <div className="luxury-details-list">
                    {getApprovalsSpecsLevel3().length === 0 ? (
                      <div className="luxury-empty-state">
                        <span>هیچ جزئیاتی یافت نشد.</span>
                      </div>
                    ) : (
                      getApprovalsSpecsLevel3().map((sub, idx) => (
                        <div key={idx} className="luxury-sub-row animate-in">
                          <div className="luxury-sub-specs">
                            <span className="luxury-spec-badge">سایز: {sub.size || '—'}</span>
                            <span className="luxury-spec-badge">جنس: {sub.material_type || '—'}</span>
                            <span className="luxury-spec-badge">ضخامت: {sub.thickness || '—'}</span>
                          </div>
                          <div className="luxury-sub-values" style={{ gap: '1.5rem' }}>
                            <div className="luxury-sub-value-item">
                              <span className="luxury-sub-value-label">تحویلی:</span>
                              <span className="luxury-sub-value-qty" style={{ color: 'var(--warning)', fontSize: '0.92rem' }}>
                                {formatNum(sub.total_delivered)}
                              </span>
                              <span className="luxury-sub-value-unit">{UNIT_LABELS[sub.unit] || sub.unit}</span>
                            </div>
                            <div className="luxury-sub-value-item">
                              <span className="luxury-sub-value-label">تایید شده:</span>
                              <span className="luxury-sub-value-qty" style={{ color: 'var(--success)', fontSize: '0.92rem' }}>
                                {formatNum(sub.total_approved)}
                              </span>
                              <span className="luxury-sub-value-unit">{UNIT_LABELS[sub.unit] || sub.unit}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Floating Export Progress Card (Chrome-style Download Manager) */}
      {exportTasks.length > 0 && (
        <div className="download-progress-card multiple">
          <div className="progress-card-header">
            <span className="progress-card-title">لیست دانلودهای گزارش</span>
            <button className="progress-card-close" onClick={() => setExportTasks([])}>× بستن همه</button>
          </div>

          <div className="progress-card-list">
            {exportTasks.map((task) => (
              <div key={task.id} className={`progress-card-item ${task.status === 'PAUSED' ? 'paused' :
                  task.status === 'CANCELLED' ? 'cancelled' : ''
                }`}>
                <div className="progress-item-header">
                  <span className="progress-item-title">
                    {task.type === 'pdf' ? 'گزارش PDF موازنه کل' : 'گزارش اکسل موازنه کل'}
                  </span>
                  <button
                    className="progress-item-close"
                    onClick={() => {
                      if (task.status === 'PENDING' || task.status === 'PROCESSING' || task.status === 'QUEUED') {
                        handleCancelTask(task.id);
                      } else {
                        setExportTasks(prev => prev.filter(t => t.id !== task.id));
                      }
                    }}
                    title={task.status === 'PENDING' || task.status === 'PROCESSING' || task.status === 'QUEUED' ? "لغو دانلود" : "حذف از لیست"}
                  >
                    ×
                  </button>
                </div>

                <div className="progress-bar-container">
                  <div
                    className={`progress-bar-fill ${task.status === 'SUCCESS' ? 'success' :
                        task.status === 'FAILURE' || task.status === 'CANCELLED' ? 'danger' :
                          task.status === 'PAUSED' ? 'warning' : ''
                      }`}
                    style={{ width: `${task.progress}%` }}
                  ></div>
                </div>

                <div className="progress-card-meta">
                  <span className="progress-percentage">
                    {task.status === 'PENDING' && 'در صف...'}
                    {task.status === 'QUEUED' && 'در صف انتظار...'}
                    {task.status === 'PROCESSING' && `${task.progress}%`}
                    {task.status === 'SUCCESS' && 'تکمیل شد'}
                    {task.status === 'PAUSED' && 'متوقف شده'}
                    {task.status === 'CANCELLED' && 'لغو شده'}
                    {task.status === 'FAILURE' && (task.error_message === 'توسط کاربر لغو شد.' || task.error_message === 'لغو شده توسط کاربر' ? 'لغو شد' : 'خطا')}
                  </span>

                  {task.status === 'PROCESSING' && task.eta > 0 && (
                    <span className="progress-eta">
                      باقی‌مانده: {task.eta} ثانیه
                    </span>
                  )}
                  {task.status === 'SUCCESS' && (
                    <span className="progress-eta success-text">
                      فایل دانلود شد
                    </span>
                  )}
                  {task.status === 'FAILURE' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className="progress-eta error-text" title={task.error_message}>
                        {task.error_message === 'توسط کاربر لغو شد.' || task.error_message === 'لغو شده توسط کاربر' ? 'لغو شده' : 'خطا در تولید'}
                      </span>
                      <button
                        className="progress-retry-btn"
                        onClick={() => handleRetryTask(task)}
                        style={{
                          background: 'rgba(99, 102, 241, 0.08)',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontSize: '10px',
                          cursor: 'pointer',
                          color: 'var(--primary-600)',
                          fontFamily: 'inherit',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px'
                        }}
                      >
                        🔄 تلاش مجدد
                      </button>
                    </div>
                  )}

                  {/* Buttons next to each other as requested */}
                  {(task.status === 'PENDING' || task.status === 'PROCESSING') && (
                    <div className="progress-actions">
                      <button className="btn-action pause" onClick={() => handlePauseTask(task.id)}>توقف</button>
                      <button className="btn-action cancel" onClick={() => handleCancelTask(task.id)}>لغو</button>
                    </div>
                  )}
                  {task.status === 'PAUSED' && (
                    <div className="progress-actions">
                      <button className="btn-action resume" onClick={() => handleResumeTask(task)}>ادامه</button>
                      <button className="btn-action cancel" onClick={() => handleCancelTask(task.id)}>لغو</button>
                    </div>
                  )}
                  {task.status === 'QUEUED' && (
                    <div className="progress-actions">
                      <button className="btn-action cancel" onClick={() => handleCancelTask(task.id)}>لغو</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOverview;
