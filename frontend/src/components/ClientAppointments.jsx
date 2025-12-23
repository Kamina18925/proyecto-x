import React, { useContext, useRef, useEffect, useState } from 'react';
import { AppContext } from '../App';

const ClientAppointments = ({ onBack, serverNowIso, serverNowFetchedAtMs }) => {
  const { state, dispatch } = useContext(AppContext);
  const clientId = state.currentUser?.id;
  const [cancelling, setCancelling] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const isMounted = useRef(true);
  
  // Control de ciclo de vida del componente
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Protección contra undefined
  const appointments = Array.isArray(state.appointments) ? state.appointments : [];
  const barberShops = Array.isArray(state.barberShops) ? state.barberShops : [];
  const users = Array.isArray(state.users) ? state.users : [];
  const services = Array.isArray(state.services) ? state.services : [];

  const isCorruptProductOrderAppointment = (appt) => {
    const serviceId = appt?.serviceId ?? appt?.service_id ?? null;
    const shopId = appt?.shopId ?? appt?.shop_id ?? null;
    const barberId = appt?.barberId ?? appt?.barber_id ?? null;
    const notes = String(appt?.notes || '').toLowerCase();
    const looksLikeProductOrder = notes.includes('pedido de producto');
    const missingCoreRefs = serviceId == null || shopId == null || barberId == null;
    return looksLikeProductOrder && missingCoreRefs;
  };

  const myAppointments = appointments.filter((a) => {
    const apptClientId = a.clientId ?? a.client_id;
    if (apptClientId == null || clientId == null) return false;

    // Respetar bandera de oculto para el cliente (borrado de historial lógico)
    const hiddenForClient = a.hiddenForClient ?? a.hidden_for_client;
    if (hiddenForClient) return false;

    // Ocultar citas corruptas que en realidad son pedidos de productos
    if (isCorruptProductOrderAppointment(a)) return false;

    return String(apptClientId) === String(clientId);
  });

  const getEffectiveNowMs = () => {
    if (serverNowIso && serverNowFetchedAtMs) {
      const base = new Date(serverNowIso).getTime();
      if (!Number.isNaN(base)) {
        const delta = Date.now() - serverNowFetchedAtMs;
        return base + Math.max(0, delta);
      }
    }
    return Date.now();
  };

  const isPastAppointment = (appt) => {
    const start = appt?.startTime || appt?.date || appt?.start_time;
    if (!start) return false;
    const ms = new Date(start).getTime();
    if (Number.isNaN(ms)) return false;
    return ms < getEffectiveNowMs();
  };

  const hasHistoryAppointments = appointments.some((a) => {
    const apptClientId = a.clientId ?? a.client_id;
    if (apptClientId == null || clientId == null) return false;
    if (String(apptClientId) !== String(clientId)) return false;

    const hiddenForClient = a.hiddenForClient ?? a.hidden_for_client;
    if (hiddenForClient) return false;

    // Si detectamos una cita corrupta (pedido de producto), permitir borrarla del historial
    if (isCorruptProductOrderAppointment(a)) return true;

    const status = String(a.status || '').toLowerCase();
    if (status === 'completed' || status === 'cancelled' || status.startsWith('cancelled')) return true;
    if (status === 'confirmed' && isPastAppointment(a)) return true;
    return false;
  });

  const handleCancel = async (apptId) => {
    try {
      if (cancelling) return; // Prevenir múltiples clics

      if (apptId == null) {
        dispatch({
          type: 'SHOW_NOTIFICATION',
          payload: { message: 'No se pudo identificar la cita a cancelar (ID inválido).', type: 'error' },
        });
        return;
      }
      
      setCancelling(true);
      setCancellingId(apptId);
      
      // Pequeño retardo para evitar problemas de renderizado
      await new Promise(resolve => setTimeout(resolve, 50));

      // Solo ejecutar si el componente sigue montado
      if (!isMounted.current) return;
      
      dispatch({ type: 'CANCEL_APPOINTMENT', payload: { id: apptId } });
      
      // Pequeño retardo antes de mostrar notificación
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Solo ejecutar si el componente sigue montado
      if (!isMounted.current) return;

      dispatch({ 
        type: 'SHOW_NOTIFICATION', 
        payload: { message: 'Cita cancelada exitosamente', type: 'success' } 
      });
      
      // Resetear estado después de completar
      setTimeout(() => {
        if (isMounted.current) {
          setCancelling(false);
          setCancellingId(null);
        }
      }, 300);
    } catch (error) {
      console.error('Error al cancelar cita:', error);
      if (isMounted.current) {
        setCancelling(false);
        setCancellingId(null);
        dispatch({ 
          type: 'SHOW_NOTIFICATION', 
          payload: { message: 'Error al cancelar la cita', type: 'error' } 
        });
      }
    }
  };

  const handleDeleteHistory = async () => {
    try {
      if (deletingHistory) return; // Prevenir múltiples clics
      
      setDeletingHistory(true);
      
      // Pequeño retardo para evitar problemas de renderizado
      await new Promise(resolve => setTimeout(resolve, 50));

      // Solo ejecutar si el componente sigue montado
      if (!isMounted.current) return;
      
      dispatch({ 
        type: 'DELETE_CLIENT_APPOINTMENTS_HISTORY', 
        payload: { 
          clientId, 
          keepActive: true, // Mantener citas activas/confirmadas
          nowMs: getEffectiveNowMs(),
        } 
      });
      
      // Pequeño retardo antes de mostrar notificación
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Solo ejecutar si el componente sigue montado
      if (!isMounted.current) return;

      dispatch({ 
        type: 'SHOW_NOTIFICATION', 
        payload: { message: 'Historial de citas borrado exitosamente (las citas activas se mantienen).', type: 'success' } 
      });
      
      // Resetear estado después de completar
      setTimeout(() => {
        if (isMounted.current) {
          setDeletingHistory(false);
          setShowConfirmation(false);
        }
      }, 300);
    } catch (error) {
      console.error('Error al borrar historial:', error);
      if (isMounted.current) {
        setDeletingHistory(false);
        setShowConfirmation(false);
        dispatch({ 
          type: 'SHOW_NOTIFICATION', 
          payload: { message: 'Error al borrar el historial de citas', type: 'error' } 
        });
      }
    }
  };

  try {
    // Solo en modo desarrollo (comentar en producción)
    // console.log('ClientAppointments: rendering...');
    return (
      <div className="min-h-screen bg-slate-100 custom-scrollbar">
        <div className="max-w-3xl mx-auto px-4 pt-8 pb-16">
          <div className="flex items-center mb-8 gap-4">
            <h1 className="text-3xl font-bold text-slate-800 flex-1">Mis Citas</h1>
            {onBack && (
              <button
                className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg shadow text-sm font-semibold"
                onClick={onBack}
              >
                <i className="fa-solid fa-arrow-left mr-2"></i>Volver
              </button>
            )}
          </div>

          <div className="flex items-center mb-4">
            <div className="text-slate-700 text-sm flex-1">Citas encontradas: {myAppointments.length}</div>
            <button
              className="bg-slate-500 hover:bg-slate-600 text-white font-semibold px-4 py-2 rounded-lg shadow text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => setShowConfirmation(true)}
              disabled={deletingHistory || !hasHistoryAppointments}
              type="button"
            >
              {deletingHistory ? (
                <span className="flex items-center justify-center">
                  <span className="inline-block animate-spin mr-2 h-4 w-4 text-white">
                    ⟳
                  </span>
                  Borrando historial...  
                </span>
              ) : (
                <span>
                  <i className="fa-solid fa-trash-can mr-2"></i>Borrar historial
                </span>
              )}
            </button>
          </div>
          
          {/* Diálogo de confirmación para borrar historial */}
          {showConfirmation && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
                <h3 className="text-xl font-bold text-slate-800 mb-3">Confirmar borrado</h3>
                <p className="text-slate-600 mb-6">
                  ¿Estás seguro que deseas borrar tu historial de citas completadas y canceladas? Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-semibold text-sm"
                    onClick={() => setShowConfirmation(false)}
                    disabled={deletingHistory}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold text-sm"
                    onClick={handleDeleteHistory}
                    disabled={deletingHistory}
                  >
                    {deletingHistory ? (
                      <span className="flex items-center justify-center">
                        <span className="inline-block animate-spin mr-2 h-4 w-4 text-white">
                          ⟳
                        </span>
                        Borrando...
                      </span>
                    ) : 'Sí, borrar historial'}
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {myAppointments.length === 0 ? (
            <div className="bg-white rounded-xl shadow-lg p-8 text-center text-slate-500">
              No tienes citas reservadas.
            </div>
          ) : (
            <div className="space-y-6">
              {myAppointments.map((appt, idx) => {
                try {
                  const shop = barberShops.find(s => s.id === appt.shopId);
                  const barber = users.find(u => u.id === appt.barberId);
                  const service = services.find(s => s.id === appt.serviceId);
                  const statusRaw = String(appt.status || '');
                  const status = statusRaw.trim().toLowerCase();
                  const isConfirmed = status === 'confirmed' || status === 'confirmada' || status === 'confirmado' || status.startsWith('confirm');
                  const isCancelled = status === 'cancelled' || status === 'cancelada' || status.startsWith('cancelled') || status.startsWith('cancelada') || status.startsWith('cancel');
                  const isCompleted = status === 'completed' || status === 'completada' || status === 'completado' || status.startsWith('complet');
                  const isNoShow = status === 'no_show' || status === 'no-show' || status === 'noshow';
                  const apptIdRaw = appt?.id ?? appt?.appointmentId ?? appt?.appointment_id ?? null;
                  const apptId = apptIdRaw != null && apptIdRaw !== '' ? apptIdRaw : null;
                  const shouldShowCancel = !isPastAppointment(appt) && !isCancelled && !isCompleted && !isNoShow;
                  const canCancel = apptId != null && shouldShowCancel;
                  return (
                    <div key={apptId ?? appt?.id ?? idx} className={`bg-white rounded-xl shadow-lg p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-l-4 ${
                      isCompleted ? 'border-green-500' : isCancelled ? 'border-red-500' : 'border-indigo-500'
                    }`}>
                      <div className="flex-1">
                        <div className="mb-2">
                          <span className="font-semibold text-indigo-700">{shop?.name || 'Barbería no disponible'}</span> — <span className="text-slate-600">{service?.name || 'Servicio no disponible'}</span>
                        </div>
                        <div className="text-slate-600 text-sm mb-1">
                          <i className="fa-solid fa-user-tie mr-1 text-indigo-400"></i> {barber?.name || 'Barbero no disponible'}
                        </div>
                        <div className="text-slate-600 text-sm mb-1">
                          <i className="fa-solid fa-calendar mr-1 text-indigo-400"></i>
                          {appt.startTime ? (
                            (() => {
                              const dt = new Date(appt.startTime);
                              const fecha = dt.toLocaleDateString('es-DO', {
                                timeZone: 'America/Santo_Domingo',
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit',
                              });
                              const hora = dt.toLocaleTimeString('es-DO', {
                                timeZone: 'America/Santo_Domingo',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true,
                              });
                              return `${fecha}, ${hora}`;
                            })()
                          ) : 'Fecha no disponible'}
                        </div>
                        <div className="text-slate-600 text-sm mb-1">
                          <i className="fa-solid fa-money-bill-wave mr-1 text-green-500"></i>{' '}
                          {(() => {
                            const price =
                              appt.priceAtBooking ??
                              appt.price_at_booking ??
                              service?.basePrice ??
                              service?.price ??
                              null;
                            return price != null ? `RD$${price}` : 'Precio no disponible';
                          })()}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">Estado: {isCompleted ? 'Completada' : isCancelled ? 'Cancelada' : 'Confirmada'}</div>
                      </div>
                      {shouldShowCancel && (
                        <button
                          className="bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-lg shadow text-sm"
                          onClick={() => handleCancel(apptId)}
                          disabled={!canCancel || (cancelling && cancellingId === apptId)}
                        >
                          {cancelling && cancellingId === apptId ? (
                            <span className="flex items-center justify-center">
                              <span className="inline-block animate-spin mr-2 h-4 w-4 text-white">
                                ⟳
                              </span>
                              Cancelando...
                            </span>
                          ) : 'Cancelar'}
                        </button>
                      )}
                    </div>
                  );
                } catch (err) {
                  console.error('Error renderizando cita', idx, appt, err);
                  return (
                    <div key={appt.id || idx} className="bg-red-100 text-red-700 p-4 rounded">
                      Error mostrando cita (ver consola para detalles).
                    </div>
                  );
                }
              })}
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error('Error interno en ClientAppointments:', error, JSON.stringify(error));
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50">
        <div className="bg-white p-8 rounded-xl shadow text-center text-red-600">
          <h2 className="text-2xl font-bold mb-2">Error interno</h2>
          <p>No se pudo mostrar tus citas por un error inesperado.</p>
          <p className="mt-2 text-xs text-red-400">{error && (error.message || JSON.stringify(error))}</p>
          {onBack && (
            <button
              className="mt-6 bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg shadow text-sm font-semibold"
              onClick={onBack}
            >
              <i className="fa-solid fa-arrow-left mr-2"></i>Volver
            </button>
          )}
        </div>
      </div>
    );
  }
};

export default ClientAppointments;
