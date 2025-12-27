import React, { useContext, useEffect, useMemo, useState, useRef } from 'react';
import { AppContext } from '../App';
import {
  archiveConversation,
  getOrCreateDirectConversation,
  getOrCreateConversationForAppointment,
  loadMessagesForConversation,
  loadUserConversations,
  sendChatMessage,
} from '../services/dataService';
import { respondToNotification } from '../services/dataService';
import { markChatMessagesAsRead } from '../services/dataService';

const extractPhotoFromText = (rawText) => {
  const text = typeof rawText === 'string' ? rawText : '';
  const lines = text.split('\n');
  let photoUrl = null;
  const kept = [];

  for (const line of lines) {
    const match = String(line).match(/^\s*Foto:\s*(.+)\s*$/i);
    if (match && !photoUrl) {
      const candidate = String(match[1] || '').trim();
      if (
        candidate.startsWith('data:image/') ||
        candidate.startsWith('https://') ||
        candidate.startsWith('http://')
      ) {
        photoUrl = candidate;
        continue;
      }
    }
    kept.push(line);
  }

  const cleanedText = kept.join('\n').trim();
  return { cleanedText, photoUrl };
};

const buildDisplayConversations = (rawList) => {
  const list = Array.isArray(rawList) ? rawList : [];

  const byId = new Map();
  for (const c of list) {
    if (!c || c.id == null) continue;
    if (!byId.has(c.id)) byId.set(c.id, c);
  }

  const getPartnerId = (c) => c?.partner_id ?? c?.partnerId;
  const getUnread = (c) => Number(c?.unread_count ?? c?.unreadCount ?? 0) || 0;
  const getTs = (c) => {
    const raw =
      c?.last_message_at ??
      c?.lastMessageAt ??
      c?.updated_at ??
      c?.updatedAt ??
      c?.created_at ??
      c?.createdAt;
    if (!raw) return 0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
  };

  const groups = new Map();
  for (const c of byId.values()) {
    const partnerId = getPartnerId(c);
    const key = partnerId != null ? `partner:${String(partnerId)}` : `conv:${String(c.id)}`;
    const prev = groups.get(key);
    if (!prev) {
      groups.set(key, {
        ...c,
        unread_count: getUnread(c),
        unreadCount: getUnread(c),
        thread_count: 1,
        threadCount: 1,
      });
      continue;
    }

    const sumUnread = getUnread(prev) + getUnread(c);
    const prevTs = getTs(prev);
    const nextTs = getTs(c);
    const chosen = nextTs >= prevTs ? c : prev;

    groups.set(key, {
      ...chosen,
      unread_count: sumUnread,
      unreadCount: sumUnread,
      thread_count: (Number(prev.thread_count ?? prev.threadCount ?? 1) || 1) + 1,
      threadCount: (Number(prev.thread_count ?? prev.threadCount ?? 1) || 1) + 1,
    });
  }

  return Array.from(groups.values()).sort((a, b) => getTs(b) - getTs(a));
};

const ChatWidget = () => {
  const { state, dispatch } = useContext(AppContext);
  const currentUser = state.currentUser;

  const currentRoleRaw = currentUser?.role || currentUser?.rol || '';
  const isClientRole = String(currentRoleRaw).toLowerCase().includes('client');
  const [isOpen, setIsOpen] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [hiddenPartnerIds, setHiddenPartnerIds] = useState(() => new Set());
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [selectedBarberId, setSelectedBarberId] = useState(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const prevIncomingCountRef = useRef(0);
  const selectedConversationIdRef = useRef(null);

  const isAuthenticated = !!state.isAuthenticated && !!currentUser;

  const now = useMemo(() => new Date(), []);

  const hiddenStorageKey = useMemo(() => {
    if (!currentUser?.id) return null;
    return `chat_hidden_partners_${currentUser.id}`;
  }, [currentUser?.id]);

  useEffect(() => {
    if (!hiddenStorageKey) return;
    try {
      const raw = localStorage.getItem(hiddenStorageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed)) {
        setHiddenPartnerIds(new Set(parsed.map((v) => String(v))));
      }
    } catch (e) {
      // ignorar
    }
  }, [hiddenStorageKey]);

  useEffect(() => {
    if (!hiddenStorageKey) return;
    try {
      localStorage.setItem(hiddenStorageKey, JSON.stringify(Array.from(hiddenPartnerIds.values())));
    } catch (e) {
      // ignorar
    }
  }, [hiddenStorageKey, hiddenPartnerIds]);

  // Permitir abrir el chat desde cualquier parte (botón en header, etc.)
  useEffect(() => {
    const handler = (event) => {
      try {
        const apptIdFromEvent = event?.detail?.appointmentId;
        const barberIdFromEvent = event?.detail?.barberId;
        if (typeof apptIdFromEvent === 'number') {
          setSelectedAppointmentId(apptIdFromEvent);
          setSelectedBarberId(null);
        } else if (barberIdFromEvent != null) {
          setSelectedBarberId(barberIdFromEvent);
          setSelectedAppointmentId(null);
        } else {
          setSelectedAppointmentId(null);
          setSelectedBarberId(null);
        }
      } catch (e) {
        console.error('Error procesando evento open-chat-widget:', e);
      }
      setIsOpen(true);
    };
    window.addEventListener('open-chat-widget', handler);
    return () => {
      window.removeEventListener('open-chat-widget', handler);
    };
  }, []);

  const conversationsForDisplay = useMemo(
    () => buildDisplayConversations(conversations),
    [conversations]
  );

  const visibleConversationsForDisplay = useMemo(() => {
    const list = Array.isArray(conversationsForDisplay) ? conversationsForDisplay : [];
    if (!hiddenPartnerIds || hiddenPartnerIds.size === 0) return list;
    return list.filter((c) => {
      const partnerId = c?.partner_id ?? c?.partnerId;
      if (partnerId == null) return true;
      return !hiddenPartnerIds.has(String(partnerId));
    });
  }, [conversationsForDisplay, hiddenPartnerIds]);

  useEffect(() => {
    if (!hiddenPartnerIds || hiddenPartnerIds.size === 0) return;
    const list = Array.isArray(conversationsForDisplay) ? conversationsForDisplay : [];
    const toUnhide = [];
    for (const c of list) {
      const partnerId = c?.partner_id ?? c?.partnerId;
      if (partnerId == null) continue;
      const key = String(partnerId);
      if (!hiddenPartnerIds.has(key)) continue;
      const unread = Number(c?.unread_count ?? c?.unreadCount ?? 0) || 0;
      if (unread > 0) toUnhide.push(key);
    }
    if (toUnhide.length === 0) return;
    setHiddenPartnerIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      toUnhide.forEach((k) => {
        if (next.has(k)) {
          next.delete(k);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [conversationsForDisplay, hiddenPartnerIds]);

  const totalUnreadCount = useMemo(() => {
    const list = Array.isArray(conversationsForDisplay) ? conversationsForDisplay : [];
    return list.reduce((sum, c) => sum + (Number(c.unread_count ?? c.unreadCount ?? 0) || 0), 0);
  }, [conversationsForDisplay]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    if (!currentUser?.id || !isAuthenticated) return;

    let cancelled = false;
    const loadList = async () => {
      try {
        const list = await loadUserConversations(currentUser.id);
        if (!cancelled) {
          setConversations(list);
          const displayList = buildDisplayConversations(list);
          const desired = selectedConversationIdRef.current;
          if (!Array.isArray(displayList) || displayList.length === 0) {
            if (desired != null) setSelectedConversationId(null);
            return;
          }

          if (desired == null) {
            setSelectedConversationId(displayList[0].id);
            return;
          }

          const stillExists = displayList.some((c) => c?.id === desired);
          if (!stillExists) {
            setSelectedConversationId(displayList[0].id);
          }
        }
      } catch (e) {
        console.error('Error cargando lista de conversaciones:', e);
      }
    };

    loadList();
    const intervalId = setInterval(loadList, 5000);
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [currentUser?.id, isAuthenticated]);

  const futureAppointmentsForUser = useMemo(() => {
    if (!currentUser) return null;
    const appointments = Array.isArray(state.appointments) ? state.appointments : [];
    const role = (currentUser.role || currentUser.rol || '').toLowerCase();

    const isClient = role.includes('client');
    const isBarber = role.includes('barber');
    if (!isClient && !isBarber) return null;

    const filtered = appointments
      .filter((appt) => {
        if (appt.status !== 'confirmed') return false;
        if (!appt.startTime) return false;
        const dt = new Date(appt.startTime);
        if (dt < now) return false;
        if (isClient && appt.clientId === currentUser.id) return true;
        if (isBarber && appt.barberId === currentUser.id) return true;
        return false;
      })
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    return filtered;
  }, [state.appointments, currentUser, now]);

  const relevantAppointment = useMemo(() => {
    if (!Array.isArray(futureAppointmentsForUser) || futureAppointmentsForUser.length === 0) {
      return null;
    }
    if (selectedAppointmentId != null) {
      return (
        futureAppointmentsForUser.find((a) => a.id === selectedAppointmentId) ||
        futureAppointmentsForUser[0]
      );
    }
    return futureAppointmentsForUser[0];
  }, [futureAppointmentsForUser, selectedAppointmentId]);

  const chatPartner = useMemo(() => {
    if (!currentUser || !relevantAppointment) return null;
    const users = Array.isArray(state.users) ? state.users : [];
    const role = (currentUser.role || currentUser.rol || '').toLowerCase();
    const isClient = role.includes('client');
    const isBarber = role.includes('barber');

    if (isClient) {
      return users.find((u) => u.id === relevantAppointment.barberId) || null;
    }
    if (isBarber) {
      return users.find((u) => u.id === relevantAppointment.clientId) || null;
    }
    return null;
  }, [currentUser, relevantAppointment, state.users]);

  // Mantener seleccionado por defecto la primera cita futura cuando cambie la lista
  useEffect(() => {
    if (!Array.isArray(futureAppointmentsForUser) || futureAppointmentsForUser.length === 0) {
      setSelectedAppointmentId(null);
      return;
    }
    // Si la cita seleccionada ya no está en la lista, elegir la primera
    const exists = futureAppointmentsForUser.some((a) => a.id === selectedAppointmentId);
    if (!exists) {
      setSelectedAppointmentId(futureAppointmentsForUser[0].id);
    }
  }, [futureAppointmentsForUser, selectedAppointmentId]);

  const relevantAppointmentId = relevantAppointment ? relevantAppointment.id : null;

  const selectedConversation = useMemo(() => {
    const list = Array.isArray(conversations) ? conversations : [];
    return list.find((c) => c.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    const partnerId = selectedConversation?.partner_id ?? selectedConversation?.partnerId;
    if (partnerId == null) return;
    const key = String(partnerId);
    setHiddenPartnerIds((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, [selectedConversation]);

  const directPartner = useMemo(() => {
    if (!selectedConversation) return null;
    const partnerId = selectedConversation.partner_id ?? selectedConversation.partnerId;
    const users = Array.isArray(state.users) ? state.users : [];
    return users.find((u) => String(u.id) === String(partnerId)) || null;
  }, [selectedConversation, state.users]);

  // Mantener compatibilidad con chat por cita cuando viene appointmentId
  useEffect(() => {
    if (!isAuthenticated || !currentUser?.id) return;

    const setupConversation = async () => {
      if (selectedBarberId != null) {
        const convId = await getOrCreateDirectConversation(currentUser.id, selectedBarberId);
        if (convId) {
          setSelectedConversationId(convId);
        }
      } else if (relevantAppointmentId != null && selectedAppointmentId != null) {
        const convId = await getOrCreateConversationForAppointment(relevantAppointmentId);
        if (convId) {
          setSelectedConversationId(convId);
        }
      }
    };

    setupConversation();
  }, [isAuthenticated, currentUser, relevantAppointmentId, selectedAppointmentId, selectedBarberId]);

  useEffect(() => {
    if (!selectedConversationId || !currentUser?.id) {
      setConversationId(null);
      setMessages([]);
      prevIncomingCountRef.current = 0;
      return;
    }

    let cancelled = false;
    const setupMessages = async () => {
      setLoading(true);
      try {
        if (chatContainerRef.current) {
          const el = chatContainerRef.current;
          const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          setShouldAutoScroll(distanceToBottom < 100);
        } else {
          setShouldAutoScroll(true);
        }

        setConversationId(selectedConversationId);
        const msgs = await loadMessagesForConversation(selectedConversationId);
        if (cancelled) return;
        setMessages(msgs);

        const incoming = msgs.filter((m) => {
          const senderId = m.sender_id ?? m.senderId;
          if (senderId === currentUser.id) return false;
          const isSystem = m.is_system || m.isSystem;
          const relatedAction = String(m.related_action ?? m.relatedAction ?? '').toUpperCase();
          if (isSystem && relatedAction === 'RETENTION_POLICY') return false;
          return true;
        }).length;
        prevIncomingCountRef.current = incoming;
        if (isOpen) {
          void markChatMessagesAsRead(selectedConversationId, currentUser.id);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setupMessages();
    return () => {
      cancelled = true;
    };
  }, [selectedConversationId, currentUser, isOpen]);

  // Polling para refrescar mensajes continuamente mientras exista conversación
  useEffect(() => {
    if (!conversationId || !currentUser?.id) return undefined;

    let cancelled = false;

    const tick = async () => {
      try {
        // Detectar si el usuario está cerca del final antes de recargar
        if (chatContainerRef.current) {
          const el = chatContainerRef.current;
          const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
          setShouldAutoScroll(distanceToBottom < 100);
        } else {
          setShouldAutoScroll(true);
        }

        const latest = await loadMessagesForConversation(conversationId);
        if (!cancelled) {
          setMessages(latest);

          // Calcular mensajes entrantes (no míos)
          const incoming = latest.filter((m) => {
            const senderId = m.sender_id ?? m.senderId;
            if (senderId === currentUser.id) return false;
            const isSystem = m.is_system || m.isSystem;
            const relatedAction = String(m.related_action ?? m.relatedAction ?? '').toUpperCase();
            if (isSystem && relatedAction === 'RETENTION_POLICY') return false;
            return true;
          }).length;
          const prevIncoming = prevIncomingCountRef.current || 0;

          // Si hay más mensajes entrantes que antes, disparar toast global
          if (incoming > prevIncoming) {
            prevIncomingCountRef.current = incoming;

            if (!isClientRole) {
              try {
                dispatch({
                  type: 'SHOW_NOTIFICATION',
                  payload: {
                    message: 'Tienes un nuevo mensaje en el chat con tu barbería.',
                    type: 'info',
                  },
                });
              } catch (e) {
                console.error('No se pudo mostrar notificación global de nuevo mensaje:', e);
              }
            }
          }

          // Marcar como leídos solo si el chat está abierto (para que el badge funcione cuando está cerrado)
          if (isOpen && currentUser?.id) {
            void markChatMessagesAsRead(conversationId, currentUser.id);
          }
        }
      } catch (e) {
        // Solo logueamos; no interrumpimos el chat
        console.error('Error refrescando mensajes de chat:', e);
      }
    };

    const intervalId = setInterval(tick, 5000); // cada 5 segundos
    // Primera carga inmediata
    tick();

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [conversationId, currentUser, isOpen, dispatch, isClientRole]);

  useEffect(() => {
    if (isOpen && shouldAutoScroll && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, shouldAutoScroll]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    if (!conversationId || !currentUser) return;

    const partner = directPartner || chatPartner;
    if (!partner?.id) return;

    const text = inputValue.trim();
    setSending(true);
    try {
      const newMsg = await sendChatMessage({
        conversationId,
        senderId: currentUser.id,
        receiverId: partner.id,
        text,
      });
      setMessages((prev) => [...prev, newMsg]);
      setInputValue('');
    } catch (error) {
      // En esta primera versión solo logueamos el error
      console.error('Error enviando mensaje de chat:', error);
    } finally {
      setSending(false);
    }
  };

  const unreadCount = totalUnreadCount;

  const respondedRescheduleNotificationIds = useMemo(() => {
    const set = new Set();
    (Array.isArray(messages) ? messages : []).forEach((m) => {
      const isSystem = m.is_system || m.isSystem;
      const relatedAction = m.related_action ?? m.relatedAction;
      const relatedId = m.related_id ?? m.relatedId;
      if (isSystem && relatedAction === 'RESCHEDULE_RESPONSE' && relatedId != null) {
        set.add(String(relatedId));
      }
    });
    return set;
  }, [messages]);

  // Notificar a otros componentes (dashboards) del número de mensajes no leídos
  useEffect(() => {
    try {
      const event = new CustomEvent('chat-unread-changed', {
        detail: { count: unreadCount },
      });
      window.dispatchEvent(event);
    } catch (e) {
      console.error('No se pudo emitir chat-unread-changed:', e);
    }
  }, [unreadCount]);

  const roleLabel = (() => {
    const roleRaw = (currentUser?.role || currentUser?.rol || '');
    const role = String(roleRaw).toLowerCase();
    if (role.includes('client')) return 'Tu Profesional';
    if (role.includes('barber')) return 'Tu Cliente';
    return 'Chat';
  })();

  // Importante: devolver null SOLO después de haber ejecutado todos los hooks,
  // para no romper el orden de hooks entre renders autenticado/no autenticado.
  if (!isAuthenticated || !currentUser) return null;

  const appointmentInfoLabel = (() => {
    if (!relevantAppointment) return '';
    const shops = Array.isArray(state.barberShops) ? state.barberShops : [];
    const services = Array.isArray(state.services) ? state.services : [];
    const shop = shops.find((s) => s.id === relevantAppointment.shopId);
    const service = services.find((s) => s.id === relevantAppointment.serviceId);
    const dt = relevantAppointment.startTime ? new Date(relevantAppointment.startTime) : null;
    const fecha =
      dt &&
      dt.toLocaleDateString('es-DO', {
        timeZone: 'America/Santo_Domingo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    const hora =
      dt &&
      dt.toLocaleTimeString('es-DO', {
        timeZone: 'America/Santo_Domingo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    const parts = [];
    if (service?.name) parts.push(service.name);
    if (shop?.name) parts.push(shop.name);
    if (fecha && hora) parts.push(`${fecha}, ${hora}`);
    return parts.join(' • ');
  })();

  const headerTitle = (() => {
    const fromDirect = directPartner?.name;
    const fromAppointment = chatPartner?.name;
    const fromConversation = selectedConversation?.partner_name ?? selectedConversation?.partnerName;
    return fromDirect || fromAppointment || fromConversation || 'Centro de Mensajes';
  })();

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-slate-900 hover:bg-slate-800 text-white px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 text-sm font-semibold z-[9999]"
      >
        <span>Chat</span>
        {!isClientRole && unreadCount > 0 && (
          <span className="bg-red-500 text-xs w-5 h-5 rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden z-[9999] h-[480px]">
      <div className="bg-slate-900 text-white px-3 py-2 flex items-center justify-between text-sm">
        <div className="flex-1 min-w-0">
          <div className="font-semibold truncate max-w-[180px]">{headerTitle}</div>
          <div className="text-xs text-slate-300 truncate">{roleLabel}</div>
          {appointmentInfoLabel && (
            <div className="text-[10px] text-slate-400 truncate mt-0.5">
              {appointmentInfoLabel}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-slate-200 hover:text-white text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="border-b border-slate-200 bg-white px-2 py-2 overflow-x-auto">
        <div className="flex gap-2">
          {(Array.isArray(visibleConversationsForDisplay) ? visibleConversationsForDisplay : []).map((c) => {
            const cPartnerId = c.partner_id ?? c.partnerId;
            const selectedPartnerId = selectedConversation?.partner_id ?? selectedConversation?.partnerId;
            const isActive =
              c.id === selectedConversationId ||
              (cPartnerId != null && selectedPartnerId != null && String(cPartnerId) === String(selectedPartnerId));
            const unread = Number(c.unread_count ?? c.unreadCount ?? 0) || 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedConversationId(c.id)}
                className={`group flex items-center gap-2 px-3 py-1 rounded-full border text-xs whitespace-nowrap ${
                  isActive ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                <span className="max-w-[120px] truncate">{c.partner_name || 'Conversación'}</span>
                {unread > 0 && (
                  <span className={`text-[10px] px-1.5 h-[18px] rounded-full flex items-center justify-center ${isActive ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}`}>
                    {unread}
                  </span>
                )}
                <span
                  role="button"
                  tabIndex={0}
                  title="Ocultar"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const partnerId = c.partner_id ?? c.partnerId;
                    if (partnerId == null) return;
                    const partnerKey = String(partnerId);

                    setHiddenPartnerIds((prev) => {
                      if (prev.has(partnerKey)) return prev;
                      const next = new Set(prev);
                      next.add(partnerKey);
                      return next;
                    });

                    if (isActive) {
                      const nextConv = (Array.isArray(visibleConversationsForDisplay)
                        ? visibleConversationsForDisplay
                        : [])
                        .filter((x) => String((x.partner_id ?? x.partnerId) ?? '') !== partnerKey)
                        .sort((a, b) => {
                          const at = new Date(a.last_message_at ?? a.lastMessageAt ?? a.updated_at ?? a.updatedAt ?? a.created_at ?? a.createdAt ?? 0).getTime();
                          const bt = new Date(b.last_message_at ?? b.lastMessageAt ?? b.updated_at ?? b.updatedAt ?? b.created_at ?? b.createdAt ?? 0).getTime();
                          return bt - at;
                        })[0];
                      setSelectedConversationId(nextConv?.id ?? null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.click();
                    }
                  }}
                  className={`ml-1 text-[12px] leading-none opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity ${
                    isActive ? 'text-slate-300 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  ×
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        ref={chatContainerRef}
        className="flex-1 bg-slate-50 overflow-y-auto p-3 text-sm space-y-2"
      >
        {!selectedConversationId ? (
          <p className="text-slate-500 text-xs text-center mt-4">
            No tienes conversaciones todavía.
          </p>
        ) : loading ? (
          <p className="text-slate-500 text-xs text-center mt-4">Cargando conversación...</p>
        ) : messages.length === 0 ? (
          <p className="text-slate-400 text-xs text-center mt-4">No hay mensajes todavía. Inicia la conversación.</p>
        ) : (
          messages.map((msg) => {
            const senderId = msg.sender_id ?? msg.senderId;
            const isMine = senderId === currentUser.id;
            const isSystem = msg.is_system || msg.isSystem;
            const users = Array.isArray(state.users) ? state.users : [];
            const senderUser = users.find((u) => u.id === senderId);
            const senderRole = (senderUser?.role || senderUser?.rol || '').toLowerCase();
            const isOwnerSender = senderRole.includes('owner');
            const text = msg.text;
            const parsedText = extractPhotoFromText(text);
            const displayText = parsedText.cleanedText;
            const ts = msg.created_at || msg.timestamp;
            const timeLabel = ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

            const relatedAction = msg.related_action ?? msg.relatedAction;
            const relatedId = msg.related_id ?? msg.relatedId;
            const isRescheduleProposal =
              isSystem && relatedAction === 'RESCHEDULE_PROPOSAL' && !!relatedId;

            const isReviewRequest = (() => {
              if (!isSystem || !relatedId) return false;
              const a = String(relatedAction || '').trim().toUpperCase();
              return a === 'REVIEW_REQUEST';
            })();

            const isRescheduleProposalAlreadyResponded =
              isRescheduleProposal && respondedRescheduleNotificationIds.has(String(relatedId));

            const bubbleClasses = (() => {
              if (isSystem) return 'bg-blue-50 border border-blue-200 text-slate-800 text-center w-full';
              if (isOwnerSender) return 'bg-purple-50 border border-purple-300 text-purple-900';
              if (isMine) return 'bg-slate-800 text-white rounded-br-none';
              return 'bg-white border border-slate-200 text-slate-800 rounded-bl-none';
            })();
            return (
              <div
                key={msg.id}
                className={`flex w-full ${isMine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  key={msg.id}
                  className={`max-w-[75%] rounded-lg px-3 py-2 mb-1 text-xs shadow-sm ${bubbleClasses}`}
                >
                  {isSystem && (
                    <span className="block text-[10px] font-bold text-blue-600 mb-1">
                      AUTOMÁTICO
                    </span>
                  )}
                  {!isSystem && isOwnerSender && (
                    <span className="block text-[10px] font-bold text-purple-700 mb-1">
                      DUEÑO / ADMIN
                    </span>
                  )}
                  {displayText && (
                    <p className="whitespace-pre-wrap break-words">{displayText}</p>
                  )}
                  {parsedText.photoUrl && (
                    <img
                      src={parsedText.photoUrl}
                      alt="Foto del producto"
                      loading="lazy"
                      className="mt-2 w-full max-h-56 object-contain rounded border border-slate-200 bg-white"
                    />
                  )}
                  {isRescheduleProposal && !isMine && (
                    <RescheduleProposalActions
                      notificationId={relatedId}
                      disabled={isRescheduleProposalAlreadyResponded}
                      onRespond={async (accepted) => {
                        try {
                          await respondToNotification(relatedId, accepted);
                          // Pequeño refresco manual de mensajes para ver el resultado
                          if (conversationId) {
                            const latest = await loadMessagesForConversation(conversationId);
                            setMessages(latest);
                          }
                        } catch (e) {
                          console.error('Error al responder propuesta desde el chat:', e);
                        }
                      }}
                    />
                  )}

                  {isReviewRequest && !isMine && (
                    <ReviewRequestActions appointmentId={relatedId} />
                  )}
                  <span
                    className={`block mt-1 text-[10px] ${
                      isMine && !isOwnerSender ? 'text-slate-300' : 'text-slate-400'
                    }`}
                  >
                    {timeLabel}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="border-t border-slate-200 bg-white px-2 py-2 flex items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              if (!selectedConversationId || !currentUser?.id) return;
              const partnerName = selectedConversation?.partner_name ?? selectedConversation?.partnerName;
              const ok = window.confirm(
                partnerName
                  ? `¿Estás seguro de que deseas eliminar la conversación con ${partnerName}?`
                  : '¿Estás seguro de que deseas eliminar esta conversación?'
              );
              if (!ok) return;

              const partnerId = selectedConversation?.partner_id ?? selectedConversation?.partnerId;
              const list = Array.isArray(conversations) ? conversations : [];
              const toArchive = partnerId == null
                ? list.filter((c) => c?.id === selectedConversationId)
                : list.filter((c) => String(c?.partner_id ?? c?.partnerId ?? '') === String(partnerId));

              const uniqueIds = Array.from(new Set(toArchive.map((c) => c?.id).filter((id) => id != null)));
              if (uniqueIds.length === 0) uniqueIds.push(selectedConversationId);

              for (const id of uniqueIds) {
                await archiveConversation(id, currentUser.id);
              }

              const refreshed = await loadUserConversations(currentUser.id);
              setConversations(refreshed);
              const displayList = buildDisplayConversations(refreshed);
              setSelectedConversationId(displayList?.[0]?.id ?? null);
            } catch (e) {
              console.error('Error eliminando conversación:', e);
            }
          }}
          disabled={!selectedConversationId}
          className="px-3 py-2 rounded-full bg-slate-200 text-slate-700 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Eliminar
        </button>
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            sending
                ? 'Enviando...'
                : 'Escribe un mensaje...'
          }
          disabled={sending || !conversationId}
          className="flex-1 text-xs px-3 py-2 rounded-full border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-100"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !conversationId || !inputValue.trim()}
          className="px-3 py-2 rounded-full bg-slate-900 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

const RescheduleProposalActions = ({ notificationId, onRespond, disabled = false }) => {
  const [submitting, setSubmitting] = useState(false);
  const [localDisabled, setLocalDisabled] = useState(false);

  useEffect(() => {
    if (disabled) setLocalDisabled(true);
  }, [disabled]);

  if (!notificationId || !onRespond) return null;

  const handleClick = async (accepted) => {
    if (submitting || localDisabled) return;
    setSubmitting(true);
    try {
      await onRespond(accepted);
      setLocalDisabled(true);
    } finally {
      setSubmitting(false);
    }
  };

  const isDisabled = localDisabled || submitting;

  return (
    <div className="mt-2 flex gap-2 justify-end">
      <button
        type="button"
        onClick={() => handleClick(true)}
        disabled={isDisabled}
        className="px-2 py-1 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400"
      >
        Aceptar adelanto
      </button>
      <button
        type="button"
        onClick={() => handleClick(false)}
        disabled={isDisabled}
        className="px-2 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white text-[10px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:hover:bg-slate-400"
      >
        Rechazar
      </button>
    </div>
  );
};

const ReviewRequestActions = ({ appointmentId }) => {
  const { state } = useContext(AppContext);

  if (!appointmentId) return null;

  return (
    <div className="mt-2 flex gap-2 justify-end">
      <button
        type="button"
        onClick={() => {
          try {
            const appts = Array.isArray(state.appointments) ? state.appointments : [];
            const appt = appts.find((a) => String(a?.id) === String(appointmentId)) || null;
            const shopId = appt?.shopId ?? appt?.shop_id ?? null;
            if (shopId == null) return;
            window.dispatchEvent(
              new CustomEvent('open-reviews-modal', {
                detail: {
                  shopId,
                  appointmentId,
                },
              })
            );
          } catch (e) {
            console.error('No se pudo abrir el popup de reseñas desde el chat:', e);
          }
        }}
        className="px-2 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-semibold"
      >
        Dejar reseña
      </button>
    </div>
  );
};

export default ChatWidget;
