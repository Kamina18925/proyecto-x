import React, { useContext, useRef, useEffect, useState } from 'react';
import { AppContext } from '../App';
import {
  clearNotificationHistoryForUser,
  loadNotificationsForUser,
  respondToNotification,
} from '../services/dataService';

const ClientNotifications = ({ onBack }) => {
  const { state, dispatch } = useContext(AppContext);
  const clientId = state.currentUser?.id;
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [respondingNotificationId, setRespondingNotificationId] = useState(null);
  const [clearingHistory, setClearingHistory] = useState(false);
  const isMounted = useRef(true);

  // Control de ciclo de vida del componente
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Cargar notificaciones del cliente (incluye propuestas de adelanto) + polling
  useEffect(() => {
    let intervalId = null;

    const fetchNotifications = async () => {
      if (!clientId) return;
      // Para evitar parpadeo constante, solo mostramos "cargando" en la primera vez
      setLoadingNotifications((prev) => (notifications.length === 0 && !prev ? true : prev));
      try {
        const data = await loadNotificationsForUser(clientId);
        if (isMounted.current) {
          setNotifications(data);
        }
      } finally {
        if (isMounted.current) {
          setLoadingNotifications(false);
        }
      }
    };

    // Carga inicial inmediata
    fetchNotifications();

    // Polling cada 5 segundos mientras el componente esté montado
    intervalId = setInterval(fetchNotifications, 5000);

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [clientId]);

  const handleNotificationResponse = async (notification, accepted) => {
    if (!notification?.id) return;
    try {
      setRespondingNotificationId(notification.id);
      const res = await respondToNotification(notification.id, accepted);

      // Actualizar notificación en memoria
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? res.notification || n : n))
      );

      // Mostrar mensaje al usuario
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: accepted
            ? 'Has aceptado la nueva hora de la cita.'
            : 'Has rechazado la propuesta de adelanto.',
          type: 'success',
        },
      });
    } catch (error) {
      console.error('Error al responder notificación:', error);
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'No se pudo procesar tu respuesta. Inténtalo de nuevo.',
          type: 'error',
        },
      });
    } finally {
      if (isMounted.current) {
        setRespondingNotificationId(null);
      }
    }
  };

  const handleClearHistory = async () => {
    if (!clientId) return;
    const confirmed = window.confirm(
      '¿Estás seguro? Se borrarán las notificaciones de tu vista. Podrán recuperarse por soporte durante 31 días.'
    );
    if (!confirmed) return;

    try {
      setClearingHistory(true);
      await clearNotificationHistoryForUser(clientId);
      if (isMounted.current) {
        setNotifications([]);
      }
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Historial de notificaciones borrado de tu vista.',
          type: 'success',
        },
      });
    } catch (error) {
      console.error('Error al limpiar historial de notificaciones:', error);
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'No se pudo borrar el historial. Inténtalo de nuevo.',
          type: 'error',
        },
      });
    } finally {
      if (isMounted.current) {
        setClearingHistory(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 custom-scrollbar">
      <div className="max-w-3xl mx-auto px-4 pt-8 pb-16">
        <div className="flex items-center mb-8 gap-4">
          <h1 className="text-3xl font-bold text-slate-800 flex-1">Notificaciones</h1>
          <button
            className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={handleClearHistory}
            type="button"
            disabled={clearingHistory || loadingNotifications}
          >
            {clearingHistory ? 'Borrando...' : 'Borrar historial'}
          </button>
          {onBack && (
            <button
              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg shadow text-sm font-semibold"
              onClick={onBack}
              type="button"
            >
              <i className="fa-solid fa-arrow-left mr-2"></i>Volver
            </button>
          )}
        </div>

        {loadingNotifications ? (
          <p className="text-sm text-slate-500">Cargando notificaciones...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-slate-500">No tienes notificaciones.</p>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className="bg-white rounded-lg shadow-sm border border-slate-200 p-3 text-sm flex flex-col gap-1"
              >
                <div className="flex justify-between items-center gap-2">
                  <div>
                    <p className="font-semibold text-slate-800">{notif.title}</p>
                    <p className="text-slate-600 text-xs">{notif.message}</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase">
                    {notif.status}
                  </span>
                </div>

                {notif.type === 'RESCHEDULE_PROPOSAL' && notif.status === 'PENDING' && (
                  <div className="mt-2 flex gap-2 justify-end">
                    <button
                      onClick={() => handleNotificationResponse(notif, true)}
                      disabled={respondingNotificationId === notif.id}
                      className="px-3 py-1 text-xs rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                      type="button"
                    >
                      Aceptar
                    </button>
                    <button
                      onClick={() => handleNotificationResponse(notif, false)}
                      disabled={respondingNotificationId === notif.id}
                      className="px-3 py-1 text-xs rounded-md bg-red-500 hover:bg-red-600 text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                      type="button"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientNotifications;
