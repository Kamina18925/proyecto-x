import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../App';
import api from '../services/apiService';

const days = [
  { key: 'L', name: 'Lunes' },
  { key: 'M', name: 'Martes' },
  { key: 'X', name: 'Miércoles' },
  { key: 'J', name: 'Jueves' },
  { key: 'V', name: 'Viernes' },
  { key: 'S', name: 'Sábado' },
  { key: 'D', name: 'Domingo' },
];

const BarberAvailabilityManagement = ({ barberId }) => {
  const { state, dispatch } = useContext(AppContext);
  const barberCurrentAvailability = Array.isArray(state.barberAvailability[barberId]) ? state.barberAvailability[barberId] : [];
  const barberCurrentBreaks = Array.isArray(state.barberBreaks?.[barberId]) ? state.barberBreaks[barberId] : [];
  const [localAvailability, setLocalAvailability] = useState(
    JSON.parse(JSON.stringify(barberCurrentAvailability))
  );

  const [localBreaks, setLocalBreaks] = useState(JSON.parse(JSON.stringify(barberCurrentBreaks)));
  const [breaksDirty, setBreaksDirty] = useState(false);

  // Configuración de tiempo de llegada (lead time) por barbero
  const globalArrivalConfig = state.barberArrivalBuffers?.[barberId] || {};
  const [useArrivalBuffer, setUseArrivalBuffer] = useState(!!globalArrivalConfig.enabled);
  const [arrivalBufferMinutes, setArrivalBufferMinutes] = useState(globalArrivalConfig.minutes ?? 20);

  // Día libre puntual del barbero
  const [dayOffDate, setDayOffDate] = useState('');
  const [dayOffReason, setDayOffReason] = useState('');
  const [dayOffLoading, setDayOffLoading] = useState(false);

  const [leaveEarlyEnabled, setLeaveEarlyEnabled] = useState(false);
  const [leaveEarlyTime, setLeaveEarlyTime] = useState('');
  const [leaveEarlyNote, setLeaveEarlyNote] = useState('');
  const [leaveEarlyLoading, setLeaveEarlyLoading] = useState(false);
  const [leaveEarlyDirty, setLeaveEarlyDirty] = useState(false);

  useEffect(() => {
    const globalAvailability = Array.isArray(state.barberAvailability[barberId]) ? state.barberAvailability[barberId] : [];
    if (JSON.stringify(globalAvailability) !== JSON.stringify(localAvailability)) {
      setLocalAvailability(JSON.parse(JSON.stringify(globalAvailability)));
    }
  }, [state.barberAvailability, barberId]);

  useEffect(() => {
    if (breaksDirty) return;
    const globalBreaks = Array.isArray(state.barberBreaks?.[barberId]) ? state.barberBreaks[barberId] : [];
    if (JSON.stringify(globalBreaks) !== JSON.stringify(localBreaks)) {
      setLocalBreaks(JSON.parse(JSON.stringify(globalBreaks)));
    }
  }, [state.barberBreaks, barberId, breaksDirty]);

  useEffect(() => {
    const cfg = state.barberArrivalBuffers?.[barberId] || {};
    setUseArrivalBuffer(!!cfg.enabled);
    setArrivalBufferMinutes(cfg.minutes ?? 20);
  }, [state.barberArrivalBuffers, barberId]);

  useEffect(() => {
    if (leaveEarlyDirty) return;

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    const leaveEarlyAppt = (state.appointments || []).find(appt => {
      if (String(appt?.status || '').toLowerCase() !== 'leave_early') return false;
      const apptBarberId = appt.barberId ?? appt.barber_id;
      if (String(apptBarberId) !== String(barberId)) return false;
      const start = appt.startTime || appt.date;
      if (!start) return false;
      const dt = new Date(start);
      if (Number.isNaN(dt.getTime())) return false;
      const yy = dt.getFullYear();
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const dd = String(dt.getDate()).padStart(2, '0');
      const localDateStr = `${yy}-${mm}-${dd}`;
      return localDateStr === todayStr;
    });

    if (leaveEarlyAppt) {
      const start = leaveEarlyAppt.startTime || leaveEarlyAppt.date;
      const dt = start ? new Date(start) : null;
      const hh = dt && !Number.isNaN(dt.getTime()) ? String(dt.getHours()).padStart(2, '0') : '';
      const mn = dt && !Number.isNaN(dt.getTime()) ? String(dt.getMinutes()).padStart(2, '0') : '';
      const timeStr = hh && mn ? `${hh}:${mn}` : '';
      setLeaveEarlyEnabled(true);
      setLeaveEarlyTime(timeStr);
      setLeaveEarlyNote(leaveEarlyAppt.notes || leaveEarlyAppt.notas || '');
    } else {
      setLeaveEarlyEnabled(false);
      setLeaveEarlyTime('');
      setLeaveEarlyNote('');
    }
  }, [state.appointments, barberId, leaveEarlyDirty]);

  const applyArrivalBufferToGlobalState = (enabled, minutes) => {
    dispatch({
      type: 'UPDATE_BARBER_ARRIVAL_BUFFER',
      payload: {
        barberId,
        enabled: !!enabled,
        minutes: Number(minutes) || 0,
      },
    });
  };

  const handleTimeChange = (dayKey, field, value) => {
    setLocalAvailability(prev => {
      const dayIndex = prev.findIndex(d => d.day === dayKey);
      let newAvailability;
      if (dayIndex > -1) {
        const updatedDay = { ...prev[dayIndex], [field]: value };
        // Permitimos explícitamente rangos que terminan a las 00:00 (medianoche),
        // para soportar turnos como 12:00 -> 00:00 sin mostrar error.
        if (field === 'startTime' && updatedDay.endTime && value >= updatedDay.endTime && updatedDay.endTime !== '00:00') {
          dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: `En ${days.find(d => d.key === dayKey).name}, la hora de inicio debe ser anterior a la hora de fin.`, type: 'error' } });
          return prev;
        }
        if (field === 'endTime' && updatedDay.startTime && value <= updatedDay.startTime && value !== '00:00') {
          dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: `En ${days.find(d => d.key === dayKey).name}, la hora de fin debe ser posterior a la hora de inicio.`, type: 'error' } });
          return prev;
        }
        newAvailability = [...prev];
        newAvailability[dayIndex] = updatedDay;
      } else {
        return prev;
      }
      return newAvailability.sort((a, b) => days.findIndex(d => d.key === a.day) - days.findIndex(d => d.key === b.day));
    });
  };

  const handleToggleDay = (dayKey) => {
    setLocalAvailability(prev => {
      const dayExists = prev.some(d => d.day === dayKey);
      let newAvailability;
      if (dayExists) {
        newAvailability = prev.filter(d => d.day !== dayKey);
      } else {
        newAvailability = [...prev, { day: dayKey, startTime: '09:00', endTime: '17:00' }];
      }
      return newAvailability.sort((a, b) => days.findIndex(d => d.key === a.day) - days.findIndex(d => d.key === b.day));
    });
  };

  const breakTypes = [
    { key: 'breakfast', label: 'Desayuno' },
    { key: 'lunch', label: 'Comida' },
    { key: 'dinner', label: 'Cena' },
  ];

  const getBreakItem = (day, type) => {
    const found = (localBreaks || []).find(b => String(b?.day) === String(day) && String(b?.type || b?.break_type) === String(type));
    return found || {
      day,
      type,
      startTime: '',
      endTime: '',
      enabled: false,
    };
  };

  const setBreakItem = (day, type, patch) => {
    setLocalBreaks(prev => {
      const list = Array.isArray(prev) ? [...prev] : [];
      const idx = list.findIndex(b => String(b?.day) === String(day) && String(b?.type || b?.break_type) === String(type));
      const base = idx >= 0 ? list[idx] : { day, type, startTime: '', endTime: '', enabled: false };
      const next = { ...base, ...patch, day, type };
      if (idx >= 0) list[idx] = next;
      else list.push(next);
      return list;
    });
  };

  const handleSaveChanges = async () => {
    const normalizeStatus = (s) => String(s || '').trim().toLowerCase();
    const now = new Date();
    const todayY = now.getFullYear();
    const todayM = String(now.getMonth() + 1).padStart(2, '0');
    const todayD = String(now.getDate()).padStart(2, '0');
    const todayStr = `${todayY}-${todayM}-${todayD}`;
    const dayKeyByIndex = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];

    const toMinutes = (hhmm) => {
      if (!hhmm || typeof hhmm !== 'string') return null;
      const [h, m] = hhmm.split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return (h * 60) + m;
    };

    const buildBreakIntervalsForDay = (dayKey, prevDayKey) => {
      const intervals = [];
      const items = Array.isArray(localBreaks) ? localBreaks : [];
      for (const it of items) {
        const enabled = it?.enabled !== false;
        const type = it?.type || it?.break_type;
        const day = it?.day;
        if (!day || !type) continue;
        if (!enabled) continue;

        const startTime = it?.startTime || it?.start_time;
        const endTime = it?.endTime || it?.end_time;
        const bStart = toMinutes(startTime);
        const bEnd = toMinutes(endTime);
        if (bStart == null || bEnd == null) continue;

        const crosses = bStart > bEnd;
        if (String(day) === String(dayKey)) {
          if (!crosses) {
            intervals.push([bStart, bEnd]);
          } else {
            intervals.push([bStart, 1440]);
          }
        }
        if (crosses && String(day) === String(prevDayKey)) {
          intervals.push([0, bEnd]);
        }
      }
      return intervals;
    };

    const intervalsOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

    const appointmentOverlapsIntervals = (startMin, endMin, intervals) => {
      const apptIntervals = [];
      if (endMin <= 1440) {
        apptIntervals.push([startMin, endMin]);
      } else {
        apptIntervals.push([startMin, 1440]);
        apptIntervals.push([0, endMin - 1440]);
      }
      return intervals.some(([bStart, bEnd]) => apptIntervals.some(([aStart, aEnd]) => intervalsOverlap(aStart, aEnd, bStart, bEnd)));
    };

    const getLocalDateStrFromMs = (ms) => {
      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    const getDayKeyFromMs = (ms) => {
      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) return null;
      return dayKeyByIndex[d.getDay()] || null;
    };

    const getServiceDurationMinutes = (appt) => {
      const apptServiceId = appt?.serviceId ?? appt?.service_id ?? null;
      if (apptServiceId == null) return 0;
      const svc = (state.services || []).find(s => String(s?.id) === String(apptServiceId));
      const raw = svc?.baseDurationMinutes ?? svc?.duration ?? svc?.baseDuration ?? 0;
      return Math.max(0, Number(raw) || 0);
    };

    for (const item of localAvailability) {
      if (!item.startTime || !item.endTime) {
        dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: `Por favor, define ambas horas para ${days.find(d => d.key === item.day).name} o márcalo como día libre.`, type: 'error' } });
        return;
      }
      // Permitimos específicamente rangos que acaban en 00:00 para soportar turnos nocturnos (ej. 12:00 -> 00:00).
      if (item.startTime >= item.endTime && item.endTime !== '00:00') {
        dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: `En ${days.find(d => d.key === item.day).name}, la hora de inicio debe ser anterior a la hora de fin.`, type: 'error' } });
        return;
      }
    }

    for (const d of days) {
      for (const bt of breakTypes) {
        const it = getBreakItem(d.key, bt.key);
        if (!it || it.enabled === false) continue;
        const st = it.startTime || it.start_time;
        const en = it.endTime || it.end_time;
        if (!st || !en) {
          dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: `Completa el rango de ${bt.label} para ${d.name} o desactívalo.`, type: 'error' } });
          return;
        }
        if (String(st) === String(en)) {
          dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: `El rango de ${bt.label} en ${d.name} no puede ser de 0 minutos.`, type: 'error' } });
          return;
        }
      }
    }

    if (leaveEarlyEnabled && !leaveEarlyTime) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Selecciona una hora para retirarte temprano hoy.', type: 'error' } });
      return;
    }

    const leaveEarlyCutoffMinutes = leaveEarlyEnabled ? toMinutes(leaveEarlyTime) : null;
    if (leaveEarlyEnabled && leaveEarlyCutoffMinutes == null) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Hora inválida para retirarte temprano hoy.', type: 'error' } });
      return;
    }

    const newAvailByDayKey = {};
    for (const a of localAvailability) {
      const startMinutes = toMinutes(a.startTime);
      const endMinutesRaw = toMinutes(a.endTime);
      const endMinutes = a.endTime === '00:00' ? (24 * 60) : endMinutesRaw;
      if (startMinutes == null || endMinutes == null) continue;
      newAvailByDayKey[a.day] = { startMinutes, endMinutes };
    }

    const affectedAppointments = (state.appointments || [])
      .filter(appt => {
        const apptBarberId = appt.barberId ?? appt.barber_id;
        if (String(apptBarberId) !== String(barberId)) return false;

        const st = normalizeStatus(appt.status);
        if (st !== 'confirmed') return false;

        const start = appt.startTime || appt.date;
        if (!start) return false;
        const ms = new Date(start).getTime();
        if (Number.isNaN(ms)) return false;
        if (ms < Date.now()) return false;

        const apptDateStr = getLocalDateStrFromMs(ms);
        const dayKey = getDayKeyFromMs(ms);
        if (!apptDateStr || !dayKey) return false;

        const range = newAvailByDayKey[dayKey];
        if (!range) return true;

        const d = new Date(ms);
        const startMin = (d.getHours() * 60) + d.getMinutes();
        const duration = getServiceDurationMinutes(appt);
        const endMin = startMin + duration;

        if (startMin < range.startMinutes) return true;
        if (startMin >= range.endMinutes) return true;
        if (duration > 0 && endMin > range.endMinutes) return true;

        if (leaveEarlyEnabled && apptDateStr === todayStr && leaveEarlyCutoffMinutes != null) {
          if (startMin >= leaveEarlyCutoffMinutes) return true;
          if (duration > 0 && endMin > leaveEarlyCutoffMinutes) return true;
        }

        const prevDayKey = dayKeyByIndex[(d.getDay() + 6) % 7] || null;
        if (prevDayKey) {
          const breakIntervals = buildBreakIntervalsForDay(dayKey, prevDayKey);
          if (duration > 0 && appointmentOverlapsIntervals(startMin, endMin, breakIntervals)) return true;
          if (duration === 0 && breakIntervals.some(([bStart, bEnd]) => startMin >= bStart && startMin < bEnd)) return true;
        }

        return false;
      })
      .map(appt => {
        const start = appt.startTime || appt.date;
        const ms = start ? new Date(start).getTime() : NaN;
        const d = Number.isNaN(ms) ? null : new Date(ms);
        const dateLabel = d
          ? d.toLocaleDateString('es-DO', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: 'short', day: 'numeric' })
          : 'Fecha desconocida';
        const timeLabel = d
          ? d.toLocaleTimeString('es-DO', { timeZone: 'America/Santo_Domingo', hour: '2-digit', minute: '2-digit', hour12: true })
          : '';
        return { appt, ms, dateLabel, timeLabel };
      })
      .sort((a, b) => (a.ms || 0) - (b.ms || 0));

    const performSave = async (cancelIds) => {
      const barberUser = (state.users || []).find(u => String(u?.id) === String(barberId));
      const shopId = barberUser?.shopId ?? barberUser?.shop_id ?? null;

      if (Array.isArray(cancelIds) && cancelIds.length > 0) {
        for (const id of cancelIds) {
          try {
            await dispatch({ type: 'CANCEL_APPOINTMENT', payload: { appointmentId: id, cancelledBy: 'barber' } });
          } catch (e) {
            console.error('Error cancelando cita afectada:', id, e);
          }
        }
      }

      await dispatch({ type: 'UPDATE_BARBER_AVAILABILITY', payload: { barberId, availability: localAvailability } });

      const breaksToSave = (Array.isArray(localBreaks) ? localBreaks : []).map(b => ({
        id: b.id,
        day: b.day,
        type: b.type || b.break_type,
        startTime: b.startTime || b.start_time || '',
        endTime: b.endTime || b.end_time || '',
        enabled: b.enabled !== false,
      }));
      await dispatch({ type: 'UPDATE_BARBER_BREAKS', payload: { barberId, breaks: breaksToSave } });

      await dispatch({
        type: 'UPDATE_BARBER_ARRIVAL_BUFFER',
        payload: {
          barberId,
          enabled: useArrivalBuffer,
          minutes: arrivalBufferMinutes,
        },
      });

      const todayLeaveEarlyAppt = (state.appointments || []).find(appt => {
        const st = String(appt?.status || '').toLowerCase();
        if (st !== 'leave_early') return false;
        const apptBarberId = appt.barberId ?? appt.barber_id;
        if (String(apptBarberId) !== String(barberId)) return false;
        const start = appt.startTime || appt.date;
        if (!start) return false;
        const dt = new Date(start);
        if (Number.isNaN(dt.getTime())) return false;
        const yy = dt.getFullYear();
        const mm = String(dt.getMonth() + 1).padStart(2, '0');
        const dd = String(dt.getDate()).padStart(2, '0');
        return `${yy}-${mm}-${dd}` === todayStr;
      });

      if (!leaveEarlyEnabled && todayLeaveEarlyAppt?.id != null) {
        try {
          setLeaveEarlyLoading(true);
          await api.appointments.cancel(todayLeaveEarlyAppt.id);
        } catch (e) {
          console.error('Error eliminando salida temprana:', e);
        } finally {
          setLeaveEarlyLoading(false);
        }
      }

      if (leaveEarlyEnabled && leaveEarlyTime) {
        try {
          setLeaveEarlyLoading(true);
          await api.appointments.createLeaveEarly({
            date: todayStr,
            time: leaveEarlyTime,
            barberId,
            shopId,
            notes: leaveEarlyNote || null,
          });
        } catch (e) {
          console.error('Error marcando salida temprana:', e);
        } finally {
          setLeaveEarlyLoading(false);
        }
      }

      setLeaveEarlyDirty(false);
      setBreaksDirty(false);
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Disponibilidad actualizada con éxito.', type: 'success' } });
    };

    if (affectedAppointments.length > 0) {
      const firstFew = affectedAppointments.slice(0, 6);
      dispatch({
        type: 'SHOW_MODAL',
        payload: {
          props: { title: 'Confirmar cambios' },
          content: (
            <div className="p-4">
              <div className="text-sm text-slate-700">
                Estos cambios afectan {affectedAppointments.length} cita(s) futura(s). Si continúas, esas citas se cancelarán.
              </div>

              <div className="mt-3 border border-slate-200 rounded-md max-h-48 overflow-y-auto">
                {firstFew.map(({ appt, dateLabel, timeLabel }) => (
                  <div key={appt.id} className="px-3 py-2 border-b border-slate-100 text-sm text-slate-700">
                    {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}
                  </div>
                ))}
                {affectedAppointments.length > firstFew.length && (
                  <div className="px-3 py-2 text-xs text-slate-500">
                    y {affectedAppointments.length - firstFew.length} más...
                  </div>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-md border border-slate-300"
                  onClick={() => dispatch({ type: 'HIDE_MODAL' })}
                >
                  Volver
                </button>
                <button
                  type="button"
                  className="px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-md"
                  onClick={async () => {
                    dispatch({ type: 'HIDE_MODAL' });
                    const ids = affectedAppointments.map(x => x.appt.id);
                    await performSave(ids);
                  }}
                >
                  Cancelar citas y guardar
                </button>
              </div>
            </div>
          ),
        },
      });
      return;
    }

    await performSave([]);
  };

  const handleRemoveLeaveEarly = async (appointmentId) => {
    try {
      setLeaveEarlyLoading(true);
      await api.appointments.cancel(appointmentId);
      setLeaveEarlyLoading(false);
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Salida temprana eliminada. Hoy vuelve a estar disponible para reservas.', type: 'success' },
      });
    } catch (e) {
      console.error('Error al eliminar salida temprana:', e);
      setLeaveEarlyLoading(false);
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Error al eliminar la salida temprana. Intenta de nuevo.', type: 'error' },
      });
    }
  };

  const handleMarkDayOff = async () => {
    if (!dayOffDate) {
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Elige una fecha para marcar el día libre.', type: 'error' },
      });
      return;
    }

    try {
      setDayOffLoading(true);

      // Obtener shopId del barbero actual
      const barber = (state.users || []).find(u => u.id === barberId);
      const shopId = barber?.shopId ?? barber?.shop_id ?? null;

      if (!shopId) {
        setDayOffLoading(false);
        dispatch({
          type: 'SHOW_NOTIFICATION',
          payload: { message: 'No se pudo determinar la barbería del barbero.', type: 'error' },
        });
        return;
      }

      await api.appointments.createDayOff({
        date: dayOffDate,
        barberId,
        shopId,
        notes: dayOffReason || null,
      });

      setDayOffLoading(false);
      setDayOffDate('');
      setDayOffReason('');

      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Día libre registrado correctamente.', type: 'success' },
      });
    } catch (e) {
      console.error('Error al marcar día libre:', e);
      setDayOffLoading(false);
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Error al marcar el día libre. Intenta de nuevo.', type: 'error' },
      });
    }
  };

  const handleRemoveDayOff = async (appointmentId) => {
    try {
      setDayOffLoading(true);
      await api.appointments.cancel(appointmentId);
      setDayOffLoading(false);
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Día libre eliminado. Ese día vuelve a estar disponible para reservas.', type: 'success' },
      });
    } catch (e) {
      console.error('Error al eliminar día libre:', e);
      setDayOffLoading(false);
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Error al eliminar el día libre. Intenta de nuevo.', type: 'error' },
      });
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg">
      <h3 className="text-xl md:text-2xl font-bold text-indigo-700 mb-6 flex items-center"><i className="fas fa-user-clock mr-2"></i>Mi Disponibilidad</h3>

      <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm">
        <h4 className="font-semibold text-amber-900 mb-2">Retirarse temprano hoy</h4>
        <p className="text-xs text-amber-800 mb-3">
          Si lo activas, los clientes no podrán reservar después de esa hora. Si ya tienes citas después de esa hora, al guardar se te pedirá confirmar.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          <div className="flex items-start gap-3">
            <input
              id="leaveEarlyToggle"
              type="checkbox"
              className="mt-1 h-4 w-4 text-amber-600 border-amber-400 rounded"
              checked={leaveEarlyEnabled}
              onChange={e => {
                const enabled = e.target.checked;
                setLeaveEarlyDirty(true);
                setLeaveEarlyEnabled(enabled);
                if (!enabled) {
                  setLeaveEarlyTime('');
                  setLeaveEarlyNote('');
                }
              }}
            />
            <div>
              <label htmlFor="leaveEarlyToggle" className="font-semibold text-amber-900">Activar salida temprana</label>
              <div className="text-[11px] text-amber-800 mt-1">Solo aplica para el día de hoy.</div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-amber-900 mb-1">Hora de salida</label>
            <input
              type="time"
              className="w-full border border-amber-300 rounded-md p-2 text-sm bg-white disabled:bg-slate-100"
              value={leaveEarlyTime}
              onChange={e => {
                setLeaveEarlyDirty(true);
                setLeaveEarlyTime(e.target.value);
              }}
              disabled={!leaveEarlyEnabled}
            />
          </div>

          <div className="md:col-span-1">
            <label className="block text-xs font-medium text-amber-900 mb-1">Nota (opcional)</label>
            <input
              type="text"
              className="w-full border border-amber-300 rounded-md p-2 text-sm bg-white disabled:bg-slate-100"
              value={leaveEarlyNote}
              onChange={e => {
                setLeaveEarlyDirty(true);
                setLeaveEarlyNote(e.target.value);
              }}
              disabled={!leaveEarlyEnabled}
              placeholder="Ej: emergencia, diligencia, etc."
            />
          </div>
        </div>

        {Array.isArray(state.appointments) && state.appointments.some(appt => {
          const st = String(appt?.status || '').toLowerCase();
          if (st !== 'leave_early') return false;
          const apptBarberId = appt.barberId ?? appt.barber_id;
          return String(apptBarberId) === String(barberId);
        }) && (
          <div className="mt-4 border-t border-amber-200 pt-3">
            <div className="text-xs font-semibold text-amber-900 mb-2">Salida temprana registrada</div>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {state.appointments
                .filter(appt => {
                  const st = String(appt?.status || '').toLowerCase();
                  if (st !== 'leave_early') return false;
                  const apptBarberId = appt.barberId ?? appt.barber_id;
                  return String(apptBarberId) === String(barberId);
                })
                .slice(0, 3)
                .map(appt => {
                  const start = appt.startTime || appt.date;
                  const d = start ? new Date(start) : null;
                  const label = d && !Number.isNaN(d.getTime())
                    ? d.toLocaleString('es-DO', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
                    : 'Hora desconocida';
                  return (
                    <li key={appt.id} className="flex items-start justify-between gap-2 bg-amber-100 border border-amber-200 rounded px-2 py-1">
                      <div className="text-xs text-amber-900">
                        <div className="font-semibold">{label}</div>
                      </div>
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 bg-white text-amber-800 border border-amber-300 rounded hover:bg-amber-700 hover:text-white"
                        onClick={() => handleRemoveLeaveEarly(appt.id)}
                        disabled={leaveEarlyLoading}
                      >
                        Quitar
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border border-slate-200 rounded-lg bg-slate-50">
          <thead>
            <tr className="bg-indigo-100 text-indigo-700">
              <th className="py-2 px-3 text-left font-semibold">Día</th>
              <th className="py-2 px-3 text-left font-semibold">¿Trabaja?</th>
              <th className="py-2 px-3 text-left font-semibold">Desde</th>
              <th className="py-2 px-3 text-left font-semibold">Hasta</th>
            </tr>
          </thead>
          <tbody>
            {days.map(day => {
              const dayData = localAvailability.find(d => d.day === day.key);
              const isWorking = !!dayData;
              return (
                <tr key={day.key} className={isWorking ? 'bg-white' : 'bg-slate-100'}>
                  <td className="py-2 px-3 font-medium text-slate-700">{day.name}</td>
                  <td className="py-2 px-3">
                    <input
                      type="checkbox"
                      checked={isWorking}
                      onChange={() => handleToggleDay(day.key)}
                      className="form-checkbox h-5 w-5 text-indigo-600"
                    />
                  </td>
                  <td className="py-2 px-3">
                    {isWorking && (
                      <input
                        type="time"
                        value={dayData.startTime}
                        onChange={e => handleTimeChange(day.key, 'startTime', e.target.value)}
                        className="p-1 border border-slate-300 rounded-md text-sm w-28"
                      />
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {isWorking && (
                      <input
                        type="time"
                        value={dayData.endTime}
                        onChange={e => handleTimeChange(day.key, 'endTime', e.target.value)}
                        className="p-1 border border-slate-300 rounded-md text-sm w-28"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-sm">
        <h4 className="font-semibold text-emerald-900 mb-2">Descansos (desayuno / comida / cena)</h4>
        <div className="text-xs text-emerald-900 mb-3">
          Configura rangos por día. Si un rango cruza medianoche, se aplicará también al inicio del día siguiente.
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full border border-emerald-200 rounded-lg bg-white">
            <thead>
              <tr className="bg-emerald-100 text-emerald-800">
                <th className="py-2 px-3 text-left font-semibold">Día</th>
                <th className="py-2 px-3 text-left font-semibold">Desayuno</th>
                <th className="py-2 px-3 text-left font-semibold">Comida</th>
                <th className="py-2 px-3 text-left font-semibold">Cena</th>
              </tr>
            </thead>
            <tbody>
              {days.map(d => (
                <tr key={d.key} className="border-t border-emerald-100">
                  <td className="py-2 px-3 font-medium text-slate-700">{d.name}</td>
                  {breakTypes.map(bt => {
                    const it = getBreakItem(d.key, bt.key);
                    return (
                      <td key={bt.key} className="py-2 px-3">
                        <div className="flex flex-col gap-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-emerald-900">
                            <input
                              type="checkbox"
                              className="h-4 w-4 text-emerald-600 border-emerald-400 rounded"
                              checked={it.enabled !== false}
                              onChange={(e) => {
                                setBreaksDirty(true);
                                const enabled = e.target.checked;
                                const defaults = {
                                  breakfast: { startTime: '08:00', endTime: '08:30' },
                                  lunch: { startTime: '13:00', endTime: '14:00' },
                                  dinner: { startTime: '19:00', endTime: '20:00' },
                                };
                                const def = defaults[bt.key] || { startTime: '', endTime: '' };
                                setBreakItem(d.key, bt.key, {
                                  enabled,
                                  startTime: it.startTime || it.start_time || (!it.startTime && enabled ? def.startTime : ''),
                                  endTime: it.endTime || it.end_time || (!it.endTime && enabled ? def.endTime : ''),
                                });
                              }}
                            />
                            Activar
                          </label>

                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              className="p-1 border border-emerald-200 rounded-md text-sm w-28 disabled:bg-slate-100"
                              value={it.startTime || it.start_time || ''}
                              disabled={it.enabled === false}
                              onChange={(e) => {
                                setBreaksDirty(true);
                                setBreakItem(d.key, bt.key, { startTime: e.target.value });
                              }}
                            />
                            <span className="text-xs text-emerald-900">a</span>
                            <input
                              type="time"
                              className="p-1 border border-emerald-200 rounded-md text-sm w-28 disabled:bg-slate-100"
                              value={it.endTime || it.end_time || ''}
                              disabled={it.enabled === false}
                              onChange={(e) => {
                                setBreaksDirty(true);
                                setBreakItem(d.key, bt.key, { endTime: e.target.value });
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Configuración de Tiempo de Llegada (margen para que el cliente llegue) */}
      <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
        <div className="flex items-start gap-3">
          <input
            id="arrivalBufferToggle"
            type="checkbox"
            className="mt-1 h-4 w-4 text-yellow-600 border-yellow-400 rounded"
            checked={useArrivalBuffer}
            onChange={e => {
              const enabled = e.target.checked;
              setUseArrivalBuffer(enabled);
              applyArrivalBufferToGlobalState(enabled, enabled ? arrivalBufferMinutes : 0);
            }}
          />
          <div>
            <label htmlFor="arrivalBufferToggle" className="font-semibold text-yellow-900">
              Activar tiempo de llegada para reservas del mismo día
            </label>
            <p className="text-xs text-yellow-800 mt-1">
              Si está activado, cuando un cliente reserve para hoy, la primera hora disponible será la hora actual del sistema más estos minutos de margen.
            </p>
            {useArrivalBuffer && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-medium text-yellow-900">Minutos de margen:</span>
                <select
                  className="border border-yellow-300 rounded-md px-2 py-1 text-xs bg-white"
                  value={arrivalBufferMinutes}
                  onChange={e => {
                    const mins = Number(e.target.value) || 0;
                    setArrivalBufferMinutes(mins);
                    applyArrivalBufferToGlobalState(useArrivalBuffer, mins);
                  }}
                >
                  <option value={10}>10 minutos</option>
                  <option value={15}>15 minutos</option>
                  <option value={20}>20 minutos</option>
                  <option value={30}>30 minutos</option>
                  <option value={45}>45 minutos</option>
                  <option value={60}>60 minutos</option>
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Días libres específicos (excepciones puntuales) */}
      <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm">
        <h4 className="font-semibold text-red-900 mb-2">
          Marcar un día libre (excepción puntual)
        </h4>
        <p className="text-xs text-red-800 mb-3">
          Usa esto cuando tengas una emergencia o no puedas asistir un día específico.
          Los clientes no podrán reservar contigo ese día.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-start">
          <div>
            <label className="block text-xs font-medium text-red-900 mb-1">
              Fecha del día libre
            </label>
            <input
              type="date"
              className="w-full border border-red-300 rounded-md p-2 text-sm"
              value={dayOffDate}
              onChange={e => setDayOffDate(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-red-900 mb-1">
              Justificación (opcional)
            </label>
            <textarea
              className="w-full border border-red-300 rounded-md p-2 text-sm resize-none"
              rows={2}
              placeholder="Ej: Emergencia familiar, cita médica, viaje, etc."
              value={dayOffReason}
              onChange={e => setDayOffReason(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow disabled:opacity-60"
            onClick={handleMarkDayOff}
            disabled={dayOffLoading}
          >
            {dayOffLoading ? 'Guardando...' : 'Marcar día libre'}
          </button>
        </div>

        {Array.isArray(state.appointments) && state.appointments.some(appt => appt.status === 'day_off' && (appt.barberId === barberId || appt.barber_id === barberId)) && (
          <div className="mt-4 border-t border-red-200 pt-3">
            <div className="text-xs font-semibold text-red-900 mb-2">Días libres registrados</div>
            <ul className="space-y-2 max-h-40 overflow-y-auto">
              {state.appointments
                .filter(appt => {
                  if (appt.status !== 'day_off') return false;
                  const apptBarberId = appt.barberId ?? appt.barber_id;
                  return String(apptBarberId) === String(barberId);
                })
                .map(appt => {
                  const start = appt.startTime || appt.date;
                  const d = start ? new Date(start) : null;
                  const labelDate = d && !Number.isNaN(d.getTime())
                    ? `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
                    : 'Fecha desconocida';
                  const reason = appt.notes || appt.notas || '';
                  return (
                    <li key={appt.id} className="flex items-start justify-between gap-2 bg-red-100 border border-red-200 rounded px-2 py-1">
                      <div className="text-xs text-red-900">
                        <div className="font-semibold">{labelDate}</div>
                        {reason && <div className="text-[11px] text-red-800">Motivo: {reason}</div>}
                      </div>
                      <button
                        type="button"
                        className="text-[11px] px-2 py-1 bg-white text-red-700 border border-red-300 rounded hover:bg-red-600 hover:text-white"
                        onClick={() => handleRemoveDayOff(appt.id)}
                        disabled={dayOffLoading}
                      >
                        Quitar
                      </button>
                    </li>
                  );
                })}
            </ul>
          </div>
        )}
      </div>
      <div className="pt-5 flex justify-end space-x-3">
        <button type="button" className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg border border-slate-300 shadow-sm transition-colors" onClick={() => setLocalAvailability(barberCurrentAvailability)}>Cancelar</button>
        <button type="button" className="flex justify-center items-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-5 rounded-lg shadow-md transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" onClick={handleSaveChanges}>
          <i className="fas fa-save mr-2"></i> Guardar Cambios
        </button>
      </div>
    </div>
  );
};

export default BarberAvailabilityManagement;
