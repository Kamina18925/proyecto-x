import React, { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext } from '../App';
import OwnerProductsManagement from './OwnerProductsManagement';
import OwnerSummary from './OwnerSummary';
import OwnerBarbersManagement from './OwnerBarbersManagement';
import OwnerAppointmentsManagement from './OwnerAppointmentsManagement';
import OwnerServicesManagement from './OwnerServicesManagement';
import OwnerBarberShopsManagement from './OwnerBarberShopsManagement';
import OwnerChatSupervision from './OwnerChatSupervision';

// Los componentes ya están importados desde sus propios archivos

// Ahora importado desde su propio archivo

const navItems = [
  { key: 'summary', label: 'Resumen General', icon: 'fas fa-home' },
  { key: 'barberShops', label: 'Barberías', icon: 'fas fa-store-alt' },
  { key: 'shopServices', label: 'Servicios Tienda', icon: 'fas fa-cut' },
  { key: 'manageBarbers', label: 'Gestionar Profesionales', icon: 'fas fa-user-tie' },
  { key: 'shopAppointments', label: 'Citas Tienda', icon: 'fas fa-calendar-check' },
  { key: 'shopProducts', label: 'Productos Tienda', icon: 'fas fa-box-open' }
  ,{ key: 'chatSupervision', label: 'Chats', icon: 'fas fa-comments' }
];

const sectionTitles = {
  summary: 'Resumen General',
  barberShops: 'Barberías',
  shopServices: 'Servicios Tienda',
  manageBarbers: 'Gestionar Profesionales',
  shopAppointments: 'Citas Tienda',
  shopProducts: 'Productos Tienda',
  chatSupervision: 'Supervisión de Chats',
};

const OwnerDashboard = () => {
  const { state, dispatch } = useContext(AppContext);
  const owner = state.currentUser;
  const [activeSection, setActiveSection] = useState('summary');
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [shopSearch, setShopSearch] = useState('');
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [growthPeriod, setGrowthPeriod] = useState('week');
  const [growthWeekOffset, setGrowthWeekOffset] = useState(0);
  const [growthMonth, setGrowthMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [growthYear, setGrowthYear] = useState(() => String(new Date().getFullYear()));
  const [growthFromDate, setGrowthFromDate] = useState('');
  const [growthToDate, setGrowthToDate] = useState('');

  const getAppointmentShopId = (a) => (a?.shopId ?? a?.shop_id ?? null);
  const getUserShopId = (u) => (u?.shopId ?? u?.shop_id ?? null);

  const handleOpenChatFromSidebar = () => {
    try {
      window.dispatchEvent(new Event('open-chat-widget'));
    } catch (e) {
      console.error('No se pudo abrir el chat desde el panel de propietario:', e);
    }
  };

  useEffect(() => {
    const onUnread = (ev) => {
      const count = ev?.detail?.count ?? 0;
      setChatUnreadCount(typeof count === 'number' ? count : 0);
    };
    window.addEventListener('chat-unread-changed', onUnread);
    return () => window.removeEventListener('chat-unread-changed', onUnread);
  }, []);

  const isAdmin = ((owner?.role || owner?.rol || '') + '').toLowerCase().includes('admin');
  const visibleShops = (state.barberShops || []).filter(shop =>
    isAdmin ? true : shop.ownerId === owner?.id
  );

  const currentShop = visibleShops.find(s => s.ownerId === owner?.id) || null;
  const selectedShop = visibleShops.find(s => s.id === selectedShopId) || null;

  const summaryAppointments = isAdmin
    ? (state.appointments || [])
    : (state.appointments || []).filter(a => String(getAppointmentShopId(a) ?? '') === String(currentShop?.id ?? ''));

  const summaryBarbers = isAdmin
    ? (state.users || []).filter(u => String(u?.role || u?.rol || '').toLowerCase().includes('barber'))
    : (state.users || []).filter(u => {
      const role = String(u?.role || u?.rol || '').toLowerCase();
      if (!role.includes('barber')) return false;
      const inList = currentShop?.barberIds?.includes?.(u.id) || false;
      const inShop = String(getUserShopId(u) ?? '') === String(currentShop?.id ?? '');
      return inList || inShop;
    });

  const growthAnalytics = useMemo(() => {
    const appts = Array.isArray(summaryAppointments) ? summaryAppointments : [];

    const normalizeStatus = (status) => String(status || '').trim().toLowerCase();
    const isCompletedStatus = (status) => {
      const s = normalizeStatus(status);
      return s === 'completed' || s === 'completada' || s === 'completado' || s.startsWith('complet');
    };

    const DEFAULT_TIMEZONE_OFFSET = '-04:00';

    const getRdDateString = (date = new Date()) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Santo_Domingo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);

      const y = parts.find(p => p.type === 'year')?.value;
      const m = parts.find(p => p.type === 'month')?.value;
      const d = parts.find(p => p.type === 'day')?.value;
      if (!y || !m || !d) return null;
      return `${y}-${m}-${d}`;
    };
    const parseInstantMs = (raw) => {
      if (!raw) return null;
      if (raw instanceof Date) {
        const ms = raw.getTime();
        return Number.isNaN(ms) ? null : ms;
      }
      const s = String(raw).trim();
      if (!s) return null;

      const hasExplicitOffset = /Z$|[+-]\d{2}:\d{2}$/.test(s);
      const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(s);
      const isNaiveIsoDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s);
      const isNaiveSqlDateTime = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(:\d{2})?$/.test(s);

      let d = null;
      if (hasExplicitOffset) d = new Date(s);
      else if (isDateOnly) d = new Date(`${s}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
      else if (isNaiveIsoDateTime) d = new Date(`${s}${DEFAULT_TIMEZONE_OFFSET}`);
      else if (isNaiveSqlDateTime) d = new Date(`${s.replace(' ', 'T')}${DEFAULT_TIMEZONE_OFFSET}`);
      else d = new Date(s);

      const ms = d.getTime();
      return Number.isNaN(ms) ? null : ms;
    };

    const getApptMs = (a) => parseInstantMs(a?.startTime || a?.date || a?.start_time || null);
    const getClientId = (a) => (a?.clientId ?? a?.client_id ?? null);

    const getGrowthRangeMs = () => {
      const rdTodayStr = getRdDateString(new Date());
      if (!rdTodayStr) return { startMs: null, endMs: null };
      const baseMidnight = new Date(`${rdTodayStr}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
      const baseMs = baseMidnight.getTime();
      if (Number.isNaN(baseMs)) return { startMs: null, endMs: null };

      if (growthPeriod === 'week') {
        const dow = baseMidnight.getUTCDay();
        const daysSinceMonday = (dow + 6) % 7;
        const startOfWeekMs = baseMs - (daysSinceMonday * 24 * 60 * 60 * 1000);
        const offsetWeeks = Math.min(3, Math.max(0, Number(growthWeekOffset) || 0));
        const startMs = startOfWeekMs - (offsetWeeks * 7 * 24 * 60 * 60 * 1000);
        const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
        return { startMs, endMs };
      }

      if (growthPeriod === 'month') {
        const [yy, mm] = String(growthMonth || '').split('-');
        const y = Number(yy);
        const m = Number(mm);
        if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return { startMs: null, endMs: null };
        const start = new Date(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
        const startMs = start.getTime();
        if (Number.isNaN(startMs)) return { startMs: null, endMs: null };
        const next = new Date(start.getTime());
        next.setUTCMonth(next.getUTCMonth() + 1);
        const endMs = next.getTime();
        return { startMs, endMs };
      }

      if (growthPeriod === 'year') {
        const y = Number(growthYear);
        if (!Number.isFinite(y)) return { startMs: null, endMs: null };
        const start = new Date(`${String(y).padStart(4, '0')}-01-01T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
        const startMs = start.getTime();
        if (Number.isNaN(startMs)) return { startMs: null, endMs: null };
        const end = new Date(`${String(y + 1).padStart(4, '0')}-01-01T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
        const endMs = end.getTime();
        return { startMs, endMs: Number.isNaN(endMs) ? null : endMs };
      }

      if (growthPeriod === 'range') {
        const from = String(growthFromDate || '').trim();
        const to = String(growthToDate || '').trim();
        if (!from || !to) return { startMs: null, endMs: null };
        const start = new Date(`${from}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
        const startMs = start.getTime();
        if (Number.isNaN(startMs)) return { startMs: null, endMs: null };
        const end = new Date(`${to}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
        const endMsBase = end.getTime();
        if (Number.isNaN(endMsBase)) return { startMs: null, endMs: null };
        const endMs = endMsBase + 24 * 60 * 60 * 1000;
        return { startMs, endMs };
      }

      return { startMs: null, endMs: null };
    };

    const { startMs: curStart, endMs: curEnd } = getGrowthRangeMs();
    const durationMs = (curStart != null && curEnd != null) ? (curEnd - curStart) : null;

    const prevRange = (() => {
      if (curStart == null || curEnd == null) return { prevStart: null, prevEnd: null };

      if (growthPeriod === 'week') {
        return { prevStart: curStart - (7 * 24 * 60 * 60 * 1000), prevEnd: curStart };
      }

      if (growthPeriod === 'month') {
        const curStartDate = new Date(curStart);
        const prevStartDate = new Date(curStartDate.getTime());
        prevStartDate.setUTCMonth(prevStartDate.getUTCMonth() - 1);
        return { prevStart: prevStartDate.getTime(), prevEnd: curStart };
      }

      if (growthPeriod === 'year') {
        const curStartDate = new Date(curStart);
        const prevStartDate = new Date(curStartDate.getTime());
        prevStartDate.setUTCFullYear(prevStartDate.getUTCFullYear() - 1);
        return { prevStart: prevStartDate.getTime(), prevEnd: curStart };
      }

      if (durationMs == null) return { prevStart: null, prevEnd: null };
      return { prevStart: curStart - durationMs, prevEnd: curStart };
    })();

    const prevStart = prevRange.prevStart;
    const prevEnd = prevRange.prevEnd;

    const firstByClient = new Map();
    const activeCur = new Set();

    for (const a of appts) {
      if (!isCompletedStatus(a?.status)) continue;
      const cid = getClientId(a);
      if (cid == null) continue;
      const ms = getApptMs(a);
      if (ms == null) continue;

      const key = String(cid);
      const prev = firstByClient.get(key);
      if (prev == null || ms < prev) firstByClient.set(key, ms);
      if (ms >= curStart && ms <= curEnd) activeCur.add(key);
    }

    const totalClients = firstByClient.size;

    let newClientsCur = 0;
    let newClientsPrev = 0;
    for (const [, firstMs] of firstByClient.entries()) {
      if (firstMs >= curStart && firstMs <= curEnd) newClientsCur += 1;
      if (firstMs >= prevStart && firstMs <= prevEnd) newClientsPrev += 1;
    }

    const growthPct = (() => {
      if (newClientsPrev <= 0) return newClientsCur > 0 ? 100 : 0;
      return ((newClientsCur - newClientsPrev) / newClientsPrev) * 100;
    })();

    const growthAbs = newClientsCur - newClientsPrev;
    const growthSign = growthAbs >= 0 ? '+' : '';
    const growthLabel = `${growthSign}${Math.round(growthPct)}%`;

    const windowLabel = (() => {
      if (growthPeriod === 'week') {
        const off = Math.min(3, Math.max(0, Number(growthWeekOffset) || 0));
        return off === 0 ? 'Esta semana' : `Hace ${off} semana${off === 1 ? '' : 's'}`;
      }
      if (growthPeriod === 'month') return `Mes: ${growthMonth}`;
      if (growthPeriod === 'year') return `Año: ${growthYear}`;
      if (growthPeriod === 'range') {
        const from = String(growthFromDate || '').trim();
        const to = String(growthToDate || '').trim();
        if (!from || !to) return 'Rango: selecciona fechas';
        return `Rango: ${from} a ${to}`;
      }
      return '';
    })();

    return {
      newClientsCur,
      newClientsPrev,
      activeClientsCur: activeCur.size,
      totalClients,
      growthAbs,
      growthPct,
      growthLabel,
      windowLabel,
    };
  }, [growthFromDate, growthMonth, growthPeriod, growthToDate, growthWeekOffset, growthYear, summaryAppointments]);

  const filteredShops = visibleShops.filter(shop => {
    if (!shopSearch.trim()) return true;
    const term = shopSearch.toLowerCase();
    return (
      (shop.name || '').toLowerCase().includes(term) ||
      (shop.address || '').toLowerCase().includes(term) ||
      (shop.city || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 font-inter" data-component-name="OwnerDashboard">
      <div className="flex min-h-screen overflow-hidden">
        <button
          type="button"
          className="lg:hidden fixed bottom-4 left-4 z-50 p-3 bg-slate-800 text-white rounded-full shadow-lg"
          onClick={() => setIsMobileMenuOpen(v => !v)}
          aria-label={isMobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {isMobileMenuOpen ? (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="M6 6 18 18" />
            </svg>
          ) : (
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 6h16" />
              <path d="M4 12h16" />
              <path d="M4 18h16" />
            </svg>
          )}
        </button>

        {isMobileMenuOpen && (
          <div
            className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
        )}
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-800 text-slate-100 p-4 lg:p-5 space-y-6 min-h-screen flex flex-col shadow-lg transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-auto`}
        >
          <div>
            <h2 className="text-3xl font-bold text-center md:text-left text-white tracking-tight">Style<span className="text-indigo-400">x</span></h2>
            <p className="text-xs text-center md:text-left text-slate-400 mt-1">Panel de Propietario</p>
          </div>
          <nav className="space-y-1.5 flex-grow">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveSection(item.key);
                  setIsMobileMenuOpen(false);
                }}
                data-section={item.key}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 transition-colors duration-150 ease-in-out ${activeSection === item.key ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
              >
                <i className={`${item.icon} w-5 h-5 text-center text-base`}></i>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="border-t border-slate-700 pt-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                handleOpenChatFromSidebar();
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-150 ease-in-out"
            >
              <i className="fas fa-comments w-5 h-5 text-center text-base"></i>
              <span className="flex items-center gap-1">
                Mensajes
                {chatUnreadCount > 0 && (
                  <span className="inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px]">
                    {chatUnreadCount}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                dispatch({ type: 'LOGOUT' });
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 text-slate-300 hover:bg-red-700 hover:text-white transition-colors duration-150 ease-in-out"
            >
              <i className="fas fa-sign-out-alt w-5 h-5 text-center text-base"></i>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </aside>
        {/* Main content */}
        <main className="flex-1 w-full p-6 md:p-8 lg:p-10 custom-scrollbar overflow-y-auto" style={{maxHeight: '100vh'}}>
          <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Panel de Administración</h1>
            </div>
            {owner?.shop_id || owner?.shopId ? (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  dispatch({ type: 'SET_VIEW', payload: 'barberDashboard' });
                }}
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-slate-800 text-slate-100 hover:bg-slate-900 shadow-sm"
              >
                <i className="fas fa-exchange-alt mr-2"></i>
                Cambiar a modo Profesional
              </button>
            ) : null}
          </header>
          <section>
            {activeSection !== 'summary' && (
              <h2 className="text-xl font-semibold text-slate-700 mb-6">{sectionTitles[activeSection]}</h2>
            )}

            {activeSection === 'summary' && (
              <div className="mb-6 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 md:p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-b border-slate-100">
                  <div>
                    <div className="text-lg font-bold text-slate-800">Analítica de Crecimiento</div>
                    <div className="text-xs text-slate-500">{growthAnalytics.windowLabel}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex bg-slate-100 rounded-lg p-1">
                      <button
                        type="button"
                        className={`px-4 py-1.5 text-sm font-medium rounded-md ${growthPeriod === 'week' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
                        onClick={() => setGrowthPeriod('week')}
                      >
                        Semana
                      </button>
                      <button
                        type="button"
                        className={`px-4 py-1.5 text-sm font-medium rounded-md ${growthPeriod === 'month' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
                        onClick={() => setGrowthPeriod('month')}
                      >
                        Mes
                      </button>
                      <button
                        type="button"
                        className={`px-4 py-1.5 text-sm font-medium rounded-md ${growthPeriod === 'year' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
                        onClick={() => setGrowthPeriod('year')}
                      >
                        Año
                      </button>
                      <button
                        type="button"
                        className={`px-4 py-1.5 text-sm font-medium rounded-md ${growthPeriod === 'range' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
                        onClick={() => setGrowthPeriod('range')}
                      >
                        Rango
                      </button>
                    </div>

                    {growthPeriod === 'week' && (
                      <select
                        className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                        value={growthWeekOffset}
                        onChange={(e) => setGrowthWeekOffset(Number(e.target.value) || 0)}
                      >
                        {Array.from({ length: 4 }).map((_, idx) => (
                          <option key={idx} value={idx}>
                            {idx === 0 ? 'Esta semana' : `Hace ${idx} semana${idx === 1 ? '' : 's'}`}
                          </option>
                        ))}
                      </select>
                    )}

                    {growthPeriod === 'month' && (
                      <input
                        type="month"
                        className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                        value={growthMonth}
                        onChange={(e) => setGrowthMonth(e.target.value)}
                      />
                    )}

                    {growthPeriod === 'year' && (
                      <select
                        className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                        value={growthYear}
                        onChange={(e) => setGrowthYear(e.target.value)}
                      >
                        {Array.from({ length: 7 }).map((_, idx) => {
                          const y = new Date().getFullYear() - idx;
                          return (
                            <option key={y} value={String(y)}>
                              {y}
                            </option>
                          );
                        })}
                      </select>
                    )}

                    {growthPeriod === 'range' && (
                      <>
                        <input
                          type="date"
                          className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                          value={growthFromDate}
                          onChange={(e) => setGrowthFromDate(e.target.value)}
                        />
                        <span className="text-sm text-slate-500">a</span>
                        <input
                          type="date"
                          className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                          value={growthToDate}
                          onChange={(e) => setGrowthToDate(e.target.value)}
                        />
                      </>
                    )}
                  </div>
                </div>

                <div className="p-4 md:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="text-xs font-semibold text-slate-500">Clientes nuevos</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{growthAnalytics.newClientsCur}</div>
                    <div className="mt-1 text-xs text-slate-500">Anterior: {growthAnalytics.newClientsPrev}</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="text-xs font-semibold text-slate-500">Clientes activos</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{growthAnalytics.activeClientsCur}</div>
                    <div className="mt-1 text-xs text-slate-500">Con citas completadas en el período</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="text-xs font-semibold text-slate-500">Clientes totales</div>
                    <div className="mt-1 text-2xl font-bold text-slate-900">{growthAnalytics.totalClients}</div>
                    <div className="mt-1 text-xs text-slate-500">Histórico (citas completadas)</div>
                  </div>
                  <div className="bg-slate-50 rounded-xl border border-slate-100 p-4">
                    <div className="text-xs font-semibold text-slate-500">Crecimiento</div>
                    <div className="mt-1 flex items-baseline gap-2">
                      <div className="text-2xl font-bold text-slate-900">{growthAnalytics.growthLabel}</div>
                      <div className={`text-xs font-semibold ${growthAnalytics.growthAbs >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {growthAnalytics.growthAbs >= 0 ? '↑' : '↓'} {Math.abs(growthAnalytics.growthAbs)}
                      </div>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">vs período anterior</div>
                  </div>
                </div>
              </div>
            )}
            {activeSection === 'summary' && (
                <OwnerSummary 
                  shop={currentShop} 
                  appointments={summaryAppointments} 
                  barbers={summaryBarbers} 
                />
              )}
            {activeSection === 'barberShops' && (
                <OwnerBarberShopsManagement />
              )}
            {activeSection === 'shopProducts' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow p-4 mb-4">
                  <h3 className="text-lg font-semibold text-slate-700 mb-3">Seleccionar barbería</h3>
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        placeholder="Buscar barbería por nombre, dirección o ciudad..."
                        value={shopSearch}
                        onChange={e => setShopSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-3 max-h-48 overflow-y-auto border border-slate-200 rounded">
                    {filteredShops.length === 0 && (
                      <div className="p-3 text-sm text-slate-500">No hay barberías que coincidan con la búsqueda.</div>
                    )}
                    {filteredShops.map(shop => (
                      <button
                        key={shop.id}
                        type="button"
                        onClick={() => setSelectedShopId(shop.id)}
                        className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${selectedShopId === shop.id ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        <div className="font-medium">{shop.name}</div>
                        <div className="text-[11px] text-slate-500">{shop.address}</div>
                      </button>
                    ))}
                  </div>
                  {selectedShop && (
                    <div className="mt-3 text-sm text-slate-600">
                      Gestionando productos de: <span className="font-semibold text-indigo-700">{selectedShop.name}</span>
                    </div>
                  )}
                </div>
                {selectedShop ? (
                  <OwnerProductsManagement shop={selectedShop} />
                ) : (
                  <div className="bg-white rounded-xl shadow p-8 text-center text-slate-500">
                    <p className="text-base">Selecciona una barbería para gestionar sus productos.</p>
                  </div>
                )}
              </div>
            )}
            {activeSection === 'manageBarbers' && (
                <OwnerBarbersManagement />
              )}
              {activeSection === 'shopAppointments' && (
                <OwnerAppointmentsManagement />
              )}
              {activeSection === 'shopServices' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow p-4 mb-4">
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">Seleccionar barbería</h3>
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          placeholder="Buscar barbería por nombre, dirección o ciudad..."
                          value={shopSearch}
                          onChange={e => setShopSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-3 max-h-48 overflow-y-auto border border-slate-200 rounded">
                      {filteredShops.length === 0 && (
                        <div className="p-3 text-sm text-slate-500">No hay barberías que coincidan con la búsqueda.</div>
                      )}
                      {filteredShops.map(shop => (
                        <button
                          key={shop.id}
                          type="button"
                          onClick={() => setSelectedShopId(shop.id)}
                          className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${selectedShopId === shop.id ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                          <div className="font-medium">{shop.name}</div>
                          <div className="text-[11px] text-slate-500">{shop.address}</div>
                        </button>
                      ))}
                    </div>
                    {selectedShop && (
                      <div className="mt-3 text-sm text-slate-600">
                        Gestionando servicios de: <span className="font-semibold text-indigo-700">{selectedShop.name}</span>
                      </div>
                    )}
                  </div>
                  {selectedShop ? (
                    <>
                      <h2 className="text-2xl font-bold text-slate-700 mb-4">Servicios Tienda</h2>
                      <OwnerServicesManagement shop={selectedShop} />
                    </>
                  ) : (
                    <div className="bg-white rounded-xl shadow p-8 text-center text-slate-500">
                      <p className="text-base">Selecciona una barbería para gestionar sus servicios.</p>
                    </div>
                  )}
                </div>
              )}
              {activeSection === 'chatSupervision' && (
                <OwnerChatSupervision ownerId={owner?.id} />
              )}
              {activeSection !== 'summary' && activeSection !== 'barberShops' && activeSection !== 'shopProducts' && activeSection !== 'manageBarbers' && activeSection !== 'shopAppointments' && activeSection !== 'shopServices' && (
                <div className="bg-white rounded-xl shadow p-8 flex flex-col items-center justify-center min-h-[200px] text-slate-500">
                  <i className="fas fa-tools text-4xl text-indigo-300 mb-4"></i>
                  <span className="text-lg font-semibold">Próximamente: {sectionTitles[activeSection]}</span>
                </div>
              )}
          </section>
        </main>
      </div>
    </div>
  );
};
export default OwnerDashboard;
