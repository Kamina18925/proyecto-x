import React, { useEffect, useState } from 'react';
import { loadOwnerConversations, loadMessagesForConversation, sendChatMessage } from '../services/dataService';

const OwnerChatSupervision = ({ ownerId }) => {
  const [conversations, setConversations] = useState([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [shopFilter, setShopFilter] = useState('');
  const [barberFilter, setBarberFilter] = useState('');
  const [composeText, setComposeText] = useState('');
  const [composeTarget, setComposeTarget] = useState('barber'); // 'client' | 'barber'
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchConversations = async () => {
      if (!ownerId) return;
      setLoadingConversations(true);
      try {
        const data = await loadOwnerConversations(ownerId);
        setConversations(Array.isArray(data) ? data : []);
      } finally {
        setLoadingConversations(false);
      }
    };

    fetchConversations();
  }, [ownerId]);

  const handleSelectConversation = async (conv) => {
    setSelectedConversation(conv);
    setMessages([]);
    if (!conv?.id) return;
    setLoadingMessages(true);
    try {
      const msgs = await loadMessagesForConversation(conv.id);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } finally {
      setLoadingMessages(false);
    }
  };

  const formatDateTime = (ts) => {
    if (!ts) return '';
    const dt = new Date(ts);
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
    return `${fecha} ${hora}`;
  };

  const shopOptions = Array.from(
    new Map(
      conversations
        .filter((c) => c.shop_name)
        .map((c) => [c.shop_name, c.shop_name])
    ).values()
  );

  const barberOptions = Array.from(
    new Map(
      conversations
        .filter((c) => c.barber_name)
        .map((c) => [c.barber_name, c.barber_name])
    ).values()
  );

  const filteredConversations = conversations.filter((conv) => {
    if (shopFilter && conv.shop_name !== shopFilter) return false;
    if (barberFilter && conv.barber_name !== barberFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-4">
        <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <i className="fas fa-comments text-indigo-500"></i>
          Supervisión de Chats
        </h3>
        <div className="flex flex-col md:flex-row gap-3 mb-3 text-xs">
          <div className="flex-1">
            <label className="block text-slate-600 mb-1">Filtrar por barbería</label>
            <select
              value={shopFilter}
              onChange={(e) => setShopFilter(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
            >
              <option value="">Todas</option>
              {shopOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-slate-600 mb-1">Filtrar por profesional</label>
            <select
              value={barberFilter}
              onChange={(e) => setBarberFilter(e.target.value)}
              className="w-full border border-slate-300 rounded px-2 py-1 text-xs"
            >
              <option value="">Todos</option>
              {barberOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>
        {loadingConversations ? (
          <p className="text-sm text-slate-500">Cargando conversaciones...</p>
        ) : filteredConversations.length === 0 ? (
          <p className="text-sm text-slate-500">No hay conversaciones registradas aún.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded divide-y divide-slate-100">
            {filteredConversations.map((conv) => {
              const unreadClient = Number(conv.unread_for_client || 0);
              const unreadBarber = Number(conv.unread_for_barber || 0);
              const totalUnread = unreadClient + unreadBarber;
              return (
              <button
                key={conv.id}
                type="button"
                onClick={() => handleSelectConversation(conv)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex flex-col gap-0.5 ${
                  selectedConversation?.id === conv.id ? 'bg-indigo-50' : 'bg-white'
                }`}
              >
                <div className="flex justify-between items-center gap-2">
                  <span className="font-semibold text-slate-800 truncate">
                    {conv.client_name || 'Cliente'} 
                    <span className="text-slate-400">/</span> {conv.barber_name || 'Profesional'}
                  </span>
                  <span className="text-[11px] text-slate-400 shrink-0">
                    {formatDateTime(conv.last_message_at || conv.updated_at || conv.created_at)}
                  </span>
                </div>
                <div className="text-xs text-slate-500 truncate">
                  {conv.shop_name || 'Barbería'}
                </div>
                {totalUnread > 0 && (
                  <div className="text-[11px] text-amber-600 font-semibold flex items-center gap-1">
                    <i className="fas fa-circle text-[7px]"></i>
                    {totalUnread} mensaje(s) sin leer (cliente: {unreadClient}, profesional: {unreadBarber})
                  </div>
                )}
                {conv.last_message_text && (
                  <div className="text-xs text-slate-600 truncate">
                    Último: {conv.last_message_text}
                  </div>
                )}
              </button>
            );})}
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow p-4 min-h-[200px]">
        <h3 className="text-lg font-semibold text-slate-700 mb-3 flex items-center gap-2">
          <i className="fas fa-eye text-indigo-500"></i>
          Detalle de conversación
        </h3>
        {!selectedConversation ? (
          <p className="text-sm text-slate-500">Selecciona una conversación para ver sus mensajes.</p>
        ) : loadingMessages ? (
          <p className="text-sm text-slate-500">Cargando mensajes...</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-slate-500">Esta conversación aún no tiene mensajes.</p>
        ) : (
          <>
            <div className="max-h-60 overflow-y-auto border border-slate-200 rounded p-3 space-y-2 text-sm bg-slate-50 mb-3">
              {messages.map((msg) => {
                const isSystem = msg.is_system || msg.isSystem;
                const ts = msg.created_at || msg.timestamp;
                const timeLabel = ts ? formatDateTime(ts) : '';
                return (
                  <div
                    key={msg.id}
                    className={`px-3 py-2 rounded-lg text-xs shadow-sm border ${
                      isSystem
                        ? 'bg-blue-50 border-blue-200 text-slate-800'
                        : 'bg-white border-slate-200 text-slate-800'
                    }`}
                  >
                    {isSystem && (
                      <span className="block text-[10px] font-bold text-blue-600 mb-1">
                        AUTOMÁTICO
                      </span>
                    )}
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                    <span className="block mt-1 text-[10px] text-slate-400">{timeLabel}</span>
                  </div>
                );
              })}
            </div>
            <OwnerComposeMessage
              ownerId={ownerId}
              conversation={selectedConversation}
              composeText={composeText}
              setComposeText={setComposeText}
              composeTarget={composeTarget}
              setComposeTarget={setComposeTarget}
              sending={sending}
              setSending={setSending}
              onSent={async () => {
                if (!selectedConversation?.id) return;
                const msgs = await loadMessagesForConversation(selectedConversation.id);
                setMessages(Array.isArray(msgs) ? msgs : []);
              }}
            />
          </>
        )}
      </div>
    </div>
  );
};

const OwnerComposeMessage = ({
  ownerId,
  conversation,
  composeText,
  setComposeText,
  composeTarget,
  setComposeTarget,
  sending,
  setSending,
  onSent,
}) => {
  if (!ownerId || !conversation) return null;

  const handleSend = async () => {
    const text = (composeText || '').trim();
    if (!text) return;
    const clientId = conversation.client_id ?? conversation.clientId;
    const barberId = conversation.barber_id ?? conversation.barberId;
    let receiverId = null;
    if (composeTarget === 'client') receiverId = clientId;
    if (composeTarget === 'barber') receiverId = barberId;
    if (!receiverId) return;

    try {
      setSending(true);
      await sendChatMessage({
        conversationId: conversation.id,
        senderId: ownerId,
        receiverId,
        text,
        isSystem: false,
      });
      setComposeText('');
      if (typeof onSent === 'function') {
        await onSent();
      }
    } catch (e) {
      console.error('Error al enviar mensaje como dueño:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border-t border-slate-200 pt-3 mt-2 flex flex-col gap-2 text-xs">
      <div className="flex items-center gap-2">
        <span className="text-slate-600">Enviar a:</span>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            name="owner-chat-target"
            value="barber"
            checked={composeTarget === 'barber'}
            onChange={() => setComposeTarget('barber')}
          />
          <span>Profesional</span>
        </label>
        <label className="inline-flex items-center gap-1">
          <input
            type="radio"
            name="owner-chat-target"
            value="client"
            checked={composeTarget === 'client'}
            onChange={() => setComposeTarget('client')}
          />
          <span>Cliente</span>
        </label>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={composeText}
          onChange={(e) => setComposeText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={sending ? 'Enviando...' : 'Escribe un mensaje como dueño...'}
          disabled={sending}
          className="flex-1 border border-slate-300 rounded px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-400"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !composeText.trim()}
          className="px-3 py-1 rounded bg-indigo-600 text-white text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
        >
          Enviar
        </button>
      </div>
    </div>
  );
};

export default OwnerChatSupervision;
