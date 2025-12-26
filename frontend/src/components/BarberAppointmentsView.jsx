import React, { useContext, useState, useEffect, useMemo } from 'react';
import { AppContext } from '../App';
import { proposeAdvanceAppointment } from '../services/dataService';
import { getOrCreateConversationForAppointment, sendChatMessage } from '../services/dataService';
import api from '../services/apiService';

// Traducir estados internos de cita a etiquetas en español
const getStatusLabelEs = (status) => {
  if (!status) return 'DESCONOCIDO';
  const s = String(status).trim().toLowerCase();

  if (s === 'confirmed') return 'CONFIRMADA';
  if (s === 'confirmada' || s === 'confirmado') return 'CONFIRMADA';
  if (s === 'completed') return 'COMPLETADA';
  if (s === 'completada' || s === 'completado') return 'COMPLETADA';
  if (s === 'no_show') return 'NO ASISTIÓ';
  if (s === 'no-show' || s === 'noshow') return 'NO ASISTIÓ';
  if (s.startsWith('cancelled_by_barber')) return 'CANCELADA (POR MÍ)';
  if (s.startsWith('cancelled_by_client')) return 'CANCELADA (POR CLIENTE)';
  if (s.startsWith('cancelled')) return 'CANCELADA';
  if (s === 'cancelada' || s === 'cancelado' || s.startsWith('cancelada') || s.startsWith('cancelado') || s.startsWith('cancel')) return 'CANCELADA';
  if (s === 'day_off') return 'DÍA LIBRE';

  return s.replace('_', ' ').toUpperCase();
};

const BarberAppointmentsView = ({ barber, shop }) => {
  const { state, dispatch } = useContext(AppContext);
  const [filter, setFilter] = useState('today'); // 'today', 'upcoming', 'past', 'byDate', 'no_show', 'cancelled'
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  });

  const [historyMode, setHistoryMode] = useState('cancelled');
  const [historyDeleting, setHistoryDeleting] = useState(false);
  const [paymentSavingById, setPaymentSavingById] = useState({});

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

  const getAppointmentStartRaw = (appt) => appt?.startTime || appt?.date || appt?.start_time || null;
  const getAppointmentStartMs = (appt) => parseAppointmentInstantMs(getAppointmentStartRaw(appt));

  const normalizeAppointmentsFromApi = (rows) => (rows || []).map(a => ({
    id: a.id,
    clientId: a.clientId !== undefined ? a.clientId : (a.client_id !== undefined ? a.client_id : null),
    barberId: a.barberId !== undefined ? a.barberId : (a.barber_id !== undefined ? a.barber_id : null),
    shopId: a.shopId !== undefined ? a.shopId : (a.shop_id !== undefined ? a.shop_id : null),
    serviceId: a.serviceId !== undefined ? a.serviceId : (a.service_id !== undefined ? a.service_id : null),
    startTime: a.startTime || a.date || a.start_time || null,
    status: a.status || 'confirmed',
    notes: a.notes || null,
    priceAtBooking: a.priceAtBooking || a.price_at_booking || null,
    clientPhoneNumberAtBooking: a.clientPhoneNumberAtBooking || a.client_phone_number_at_booking || null,
    hiddenForClient: a.hiddenForClient !== undefined ? a.hiddenForClient : (a.hidden_for_client !== undefined ? a.hidden_for_client : false),
    cancelledAt: a.cancelledAt || a.cancelled_at || null,
    actualEndTime: a.actualEndTime || a.actual_end_time || null,
    paymentMethod: a.paymentMethod || a.payment_method || null,
    paymentStatus: a.paymentStatus || a.payment_status || null,
    paymentMarkedAt: a.paymentMarkedAt || a.payment_marked_at || null,
    paymentMarkedBy: a.paymentMarkedBy || a.payment_marked_by || null,
  }));

  const getAppointmentEventMs = (appt, nowMs) => {
    const startMs = getAppointmentStartMs(appt);
    if (startMs == null) return null;

    const cancelled = isCancelledStatus(appt?.status);
    const completed = isCompletedStatus(appt?.status);

    if (cancelled) {
      const cancelledAtMs = parseAppointmentInstantMs(appt?.cancelledAt || appt?.cancelled_at || null);
      if (cancelledAtMs != null && cancelledAtMs > nowMs) return nowMs;
      return cancelledAtMs ?? nowMs;
    }

    if (completed) {
      const completedAtMs = parseAppointmentInstantMs(appt?.actualEndTime || appt?.actual_end_time || null);
      return completedAtMs ?? startMs;
    }

    return startMs;
  };

  const APP_TZ = 'America/Santo_Domingo';
  const getTzDateKey = (ms, timeZone = APP_TZ) => {
    if (!Number.isFinite(ms)) return null;
    const d = new Date(ms);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(d);
    const y = parts.find(p => p.type === 'year')?.value;
    const m = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    if (!y || !m || !day) return null;
    return `${y}-${m}-${day}`;
  };

  const normalizeStatus = (status) => String(status || '').trim().toLowerCase();
  const isCancelledStatus = (st) => {
    const s = normalizeStatus(st);
    return (
      s === 'cancelled' ||
      s === 'cancelada' ||
      s === 'cancelado' ||
      s === 'cancelled_by_client' ||
      s === 'cancelled_by_barber' ||
      s === 'cancelled_by_owner' ||
      s.startsWith('cancelled') ||
      s.startsWith('cancel')
    );
  };
  const isNoShowStatus = (st) => {
    const s = normalizeStatus(st);
    return s === 'no_show' || s === 'no-show' || s === 'noshow';
  };
  const isCompletedStatus = (st) => {
    const s = normalizeStatus(st);
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

  const getPaymentSummary = (appt) => {
    const st = normalizePaymentStatus(appt?.paymentStatus ?? appt?.payment_status ?? null);
    const method = normalizePaymentMethod(appt?.paymentMethod ?? appt?.payment_method ?? null);

    if (st === 'unpaid') {
      return { label: 'No pagó', className: 'bg-red-100 text-red-800' };
    }

    if (st === 'paid') {
      const methodLabel = method === 'card' ? 'Tarjeta' : method === 'transfer' ? 'Transferencia' : method === 'cash' ? 'Efectivo' : 'Pagado';
      return { label: methodLabel, className: 'bg-emerald-100 text-emerald-800' };
    }

    return { label: 'Sin marcar', className: 'bg-slate-100 text-slate-700' };
  };

  const handleUpdateAppointmentPayment = async (appointmentId, paymentMethod, paymentStatus) => {
    const user = state.currentUser || {};
    const requesterId = user.id;
    const requesterRole = user.role || user.rol || '';

    setPaymentSavingById(prev => ({ ...prev, [appointmentId]: true }));
    try {
      const updated = await api.appointments.updatePayment(appointmentId, {
        paymentMethod,
        paymentStatus,
        requesterId,
        requesterRole,
      });

      if (updated && dispatch) {
        dispatch({
          type: 'UPDATE_APPOINTMENT',
          meta: { skipApi: true },
          payload: {
            id: updated.id,
            actualEndTime: updated.actualEndTime || updated.actual_end_time || null,
            paymentMethod: updated.paymentMethod || updated.payment_method || null,
            paymentStatus: updated.paymentStatus || updated.payment_status || null,
            paymentMarkedAt: updated.paymentMarkedAt || updated.payment_marked_at || null,
            paymentMarkedBy: updated.paymentMarkedBy || updated.payment_marked_by || null,
          },
        });
      }
    } catch (e) {
      console.error('No se pudo actualizar el pago de la cita:', e);
    } finally {
      setPaymentSavingById(prev => ({ ...prev, [appointmentId]: false }));
    }
  };

  const getStatusPillClass = (status) => {
    const s = normalizeStatus(status);
    if (isCancelledStatus(s)) return 'bg-red-100 text-red-800';
    if (isNoShowStatus(s)) return 'bg-amber-100 text-amber-800';
    if (isCompletedStatus(s)) return 'bg-green-100 text-green-800';
    if (s === 'confirmed' || s === 'confirmada' || s === 'confirmado' || s.startsWith('confirm')) return 'bg-blue-100 text-blue-800';
    return 'bg-slate-100 text-slate-800';
  };

  const getUserDisplayName = (user) => {
    if (!user) return '';
    return user.name || user.nombre || user.fullName || user.username || '';
  };

  const getFirstName = (fullName) => {
    const s = String(fullName || '').trim();
    if (!s) return '';
    return s.split(/\s+/)[0] || s;
  };

  const ClientBehaviorModalContent = ({ clientId }) => {
    const { state: appState } = useContext(AppContext);
    const [selectedBarberId, setSelectedBarberId] = useState(barber?.id != null ? String(barber.id) : 'all');
    const [isBarberMenuOpen, setIsBarberMenuOpen] = useState(false);
    const [isNotesOpen, setIsNotesOpen] = useState(false);
    const nowMs = Date.now();
    const windowStartMs = nowMs - (90 * 24 * 60 * 60 * 1000);

    const apptsForClient = useMemo(() => {
      const appts = Array.isArray(appState.appointments) ? appState.appointments : [];
      return appts.filter((appt) => {
        const cid = appt?.clientId ?? appt?.client_id ?? null;
        if (cid == null) return false;
        if (String(cid) !== String(clientId)) return false;

        const apptShopId = appt?.shopId ?? appt?.shop_id ?? null;
        if (shop?.id != null && apptShopId != null && String(apptShopId) !== String(shop.id)) return false;

        return true;
      });
    }, [appState.appointments, clientId, shop?.id]);

    const barbersInHistory = useMemo(() => {
      const byId = new Map();
      for (const appt of apptsForClient) {
        const bid = appt?.barberId ?? appt?.barber_id ?? null;
        if (bid == null) continue;
        const startRaw = appt?.startTime || appt?.date || appt?.start_time || null;
        const ms = parseAppointmentInstantMs(startRaw);
        const key = String(bid);
        const prev = byId.get(key);
        if (!prev) byId.set(key, { barberId: key, lastMs: ms || 0 });
        else byId.set(key, { barberId: key, lastMs: Math.max(prev.lastMs || 0, ms || 0) });
      }

      const list = Array.from(byId.values())
        .map((row) => {
          const u = (Array.isArray(appState.users) ? appState.users : []).find((x) => String(x?.id) === String(row.barberId));
          return {
            barberId: row.barberId,
            name: getUserDisplayName(u) || `Barbero ${row.barberId}`,
            lastMs: row.lastMs,
          };
        })
        .sort((a, b) => (b.lastMs || 0) - (a.lastMs || 0));

      const currentId = barber?.id != null ? String(barber.id) : null;
      const current = currentId ? list.find((x) => String(x.barberId) === currentId) : null;
      const rest = currentId ? list.filter((x) => String(x.barberId) !== currentId) : list;

      return {
        current,
        rest,
      };
    }, [apptsForClient, appState.users, barber?.id]);

    const apptsForSelection = useMemo(() => {
      const filtered = apptsForClient.filter((appt) => {
        if (selectedBarberId === 'all') return true;
        const bid = appt?.barberId ?? appt?.barber_id ?? null;
        if (bid == null) return false;
        return String(bid) === String(selectedBarberId);
      });

      return filtered
        .map((appt) => {
          const startRaw = appt?.startTime || appt?.date || appt?.start_time || null;
          const ms = parseAppointmentInstantMs(startRaw);
          return { appt, ms };
        })
        .filter((row) => row.ms != null)
        .sort((a, b) => (b.ms || 0) - (a.ms || 0));
    }, [apptsForClient, selectedBarberId]);

    const notesForSelection = useMemo(() => {
      return apptsForSelection
        .map(({ appt, ms }) => {
          const note = (appt?.notesBarber ?? appt?.notes_barber ?? '').trim();
          if (!note) return null;

          const bid = appt?.barberId ?? appt?.barber_id ?? null;
          const allUsers = Array.isArray(appState.users) ? appState.users : [];
          const bUser = bid != null ? allUsers.find((x) => String(x?.id) === String(bid)) : null;
          const barberName = getUserDisplayName(bUser) || '';

          return {
            appointmentId: appt?.id,
            ms,
            barberName,
            status: appt?.status,
            note,
          };
        })
        .filter(Boolean)
        .sort((a, b) => (b.ms || 0) - (a.ms || 0));
    }, [apptsForSelection, appState.users]);

    const stats = useMemo(() => {
      let total = 0;
      let cancelled = 0;
      let noShow = 0;
      let completed = 0;

      for (const row of apptsForSelection) {
        const appt = row.appt;
        const eventMs = getAppointmentEventMs(appt, nowMs);
        if (eventMs == null) continue;
        if (eventMs < windowStartMs || eventMs > nowMs) continue;

        total += 1;
        if (isCancelledStatus(appt?.status)) cancelled += 1;
        else if (isNoShowStatus(appt?.status)) noShow += 1;
        else if (isCompletedStatus(appt?.status)) completed += 1;
      }

      return { total, cancelled, noShow, completed };
    }, [apptsForSelection, windowStartMs, nowMs]);

    const selectionLabel = useMemo(() => {
      if (selectedBarberId === 'all') return 'Todos los barberos';
      const allUsers = Array.isArray(appState.users) ? appState.users : [];
      const u = allUsers.find((x) => String(x?.id) === String(selectedBarberId));
      const name = getUserDisplayName(u) || 'Barbero';
      return getFirstName(name) || name;
    }, [selectedBarberId, barber?.id, appState.users]);

    const selectedBarberName = useMemo(() => {
      if (selectedBarberId === 'all') return '';
      const allUsers = Array.isArray(appState.users) ? appState.users : [];
      const u = allUsers.find((x) => String(x?.id) === String(selectedBarberId));
      const name = getUserDisplayName(u);
      return getFirstName(name) || name || '';
    }, [selectedBarberId, appState.users]);

    return (
      <div className="p-4">
        <div className="text-sm text-slate-700">
          <div className="font-semibold text-slate-900">Últimos 90 días</div>
          <div className="text-xs text-slate-500 mt-1">Mostrando: <span className="font-semibold">{selectionLabel}</span></div>

          <div className="mt-3 flex gap-2 items-center pb-1 relative">
            <button
              type="button"
              onClick={() => {
                setSelectedBarberId('all');
                setIsBarberMenuOpen(false);
              }}
              className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedBarberId === 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
            >
              Todos
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsBarberMenuOpen((v) => !v)}
                className={`px-3 py-1 rounded-full text-xs font-bold border ${selectedBarberId !== 'all' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              >
                Barberos{selectedBarberName ? `: ${selectedBarberName}` : ''}
              </button>

              {isBarberMenuOpen && (
                <div className="absolute left-0 mt-2 z-10 w-72 max-w-[80vw] bg-white border border-slate-200 rounded-md shadow-lg overflow-hidden">
                  <div className="max-h-56 overflow-y-auto">
                    {[
                      ...(barbersInHistory?.current ? [barbersInHistory.current] : []),
                      ...(barbersInHistory?.rest || []),
                    ].map((b) => (
                      <button
                        key={b.barberId}
                        type="button"
                        onClick={() => {
                          setSelectedBarberId(String(b.barberId));
                          setIsBarberMenuOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${String(selectedBarberId) === String(b.barberId) ? 'bg-slate-100' : ''}`}
                      >
                        <div className="font-semibold text-slate-800">{b.name}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsNotesOpen((v) => !v)}
              className={`ml-1 p-2 rounded-md border ${isNotesOpen ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
              title="Notas de barberos"
              aria-label="Notas de barberos"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 7h10M7 11h10M7 15h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                <path d="M6 3h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H10l-4 3v-3H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="bg-slate-50 rounded-md p-2">
              <div className="text-xs text-slate-500">Citas</div>
              <div className="font-bold text-slate-800">{stats.total}</div>
            </div>
            <div className="bg-red-50 rounded-md p-2">
              <div className="text-xs text-slate-500">Cancelaciones</div>
              <div className="font-bold text-red-700">{stats.cancelled}</div>
            </div>
            <div className="bg-amber-50 rounded-md p-2">
              <div className="text-xs text-slate-500">No asistió</div>
              <div className="font-bold text-amber-700">{stats.noShow}</div>
            </div>
            <div className="bg-green-50 rounded-md p-2">
              <div className="text-xs text-slate-500">Completadas</div>
              <div className="font-bold text-green-700">{stats.completed}</div>
            </div>
          </div>

          {isNotesOpen && (
            <div className="mt-3 border border-slate-200 rounded-md bg-white">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-900">Notas de barberos</div>
                <button
                  type="button"
                  onClick={() => setIsNotesOpen(false)}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900"
                >
                  Cerrar
                </button>
              </div>

              {notesForSelection.length === 0 ? (
                <div className="px-3 py-3 text-sm text-slate-500">No hay notas registradas.</div>
              ) : (
                <div className="max-h-48 overflow-y-auto">
                  {notesForSelection.slice(0, 20).map((n) => {
                    const d = new Date(n.ms);
                    const showBarberName = selectedBarberId === 'all' && n.barberName;
                    const label = getStatusLabelEs(n.status);
                    const pillClass = getStatusPillClass(n.status);

                    return (
                      <details key={`${n.appointmentId}-${n.ms}`} className="px-3 py-2 border-b border-slate-100">
                        <summary className="cursor-pointer select-none">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-slate-700">
                              <div>
                                {d.toLocaleDateString('es-DO', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: 'short', day: 'numeric' })}
                                {' · '}
                                {d.toLocaleTimeString('es-DO', { timeZone: 'America/Santo_Domingo', hour: '2-digit', minute: '2-digit', hour12: true })}
                              </div>
                              {showBarberName && (
                                <div className="text-xs text-slate-500">Barbero: {n.barberName}</div>
                              )}
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${pillClass}`}>{label}</span>
                          </div>
                        </summary>

                        <div className="mt-2 text-sm text-slate-700 whitespace-pre-wrap">{n.note}</div>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-4">
          <div className="font-semibold text-slate-900 mb-2">Últimas citas</div>
          {apptsForSelection.length === 0 ? (
            <div className="text-sm text-slate-500">No hay historial disponible.</div>
          ) : (
            <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-md">
              {apptsForSelection.slice(0, 12).map(({ appt, ms }) => {
                const d = new Date(ms);
                const label = getStatusLabelEs(appt.status);
                const pillClass = getStatusPillClass(appt.status);
                const showBarberName = selectedBarberId === 'all';
                const bid = appt?.barberId ?? appt?.barber_id ?? null;
                const allUsers = Array.isArray(appState.users) ? appState.users : [];
                const bUser = bid != null ? allUsers.find((x) => String(x?.id) === String(bid)) : null;
                const barberName = getUserDisplayName(bUser);

                return (
                  <div key={appt.id} className="flex items-center justify-between gap-3 px-3 py-2 border-b border-slate-100">
                    <div className="text-sm text-slate-700">
                      <div>
                        {d.toLocaleDateString('es-DO', { timeZone: 'America/Santo_Domingo', year: 'numeric', month: 'short', day: 'numeric' })}
                        {' · '}
                        {d.toLocaleTimeString('es-DO', { timeZone: 'America/Santo_Domingo', hour: '2-digit', minute: '2-digit', hour12: true })}
                      </div>
                      {showBarberName && barberName && (
                        <div className="text-xs text-slate-500">Barbero: {barberName}</div>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${pillClass}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const clientBehaviorByClientId = useMemo(() => {
    const map = {};
    const lastDays = 90;
    const nowMs = Date.now();
    const windowStartMs = nowMs - (lastDays * 24 * 60 * 60 * 1000);

    const appts = Array.isArray(state.appointments) ? state.appointments : [];
    for (const appt of appts) {
      const apptShopId = appt?.shopId ?? appt?.shop_id ?? null;
      if (shop?.id != null && apptShopId != null && String(apptShopId) !== String(shop.id)) continue;

      const clientId = appt?.clientId ?? appt?.client_id ?? null;
      if (clientId == null) continue;

      const eventMs = getAppointmentEventMs(appt, nowMs);
      if (eventMs == null) continue;

      const st = appt?.status;
      const cancelled = isCancelledStatus(st);
      const noShow = isNoShowStatus(st);
      const completed = isCompletedStatus(st);

      if (!map[clientId]) {
        map[clientId] = {
          cancelled90: 0,
          noShow90: 0,
          completed90: 0,
          total90: 0,
          lastBadMs: null,
          unpaid90: 0,
        };
      }

      if (eventMs < windowStartMs || eventMs > nowMs) continue;

      map[clientId].total90 += 1;
      if (cancelled) {
        map[clientId].cancelled90 += 1;
        map[clientId].lastBadMs = Math.max(map[clientId].lastBadMs || 0, eventMs);
      } else if (noShow) {
        map[clientId].noShow90 += 1;
        map[clientId].lastBadMs = Math.max(map[clientId].lastBadMs || 0, eventMs);
      } else if (completed) {
        map[clientId].completed90 += 1;
      }

      const paymentStatus = normalizePaymentStatus(appt?.paymentStatus ?? appt?.payment_status ?? null);
      if (paymentStatus === 'unpaid') {
        map[clientId].unpaid90 += 1;
        map[clientId].lastBadMs = Math.max(map[clientId].lastBadMs || 0, eventMs);
      }
    }

    Object.keys(map).forEach((clientId) => {
      const stats = map[clientId];
      const bad = (stats.cancelled90 || 0) + (stats.noShow90 || 0) + (stats.unpaid90 || 0);
      const rate = stats.total90 > 0 ? bad / stats.total90 : 0;

      let level = 'none';
      if ((stats.unpaid90 || 0) >= 1) level = 'high';
      else if ((stats.noShow90 || 0) >= 2) level = 'high';
      else if ((stats.cancelled90 || 0) >= 3) level = 'high';
      else if (bad >= 2) level = 'medium';
      else if (bad === 1) level = 'low';

      map[clientId] = {
        ...stats,
        bad90: bad,
        rate90: rate,
        level,
      };
    });

    return map;
  }, [state.appointments, shop?.id]);

  useEffect(() => {
    let cancelled = false;

    const runAuto = async () => {
      try {
        const nowMs = Date.now();
        const appts = Array.isArray(state.appointments) ? state.appointments : [];
        for (const appt of appts) {
          if (cancelled) return;
          const apptBarberId = appt?.barberId ?? appt?.barber_id ?? null;
          if (apptBarberId == null || barber?.id == null) continue;
          if (String(apptBarberId) !== String(barber.id)) continue;

          const apptShopId = appt?.shopId ?? appt?.shop_id ?? null;
          if (shop?.id != null && apptShopId != null && String(apptShopId) !== String(shop.id)) continue;

          if (!isCompletedStatus(appt?.status)) continue;

          const paymentStatus = normalizePaymentStatus(appt?.paymentStatus ?? appt?.payment_status ?? null);
          const paymentMethod = normalizePaymentMethod(appt?.paymentMethod ?? appt?.payment_method ?? null);
          if (paymentStatus || paymentMethod) continue;

          const completedMs = parseAppointmentInstantMs(appt?.actualEndTime || appt?.actual_end_time || null)
            ?? getAppointmentStartMs(appt);
          if (completedMs == null) continue;

          if (nowMs - completedMs < 2 * 60 * 60 * 1000) continue;
          if (paymentSavingById?.[appt.id]) continue;

          await handleUpdateAppointmentPayment(appt.id, 'cash', 'paid');
        }
      } catch (e) {
        console.error('Error aplicando pago automático:', e);
      }
    };

    runAuto();
    return () => {
      cancelled = true;
    };
  }, [barber?.id, shop?.id, state.appointments]);

  const openClientBehaviorModal = (clientId) => {
    try {
      if (!dispatch) return;
      dispatch({
        type: 'SHOW_MODAL',
        payload: {
          props: { title: 'Historia de comportamiento del cliente' },
          content: <ClientBehaviorModalContent clientId={clientId} />,
        },
      });
    } catch (e) {
      console.error('No se pudo abrir historial de comportamiento del cliente:', e);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      try {
        const refreshed = await api.appointments.getAll();
        if (cancelled || !Array.isArray(refreshed)) return;
        dispatch({ type: 'SET_ALL_DATA', payload: { appointments: normalizeAppointmentsFromApi(refreshed) } });
      } catch (e) {
        console.error('Error refrescando citas (barbero):', e);
      }
    };

    // Refetch inicial al entrar a Mis Citas
    refresh();

    // Polling silencioso mientras el barbero está en esta pantalla
    const intervalId = setInterval(refresh, 3_000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [barber?.id, shop?.id]);

  // Abrir chat enfocado en una cita concreta
  const handleOpenChatForAppointment = (appointmentId) => {
    try {
      const event = new CustomEvent('open-chat-widget', {
        detail: { appointmentId },
      });
      window.dispatchEvent(event);
    } catch (e) {
      console.error('No se pudo abrir el chat para la cita', appointmentId, e);
    }
  };

  // Filtrar citas del barbero según el filtro seleccionado
  const filteredAppointments = (Array.isArray(state.appointments) ? state.appointments : []).filter(appt => {
    const apptBarberId = appt.barberId ?? appt.barber_id;
    if (apptBarberId == null || barber?.id == null) return false;
    if (String(apptBarberId) !== String(barber.id)) return false;

    const apptStartMs = getAppointmentStartMs(appt);
    if (apptStartMs == null) return false;
    const nowMs = Date.now();
    const apptTzDay = getTzDateKey(apptStartMs);
    const todayTzDay = getTzDateKey(nowMs);

    const st = String(appt.status || '').trim().toLowerCase();
    const isCancelled =
      st === 'cancelled' ||
      st === 'cancelada' ||
      st === 'cancelado' ||
      st.startsWith('cancelled') ||
      st.startsWith('cancelada') ||
      st.startsWith('cancelado') ||
      st.startsWith('cancel');
    const isConfirmed = st === 'confirmed' || st === 'confirmada' || st === 'confirmado' || st.startsWith('confirm');
    const isCompleted = st === 'completed' || st === 'completada' || st === 'completado' || st.startsWith('complet');
    const isNoShow = st === 'no_show' || st === 'no-show' || st === 'noshow';

    if (filter === 'today') {
      // Hoy: todas las citas del día actual (cualquier estado)
      return apptTzDay != null && todayTzDay != null && apptTzDay === todayTzDay;
    } else if (filter === 'upcoming') {
      // Próximas: solo confirmadas desde AHORA en adelante, nunca canceladas
      if (isCancelled) return false;
      if (!isConfirmed) return false;
      return apptStartMs >= nowMs;
    } else if (filter === 'past') {
      // Pasadas: solo citas completadas (asistieron), no canceladas
      if (isCancelled) return false;
      return (
        isCompleted &&
        apptStartMs <= nowMs
      );
    } else if (filter === 'byDate') {
      // Por Día: TODAS las citas de ese día, incluyendo canceladas y no_show
      // Comparar por fecha en zona horaria de la barbería.
      return apptTzDay != null && apptTzDay === selectedDate;
    } else if (filter === 'no_show') {
      // No asistieron: solo citas con estado no_show
      return isNoShow;
    } else if (filter === 'cancelled') {
      // Canceladas: solo citas canceladas del barbero
      return isCancelled;
    }
    return true;
  }).sort((a, b) => {
    const ams = getAppointmentStartMs(a) ?? 0;
    const bms = getAppointmentStartMs(b) ?? 0;
    return ams - bms;
  });

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
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
      amount += appointment.additionalServices.reduce((sub, extra) => sub + toNumber(extra?.price), 0);
    }

    return Math.max(0, amount);
  };

  // Función para obtener detalles del servicio de la cita
  const getResolvedAppointmentServiceDetails = (appointment) => {
    // Primero buscar si es un servicio del catálogo
    const catalogService = state.services.find(s => s.id === appointment.serviceId);
    if (catalogService) {
      return {
        name: catalogService.name,
        duration: catalogService.baseDurationMinutes,
        price: getAppointmentTotalPrice(appointment)
      };
    }
    
    // Si no se encuentra, podría ser un servicio personalizado
    return {
      name: appointment.service || 'Servicio',
      duration: appointment.duration || '30',
      price: getAppointmentTotalPrice(appointment)
    };
  };

  // Manejar marcar citas como completadas, canceladas o no-show
  const handleMarkAppointment = async (appointmentId, status) => {
    if (!window.confirm(`¿Seguro que quieres marcar esta cita como ${status}?`)) return;
    
    if (status === 'completed') {
      await dispatch({
        type: 'COMPLETE_APPOINTMENT',
        payload: { appointmentId, completedAt: new Date().toISOString() }
      });

      try {
        const appts = Array.isArray(state.appointments) ? state.appointments : [];
        const appt = appts.find((a) => String(a?.id) === String(appointmentId)) || null;
        const clientId = appt?.clientId ?? appt?.client_id ?? null;
        const shopId = appt?.shopId ?? appt?.shop_id ?? null;
        const reviewed = appt?.clientReviewed !== undefined
          ? appt.clientReviewed
          : (appt?.client_reviewed !== undefined ? appt.client_reviewed : false);

        if (clientId != null && barber?.id != null && shopId != null && !reviewed) {
          const conversationId = await getOrCreateConversationForAppointment(appointmentId);
          if (conversationId) {
            await sendChatMessage({
              conversationId,
              senderId: barber.id,
              receiverId: clientId,
              text: 'Tu cita fue completada. ¿Quieres dejar una reseña sobre tu experiencia?',
              isSystem: true,
              relatedAction: 'REVIEW_REQUEST',
              relatedId: appointmentId,
            });
          }
        }
      } catch (e) {
        console.error('No se pudo enviar el mensaje automático de reseña:', e);
      }
    } else if (status === 'no_show') {
      dispatch({
        type: 'NO_SHOW_APPOINTMENT',
        payload: { appointmentId }
      });
    } else if (status === 'cancelled_by_barber') {
      dispatch({
        type: 'CANCEL_APPOINTMENT',
        payload: { appointmentId, cancelledBy: 'barber' }
      });
    }
  };

  // Manejar editar notas
  const handleEditNotes = (appointment) => {
    dispatch({
      type: 'SHOW_MODAL',
      payload: {
        content: (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-2">Editar Notas</h3>
            <textarea
              className="w-full p-2 border border-slate-300 rounded-md mb-4"
              rows="3"
              defaultValue={appointment.notesBarber || ''}
              id="barberNotes"
              placeholder="Añade tus notas aquí..."
            ></textarea>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => dispatch({ type: 'HIDE_MODAL' })}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >Cancelar</button>
              <button
                onClick={() => {
                  const notes = document.getElementById('barberNotes').value;
                  dispatch({
                    type: 'UPDATE_APPOINTMENT_BARBER_NOTES',
                    payload: { appointmentId: appointment.id, notesBarber: notes }
                  });
                  dispatch({ type: 'HIDE_MODAL' });
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              >Guardar</button>
            </div>
          </div>
        ),
        props: { title: 'Notas del Barbero' }
      }
    });
  };

  // Manejar añadir servicio extra
  const handleAddExtraService = (appointment) => {
    dispatch({
      type: 'SHOW_MODAL',
      payload: {
        content: (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Añadir Servicio Extra</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="extra-service-name" className="block text-sm font-medium text-slate-700 mb-1">Nombre del Servicio</label>
                <input type="text" id="extra-service-name" className="w-full p-2 border border-slate-300 rounded-md" placeholder="Ej: Recorte de barba" />
              </div>
              <div>
                <label htmlFor="extra-service-price" className="block text-sm font-medium text-slate-700 mb-1">Precio (RD$)</label>
                <input type="number" id="extra-service-price" className="w-full p-2 border border-slate-300 rounded-md" placeholder="0" min="0" />
              </div>
              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => dispatch({ type: 'HIDE_MODAL' })}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
                >Cancelar</button>
                <button
                  onClick={() => {
                    const name = document.getElementById('extra-service-name').value;
                    const price = Number(document.getElementById('extra-service-price').value);
                    if (!name || isNaN(price) || price <= 0) {
                      alert('Por favor completa todos los campos correctamente');
                      return;
                    }
                    dispatch({
                      type: 'ADD_EXTRA_SERVICE_TO_APPOINTMENT',
                      payload: {
                        appointmentId: appointment.id,
                        extraService: {
                          id: `extra_${Date.now()}`,
                          name,
                          price
                        }
                      }
                    });
                    dispatch({ type: 'HIDE_MODAL' });
                  }}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
                >Añadir</button>
              </div>
            </div>
          </div>
        ),
        props: { title: 'Añadir Servicio Extra' }
      }
    });
  };

  // Manejar eliminar servicio extra
  const handleRemoveExtraService = (appointmentId, extraServiceId) => {
    if (!window.confirm('¿Seguro que quieres eliminar este servicio extra?')) return;
    
    dispatch({
      type: 'REMOVE_EXTRA_SERVICE_FROM_APPOINTMENT',
      payload: { appointmentId, extraServiceId }
    });
  };

  // Manejar ofrecer adelanto de cita
  const handleOfferAdvance = (appointment) => {
    const now = new Date();
    const apptStartMs = getAppointmentStartMs(appointment);
    const apptStartTime = new Date(apptStartMs || Date.now());

    const toLocalInputValue = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const minValue = toLocalInputValue(now);
    const maxValue = toLocalInputValue(apptStartTime);

    dispatch({
      type: 'SHOW_MODAL',
      payload: {
        content: (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Ofrecer Adelanto de Cita</h3>
            <p className="text-slate-600 mb-4">¿Tienes disponibilidad para atender al cliente antes? Selecciona la nueva hora propuesta:</p>
            <input
              type="datetime-local"
              className="w-full p-2 border border-slate-300 rounded-md mb-4"
              id="advance-time"
              min={minValue}
              max={maxValue}
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => dispatch({ type: 'HIDE_MODAL' })}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >Cancelar</button>
              <button
                onClick={async () => {
                  const input = document.getElementById('advance-time');
                  const newTime = input?.value;
                  if (!newTime) {
                    alert('Por favor selecciona una hora válida');
                    return;
                  }

                  try {
                    await proposeAdvanceAppointment(appointment.id, newTime);
                    dispatch({ type: 'HIDE_MODAL' });
                    dispatch({
                      type: 'SHOW_NOTIFICATION',
                      payload: {
                        message: 'Se ha enviado la propuesta de adelanto al cliente.',
                        type: 'success',
                      },
                    });
                  } catch (error) {
                    console.error('Error al enviar propuesta de adelanto:', error);
                    dispatch({ type: 'HIDE_MODAL' });
                    dispatch({
                      type: 'SHOW_NOTIFICATION',
                      payload: {
                        message: 'No se pudo enviar la propuesta de adelanto. Inténtalo de nuevo.',
                        type: 'error',
                      },
                    });
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-md"
              >Enviar Propuesta</button>
            </div>
          </div>
        ),
        props: { title: 'Adelantar Cita' }
      }
    });
  };

  return (
    <div className="card overflow-hidden">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Gestión de Mis Citas</h2>

      <div className="mb-6 bg-slate-50 border border-slate-200 rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-800">Eliminación de historial</div>
            <div className="text-xs text-slate-600 mt-1">
              Borra permanentemente citas de días anteriores (desde ayer hacia atrás).
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <select
              className="border border-slate-300 rounded-md px-2 py-2 text-sm"
              value={historyMode}
              onChange={(e) => setHistoryMode(e.target.value)}
              disabled={!barber?.canDeleteHistory && !String(barber?.role || barber?.rol || '').toLowerCase().includes('owner')}
            >
              <option value="cancelled">Eliminar Canceladas (anteriores)</option>
              <option value="past">Eliminar Pasadas/Completadas (anteriores)</option>
              <option value="no_show">Eliminar No asistieron (anteriores)</option>
              <option value="all">Eliminar Todas (canceladas/completadas/no_show) (anteriores)</option>
              <option value="all_any_status">Eliminar Todas (sin importar estado) (anteriores)</option>
            </select>
            <button
              type="button"
              className={`px-4 py-2 rounded-md text-sm font-semibold shadow-sm ${(!barber?.canDeleteHistory && !String(barber?.role || barber?.rol || '').toLowerCase().includes('owner')) ? 'bg-slate-300 text-slate-600 cursor-not-allowed' : 'bg-slate-900 hover:bg-black text-white'} ${historyDeleting ? 'opacity-70' : ''}`}
              disabled={historyDeleting || (!barber?.canDeleteHistory && !String(barber?.role || barber?.rol || '').toLowerCase().includes('owner'))}
              onClick={async () => {
                const confirmed = window.prompt('Escribe ELIMINAR para confirmar el borrado PERMANENTE del historial seleccionado (días anteriores):');
                if (confirmed !== 'ELIMINAR') return;
                try {
                  setHistoryDeleting(true);
                  const requesterId = state.currentUser?.id;
                  const requesterRole = state.currentUser?.role || state.currentUser?.rol;
                  await api.appointments.deleteBarberHistory(barber.id, historyMode, requesterId, requesterRole);

                  const refreshed = await api.appointments.getAll();
                  if (Array.isArray(refreshed)) {
                    const normalizedAppointments = refreshed.map(a => ({
                      id: a.id,
                      clientId: a.clientId !== undefined ? a.clientId : (a.client_id !== undefined ? a.client_id : null),
                      barberId: a.barberId !== undefined ? a.barberId : (a.barber_id !== undefined ? a.barber_id : null),
                      shopId: a.shopId !== undefined ? a.shopId : (a.shop_id !== undefined ? a.shop_id : null),
                      serviceId: a.serviceId !== undefined ? a.serviceId : (a.service_id !== undefined ? a.service_id : null),
                      startTime: a.startTime || a.date || null,
                      status: a.status || 'confirmed',
                      notes: a.notes || null,
                      priceAtBooking: a.priceAtBooking || a.price_at_booking || null,
                      clientPhoneNumberAtBooking: a.clientPhoneNumberAtBooking || a.client_phone_number_at_booking || null,
                    }));
                    dispatch({ type: 'SET_ALL_DATA', payload: { appointments: normalizedAppointments } });
                  }

                  dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: { message: 'Historial eliminado correctamente.', type: 'success' },
                  });
                } catch (e) {
                  console.error('Error eliminando historial:', e);
                  dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: { message: 'No se pudo eliminar el historial. Verifica permisos e intenta de nuevo.', type: 'error' },
                  });
                } finally {
                  setHistoryDeleting(false);
                }
              }}
            >
              {historyDeleting ? 'Eliminando...' : 'Eliminar historial'}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex overflow-x-auto whitespace-nowrap gap-2 pb-2 scrollbar-hide">
          <button
            onClick={() => setFilter('today')}
            className={`px-4 py-2 text-sm rounded-md font-medium shrink-0 whitespace-nowrap ${filter === 'today' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
          >Hoy</button>
          <button
            onClick={() => setFilter('upcoming')}
            className={`px-4 py-2 text-sm rounded-md font-medium shrink-0 whitespace-nowrap ${filter === 'upcoming' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
          >Próximas</button>
          <button
            onClick={() => setFilter('past')}
            className={`px-4 py-2 text-sm rounded-md font-medium shrink-0 whitespace-nowrap ${filter === 'past' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
          >Pasadas</button>
          <button
            onClick={() => setFilter('byDate')}
            className={`px-4 py-2 text-sm rounded-md font-medium shrink-0 whitespace-nowrap ${filter === 'byDate' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
          >Por Día</button>
          <button
            onClick={() => setFilter('no_show')}
            className={`px-4 py-2 text-sm rounded-md font-medium shrink-0 whitespace-nowrap ${filter === 'no_show' ? 'bg-amber-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
          >No asistieron</button>
          <button
            onClick={() => setFilter('cancelled')}
            className={`px-4 py-2 text-sm rounded-md font-medium shrink-0 whitespace-nowrap ${filter === 'cancelled' ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'}`}
          >Canceladas</button>
        </div>

        {filter === 'byDate' && (
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="p-2 border border-slate-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          />
        )}
      </div>
      {filteredAppointments.length > 0 ? (
        <div className="space-y-4 max-h-[calc(100vh-22rem)] overflow-y-auto custom-scrollbar pr-2">
          {filteredAppointments.map(appt => {
            const clientIdForBehavior = appt?.clientId ?? appt?.client_id ?? null;
            const client = (Array.isArray(state.users) ? state.users : []).find(u => clientIdForBehavior != null && String(u?.id) === String(clientIdForBehavior));
            const behaviorStats = clientIdForBehavior != null
              ? (clientBehaviorByClientId?.[clientIdForBehavior] || {
                  cancelled90: 0,
                  noShow90: 0,
                  completed90: 0,
                  total90: 0,
                  bad90: 0,
                  rate90: 0,
                  lastBadMs: null,
                  level: 'none',
                })
              : null;
            const resolvedServiceDetails = getResolvedAppointmentServiceDetails(appt);
            const serviceName = resolvedServiceDetails.name;
            const apptStartMs = getAppointmentStartMs(appt);
            const apptDateTime = new Date(apptStartMs || Date.now());
            const st = String(appt.status || '').trim().toLowerCase();
            const isCancelled = st.startsWith('cancelled') || st.startsWith('cancel') || st === 'cancelada' || st === 'cancelado';
            const isNoShow = st === 'no_show' || st === 'no-show' || st === 'noshow';
            const isConfirmed = st === 'confirmed' || st === 'confirmada' || st === 'confirmado' || st.startsWith('confirm');
            const isCompleted = st === 'completed' || st === 'completada' || st === 'completado' || st.startsWith('complet');
            const paymentStatus = normalizePaymentStatus(appt?.paymentStatus ?? appt?.payment_status ?? null);
            const isPastAppt = apptDateTime < new Date() && !appt.actualEndTime && !isCancelled && !isNoShow;
            const isTodayAppt = apptDateTime.toDateString() === new Date().toDateString();
            const canManageExtras = isConfirmed && apptDateTime >= new Date() && !appt.actualEndTime;
            const canOfferAdvance = isConfirmed && apptDateTime > new Date() && !appt.actualEndTime;

            let cardBgColor = 'bg-white border-indigo-500 shadow-sm hover:shadow-md transition-shadow';
            if (isCompleted && paymentStatus === 'unpaid') cardBgColor = 'bg-red-50 border-red-500';
            else if (isCompleted) cardBgColor = 'bg-green-50 border-green-500';
            else if (isCancelled) cardBgColor = 'bg-red-50 border-red-500 opacity-80';
            else if (isNoShow) cardBgColor = 'bg-yellow-100 border-yellow-600 opacity-80';
            else if (isPastAppt && isConfirmed) cardBgColor = 'bg-orange-50 border-orange-500';
            
            return (
              <div key={appt.id} className={`p-4 rounded-lg border-l-4 ${cardBgColor}`}>
                <div className="sm:flex sm:justify-between items-start">
                  <div>
                    <h3 className="text-md font-semibold text-slate-800">
                      {serviceName} con {client?.name || 'Cliente'}
                      {behaviorStats && (
                        <button
                          type="button"
                          onClick={() => {
                            if (clientIdForBehavior != null) openClientBehaviorModal(clientIdForBehavior);
                          }}
                          className={`ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold align-middle ${
                            behaviorStats.level === 'high'
                              ? 'bg-red-100 text-red-800'
                              : behaviorStats.level === 'medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-800'
                          }`}
                          title={`Historial del cliente (últimos 90 días)\nCancelaciones: ${behaviorStats.cancelled90 ?? 0}\nNo asistió: ${behaviorStats.noShow90 ?? 0}\nNo pagó: ${behaviorStats.unpaid90 ?? 0}\nCitas: ${behaviorStats.total90 ?? 0}`}
                        >
                          <span className="uppercase tracking-wider">{behaviorStats.level === 'high' ? 'ALERTA' : behaviorStats.level === 'medium' ? 'ATENCIÓN' : 'HISTORIAL'}</span>
                          <span className="font-semibold">Cliente</span>
                        </button>
                      )}
                    </h3>
                    {appt.clientPhoneNumberAtBooking && (
                      <p className="text-xs text-slate-500"><i className="fas fa-phone-alt mr-1 opacity-70"></i>{appt.clientPhoneNumberAtBooking}</p>
                    )}
                    <p className="text-xs text-slate-500">Precio Total: RD${getAppointmentTotalPrice(appt).toLocaleString()}</p>
                    {shop && <p className="text-xs text-slate-500">{shop.name}</p>}
                  </div>
                  <div className="mt-1 sm:mt-0 text-sm sm:text-right text-slate-700">
                    <p className="font-semibold">{apptDateTime.toLocaleDateString('es-DO', { timeZone: 'America/Santo_Domingo', weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    <p>{apptDateTime.toLocaleTimeString('es-DO', { timeZone: 'America/Santo_Domingo', hour: '2-digit', minute: '2-digit', hour12: true })}</p>
                  </div>
                </div>

                {(appt.additionalServices && appt.additionalServices.length > 0) && (
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <h4 className="text-xs font-semibold text-slate-600">Servicios Extras:</h4>
                    <ul className="list-disc list-inside pl-1 text-xs text-slate-500">
                      {appt.additionalServices.map(extra => (
                        <li key={extra.id} className="flex justify-between items-center">
                          <span>{extra.name} (RD${extra.price.toLocaleString()})</span>
                          {canManageExtras && (
                            <button onClick={() => handleRemoveExtraService(appt.id, extra.id)} className="text-red-500 hover:text-red-700 text-xs ml-2 p-0.5">
                              <i className="fas fa-times-circle"></i>
                            </button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {appt.notes && <p className="text-xs text-slate-500 mt-1 pt-1 border-t border-slate-100 italic">Notas Cliente: {appt.notes}</p>}
                {appt.notesBarber && <p className="text-xs text-indigo-500 mt-1 pt-1 border-t border-slate-100 italic">Mis Notas: {appt.notesBarber}</p>}
                {appt.actualEndTime && <p className="text-xs text-green-600 mt-1 pt-1 border-t border-slate-100 italic">Finalizada a las: {new Date(appt.actualEndTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>}

                <div className="mt-3 flex flex-wrap gap-2 items-center justify-between">
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${ 
                    isConfirmed ? (isPastAppt ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800') 
                    : isCompleted ? 'bg-green-100 text-green-800' 
                    : isCancelled ? 'bg-red-100 text-red-800' 
                    : isNoShow ? 'bg-yellow-100 text-yellow-800' 
                    : 'bg-slate-100 text-slate-800' }`}>
                    {isPastAppt && isConfirmed ? 'PENDIENTE (PASADA)' : getStatusLabelEs(appt.status)}
                  </span>
                  <div className="flex flex-wrap gap-2 items-center">
                    <button onClick={() => handleEditNotes(appt)} className="text-xs text-slate-500 hover:text-indigo-600 p-1"><i className="fas fa-edit mr-1"></i>Notas</button>

                    {filter === 'past' && isCompleted && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className={`px-2 py-1 text-[11px] font-bold rounded-full ${getPaymentSummary(appt).className}`}>{getPaymentSummary(appt).label}</span>
                        <button
                          type="button"
                          disabled={Boolean(paymentSavingById?.[appt.id])}
                          onClick={() => handleUpdateAppointmentPayment(appt.id, 'cash', 'paid')}
                          className={`text-[11px] font-semibold py-1 px-2 rounded-md border ${normalizePaymentMethod(appt?.paymentMethod) === 'cash' && normalizePaymentStatus(appt?.paymentStatus) === 'paid' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'} ${paymentSavingById?.[appt.id] ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          Efectivo
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(paymentSavingById?.[appt.id])}
                          onClick={() => handleUpdateAppointmentPayment(appt.id, 'card', 'paid')}
                          className={`text-[11px] font-semibold py-1 px-2 rounded-md border ${normalizePaymentMethod(appt?.paymentMethod) === 'card' && normalizePaymentStatus(appt?.paymentStatus) === 'paid' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'} ${paymentSavingById?.[appt.id] ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          Tarjeta
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(paymentSavingById?.[appt.id])}
                          onClick={() => handleUpdateAppointmentPayment(appt.id, 'transfer', 'paid')}
                          className={`text-[11px] font-semibold py-1 px-2 rounded-md border ${normalizePaymentMethod(appt?.paymentMethod) === 'transfer' && normalizePaymentStatus(appt?.paymentStatus) === 'paid' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'} ${paymentSavingById?.[appt.id] ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          Transferencia
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(paymentSavingById?.[appt.id])}
                          onClick={() => handleUpdateAppointmentPayment(appt.id, null, 'unpaid')}
                          className={`text-[11px] font-semibold py-1 px-2 rounded-md border ${normalizePaymentStatus(appt?.paymentStatus) === 'unpaid' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'} ${paymentSavingById?.[appt.id] ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          No pagó
                        </button>
                      </div>
                    )}
                    
                    {/* Botón de Ofrecer Adelanto */}
                    {canOfferAdvance && (
                      <button 
                        onClick={() => handleOfferAdvance(appt)} 
                        className="text-xs bg-teal-500 hover:bg-teal-600 text-white font-semibold py-1 px-2.5 rounded-md shadow-sm transition-colors"
                        title="Ofrecer al cliente adelantar esta cita si hay disponibilidad ahora."
                      >
                        <i className="fas fa-fast-forward mr-1"></i>Adelantar
                      </button>
                    )}

                    {canManageExtras && (
                      <button onClick={() => handleAddExtraService(appt)} className="text-xs bg-purple-500 hover:bg-purple-600 text-white font-semibold py-1 px-2.5 rounded-md shadow-sm transition-colors"><i className="fas fa-plus-circle mr-1"></i>Extra</button>
                    )}
                    
                    {/* Abrir chat para esta cita específica */}
                    <button
                      type="button"
                      onClick={() => handleOpenChatForAppointment(appt.id)}
                      className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-semibold py-1 px-2.5 rounded-md shadow-sm transition-colors flex items-center gap-1"
                      title="Chatear con este cliente sobre esta cita"
                    >
                      <i className="fas fa-comments" />
                      Mensajes
                    </button>
                    
                    {/* Botones de acción solo si no está ya completada o cancelada */}
                    {isConfirmed && !appt.actualEndTime && (
                      <>
                        <button onClick={() => handleMarkAppointment(appt.id, 'completed')} className="text-xs bg-green-500 hover:bg-green-600 text-white font-semibold py-1 px-2.5 rounded-md shadow-sm transition-colors">Completada</button>
                        <button onClick={() => handleMarkAppointment(appt.id, 'no_show')} className="text-xs bg-amber-500 hover:bg-amber-600 text-white font-semibold py-1 px-2.5 rounded-md shadow-sm transition-colors">No Asistió</button>
                        <button onClick={() => handleMarkAppointment(appt.id, 'cancelled_by_barber')} className="text-xs bg-red-500 hover:bg-red-600 text-white font-semibold py-1 px-2.5 rounded-md shadow-sm transition-colors">Cancelar Cita</button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : <p className="text-slate-500 mt-6 text-center py-4">No tienes citas que coincidan con los filtros seleccionados.</p>}
    </div>
  );
};

export default BarberAppointmentsView;
