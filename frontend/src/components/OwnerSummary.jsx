import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../App';

const getUserDisplayName = (user) => {
  if (!user) return '';
  return user.name || user.nombre || user.fullName || user.username || '';
};

const getUserPhotoUrl = (user) => {
  if (!user) return null;
  return (
    user.photoUrl ||
    user.photo_url ||
    user.foto ||
    user.avatar ||
    user.imageUrl ||
    user.profilePhoto ||
    user.imagen ||
    user.user_photo_url ||
    null
  );
};

const getInitials = (name) => {
  const s = String(name || '').trim();
  if (!s) return '';
  const parts = s.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const second = parts.length > 1 ? (parts[1]?.[0] || '') : (parts[0]?.[1] || '');
  return (first + second).toUpperCase();
};

const Avatar = ({ user, sizeClass = 'w-10 h-10', className = '' }) => {
  const name = getUserDisplayName(user) || 'Usuario';
  const url = getUserPhotoUrl(user);
  if (url) {
    return (
      <img
        src={url}
        alt={name}
        className={`${sizeClass} rounded-full object-cover border border-slate-200 ${className}`}
        loading="lazy"
      />
    );
  }
  const initials = getInitials(name) || 'U';
  return (
    <div
      className={`${sizeClass} rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold ${className}`}
      aria-label={name}
      title={name}
    >
      {initials}
    </div>
  );
};

const StatCard = ({ icon, count, label, color, trend }) => {
  // Determinar el icono y color de tendencia
  let trendIcon = trend > 0 ? 'fa-arrow-up' : trend < 0 ? 'fa-arrow-down' : 'fa-minus';
  let trendColor = trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-slate-400';
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 transition-all duration-200 ease-in-out hover:shadow-md">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-800">{count}</div>
          <div className="text-sm text-slate-500 mt-1">{label}</div>
          {trend !== undefined && (
            <div className="flex items-center mt-2 text-xs">
              <span className={`${trendColor} mr-1`}>
                <i className={`fas ${trendIcon} mr-1`}></i>
                {Math.abs(trend)}%
              </span>
              <span className="text-slate-400">vs período anterior</span>
            </div>
          )}
        </div>
        <div className={`bg-${color}-100 rounded-full p-3 flex items-center justify-center`}>
          <i className={`fas fa-${icon} text-xl text-${color}-500`}></i>
        </div>
      </div>
    </div>
  );
};

const AppointmentItem = ({ appointment, client, barber, service }) => {
  // Generar colores de estado
  const statusStyles = {
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    'in-progress': 'bg-amber-100 text-amber-800'
  };
  
  const statusNames = {
    completed: 'Completada',
    pending: 'Pendiente',
    cancelled: 'Cancelada',
    'in-progress': 'En progreso'
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="flex items-center p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-b-0">
      <div className="mr-3 flex-shrink-0">
        <Avatar user={client} sizeClass="w-10 h-10" />
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <div className="truncate">
            <div className="font-medium text-slate-800 truncate">{client?.name || 'Cliente'}</div>
            <div className="text-xs text-slate-500 truncate">{service?.name || 'Servicio'}</div>
          </div>
          <span className={`ml-2 px-2 py-1 rounded-full text-xs whitespace-nowrap ${statusStyles[appointment.status] || statusStyles.pending}`}>
            {statusNames[appointment.status] || 'Pendiente'}
          </span>
        </div>
        <div className="flex justify-between mt-1 text-xs">
          <div className="text-slate-500 truncate flex items-center gap-1 min-w-0">
            <Avatar user={barber} sizeClass="w-4 h-4" className="border border-slate-200" />
            <span className="truncate">{barber?.name || 'Barbero'}</span>
          </div>
          <div className="text-slate-500 whitespace-nowrap">
            <i className="far fa-clock mr-1"></i> {formatDate(appointment.startTime || appointment.date)}
          </div>
        </div>
      </div>
    </div>
  );
};

const BarberPerformanceCard = ({ barber, appointments, services }) => {
  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getServicePrice = (svc) => {
    if (!svc) return 0;
    return toNumber(
      svc.basePrice ??
      svc.base_price ??
      svc.price ??
      svc.precio ??
      0
    );
  };

  const getAppointmentPrice = (appt) => {
    if (!appt) return 0;
    const direct = appt.priceAtBooking ?? appt.price_at_booking ?? null;
    if (direct != null) return toNumber(direct);
    const svcId = appt.serviceId ?? appt.service_id ?? null;
    const svc = (services || []).find(s => String(s?.id) === String(svcId));
    return getServicePrice(svc);
  };

  // Calcular estadísticas
  const barberAppointments = appointments.filter(a => a.barberId === barber.id);
  const completedAppointments = barberAppointments.filter(a => a.status === 'completed');
  const completionRate = barberAppointments.length > 0 
    ? Math.round((completedAppointments.length / barberAppointments.length) * 100) 
    : 0;
    
  // Calcular ingresos
  const revenue = completedAppointments.reduce((sum, appointment) => {
    return sum + getAppointmentPrice(appointment);
  }, 0);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <div className="mr-3">
          <Avatar user={barber} sizeClass="w-12 h-12" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-800">{barber.name}</h4>
          <div className="text-xs text-slate-500">{barber.email || 'Email'}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mt-4 text-center">
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-sm text-slate-500">Citas</div>
          <div className="font-bold text-indigo-600">{barberAppointments.length}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-sm text-slate-500">Completadas</div>
          <div className="font-bold text-green-600">{completedAppointments.length}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-sm text-slate-500">Ratio</div>
          <div className="font-bold text-amber-600">{completionRate}%</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-sm text-slate-500">Ingresos</div>
          <div className="font-bold text-blue-600">RD${revenue}</div>
        </div>
      </div>
    </div>
  );
};

const ShopCard = ({ shop, appointments, barbers, revenue, onViewDetails }) => {
  const shopAppointments = appointments.filter(a => a.shopId === shop.id);
  const shopBarbers = barbers.filter(b => b.shopId === shop.id);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600 relative">
        {shop.coverPhoto && (
          <img 
            src={shop.coverPhoto} 
            alt={shop.name} 
            className="w-full h-full object-cover opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-end p-3">
          <h3 className="text-white font-bold text-lg drop-shadow-sm">{shop.name}</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="text-sm text-slate-500 mb-2">
          <i className="fas fa-map-marker-alt mr-1"></i> {shop.city || 'Sin ubicación'}
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-50 rounded p-2">
            <div className="text-xs text-slate-500">Barberos</div>
            <div className="font-semibold text-indigo-600">{shopBarbers.length}</div>
          </div>
          <div className="bg-slate-50 rounded p-2">
            <div className="text-xs text-slate-500">Citas</div>
            <div className="font-semibold text-green-600">{shopAppointments.length}</div>
          </div>
        </div>

        <div className="mt-2 text-sm text-slate-700">
          <span className="text-xs text-slate-500">Ingresos:</span>{' '}
          <span className="font-semibold text-indigo-700">RD${(Number(revenue) || 0).toLocaleString()}</span>
        </div>
        
        <div className="mt-3 text-right">
          <button 
            className="text-indigo-600 text-sm hover:text-indigo-800"
            onClick={onViewDetails}
            data-component-name="ShopCard"
          >
            <i className="fas fa-external-link-alt mr-1"></i> Ver detalles
          </button>
        </div>
      </div>
    </div>
  );
};

const OwnerSummary = ({ shop, appointments, barbers }) => {
  const { state } = useContext(AppContext);
  const owner = state.currentUser;
  const [period, setPeriod] = useState('week');
  const [periodWeekOffset, setPeriodWeekOffset] = useState(0);
  const [periodMonth, setPeriodMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [periodYear, setPeriodYear] = useState(() => String(new Date().getFullYear()));
  const [periodFromDate, setPeriodFromDate] = useState('');
  const [periodToDate, setPeriodToDate] = useState('');

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getServicePrice = (svc) => {
    if (!svc) return 0;
    return toNumber(
      svc.basePrice ??
      svc.base_price ??
      svc.price ??
      svc.precio ??
      0
    );
  };

  const getAppointmentPrice = (appt) => {
    if (!appt) return 0;
    const direct = appt.priceAtBooking ?? appt.price_at_booking ?? null;
    if (direct != null) return toNumber(direct);
    const svcId = appt.serviceId ?? appt.service_id ?? null;
    const svc = (state.services || []).find(s => String(s?.id) === String(svcId));
    return getServicePrice(svc);
  };

  const normalizeStatus = (status) => String(status || '').trim().toLowerCase();
  const isCompletedStatus = (status) => {
    const s = normalizeStatus(status);
    return s === 'completed' || s === 'completada' || s === 'completado' || s.startsWith('complet');
  };

  const normalizePaymentMethod = (m) => {
    const s = String(m || '').trim().toLowerCase();
    if (!s) return null;
    if (s === 'cash' || s === 'efectivo') return 'cash';
    if (s === 'card' || s === 'tarjeta') return 'card';
    if (s === 'transfer' || s === 'transferencia') return 'transfer';
    return null;
  };

  const normalizePaymentStatus = (st) => {
    const s = String(st || '').trim().toLowerCase();
    if (!s) return null;
    if (s === 'paid' || s === 'pagado') return 'paid';
    if (s === 'unpaid' || s === 'no_paid' || s === 'no_payo' || s === 'no_pagado' || s === 'no pago') return 'unpaid';
    if (s === 'pending' || s === 'pendiente') return 'pending';
    return null;
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

  const parseAppointmentInstantMs = (raw) => {
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

  const getPeriodRangeMs = useMemo(() => {
    const rdTodayStr = getRdDateString(new Date());
    if (!rdTodayStr) return { startMs: null, endMs: null, prevStartMs: null, prevEndMs: null };

    const baseMidnight = new Date(`${rdTodayStr}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
    const baseMs = baseMidnight.getTime();
    if (Number.isNaN(baseMs)) return { startMs: null, endMs: null, prevStartMs: null, prevEndMs: null };

    let startMs = null;
    let endMs = null;

    if (period === 'week') {
      const dow = baseMidnight.getUTCDay();
      const daysSinceMonday = (dow + 6) % 7;
      const startOfWeekMs = baseMs - (daysSinceMonday * 24 * 60 * 60 * 1000);
      const offsetWeeks = Math.min(3, Math.max(0, Number(periodWeekOffset) || 0));
      startMs = startOfWeekMs - (offsetWeeks * 7 * 24 * 60 * 60 * 1000);
      endMs = startMs + 7 * 24 * 60 * 60 * 1000;
    } else if (period === 'month') {
      const [yy, mm] = String(periodMonth || '').split('-');
      const y = Number(yy);
      const m = Number(mm);
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        const start = new Date(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-01T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
        const ms = start.getTime();
        if (!Number.isNaN(ms)) {
          startMs = ms;
          const next = new Date(start.getTime());
          next.setUTCMonth(next.getUTCMonth() + 1);
          endMs = next.getTime();
        }
      }
    } else if (period === 'year') {
      const y = Number(periodYear);
      if (Number.isFinite(y)) {
        const start = new Date(`${String(y).padStart(4, '0')}-01-01T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
        const ms = start.getTime();
        if (!Number.isNaN(ms)) {
          startMs = ms;
          const end = new Date(`${String(y + 1).padStart(4, '0')}-01-01T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
          const endMsCalc = end.getTime();
          endMs = Number.isNaN(endMsCalc) ? null : endMsCalc;
        }
      }
    } else if (period === 'range') {
      const from = String(periodFromDate || '').trim();
      const to = String(periodToDate || '').trim();
      if (from && to) {
        const start = new Date(`${from}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
        const sMs = start.getTime();
        const end = new Date(`${to}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
        const eBase = end.getTime();
        if (!Number.isNaN(sMs) && !Number.isNaN(eBase)) {
          startMs = sMs;
          endMs = eBase + 24 * 60 * 60 * 1000;
        }
      }
    }

    const durationMs = (startMs != null && endMs != null) ? (endMs - startMs) : null;
    const prev = (() => {
      if (startMs == null || endMs == null) return { prevStartMs: null, prevEndMs: null };
      if (period === 'week') return { prevStartMs: startMs - (7 * 24 * 60 * 60 * 1000), prevEndMs: startMs };
      if (period === 'month') {
        const curStartDate = new Date(startMs);
        const prevStartDate = new Date(curStartDate.getTime());
        prevStartDate.setUTCMonth(prevStartDate.getUTCMonth() - 1);
        return { prevStartMs: prevStartDate.getTime(), prevEndMs: startMs };
      }
      if (period === 'year') {
        const curStartDate = new Date(startMs);
        const prevStartDate = new Date(curStartDate.getTime());
        prevStartDate.setUTCFullYear(prevStartDate.getUTCFullYear() - 1);
        return { prevStartMs: prevStartDate.getTime(), prevEndMs: startMs };
      }
      if (durationMs == null) return { prevStartMs: null, prevEndMs: null };
      return { prevStartMs: startMs - durationMs, prevEndMs: startMs };
    })();

    return { startMs, endMs, prevStartMs: prev.prevStartMs, prevEndMs: prev.prevEndMs };
  }, [period, periodFromDate, periodMonth, periodToDate, periodWeekOffset, periodYear]);

  const periodAppointments = useMemo(() => {
    const startMs = getPeriodRangeMs.startMs;
    const endMs = getPeriodRangeMs.endMs;
    const list = Array.isArray(appointments) ? appointments : [];
    return list.filter((a) => {
      const ms = parseAppointmentInstantMs(a?.startTime || a?.date || a?.start_time || null);
      if (ms == null) return false;
      if (startMs != null && ms < startMs) return false;
      if (endMs != null && ms >= endMs) return false;
      return true;
    });
  }, [appointments, getPeriodRangeMs.endMs, getPeriodRangeMs.startMs]);

  const prevPeriodAppointments = useMemo(() => {
    const startMs = getPeriodRangeMs.prevStartMs;
    const endMs = getPeriodRangeMs.prevEndMs;
    const list = Array.isArray(appointments) ? appointments : [];
    return list.filter((a) => {
      const ms = parseAppointmentInstantMs(a?.startTime || a?.date || a?.start_time || null);
      if (ms == null) return false;
      if (startMs != null && ms < startMs) return false;
      if (endMs != null && ms >= endMs) return false;
      return true;
    });
  }, [appointments, getPeriodRangeMs.prevEndMs, getPeriodRangeMs.prevStartMs]);
  
  // Navegación entre secciones - con verificación adicional
  const handleNavigation = (section) => {
    try {
      // Buscar el elemento padre del dashboard
      const dashboardElement = document.querySelector('[data-component-name="OwnerDashboard"]');
      if (dashboardElement) {
        // Encontrar todos los botones de navegación
        const navButtons = dashboardElement.querySelectorAll('button[data-section]');
        let found = false;
        // Buscar y hacer clic en el botón de la sección correspondiente
        navButtons.forEach(button => {
          if (button.getAttribute('data-section') === section) {
            button.click();
            found = true;
          }
        });
        
        if (!found) {
          console.log(`No se encontró el botón para la sección: ${section}`);
        }
      } else {
        console.log('No se encontró el componente OwnerDashboard');
      }
    } catch (error) {
      console.error('Error al navegar:', error);
    }
  };
  
  // Abrir el formulario para añadir una barbería - con verificación adicional
  const handleAddBarberShop = () => {
    try {
      // Primero navegar a la sección de barberías
      handleNavigation('barberShops');
      // Luego, con un pequeño retraso, buscar y hacer clic en el botón de añadir
      setTimeout(() => {
        const addButton = document.querySelector('[data-component-name="OwnerBarberShopsManagement"] button[data-action="add"]');
        if (addButton) {
          addButton.click();
        } else {
          console.log('No se encontró el botón de añadir barbería');
        }
      }, 300);
    } catch (error) {
      console.error('Error al abrir formulario de añadir barbería:', error);
    }
  };
  
  // Estadísticas generales
  const totalAppointments = periodAppointments?.length || 0;
  const pendingAppointments = periodAppointments?.filter(a => normalizeStatus(a?.status) === 'pending').length || 0;
  const totalBarbers = barbers?.length || 0;
  
  // Calcular ingresos
  const calculateRevenue = () => {
    return (periodAppointments || [])
      .filter(a => {
        if (!isCompletedStatus(a?.status)) return false;
        const st = normalizePaymentStatus(a?.paymentStatus ?? a?.payment_status ?? null);
        return st !== 'unpaid';
      })
      .reduce((sum, appointment) => {
        return sum + getAppointmentPrice(appointment);
      }, 0);
  };
  
  const totalRevenue = calculateRevenue();

  const paymentBreakdown = useMemo(() => {
    const rows = Array.isArray(periodAppointments) ? periodAppointments : [];
    const completed = rows.filter(a => isCompletedStatus(a?.status));

    const totals = {
      total: 0,
      cash: 0,
      card: 0,
      transfer: 0,
      unmarked: 0,
    };

    for (const appt of completed) {
      const st = normalizePaymentStatus(appt?.paymentStatus ?? appt?.payment_status ?? null);
      if (st === 'unpaid') continue;

      const method = normalizePaymentMethod(appt?.paymentMethod ?? appt?.payment_method ?? null);
      const amount = getAppointmentPrice(appt);
      if (amount <= 0) continue;

      totals.total += amount;
      if (method === 'cash') totals.cash += amount;
      else if (method === 'card') totals.card += amount;
      else if (method === 'transfer') totals.transfer += amount;
      else totals.unmarked += amount;
    }

    const pct = (value) => {
      if (totals.total <= 0) return 0;
      return Math.round((value / totals.total) * 100);
    };

    return {
      totals,
      pct: {
        cash: pct(totals.cash),
        card: pct(totals.card),
        transfer: pct(totals.transfer),
        unmarked: pct(totals.unmarked),
      },
    };
  }, [periodAppointments, state.services]);

  const getTrendPct = (cur, prev) => {
    const a = toNumber(cur);
    const b = toNumber(prev);
    if (b <= 0) return a > 0 ? 100 : 0;
    return Math.round(((a - b) / b) * 100);
  };

  const prevTotalAppointments = prevPeriodAppointments?.length || 0;
  const prevPendingAppointments = prevPeriodAppointments?.filter(a => String(a?.status || '').trim().toLowerCase() === 'pending').length || 0;
  const prevRevenue = (prevPeriodAppointments || [])
    .filter(a => {
      if (!isCompletedStatus(a?.status)) return false;
      const st = normalizePaymentStatus(a?.paymentStatus ?? a?.payment_status ?? null);
      return st !== 'unpaid';
    })
    .reduce((sum, appointment) => sum + getAppointmentPrice(appointment), 0);
  
  // Filtrar citas recientes
  const recentAppointments = [...(appointments || [])]
    .filter((a) => {
      const startMs = getPeriodRangeMs.startMs;
      const endMs = getPeriodRangeMs.endMs;
      const ms = parseAppointmentInstantMs(a?.startTime || a?.date || a?.start_time || null);
      if (ms == null) return false;
      if (startMs != null && ms < startMs) return false;
      if (endMs != null && ms >= endMs) return false;
      return true;
    })
    .sort((a, b) => new Date(b.startTime || b.date) - new Date(a.startTime || a.date))
    .slice(0, 5);
    
  // Obtener los mejores barberos
  const topBarbers = barbers?.slice(0, 3) || [];
    
  // Obtener las barberías visibles para este dueño (o todas si es admin)
  const isAdmin = ((owner?.role || owner?.rol || '') + '').toLowerCase().includes('admin');
  const shops = (state.barberShops || [])
    .filter(s => (isAdmin ? true : s.ownerId === owner?.id))
    .slice(0, 3);

  const shopRevenueMap = (appointments || []).reduce((acc, appt) => {
    const st = String(appt?.status || '').trim().toLowerCase();
    if (st !== 'completed' && st !== 'completada' && st !== 'completado') return acc;
    const sid = appt?.shopId ?? appt?.shop_id ?? null;
    if (sid == null) return acc;
    const key = String(sid);
    acc[key] = (acc[key] || 0) + getAppointmentPrice(appt);
    return acc;
  }, {});

  return (
    <div className="space-y-8" data-component-name="OwnerSummary">
      {/* Encabezado con selectores */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Panel de Control</h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            <button 
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${period === 'week' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
              onClick={() => setPeriod('week')}
              type="button"
            >
              Semana
            </button>
            <button 
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${period === 'month' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
              onClick={() => setPeriod('month')}
              type="button"
            >
              Mes
            </button>
            <button 
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${period === 'year' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
              onClick={() => setPeriod('year')}
              type="button"
            >
              Año
            </button>
            <button 
              className={`px-4 py-1.5 text-sm font-medium rounded-md ${period === 'range' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
              onClick={() => setPeriod('range')}
              type="button"
            >
              Rango
            </button>
          </div>

          {period === 'week' && (
            <select
              className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
              value={periodWeekOffset}
              onChange={(e) => setPeriodWeekOffset(Number(e.target.value) || 0)}
            >
              {Array.from({ length: 4 }).map((_, idx) => (
                <option key={idx} value={idx}>
                  {idx === 0 ? 'Esta semana' : `Hace ${idx} semana${idx === 1 ? '' : 's'}`}
                </option>
              ))}
            </select>
          )}

          {period === 'month' && (
            <input
              type="month"
              className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(e.target.value)}
            />
          )}

          {period === 'year' && (
            <select
              className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
              value={periodYear}
              onChange={(e) => setPeriodYear(e.target.value)}
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

          {period === 'range' && (
            <>
              <input
                type="date"
                className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                value={periodFromDate}
                onChange={(e) => setPeriodFromDate(e.target.value)}
              />
              <span className="text-sm text-slate-500">a</span>
              <input
                type="date"
                className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                value={periodToDate}
                onChange={(e) => setPeriodToDate(e.target.value)}
              />
            </>
          )}
        </div>
      </div>
      
      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon="calendar-check" 
          count={totalAppointments} 
          label="Citas Totales" 
          color="blue" 
          trend={getTrendPct(totalAppointments, prevTotalAppointments)} 
        />
        <StatCard 
          icon="clock" 
          count={pendingAppointments} 
          label="Citas Pendientes" 
          color="amber" 
          trend={getTrendPct(pendingAppointments, prevPendingAppointments)} 
        />
        <StatCard 
          icon="user-tie" 
          count={totalBarbers} 
          label="Profesionales Activos" 
          color="indigo" 
          trend={0} 
        />
        <StatCard 
          icon="dollar-sign" 
          count={`RD$${totalRevenue.toLocaleString()}`} 
          label="Ingresos Totales" 
          color="green" 
          trend={getTrendPct(totalRevenue, prevRevenue)} 
        />
      </div>
      
      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Citas recientes */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h3 className="font-semibold text-slate-800">Citas Recientes</h3>
            <button 
              className="text-indigo-600 text-sm hover:text-indigo-800"
              onClick={() => handleNavigation('shopAppointments')}
            >
              Ver todas <i className="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentAppointments.map(appointment => {
              const client = state.users.find(u => u.id === appointment.clientId);
              const barber = state.users.find(u => u.id === appointment.barberId);
              const service = state.services.find(s => s.id === appointment.serviceId);
              return (
                <AppointmentItem 
                  key={appointment.id} 
                  appointment={appointment} 
                  client={client} 
                  barber={barber} 
                  service={service} 
                />
              );
            })}
            {recentAppointments.length === 0 && (
              <div className="p-4 text-center text-slate-500">
                No hay citas recientes.
              </div>
            )}
          </div>
        </div>
        
        {/* Panel de ingresos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <h3 className="font-semibold text-slate-800">Resumen Financiero</h3>
          </div>
          <div className="p-4">
            <div className="text-center py-6 border-b border-slate-100">
              <div className="text-sm text-slate-500 mb-1">Ingresos Totales</div>
              <div className="text-3xl font-bold text-indigo-600">RD${totalRevenue.toLocaleString()}</div>
              <div className={`flex items-center justify-center mt-2 text-sm ${getTrendPct(totalRevenue, prevRevenue) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                <i className={`fas ${getTrendPct(totalRevenue, prevRevenue) >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'} mr-1`}></i>
                {Math.abs(getTrendPct(totalRevenue, prevRevenue))}% vs período anterior
              </div>
            </div>
            
            <div className="pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-slate-800">Efectivo</div>
                  <div className="text-xs text-slate-500">{paymentBreakdown.pct.cash}% de pagos</div>
                </div>
                <div className="text-lg font-semibold text-slate-800">RD${Math.round(paymentBreakdown.totals.cash).toLocaleString()}</div>
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-slate-800">Tarjeta</div>
                  <div className="text-xs text-slate-500">{paymentBreakdown.pct.card}% de pagos</div>
                </div>
                <div className="text-lg font-semibold text-slate-800">RD${Math.round(paymentBreakdown.totals.card).toLocaleString()}</div>
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-slate-800">Transferencia</div>
                  <div className="text-xs text-slate-500">{paymentBreakdown.pct.transfer}% de pagos</div>
                </div>
                <div className="text-lg font-semibold text-slate-800">RD${Math.round(paymentBreakdown.totals.transfer).toLocaleString()}</div>
              </div>

              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-slate-800">Sin marcar</div>
                  <div className="text-xs text-slate-500">{paymentBreakdown.pct.unmarked}% de pagos</div>
                </div>
                <div className="text-lg font-semibold text-slate-800">RD${Math.round(paymentBreakdown.totals.unmarked).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Sección inferior: Barberos y Barberías */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mejores barberos */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Barberos Destacados</h3>
            <button 
              className="text-indigo-600 text-sm hover:text-indigo-800"
              onClick={() => handleNavigation('manageBarbers')}
            >
              Ver todos <i className="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {topBarbers.map(barber => (
              <BarberPerformanceCard 
                key={barber.id} 
                barber={barber} 
                appointments={state.appointments} 
                services={state.services} 
              />
            ))}
            {topBarbers.length === 0 && (
              <div className="p-4 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-100">
                No hay barberos registrados.
              </div>
            )}
          </div>
        </div>
        
        {/* Barberías */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Mis Barberías</h3>
            <button 
              className="text-indigo-600 text-sm hover:text-indigo-800"
              onClick={() => handleNavigation('barberShops')}
            >
              Ver todas <i className="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
            {shops.map(shop => (
              <ShopCard 
                key={shop.id} 
                shop={shop} 
                appointments={state.appointments} 
                barbers={state.users.filter(u => u.role === 'barber')}
                revenue={shopRevenueMap[String(shop.id)] || 0}
                onViewDetails={() => {
                  handleNavigation('barberShops');
                }} 
              />
            ))}
            {shops.length === 0 && (
              <div className="p-4 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-100">
                No hay barberías registradas.
              </div>
            )}
            
            <div 
              className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 flex flex-col items-center justify-center hover:bg-indigo-100 transition-colors cursor-pointer"
              onClick={handleAddBarberShop}
            >
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                <i className="fas fa-plus text-indigo-500 text-xl"></i>
              </div>
              <div className="font-medium text-indigo-700">Añadir Barbería</div>
              <div className="text-xs text-indigo-500 mt-1">Expande tu negocio</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerSummary;
