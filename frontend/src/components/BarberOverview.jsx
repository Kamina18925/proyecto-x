import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../App';

const BarberOverview = ({ barber, shop }) => {
  const { state, dispatch } = useContext(AppContext);
  const [showAppointmentsModal, setShowAppointmentsModal] = useState(false);
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [currentAppointment, setCurrentAppointment] = useState(null);
  const [historyMode, setHistoryMode] = useState('week');
  const [historyWeekOffset, setHistoryWeekOffset] = useState(0);
  const [historyMonth, setHistoryMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [historyYear, setHistoryYear] = useState(() => String(new Date().getFullYear()));
  const [historyFromDate, setHistoryFromDate] = useState('');
  const [historyToDate, setHistoryToDate] = useState('');

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const DEFAULT_TIMEZONE_OFFSET = '-04:00';

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

    let d = null;
    if (hasExplicitOffset) d = new Date(s);
    else if (isDateOnly) d = new Date(`${s}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
    else if (isNaiveIsoDateTime) d = new Date(`${s}${DEFAULT_TIMEZONE_OFFSET}`);
    else d = new Date(s);

    const ms = d.getTime();
    return Number.isNaN(ms) ? null : ms;
  };

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

  const getAppointmentStart = (appointment) => {
    return appointment?.startTime || appointment?.date || appointment?.appointmentDate || null;
  };

  const getAppointmentBarberId = (appointment) => {
    return appointment?.barberId ?? appointment?.barber_id ?? null;
  };

  const getAppointmentStatus = (appointment) => {
    return String(appointment?.status || '').trim().toLowerCase();
  };

  const getHistoryRangeMs = () => {
    const rdTodayStr = getRdDateString(new Date());
    if (!rdTodayStr) return { startMs: null, endMs: null };

    const baseMidnight = new Date(`${rdTodayStr}T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
    const baseMs = baseMidnight.getTime();
    if (Number.isNaN(baseMs)) return { startMs: null, endMs: null };

    if (historyMode === 'week') {
      const dow = baseMidnight.getUTCDay();
      const daysSinceMonday = (dow + 6) % 7;
      const startOfWeekMs = baseMs - (daysSinceMonday * 24 * 60 * 60 * 1000);
      const offsetMs = Math.min(3, Math.max(0, Number(historyWeekOffset) || 0)) * 7 * 24 * 60 * 60 * 1000;
      const startMs = startOfWeekMs - offsetMs;
      const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
      return { startMs, endMs };
    }

    if (historyMode === 'month') {
      const [yy, mm] = String(historyMonth || '').split('-');
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

    if (historyMode === 'year') {
      const y = Number(historyYear);
      if (!Number.isFinite(y)) return { startMs: null, endMs: null };
      const start = new Date(`${String(y).padStart(4, '0')}-01-01T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
      const startMs = start.getTime();
      if (Number.isNaN(startMs)) return { startMs: null, endMs: null };
      const end = new Date(`${String(y + 1).padStart(4, '0')}-01-01T00:00:00${DEFAULT_TIMEZONE_OFFSET}`);
      const endMs = end.getTime();
      return { startMs, endMs: Number.isNaN(endMs) ? null : endMs };
    }

    if (historyMode === 'range') {
      const from = String(historyFromDate || '').trim();
      const to = String(historyToDate || '').trim();
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

  const getServiceBasePrice = (service) => {
    if (!service) return 0;
    return toNumber(
      service.basePrice ??
        service.base_price ??
        service.price ??
        service.precio ??
        0
    );
  };

  const getAppointmentTotalPrice = (appointment) => {
    if (!appointment) return 0;

    const direct = appointment.priceAtBooking ?? appointment.price_at_booking ?? null;
    let amount = direct != null ? toNumber(direct) : 0;

    if (amount <= 0) {
      const svcId = appointment.serviceId ?? appointment.service_id ?? null;
      const svc = (state.services || []).find(s => String(s?.id) === String(svcId)) || null;
      amount = getServiceBasePrice(svc);
    }

    if (appointment.additionalServices && appointment.additionalServices.length > 0) {
      amount += appointment.additionalServices.reduce((subTotal, service) => subTotal + toNumber(service?.price), 0);
    }

    return Math.max(0, amount);
  };
  
  // Función para obtener las citas del día actual
  const fetchTodayAppointments = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Filtrar las citas para el día actual y este barbero
    const appointments = state.appointments || [];
    const filtered = appointments.filter(appointment => {
      const start = getAppointmentStart(appointment);
      const appointmentDate = new Date(start);
      if (Number.isNaN(appointmentDate.getTime())) return false;
      appointmentDate.setHours(0, 0, 0, 0);
      const st = getAppointmentStatus(appointment);
      return (
        String(getAppointmentBarberId(appointment)) === String(barber?.id) &&
        appointmentDate.getTime() === today.getTime() &&
        (st === 'confirmed' || st === 'confirmada' || st === 'confirmado' || st.startsWith('confirm') || st === 'in_progress')
      );
    });
    
    // Ordenar por hora de inicio
    const sorted = [...filtered].sort((a, b) => {
      const timeA = new Date(getAppointmentStart(a)).getTime();
      const timeB = new Date(getAppointmentStart(b)).getTime();
      return timeA - timeB;
    });
    
    // Identificar la cita actual (en progreso)
    const current = sorted.find(a => getAppointmentStatus(a) === 'in_progress');
    if (current) {
      setCurrentAppointment(current);
    } else if (sorted.length > 0) {
      // Si no hay cita en progreso, establecer la primera como actual
      // (solo si no hay una cita actualmente en progreso)
      if (!currentAppointment) {
        setCurrentAppointment(sorted[0]);
        // Actualizar el estado de la primera cita a 'in_progress'
        updateAppointmentStatus(sorted[0].id, 'in_progress');
      }
    }
    
    setTodayAppointments(sorted);
  };
  
  // Función para actualizar el estado de una cita
  const updateAppointmentStatus = async (appointmentId, status) => {
    try {
      // Llamada a la API para actualizar el estado
      const response = await fetch(`/api/appointments/${appointmentId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        // Actualizar el estado en la UI
        const updatedAppointments = state.appointments.map(appointment => {
          if (appointment.id === appointmentId) {
            return { ...appointment, status };
          }
          return appointment;
        });
        
        // Actualizar el estado global
        if (dispatch) {
          dispatch({ 
            type: 'SET_APPOINTMENTS', 
            payload: updatedAppointments 
          });
        }
        
        // Refrescar las citas del día
        fetchTodayAppointments();
      } else {
        console.error('Error al actualizar el estado de la cita');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };
  
  // Función para marcar una cita como completada
  const markAsCompleted = async (appointmentId) => {
    await updateAppointmentStatus(appointmentId, 'completed');
    
    // Establecer la siguiente cita como 'en proceso'
    const nextAppointment = todayAppointments.find(a => 
      a.id !== appointmentId && a.status === 'confirmed'
    );
    
    if (nextAppointment) {
      setCurrentAppointment(nextAppointment);
      updateAppointmentStatus(nextAppointment.id, 'in_progress');
    } else {
      setCurrentAppointment(null);
    }
  };
  
  // Efecto para cargar las citas cuando se abre el modal
  useEffect(() => {
    if (showAppointmentsModal) {
      fetchTodayAppointments();
    }
  }, [showAppointmentsModal, state.appointments]);
  
  // Obtener estadísticas reales desde el contexto global
  const appointments = state.appointments || [];
  const reviews = (shop?.reviews || []).filter(r => String(r?.barberId ?? r?.barber_id) === String(barber?.id));

  const nowMs = Date.now();
  const barberAppointments = appointments.filter(a => {
    if (String(getAppointmentBarberId(a)) !== String(barber?.id)) return false;
    const ms = parseAppointmentInstantMs(getAppointmentStart(a));
    return ms != null;
  });
  
  // Calcular estadísticas
  const upcoming = barberAppointments.filter(a => {
    const st = getAppointmentStatus(a);
    const isCancelled = st === 'cancelled' || st === 'cancelada' || st === 'cancelado' || st.startsWith('cancelled') || st.startsWith('cancel');
    const isConfirmed = st === 'confirmed' || st === 'confirmada' || st === 'confirmado' || st.startsWith('confirm');
    if (isCancelled || !isConfirmed) return false;
    const ms = parseAppointmentInstantMs(getAppointmentStart(a));
    if (ms == null) return false;
    return ms > nowMs;
  });
  
  const completed = barberAppointments.filter(a => {
    const st = getAppointmentStatus(a);
    return st === 'completed' || st === 'completada' || st === 'completado' || st.startsWith('complet');
  });
  
  const avgRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) 
    : null;
    
  const specialties = barber?.specialties || [];
  
  // Calcular ingresos de las citas completadas
  const totalEarnings = completed.reduce((sum, appt) => {
    return sum + getAppointmentTotalPrice(appt);
  }, 0);

  const { startMs: historyStartMs, endMs: historyEndMs } = getHistoryRangeMs();
  const historyAppointments = barberAppointments.filter(a => {
    const ms = parseAppointmentInstantMs(getAppointmentStart(a));
    if (ms == null) return false;
    if (historyStartMs != null && ms < historyStartMs) return false;
    if (historyEndMs != null && ms >= historyEndMs) return false;
    return true;
  });

  const historyCompleted = historyAppointments.filter(a => {
    const st = getAppointmentStatus(a);
    return st === 'completed' || st === 'completada' || st === 'completado' || st.startsWith('complet');
  });

  const historyCancelled = historyAppointments.filter(a => {
    const st = getAppointmentStatus(a);
    return st === 'cancelled' || st === 'cancelada' || st === 'cancelado' || st.startsWith('cancelled') || st.startsWith('cancel');
  });

  const historyEarnings = historyCompleted.reduce((sum, appt) => sum + getAppointmentTotalPrice(appt), 0);
  
  // Foto de perfil (intentar varios posibles campos antes de usar avatar por iniciales)
  const photoFromUser =
    barber?.photoUrl ||
    barber?.photo_url ||
    barber?.foto ||
    barber?.avatar ||
    barber?.imageUrl ||
    barber?.profilePhoto ||
    barber?.imagen ||
    null;

  const photo = photoFromUser ||
    'https://ui-avatars.com/api/?name=' + encodeURIComponent(barber?.name || 'Barbero') + '&background=4f46e5&color=fff&size=128';
  
  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex flex-col md:flex-row gap-6 items-center">
          <div className="relative w-32 h-32">
            <img 
              src={photo} 
              alt="Foto del barbero" 
              className="w-32 h-32 rounded-full border-4 border-indigo-200 shadow-md object-cover" 
            />
            <label className="absolute bottom-2 right-2 bg-white rounded-full p-1 shadow cursor-pointer hover:bg-indigo-50 transition-colors">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async e => {
                  if (e.target.files && e.target.files[0]) {
                    const formData = new FormData();
                    formData.append('image', e.target.files[0]);
                    // Subir imagen al backend (endpoint existente en el proyecto)
                    const uploadRes = await fetch('/api/upload', {
                      method: 'POST',
                      body: formData
                    });
                    const uploadData = await uploadRes.json();
                    if (uploadData.url) {
                      // Actualizar sólo en el estado global; el backend actual no expone /api/users/profile
                      if (dispatch) {
                        dispatch({
                          type: 'UPDATE_USER',
                          payload: {
                            id: barber.id,
                            photoUrl: uploadData.url
                          }
                        });
                      }
                    }
                  }
                }}
              />
              <i className="fas fa-camera text-indigo-600"></i> <span className="ml-1 text-xs font-semibold">Editar foto</span>
            </label>
          </div>
          <div className="flex-1 text-center md:text-left">
            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
              <i className="fas fa-user-tie mr-2 text-indigo-500"></i>{barber?.name}
            </h2>
            <p className="mb-1 text-slate-700"><i className="fas fa-store-alt mr-2 text-indigo-400"></i><span className="font-semibold">Barbería:</span> {shop?.name || 'No asignado'}</p>
            <p className="mb-1 text-slate-700"><i className="fas fa-envelope mr-2 text-indigo-400"></i><span className="font-semibold">Correo:</span> {barber?.email}</p>
            <p className="mb-1 text-slate-700"><i className="fas fa-phone-alt mr-2 text-indigo-400"></i><span className="font-semibold">Teléfono:</span> {barber?.phone}</p>
            {specialties.length > 0 && (
              <p className="mb-2 text-slate-700"><i className="fas fa-star mr-2 text-yellow-400"></i><span className="font-semibold">Especialidades:</span> {specialties.join(', ')}</p>
            )}
          </div>
        </div>

        {/* Accesos rápidos */}
        <div className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-4 flex items-center">
            <i className="fas fa-bolt mr-2 text-indigo-500"></i>Accesos Rápidos
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={() => {
                if (dispatch) {
                  dispatch({ type: 'SET_SUB_VIEW', payload: 'barberAppointments' });
                }
              }}
              className="p-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium flex items-center justify-center transition-colors"
            ><i className="fas fa-calendar-check mr-2"></i>Ver Mis Citas</button>
            <button 
              onClick={() => {
                console.log('Navegando a vista Mis Servicios (barberServices)...');
                if (dispatch) {
                  dispatch({ type: 'SET_SUB_VIEW', payload: 'barberServices' });
                }
              }}
              className="p-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium flex items-center justify-center transition-colors"
            ><i className="fas fa-cut mr-2"></i>Gestionar Servicios</button>
          </div>
        </div>
        
        <div className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="text-xl font-semibold text-slate-800 mb-4">Resumen de Actividad</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-indigo-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-indigo-700">{upcoming.length}</div>
              <div className="text-xs text-slate-600">Citas Próximas</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">{completed.length}</div>
              <div className="text-xs text-slate-600">Citas Completadas</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-600">{avgRating || '—'}</div>
              <div className="text-xs text-slate-600">Calificación</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-700">RD${totalEarnings.toLocaleString()}</div>
              <div className="text-xs text-slate-600">Ingresos Totales</div>
            </div>
          </div>
        </div>

        {/* Historial / Resumen General */}
        <div className="mt-6 border-t border-slate-200 pt-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <h3 className="text-xl font-semibold text-slate-800 flex items-center">
              <i className="fas fa-chart-bar mr-2 text-indigo-500"></i>Historial / Resumen General
            </h3>

            <div className="flex flex-wrap items-center gap-2">
              <select
                className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                value={historyMode}
                onChange={(e) => setHistoryMode(e.target.value)}
              >
                <option value="week">Semanal</option>
                <option value="month">Mensual</option>
                <option value="year">Anual</option>
                <option value="range">Rango</option>
              </select>

              {historyMode === 'week' && (
                <select
                  className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                  value={historyWeekOffset}
                  onChange={(e) => setHistoryWeekOffset(Number(e.target.value) || 0)}
                >
                  <option value={0}>Esta semana</option>
                  <option value={1}>Hace 1 semana</option>
                  <option value={2}>Hace 2 semanas</option>
                  <option value={3}>Hace 3 semanas</option>
                </select>
              )}

              {historyMode === 'month' && (
                <input
                  type="month"
                  className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                  value={historyMonth}
                  onChange={(e) => setHistoryMonth(e.target.value)}
                />
              )}

              {historyMode === 'year' && (
                <select
                  className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                  value={historyYear}
                  onChange={(e) => setHistoryYear(e.target.value)}
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

              {historyMode === 'range' && (
                <>
                  <input
                    type="date"
                    className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                    value={historyFromDate}
                    onChange={(e) => setHistoryFromDate(e.target.value)}
                  />
                  <span className="text-sm text-slate-500">a</span>
                  <input
                    type="date"
                    className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                    value={historyToDate}
                    onChange={(e) => setHistoryToDate(e.target.value)}
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-slate-800">{historyAppointments.length}</div>
              <div className="text-xs text-slate-600">Citas (en período)</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700">{historyCompleted.length}</div>
              <div className="text-xs text-slate-600">Completadas (en período)</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-700">{historyCancelled.length}</div>
              <div className="text-xs text-slate-600">Canceladas (en período)</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-700">RD${historyEarnings.toLocaleString()}</div>
              <div className="text-xs text-slate-600">Ingresos (en período)</div>
            </div>
          </div>

          {(historyStartMs == null || historyEndMs == null) && historyMode === 'range' && (
            <div className="text-xs text-slate-500 mt-3">
              Selecciona un rango válido (desde y hasta) para ver el historial.
            </div>
          )}
        </div>
      </div>

      {/* Modal de citas del día */}
      {showAppointmentsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg overflow-hidden">
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
              <h3 className="text-xl font-semibold">
                <i className="fas fa-calendar-day mr-2"></i>
                Citas del Día
              </h3>
              <button onClick={() => setShowAppointmentsModal(false)} className="text-white hover:text-indigo-200">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="p-6">
              {/* Cita actual en proceso */}
              {currentAppointment && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-indigo-700 mb-2 flex items-center">
                    <i className="fas fa-hourglass-half mr-2"></i>
                    En Atención
                  </h4>
                  <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-lg">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{currentAppointment.clientName || 'Cliente'}</p>
                        <p className="text-sm text-slate-600">
                          <i className="far fa-clock mr-1"></i>
                          {currentAppointment.startTime} - {currentAppointment.endTime}
                        </p>
                        <p className="text-sm text-slate-600">
                          <i className="fas fa-cut mr-1"></i>
                          {currentAppointment.serviceName || 'Servicio'}
                        </p>
                      </div>
                      <button 
                        onClick={() => markAsCompleted(currentAppointment.id)}
                        className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm transition-colors"
                      >
                        <i className="fas fa-check mr-1"></i> Completada
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Lista de próximas citas */}
              <h4 className="text-lg font-semibold text-slate-700 mb-2 flex items-center">
                <i className="fas fa-list-ul mr-2 text-indigo-500"></i>
                Próximas Citas
              </h4>
              
              {todayAppointments.filter(a => a.id !== (currentAppointment?.id || '')).length === 0 ? (
                <p className="text-center py-4 text-slate-500">No hay más citas programadas para hoy</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {todayAppointments
                    .filter(a => a.id !== (currentAppointment?.id || ''))
                    .map(appointment => (
                      <div key={appointment.id} className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold">{appointment.clientName || 'Cliente'}</p>
                            <p className="text-sm text-slate-600">
                              <i className="far fa-clock mr-1"></i>
                              {appointment.startTime} - {appointment.endTime}
                            </p>
                            <p className="text-sm text-slate-600">
                              <i className="fas fa-cut mr-1"></i>
                              {appointment.serviceName || 'Servicio'}
                            </p>
                          </div>
                          <div className="text-xs bg-indigo-100 text-indigo-800 rounded-full px-2 py-1">
                            {appointment.status === 'confirmed' ? 'Confirmada' : appointment.status}
                          </div>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
              
              <div className="mt-6 text-center">
                <button 
                  onClick={() => setShowAppointmentsModal(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};



export default BarberOverview;
