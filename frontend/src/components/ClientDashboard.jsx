import React, { useContext, useState, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import ClientAppointments from './ClientAppointments';
import ClientProductsView from './ClientProductsView';
import Modal from './ui/Modal';
import api from '../services/apiService';
import { getOrCreateDirectConversation, sendChatMessage } from '../services/dataService';

// Formatear HH:mm (24h) a formato 12h (ej. "03:20 PM") solo para mostrar en la UI
const formatTimeTo12h = (time24) => {
  if (!time24 || typeof time24 !== 'string') return time24;
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10) || 0;
  if (Number.isNaN(h)) return time24;

  const period = h >= 12 ? 'PM' : 'AM';
  const h12Raw = h % 12;
  const h12 = h12Raw === 0 ? 12 : h12Raw;
  const hh = String(h12).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${hh}:${mm} ${period}`;
};

const formatAvgRatingEs = (value) => {
  const n = Number(value);
  const safe = Number.isFinite(n) ? n : 0;
  return safe.toLocaleString('es-DO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};

const RatingStars = ({ value, idPrefix, sizeClass = 'w-4 h-4' }) => {
  const raw = Number(value);
  const clamped = Math.max(0, Math.min(5, Number.isFinite(raw) ? raw : 0));
  const rounded = Math.round(clamped * 2) / 2;
  const full = Math.floor(rounded);
  const half = rounded - full === 0.5;

  const starPath =
    'M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.173c.969 0 1.371 1.24.588 1.81l-3.376 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118L10 14.347l-3.375 2.455c-.785.57-1.84-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.632 9.394c-.783-.57-.38-1.81.588-1.81h4.173a1 1 0 00.95-.69l1.286-3.967z';

  return (
    <div className="flex items-center gap-0.5" aria-label={`Rating: ${rounded} de 5`}>
      {Array.from({ length: 5 }).map((_, idx) => {
        const n = idx + 1;
        const isFull = n <= full;
        const isHalf = !isFull && half && n === full + 1;
        const gradId = `${idPrefix}-star-${n}`;

        if (isHalf) {
          return (
            <svg key={gradId} viewBox="0 0 20 20" className={sizeClass} aria-hidden="true">
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="50%" stopColor="#d1d5db" />
                </linearGradient>
              </defs>
              <path d={starPath} fill={`url(#${gradId})`} />
            </svg>
          );
        }

        return (
          <svg
            key={gradId}
            viewBox="0 0 20 20"
            className={`${sizeClass} ${isFull ? 'text-amber-500' : 'text-slate-300'}`}
            aria-hidden="true"
          >
            <path d={starPath} fill="currentColor" />
          </svg>
        );
      })}
    </div>
  );
};

// Helpers del original
const getShopOpenStatus = (shop, targetDate, allUsers, allBarberAvailability) => {
  if (!shop) return { status: 'Desconocido', reason: 'Barbería no especificada', cssClass: 'bg-slate-100 text-slate-600' };
  const dayOfWeekIndex = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getUTCDay();
  const dayKey = ['D', 'L', 'M', 'X', 'J', 'V', 'S'][dayOfWeekIndex];
  const hours = shop.openingHours?.[dayKey];
  if (!hours || hours === 'Cerrado') return { status: 'Cerrado', reason: 'Hoy no abre', cssClass: 'bg-red-100 text-red-700' };
  const [open, close] = hours.split('-');
  const now = new Date();
  const [h, m] = open.split(':');
  const [h2, m2] = close.split(':');
  const openMinutes = parseInt(h) * 60 + parseInt(m);
  const closeMinutes = parseInt(h2) * 60 + parseInt(m2);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes >= openMinutes && nowMinutes < closeMinutes) return { status: 'Abierto', reason: '', cssClass: 'bg-green-100 text-green-800' };
  return { status: 'Cerrado', reason: 'Fuera de horario', cssClass: 'bg-red-100 text-red-700' };
};

const ClientDashboard = () => {
  const { state, dispatch } = useContext(AppContext);
  const [search, setSearch] = useState('');
  const [selectedShop, setSelectedShop] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [reviewsShop, setReviewsShop] = useState(null);
  const [reviewsModalShowLeaveReview, setReviewsModalShowLeaveReview] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [activeView, setActiveView] = useState('shops'); // 'shops', 'appointments', 'products'
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState('');
  const [profileCurrentPassword, setProfileCurrentPassword] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdNext, setPwdNext] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [shopReviews, setShopReviews] = useState([]);
  const [shopReviewsLoading, setShopReviewsLoading] = useState(false);
  const [reviewAppointmentId, setReviewAppointmentId] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  // Estado para compra de productos
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [purchaseShop, setPurchaseShop] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [purchaseMethod, setPurchaseMethod] = useState('pickup'); // 'pickup' | 'delivery'
  const [purchaseAddress, setPurchaseAddress] = useState('');
  const [purchasePhone, setPurchasePhone] = useState('');
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [purchaseBarberId, setPurchaseBarberId] = useState(null);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  // Hora del servidor (para evitar depender del reloj del cliente)
  const [serverNowIso, setServerNowIso] = useState(null);
  const [serverNowFetchedAtMs, setServerNowFetchedAtMs] = useState(null);

  const purchaseBarber = useMemo(() => {
    if (purchaseBarberId == null) return null;
    const users = Array.isArray(state.users) ? state.users : [];
    return users.find(u => String(u?.id) === String(purchaseBarberId)) || null;
  }, [purchaseBarberId, state.users]);

  const resolvedPurchaseShop = useMemo(() => {
    if (purchaseShop) return purchaseShop;
    const productShopId = selectedProduct?.shopId ?? selectedProduct?.shop_id ?? null;
    if (productShopId == null) return null;
    const shops = Array.isArray(state.barberShops) ? state.barberShops : [];
    return shops.find(s => String(s?.id) === String(productShopId)) || null;
  }, [purchaseShop, selectedProduct, state.barberShops]);
  const [nowTick, setNowTick] = useState(0);
  
  // Referencias para controlar el ciclo de vida del componente
  const isMounted = useRef(true);

  useEffect(() => {
    // Establecer la referencia de montaje al inicio
    isMounted.current = true;

    // Limpieza al desmontar
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (activeView !== 'profile') return;
    const u = state?.currentUser;
    if (!u) return;
    setProfileName(String(u?.name || u?.nombre || '').trim());
    setProfilePhone(String(u?.phone || u?.telefono || '').trim());
    setProfilePhotoUrl(String(u?.photoUrl || u?.photo_url || '').trim());
    setProfileError('');
    setProfileSuccess('');
  }, [activeView, state?.currentUser]);

  useEffect(() => {
    if (!showReviewsModal || !reviewsShop?.id) return;

    let cancelled = false;
    const load = async () => {
      setShopReviewsLoading(true);
      try {
        const res = await api.barberShops.getReviews(reviewsShop.id);
        if (cancelled) return;
        setShopReviews(Array.isArray(res) ? res : []);
      } catch (e) {
        if (cancelled) return;
        setShopReviews([]);
      } finally {
        if (!cancelled) setShopReviewsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [showReviewsModal, reviewsShop?.id]);

  useEffect(() => {
    const handler = (event) => {
      const shopId = event?.detail?.shopId;
      const appointmentId = event?.detail?.appointmentId;
      if (shopId == null) return;

      const shops = Array.isArray(state.barberShops) ? state.barberShops : [];
      const shop = shops.find((s) => String(s?.id) === String(shopId)) || null;
      if (!shop) return;

      setReviewsShop(shop);
      setShowReviewsModal(true);
      setReviewsModalShowLeaveReview(true);
      setReviewComment('');
      setReviewRating(5);
      setReviewAppointmentId(appointmentId != null ? String(appointmentId) : '');
    };

    window.addEventListener('open-reviews-modal', handler);
    return () => {
      window.removeEventListener('open-reviews-modal', handler);
    };
  }, [state.barberShops]);

  const getEligibleAppointmentsForShop = (shopId) => {
    const userId = state?.currentUser?.id;
    if (!userId || shopId == null) return [];
    return (Array.isArray(state.appointments) ? state.appointments : []).filter((a) => {
      const sameClient = (a.clientId ?? a.client_id) != null && String(a.clientId ?? a.client_id) === String(userId);
      const sameShop = (a.shopId ?? a.shop_id) != null && String(a.shopId ?? a.shop_id) === String(shopId);
      const status = String(a.status || '').toLowerCase();
      const isCompleted = status === 'completed' || status === 'completada' || status === 'completado' || status.startsWith('complet');
      const reviewed = a.clientReviewed !== undefined ? a.clientReviewed : (a.client_reviewed !== undefined ? a.client_reviewed : false);
      return sameClient && sameShop && isCompleted && !reviewed;
    });
  };

  const handleOpenReviewsModal = (shop, opts = {}) => {
    if (!shop?.id) return;
    setReviewsShop(shop);
    setShowReviewsModal(true);
    setReviewsModalShowLeaveReview(!!opts.openLeaveReview);
    setReviewComment('');
    setReviewRating(5);
    setReviewAppointmentId(opts.appointmentId != null ? String(opts.appointmentId) : '');
  };

  const handleCloseReviewsModal = () => {
    setShowReviewsModal(false);
    setReviewsShop(null);
    setReviewsModalShowLeaveReview(false);
    setReviewAppointmentId('');
    setReviewComment('');
    setReviewRating(5);
  };

  const openUrlInNewTab = (url) => {
    let newWin = null;
    try {
      newWin = window.open('about:blank', '_blank');
    } catch {
      newWin = null;
    }

    // Si el navegador bloquea popups o devuelve la misma pestaña, no navegamos la actual.
    if (!newWin || newWin === window) {
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'El navegador bloqueó la ventana emergente. Permite los popups para abrir WhatsApp.', type: 'error' }
      });
      return false;
    }

    try {
      newWin.opener = null;
    } catch {
      // ignore
    }

    try {
      newWin.location.href = url;
    } catch {
      // ignore
    }

    return true;
  };

  const handleOpenDirectionsToShop = (shop) => {
    const address = shop?.address;
    const city = shop?.city;
    const destination = [address, city].filter(Boolean).join(', ').trim();
    const shopLat = shop?.latitude ?? shop?.lat ?? shop?.schedule?.latitude ?? shop?.schedule?.lat;
    const shopLng = shop?.longitude ?? shop?.lng ?? shop?.schedule?.longitude ?? shop?.schedule?.lng;

    if (!destination) {
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Este negocio no tiene dirección registrada.', type: 'error' },
      });
      return;
    }

    const destParam = (shopLat != null && shopLng != null)
      ? `${shopLat},${shopLng}`
      : destination;

    // Abrir Google Maps inmediatamente (acción directa del click, sin popups asíncronos).
    // Google Maps pedirá la ubicación para calcular la ruta desde "Tu ubicación".
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destParam)}&travelmode=driving`;
    openUrlInNewTab(url);
  };

  const handleOpenWhatsAppToShop = (shop) => {
    const rawLink = shop?.whatsappLink ?? shop?.schedule?.whatsappLink;
    const rawPhone = shop?.phone ?? shop?.schedule?.phone;

    const trimmedLink = String(rawLink || '').trim();
    const trimmedPhone = String(rawPhone || '').trim();

    let url = '';
    if (trimmedLink) {
      url = trimmedLink;
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
    } else if (trimmedPhone) {
      const digitsRaw = trimmedPhone.replace(/\D/g, '');
      if (digitsRaw) {
        const digits = (digitsRaw.length === 10 && !digitsRaw.startsWith('1'))
          ? `1${digitsRaw}`
          : digitsRaw;
        url = `https://wa.me/${digits}`;
      }
    }

    if (!url) {
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Esta barbería no tiene WhatsApp configurado.', type: 'error' }
      });
      return;
    }

    openUrlInNewTab(url);
  };

  const handleOpenWhatsAppToBarber = (barber) => {
    const rawLink = barber?.whatsappLink ?? barber?.whatsapp_link;
    const rawPhone = barber?.phone ?? barber?.telefono;

    const trimmedLink = String(rawLink || '').trim();
    const trimmedPhone = String(rawPhone || '').trim();

    let url = '';
    if (trimmedLink) {
      url = trimmedLink;
      if (!/^https?:\/\//i.test(url)) {
        url = `https://${url}`;
      }
    } else if (trimmedPhone) {
      const digitsRaw = trimmedPhone.replace(/\D/g, '');
      if (digitsRaw) {
        const digits = (digitsRaw.length === 10 && !digitsRaw.startsWith('1'))
          ? `1${digitsRaw}`
          : digitsRaw;
        url = `https://wa.me/${digits}`;
      }
    }

    if (!url) {
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Este barbero no tiene WhatsApp configurado.', type: 'error' }
      });
      return;
    }

    openUrlInNewTab(url);
  };

  const handleOpenChatOptionsForBarber = (barber) => {
    if (!barber?.id) return;

    dispatch({
      type: 'SHOW_MODAL',
      payload: {
        props: { title: 'Chatear con el barbero' },
        content: (
          <div className="p-4 space-y-3">
            <p className="text-sm text-slate-600">
              Elige cómo quieres comunicarte con <span className="font-semibold">{barber?.name || barber?.nombre || 'el barbero'}</span>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                className="px-4 py-3 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    window.dispatchEvent(new CustomEvent('open-chat-widget', { detail: { barberId: barber.id } }));
                  } catch (err) {
                    console.error('No se pudo abrir el chat directo:', err);
                  } finally {
                    dispatch({ type: 'HIDE_MODAL' });
                  }
                }}
              >
                Chatear en la web
              </button>
              <button
                type="button"
                className="px-4 py-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    handleOpenWhatsAppToBarber(barber);
                  } finally {
                    dispatch({ type: 'HIDE_MODAL' });
                  }
                }}
              >
                Chatear en WhatsApp
              </button>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                className="px-4 py-2 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-semibold"
                onClick={() => dispatch({ type: 'HIDE_MODAL' })}
              >
                Cancelar
              </button>
            </div>
          </div>
        ),
      },
    });
  };

  // Obtener hora actual del servidor cuando se monta el dashboard
  useEffect(() => {
    const fetchServerTime = async () => {
      try {
        const res = await api.time.getNow();
        setServerNowIso(res.nowIso);
        setServerNowFetchedAtMs(Date.now());
      } catch (e) {
        console.error('No se pudo obtener hora del servidor, se usará hora local del navegador.', e);
      }
    };
    fetchServerTime();
    // Opcional: podríamos refrescar cada cierto tiempo si hiciera falta
  }, []);

  // Tick para recalcular horarios disponibles en tiempo real mientras el modal está abierto
  useEffect(() => {
    if (!showModal) return;
    const id = setInterval(() => {
      setNowTick((t) => (t + 1) % 1_000_000);
    }, 30 * 1000);
    return () => clearInterval(id);
  }, [showModal]);

  // Polling local de citas mientras el modal de reserva esté abierto,
  // para que otras pestañas/clientes vean las horas bloqueadas casi en tiempo real.
  useEffect(() => {
    if (!showModal) return; // solo cuando el modal está abierto

    let cancelled = false;

    const fetchAppointmentsOnce = async () => {
      try {
        const appointmentsResponse = await api.appointments.getAll();

        if (cancelled || !Array.isArray(appointmentsResponse)) return;

        // Normalizar citas al formato esperado por el frontend
        const normalizedAppointments = appointmentsResponse.map(a => ({
          id: a.id,
          clientId: a.clientId !== undefined ? a.clientId : (a.client_id !== undefined ? a.client_id : null),
          barberId: a.barberId !== undefined ? a.barberId : (a.barber_id !== undefined ? a.barber_id : null),
          shopId: a.shopId !== undefined ? a.shopId : (a.shop_id !== undefined ? a.shop_id : null),
          serviceId: a.serviceId !== undefined ? a.serviceId : (a.service_id !== undefined ? a.service_id : null),
          startTime: a.startTime || a.date || null,
          status: a.status || 'confirmed',
          notes: a.notes || null,
          hiddenForClient: a.hiddenForClient !== undefined ? a.hiddenForClient : (a.hidden_for_client !== undefined ? a.hidden_for_client : false),
          priceAtBooking: a.priceAtBooking || a.price_at_booking || null,
          clientPhoneNumberAtBooking: a.clientPhoneNumberAtBooking || a.client_phone_number_at_booking || null,
        }));

        if (!cancelled) {
          dispatch({ type: 'SET_ALL_DATA', payload: { appointments: normalizedAppointments } });
        }
      } catch (e) {
        console.error('Error al refrescar citas para el modal de reserva:', e);
      }
    };

    // Refetch inmediato al abrir el modal
    fetchAppointmentsOnce();

    // Polling cada 3 segundos mientras el modal siga abierto
    const intervalId = setInterval(fetchAppointmentsOnce, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [showModal, dispatch]);

  useEffect(() => {
    if (!showModal) return undefined;

    let cancelled = false;

    const fetchBreaksOnce = async () => {
      try {
        const breaksResponse = await api.barberBreaks.getAll();
        if (cancelled || !Array.isArray(breaksResponse)) return;

        const breaksMap = {};
        breaksResponse.forEach((row) => {
          const barberId = row.barber_id ?? row.barberId;
          const breaks = row.breaks || row.breakItems || [];
          if (barberId == null) return;
          breaksMap[barberId] = Array.isArray(breaks) ? breaks : [];
        });

        if (!cancelled) {
          dispatch({ type: 'SET_BARBER_BREAKS', payload: breaksMap });
        }
      } catch (e) {
        console.error('Error al refrescar descansos de barberos para el modal de reserva:', e);
      }
    };

    fetchBreaksOnce();
    const intervalId = setInterval(fetchBreaksOnce, 10000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [showModal, dispatch]);

  // Polling de disponibilidad de barberos mientras el modal de reserva esté abierto,
  // para que cambios recientes del barbero se reflejen en los slots del cliente.
  useEffect(() => {
    if (!showModal) return undefined;

    let cancelled = false;

    const fetchAvailabilityOnce = async () => {
      try {
        const availabilityResponse = await api.barberAvailability.getAll();
        if (cancelled || !Array.isArray(availabilityResponse)) return;

        const availabilityMap = {};
        availabilityResponse.forEach((row) => {
          const barberId = row.barber_id ?? row.barberId;
          const availability = row.availability || [];
          if (barberId == null) return;
          availabilityMap[barberId] = availability;
        });

        if (!cancelled) {
          dispatch({ type: 'SET_BARBER_AVAILABILITY', payload: availabilityMap });
        }
      } catch (e) {
        console.error('Error al refrescar disponibilidad de barberos para el modal de reserva:', e);
      }
    };

    // Refetch inmediato al abrir el modal
    fetchAvailabilityOnce();

    // Polling cada 10 segundos mientras el modal siga abierto
    const intervalId = setInterval(fetchAvailabilityOnce, 10000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [showModal, dispatch]);

  // Detectar si la fecha seleccionada es un día libre (day_off) para el barbero/barbería
  const selectedDayOffInfo = useMemo(() => {
    if (!selectedBarber || !selectedShop || !selectedDate) return null;

    const appt = (state.appointments || []).find(appt => {
      if (appt.status !== 'day_off') return false;
      const apptShopId = appt.shopId ?? appt.shop_id;
      const apptBarberId = appt.barberId ?? appt.barber_id;
      if (String(apptShopId) !== String(selectedShop.id)) return false;
      if (String(apptBarberId) !== String(selectedBarber.id)) return false;

      const start = appt.startTime || appt.date;
      if (!start) return false;
      const d = new Date(start);
      if (Number.isNaN(d.getTime())) return false;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const localDateStr = `${y}-${m}-${day}`;
      return localDateStr === selectedDate;
    });

    if (!appt) return null;

    return {
      notes: appt.notes || appt.notas || null,
    };
  }, [selectedBarber, selectedShop, selectedDate, state.appointments]);

  const selectedLeaveEarlyInfo = useMemo(() => {
    if (!selectedBarber || !selectedShop || !selectedDate) return null;

    const appt = (state.appointments || []).find(appt => {
      if (appt.status !== 'leave_early') return false;
      const apptShopId = appt.shopId ?? appt.shop_id;
      const apptBarberId = appt.barberId ?? appt.barber_id;
      if (String(apptShopId) !== String(selectedShop.id)) return false;
      if (String(apptBarberId) !== String(selectedBarber.id)) return false;

      const start = appt.startTime || appt.date;
      if (!start) return false;
      const d = new Date(start);
      if (Number.isNaN(d.getTime())) return false;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const localDateStr = `${y}-${m}-${day}`;
      return localDateStr === selectedDate;
    });

    if (!appt) return null;
    const start = appt.startTime || appt.date;
    const d = start ? new Date(start) : null;
    if (!d || Number.isNaN(d.getTime())) return null;

    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');

    return {
      cutoffTime: `${hh}:${mm}`,
      notes: appt.notes || appt.notas || null,
    };
  }, [selectedBarber, selectedShop, selectedDate, state.appointments]);

  // Helpers para obtener datos de barberos y servicios
  const getBarbersInShop = (shop) => {
    if (!shop) return [];
    const users = Array.isArray(state.users) ? state.users : [];
    const shopIdNum = Number(shop.id);

    return users.filter(u => {
      const role = (u.role || u.rol || '').toLowerCase();
      const rawUserShopId =
        u.shopId !== undefined ? u.shopId : (u.shop_id !== undefined ? u.shop_id : null);

      if (!role.includes('barber') || rawUserShopId == null) return false;

      // Comparar IDs permitiendo número o string
      const userShopIdNum = Number(rawUserShopId);

      if (!Number.isNaN(shopIdNum) && !Number.isNaN(userShopIdNum)) {
        return userShopIdNum === shopIdNum;
      }

      return String(rawUserShopId) === String(shop.id);
    });
  };
  const getServicesInShop = (shop) => {
    if (!shop) return [];

    const services = Array.isArray(state.services) ? state.services : [];
    const barberServices = state.barberServices || {};

    const shopIdRaw = shop.id;
    const shopIdNum = Number(shopIdRaw);

    // Barberos activos en esta barbería
    const barbersInShop = getBarbersInShop(shop);
    if (barbersInShop.length === 0) return [];

    const barberIds = barbersInShop.map(b => b.id);

    // Servicios visibles: generales (sin shopId) o con shopId de esta barbería
    const candidateServices = services.filter(svc => {
      const serviceShopId = svc.shopId ?? svc.shop_id ?? null;
      if (serviceShopId == null) return true;

      // Comparar IDs permitiendo número o string
      const serviceShopIdNum = Number(serviceShopId);
      if (!Number.isNaN(shopIdNum) && !Number.isNaN(serviceShopIdNum)) {
        return serviceShopIdNum === shopIdNum;
      }

      return String(serviceShopId) === String(shopIdRaw);
    });

    // De esos, solo los que al menos un barbero de la barbería tenga asignado
    return candidateServices.filter(svc => {
      const svcIdStr = String(svc.id);
      return barberIds.some(barberId => {
        const svcIds = barberServices[barberId] || [];
        const svcIdsStr = svcIds.map(id => String(id));
        return svcIdsStr.includes(svcIdStr);
      });
    });
  };

  // Obtener servicios que ofrece un barbero concreto dentro de una barbería
  const getServicesForBarberInShop = (shop, barber) => {
    if (!shop || !barber) return [];
    const allServicesInShop = getServicesInShop(shop);
    const barberServices = state.barberServices || {};
    const svcIds = barberServices[barber.id] || [];
    const svcIdsStr = svcIds.map(id => String(id));

    return allServicesInShop.filter(svc => svcIdsStr.includes(String(svc.id)));
  };

  // Obtener barberos que realizan un servicio concreto dentro de una barbería
  const getBarbersForServiceInShop = (shop, serviceId) => {
    const allBarbersInShop = getBarbersInShop(shop);
    // Si no se ha elegido servicio todavía, mostrar todos los barberos de la barbería
    if (!serviceId) return allBarbersInShop;

    const barberServices = state.barberServices || {};
    const serviceIdStr = String(serviceId);

    // Mostrar SOLO barberos que tengan explícitamente este servicio asignado
    return allBarbersInShop.filter(barb => {
      const svcIds = barberServices[barb.id] || [];
      const svcIdsStr = svcIds.map(id => String(id));
      return svcIdsStr.includes(serviceIdStr);
    });
  };

  const filteredAvailableTimes = useMemo(() => {
    // Si falta barbero o fecha, no mostramos horas
    if (!selectedBarber || !selectedDate) return [];

    const availabilityMap = state.barberAvailability || {};
    const barberAvail = availabilityMap[selectedBarber.id] || [];

    // Si el barbero no tiene ninguna disponibilidad configurada, no permitir reservas
    if (!Array.isArray(barberAvail) || barberAvail.length === 0) return [];

    // selectedDate viene como YYYY-MM-DD. new Date('YYYY-MM-DD') se interpreta como UTC y
    // puede cambiar el día en zonas horarias negativas (RD). Usamos parseo local.
    const [yStr, mStr, dStr] = String(selectedDate).split('-');
    const yNum = Number(yStr);
    const mNum = Number(mStr);
    const dNum = Number(dStr);
    if (!Number.isFinite(yNum) || !Number.isFinite(mNum) || !Number.isFinite(dNum)) return [];
    const date = new Date(yNum, mNum - 1, dNum);
    if (Number.isNaN(date.getTime())) return [];

    const dayIndex = date.getDay();
    const dayKeyByIndex = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    const dayKey = dayKeyByIndex[dayIndex];

    // Log de depuración para entender por qué no aparecen horarios
    try {
      console.log('[DEBUG slots] selectedDate =', selectedDate,
        '\n  dayIndex(local) =', dayIndex,
        '\n  dayKey =', dayKey,
        '\n  selectedBarber.id =', selectedBarber?.id,
        '\n  barberAvail =', JSON.stringify(barberAvail));
    } catch (e) {
      // ignorar errores de JSON.stringify en logs
    }

    const dayData = barberAvail.find(d => d.day === dayKey);
    // Si el barbero no trabaja este día o no tiene rango de horas, no permitir reservar
    if (!dayData || !dayData.startTime || !dayData.endTime) return [];

    const breaksForBarber = (state.barberBreaks || {})[selectedBarber.id] || [];
    const enabledBreaks = Array.isArray(breaksForBarber)
      ? breaksForBarber.filter(b => b && b.enabled !== false && b.day && b.startTime && b.endTime)
      : [];

    const [sh, sm] = dayData.startTime.split(':').map(Number);
    const [eh, em] = dayData.endTime.split(':').map(Number);
    const startMinutes = sh * 60 + sm;
    // Soportar explícitamente turnos que terminan a las 00:00 tratándolo como 24:00 del mismo día
    const rawEndMinutes = eh * 60 + em;
    let endMinutes = dayData.endTime === '00:00' ? (24 * 60) : rawEndMinutes;

    if (selectedLeaveEarlyInfo?.cutoffTime) {
      const [ch, cm] = String(selectedLeaveEarlyInfo.cutoffTime).split(':').map(Number);
      if (Number.isFinite(ch) && Number.isFinite(cm)) {
        const cutoffMinutes = (ch * 60) + cm;
        endMinutes = Math.min(endMinutes, cutoffMinutes);
      }
    }

    // Duración del servicio seleccionado (en minutos)
    const selectedDurationMinutesRaw =
      selectedService?.baseDurationMinutes ??
      selectedService?.duration ??
      selectedService?.baseDuration ??
      0;
    const selectedDurationMinutes = Math.max(0, Number(selectedDurationMinutesRaw) || 0);

    // Configuración de slots y margen de anticipación
    // Generamos slots en saltos según la duración del servicio.
    // Si no hay servicio seleccionado, usamos 10 minutos como fallback.
    const SLOT_INTERVAL_MINUTES = selectedDurationMinutes > 0 ? selectedDurationMinutes : 10;

    // Tiempo de llegada configurado por barbero (si existe)
    const arrivalConfig = state.barberArrivalBuffers?.[selectedBarber.id] || {};
    const MIN_LEAD_TIME_MINUTES = arrivalConfig.enabled
      ? (Number.isFinite(arrivalConfig.minutes) ? arrivalConfig.minutes : 20)
      : 0;

    // Calcular minutos actuales según hora del servidor (si está disponible) en tiempo real
    let minAllowedMinutes = startMinutes;
    try {
      let now = new Date();
      if (serverNowIso && serverNowFetchedAtMs) {
        const base = new Date(serverNowIso);
        if (!Number.isNaN(base.getTime())) {
          const driftMs = Date.now() - serverNowFetchedAtMs;
          now = new Date(base.getTime() + driftMs);
        }
      }

      // Fecha de hoy (según servidor o navegador) en formato YYYY-MM-DD
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const todayStr = `${year}-${month}-${day}`;

      const [nh, nm] = [now.getHours(), now.getMinutes()];
      const nowMinutes = nh * 60 + nm;

      if (selectedDate < todayStr) {
        // Día en el pasado: no hay horas disponibles
        return [];
      }
      if (selectedDate === todayStr) {
        // Para hoy: aplicar margen de anticipación respecto a la hora actual
        const desiredMin = nowMinutes + MIN_LEAD_TIME_MINUTES;
        minAllowedMinutes = Math.max(startMinutes, desiredMin);
      }
    } catch (e) {
      console.warn('No se pudo calcular correctamente la fecha/hora actual, se usará solo la franja de disponibilidad.', e);
    }

    // Primer slot: exactamente desde el mínimo permitido (sin redondeos)
    let firstSlotMinutes = minAllowedMinutes;

    // Generar slots dinámicos dentro de [firstSlotMinutes, endMinutes)
    const times = [];

    // Citas existentes para este barbero/barbería/fecha (para ocultar horas ya ocupadas)
    // Calculamos su rango [start,end) según la duración del servicio asociado.
    const existingAppointments = (state.appointments || [])
      .filter(appt => {
        const apptShopId = appt.shopId ?? appt.shop_id;
        const apptBarberId = appt.barberId ?? appt.barber_id;
        const start = appt.startTime;

        if (!start) return false;

        const d = new Date(start);
        if (Number.isNaN(d.getTime())) return false;

        // Construir fecha local YYYY-MM-DD para comparar con selectedDate
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const localDateStr = `${y}-${m}-${day}`;

        const st = String(appt.status || '').trim().toLowerCase();
        const isCancelled = st === 'cancelled' || st === 'cancelada' || st.startsWith('cancelled') || st.startsWith('cancelada') || st.startsWith('cancel');

        return (
          String(apptShopId) === String(selectedShop?.id) &&
          String(apptBarberId) === String(selectedBarber.id) &&
          !isCancelled &&
          localDateStr === selectedDate
        );
      })
      .map(appt => {
        const start = appt.startTime;
        const d = new Date(start);
        const startMinutesOfDay = d.getHours() * 60 + d.getMinutes();

        const apptServiceId = appt.serviceId ?? appt.service_id;
        const svc = (state.services || []).find(s => String(s.id) === String(apptServiceId));
        const durationRaw = svc?.baseDurationMinutes ?? svc?.duration ?? 0;
        const durationMinutes = Math.max(0, Number(durationRaw) || 0);

        return {
          startMinutesOfDay,
          endMinutesOfDay: startMinutesOfDay + durationMinutes,
        };
      });

    const serviceDurationForOverlap = selectedDurationMinutes || 0;

    const toMinutes = (hhmm) => {
      if (!hhmm || typeof hhmm !== 'string') return null;
      const [h, m] = hhmm.split(':').map(Number);
      if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
      return (h * 60) + m;
    };

    const prevDayKey = dayKeyByIndex[(dayIndex + 6) % 7];
    const breakIntervals = [];

    enabledBreaks.forEach((b) => {
      const bDay = b.day;
      const bStart = toMinutes(b.startTime);
      const bEnd = toMinutes(b.endTime);
      if (bStart == null || bEnd == null) return;
      const crosses = bStart > bEnd;

      if (String(bDay) === String(dayKey)) {
        if (!crosses) {
          breakIntervals.push([bStart, bEnd]);
        } else {
          breakIntervals.push([bStart, 24 * 60]);
        }
      }

      if (crosses && String(bDay) === String(prevDayKey)) {
        breakIntervals.push([0, bEnd]);
      }
    });

    const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && aEnd > bStart;

    const overlapsAnyBreak = (slotStart, slotEnd) => {
      const slotIntervals = [];
      if (slotEnd <= 24 * 60) {
        slotIntervals.push([slotStart, slotEnd]);
      } else {
        slotIntervals.push([slotStart, 24 * 60]);
        slotIntervals.push([0, slotEnd - 24 * 60]);
      }
      return breakIntervals.some(([bStart, bEnd]) =>
        slotIntervals.some(([sStart, sEnd]) => overlaps(sStart, sEnd, bStart, bEnd))
      );
    };
    const canPlaceServiceAt = (minutes) => {
      if (minutes < startMinutes) return false;
      if (minutes >= endMinutes) return false;

      // Si el servicio seleccionado no cabe dentro del horario del barbero, no ofrecer este slot
      if (selectedDurationMinutes > 0 && (minutes + selectedDurationMinutes) > endMinutes) {
        return false;
      }

      const slotEnd = minutes + serviceDurationForOverlap;

      if (serviceDurationForOverlap > 0 && overlapsAnyBreak(minutes, slotEnd)) {
        return false;
      }

      const isTaken = existingAppointments.some(appt => {
        // Overlap si: start < apptEnd && end > apptStart
        return minutes < appt.endMinutesOfDay && slotEnd > appt.startMinutesOfDay;
      });

      return !isTaken;
    };

    // 1) Encontrar el primer minuto exacto disponible (para no saltarnos horas válidas)
    let firstAvailableStart = null;
    for (let minutes = firstSlotMinutes; minutes < endMinutes; minutes += 1) {
      if (canPlaceServiceAt(minutes)) {
        firstAvailableStart = minutes;
        break;
      }
    }

    if (firstAvailableStart == null) return [];

    // 2) Generar slots (ya visibles) en saltos de la duración del servicio desde ese primer hueco
    for (let minutes = firstAvailableStart; minutes < endMinutes; minutes += SLOT_INTERVAL_MINUTES) {
      if (!canPlaceServiceAt(minutes)) continue;

      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      const label = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      times.push(label);
    }

    return times;
  }, [selectedShop, selectedBarber, selectedDate, selectedService, state.appointments, state.barberAvailability, state.barberBreaks, state.barberArrivalBuffers, serverNowIso, serverNowFetchedAtMs, nowTick]);

  // Barberos disponibles para el servicio/barbería actualmente seleccionados
  const barbersForCurrentSelection = useMemo(() => {
    if (!selectedShop) return [];
    return getBarbersForServiceInShop(selectedShop, selectedService?.id);
  }, [selectedShop, selectedService, state.barberServices, state.users]);

  // Productos disponibles de la barbería seleccionada
  const productsForSelectedShop = useMemo(() => {
    if (!selectedShop) return [];
    const products = Array.isArray(state.products) ? state.products : [];
    return products.filter(p => String(p.shopId) === String(selectedShop.id));
  }, [selectedShop, state.products]);

  const getProductOfferPercent = (product) => {
    if (!product) return 0;
    const raw = product.offer ?? product.discount_price ?? product.discountPrice ?? null;
    const n = raw == null ? NaN : Number(raw);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
  };

  const getProductEffectivePrice = (product) => {
    if (!product) return 0;
    const priceNum = Number(product.price) || 0;
    const offerPercent = getProductOfferPercent(product);
    if (offerPercent > 0) {
      const discounted = priceNum * (1 - (offerPercent / 100));
      return Math.max(0, discounted);
    }
    return priceNum;
  };

  const productHasDiscount = (product) => {
    if (!product) return false;
    return getProductOfferPercent(product) > 0;
  };

  // Auto-seleccionar barbero cuando solo hay uno disponible para el servicio
  useEffect(() => {
    if (!selectedShop) return;
    if (barbersForCurrentSelection.length === 1) {
      setSelectedBarber(barbersForCurrentSelection[0]);
    } else if (barbersForCurrentSelection.length === 0) {
      setSelectedBarber(null);
    } else if (selectedBarber && !barbersForCurrentSelection.find(b => b.id === selectedBarber.id)) {
      // Si cambió el servicio y el barbero seleccionado ya no aplica, limpiar selección
      setSelectedBarber(null);
    }
  }, [selectedShop, selectedService, barbersForCurrentSelection, selectedBarber]);

  // Manejar apertura del modal con protección contra desmontaje
  const handleOpenModal = (shop) => {
    if (!isMounted.current) return;
    
    // Primero establecer shop, luego mostrar modal en el siguiente ciclo
    setSelectedShop(shop);
    setTimeout(() => {
      if (isMounted.current) {
        setSelectedService(null);
        setSelectedBarber(null);
        // Fecha inicial por defecto: hoy (para no obligar al cliente a elegir siempre)
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        setSelectedDate(todayStr);
        setSelectedTime('');
        setShowModal(true);
      }
    }, 0);
  };
  
  // Manejar cierre del modal con protección contra desmontaje
  const handleCloseModal = () => {
    if (!isMounted.current) return;
    
    // Primero ocultar el modal, luego limpiar estados
    setShowModal(false);
    setTimeout(() => {
      if (isMounted.current) {
        setSelectedShop(null);
        setSelectedService(null);
        setSelectedBarber(null);
        setSelectedDate('');
        setSelectedTime('');
      }
    }, 100);
  };

  // Manejar apertura de modal de compra de producto
  const handleOpenProductModal = (product) => {
    if (!isMounted.current) return;
    const productShopId = product?.shopId ?? product?.shop_id ?? null;
    if (productShopId != null) {
      const shops = Array.isArray(state.barberShops) ? state.barberShops : [];
      const shopFromProduct = shops.find(s => String(s?.id) === String(productShopId)) || null;
      setPurchaseShop(shopFromProduct);
    } else {
      setPurchaseShop(null);
    }
    setSelectedProduct(product);
    setPurchaseMethod('pickup');
    setPurchaseAddress('');
    setPurchasePhone(state.currentUser?.phone || '');
    setPurchaseNotes('');
    if (product?.barberId != null) {
      const users = Array.isArray(state.users) ? state.users : [];
      const b = users.find(u => String(u.id) === String(product.barberId)) || null;
      setPurchaseBarberId(b?.id ?? product.barberId);
    } else {
      setPurchaseBarberId(null);
    }
    setShowProductModal(true);
  };

  const handleCloseProductModal = () => {
    if (!isMounted.current) return;
    setShowProductModal(false);
    setTimeout(() => {
      if (isMounted.current) {
        setSelectedProduct(null);
        setPurchaseShop(null);
        setPurchaseMethod('pickup');
        setPurchaseAddress('');
        setPurchasePhone('');
        setPurchaseNotes('');
        setPurchaseBarberId(null);
        setPurchaseLoading(false);
      }
    }, 100);
  };

  const handleBookAppointment = async () => {
    if (!selectedShop || !selectedService || !selectedDate || !selectedTime) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Completa todos los campos.', type: 'error' } });
      return;
    }

    // Determinar si es obligatorio elegir barbero (solo si hay más de uno disponible)
    const barbers = barbersForCurrentSelection;

    // Si no hay ningún barbero que ofrezca este servicio en esta barbería, no permitir la reserva
    if (barbers.length === 0) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'No hay barberos que ofrezcan este servicio en esta barbería.', type: 'error' } });
      return;
    }
    let finalBarber = selectedBarber;

    if (!finalBarber) {
      if (barbers.length === 1) {
        finalBarber = barbers[0];
        setSelectedBarber(finalBarber);
      } else if (barbers.length > 1) {
        dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Selecciona el barbero que realizará el servicio.', type: 'error' } });
        return;
      }
    }

    // Seguridad extra: no crear citas sin barbero asignado
    if (!finalBarber) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'No se pudo determinar el barbero para esta cita.', type: 'error' } });
      return;
    }

    try {
      const clientId = state.currentUser?.id;
      const serviceId = selectedService?.id;
      if (clientId != null && serviceId != null) {
        const isSameDaySameServiceConfirmed = (state.appointments || []).some(appt => {
          const apptClientId = appt.clientId ?? appt.client_id;
          const apptServiceId = appt.serviceId ?? appt.service_id;
          if (String(apptClientId) !== String(clientId)) return false;
          if (String(apptServiceId) !== String(serviceId)) return false;

          const st = String(appt.status || '').trim().toLowerCase();
          if (st !== 'confirmed') return false;

          const start = appt.startTime || appt.date || appt.start_time;
          if (!start) return false;
          const d = new Date(start);
          if (Number.isNaN(d.getTime())) return false;
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const localDateStr = `${y}-${m}-${day}`;
          return localDateStr === selectedDate;
        });

        if (isSameDaySameServiceConfirmed) {
          dispatch({
            type: 'SHOW_NOTIFICATION',
            payload: { message: 'Ya tienes una cita activa para este servicio hoy. Elige otro servicio o cancela la cita actual.', type: 'error' }
          });
          return;
        }
      }
    } catch (e) {
      console.warn('No se pudo validar duplicidad de servicio en el cliente, se continuará con validación en el servidor.', e);
    }
    
    try {
      // Activar indicador de carga
      setBookingLoading(true);
      
      // Simulación de creación de cita con manejo seguro de errores
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Verificar si el componente sigue montado
      if (!isMounted.current) return;
      
      // Determinar startTime exacto
      const startTime = `${selectedDate}T${selectedTime}:00`;

      // Comprobar si ya existe una cita para ese barbero/barbería/hora
      const existingAppt = (state.appointments || []).find(appt =>
        String(appt.shopId) === String(selectedShop.id) &&
        String(appt.barberId) === String(finalBarber.id) &&
        appt.startTime === startTime &&
        appt.status !== 'cancelled'
      );

      if (existingAppt) {
        setBookingLoading(false);
        dispatch({
          type: 'SHOW_NOTIFICATION',
          payload: { message: 'Esa hora ya está ocupada para este barbero. Elige otra hora.', type: 'error' },
        });
        return;
      }

      // Todo ok, crear la cita (sin id manual para que la BD lo genere)
      // Guardar la hora como string local de la barbería (RD por ahora)
      dispatch({
        type: 'ADD_APPOINTMENT',
        payload: {
          clientId: state.currentUser.id,
          shopId: selectedShop.id,
          barberId: finalBarber.id,
          serviceId: selectedService.id,
          startTime,
          status: 'confirmed',
          priceAtBooking: selectedService.basePrice,
          clientPhoneNumberAtBooking: state.currentUser.phone,
          additionalServices: [],
        }
      });
      
      // Verificar nuevamente si sigue montado antes de actualizar estados
      if (!isMounted.current) return;
      
      // Restablecer estado de carga
      setBookingLoading(false);
      
      // Cerrar modal con seguridad
      handleCloseModal();
    } catch (error) {
      console.error('Error al reservar cita:', error);
      
      // Verificar si sigue montado
      if (!isMounted.current) return;
      
      // Restablecer estado y mostrar error
      setBookingLoading(false);
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Error al reservar la cita. Inténtalo de nuevo.', type: 'error' } });
    }
  };

  const handleConfirmPurchase = async () => {
    if (!resolvedPurchaseShop || !selectedProduct) return;

    const currentUser = state.currentUser;
    if (!currentUser?.id) return;

    const productBarberId = selectedProduct?.barberId ?? selectedProduct?.barber_id ?? null;
    const targetBarberId = productBarberId != null ? productBarberId : (purchaseBarberId ?? null);

    if (targetBarberId == null) {
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Selecciona un barbero para enviarle el pedido de este producto.', type: 'error' },
      });
      return;
    }

    if (purchaseMethod === 'delivery' && !purchaseAddress.trim()) {
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Ingresa la dirección para el envío.', type: 'error' } });
      return;
    }

    try {
      setPurchaseLoading(true);
      await new Promise(resolve => setTimeout(resolve, 800));

      if (!isMounted.current) return;

      const effectivePrice = getProductEffectivePrice(selectedProduct);
      const hasDiscount = productHasDiscount(selectedProduct);
      const offerPercent = getProductOfferPercent(selectedProduct);

      const orderDetails = [
        `Pedido de producto: ${selectedProduct.name}`,
        `Barbería: ${resolvedPurchaseShop.name}`,
        hasDiscount
          ? `Precio: RD$${Number(effectivePrice).toFixed(2)} (antes RD$${(Number(selectedProduct.price) || 0).toFixed(2)} - ${offerPercent}%)`
          : `Precio: RD$${(Number(effectivePrice) || 0).toFixed(2)}`,
        `Entrega: ${purchaseMethod === 'pickup' ? 'Retirar en la barbería' : 'Envío a domicilio'}`,
        purchaseMethod === 'delivery' ? `Dirección: ${purchaseAddress || '(no especificada)'}` : null,
        purchaseMethod === 'delivery' ? `Teléfono: ${purchasePhone || '(no especificado)'}` : null,
        purchaseNotes?.trim() ? `Notas: ${purchaseNotes.trim()}` : null,
        selectedProduct.photoUrl ? `Foto: ${selectedProduct.photoUrl}` : null,
      ].filter(Boolean).join('\n');

      try {
        const convId = await getOrCreateDirectConversation(currentUser.id, targetBarberId);
        if (convId) {
          await sendChatMessage({
            conversationId: convId,
            senderId: currentUser.id,
            receiverId: targetBarberId,
            text: orderDetails,
            isSystem: true,
            relatedAction: 'PRODUCT_ORDER',
            relatedId: String(selectedProduct.id),
          });
          try {
            window.dispatchEvent(new CustomEvent('open-chat-widget', { detail: { barberId: targetBarberId } }));
          } catch (e) {
            console.error('No se pudo abrir el chat automáticamente tras el pedido:', e);
          }
        }
      } catch (e) {
        console.error('No se pudo enviar el pedido al chat del barbero:', e);
      }

      setPurchaseLoading(false);
      handleCloseProductModal();

      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'Pedido de producto registrado (simulado). Más adelante lo conectaremos con la tienda.',
          type: 'success',
        }
      });
    } catch (error) {
      console.error('Error al procesar compra de producto:', error);
      if (!isMounted.current) return;
      setPurchaseLoading(false);
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Error al procesar la compra. Inténtalo de nuevo.', type: 'error' } });
    }
  };

  // Transición segura entre vistas
  const handleChangeView = (view) => {
    if (!isMounted.current) return;
    
    setActiveView(view);
    setIsMobileMenuOpen(false);
    if (view !== 'profile') {
      setProfileError('');
      setProfileSuccess('');
    }
    
    // Si estamos cambiando de vista, limpiar la búsqueda
    if (view === 'shops') {
      setSearch('');
    }
  };

  if (activeView === 'appointments') {
    return (
      <ClientAppointments
        onBack={() => handleChangeView('shops')}
        serverNowIso={serverNowIso}
        serverNowFetchedAtMs={serverNowFetchedAtMs}
      />
    );
  } else if (activeView === 'products') {
    return <ClientProductsView onBack={() => handleChangeView('shops')} />;
  } else if (activeView === 'profile') {
    const currentUserId = state?.currentUser?.id;
    const photo = profilePhotoUrl ||
      (state?.currentUser?.photoUrl || state?.currentUser?.photo_url) ||
      'https://ui-avatars.com/api/?name=' + encodeURIComponent(profileName || 'Cliente') + '&background=4f46e5&color=fff&size=256';

    const handleUploadProfilePhoto = async (file) => {
      const formData = new FormData();
      formData.append('image', file);

      const res = await fetch('/api/upload/profile', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.url) {
        throw new Error(data?.error || 'Error al subir la imagen');
      }
      setProfilePhotoUrl(data.url);
      return data.url;
    };

    const handleSaveProfile = async () => {
      if (!currentUserId) return;

      const nextName = String(profileName || '').trim();
      const nextPhone = String(profilePhone || '').trim();
      const nextPhoto = String(profilePhotoUrl || '').trim();

      setProfileError('');
      setProfileSuccess('');

      if (!nextName) {
        setProfileError('El nombre es requerido.');
        return;
      }

      if (!String(profileCurrentPassword || '').trim()) {
        setProfileError('Debes ingresar tu contraseña actual para guardar.');
        return;
      }

      setProfileSaving(true);
      try {
        const updated = await api.users.updateProfile(currentUserId, {
          name: nextName,
          phone: nextPhone,
          photoUrl: nextPhoto || null,
          currentPassword: profileCurrentPassword,
        });

        dispatch({
          type: 'UPDATE_USER_STATE',
          payload: {
            id: currentUserId,
            name: updated?.name || nextName,
            nombre: updated?.name || nextName,
            phone: updated?.phone || nextPhone,
            telefono: updated?.phone || nextPhone,
            photoUrl: updated?.photo_url || updated?.photoUrl || nextPhoto,
            photo_url: updated?.photo_url || updated?.photoUrl || nextPhoto,
          },
        });

        setProfileCurrentPassword('');
        setProfileSuccess('Perfil actualizado.');
      } catch (e) {
        if (e?.status === 401) {
          setProfileError('Contraseña actual incorrecta.');
        } else {
          setProfileError(e?.message || 'Error al actualizar perfil.');
        }
      } finally {
        setProfileSaving(false);
      }
    };

    const handleChangePassword = async () => {
      if (!currentUserId) return;

      const cur = String(pwdCurrent || '').trim();
      const next = String(pwdNext || '').trim();
      const confirm = String(pwdConfirm || '').trim();

      if (!cur || !next) {
        dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Completa contraseña actual y nueva.', type: 'error' } });
        return;
      }

      if (next !== confirm) {
        dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Las contraseñas no coinciden.', type: 'error' } });
        return;
      }

      setPwdSaving(true);
      try {
        await api.users.changePassword(currentUserId, {
          currentPassword: cur,
          newPassword: next,
        });
        setPwdCurrent('');
        setPwdNext('');
        setPwdConfirm('');
        dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Contraseña actualizada.', type: 'success' } });
      } catch (e) {
        dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: e?.message || 'Error al cambiar contraseña.', type: 'error' } });
      } finally {
        setPwdSaving(false);
      }
    };

    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-slate-800">Mi Perfil</h1>
            <button
              type="button"
              className="px-4 py-2 rounded-lg shadow-md bg-white text-slate-700 hover:bg-slate-100"
              onClick={() => handleChangeView('shops')}
            >
              Volver
            </button>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-6 items-center">
              <div className="relative w-28 h-28">
                <img
                  src={photo}
                  alt="Foto de perfil"
                  className="w-28 h-28 rounded-full border-4 border-indigo-200 shadow-md object-cover"
                />
                <label className="absolute bottom-1 right-1 bg-white rounded-full p-2 shadow cursor-pointer hover:bg-indigo-50 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        await handleUploadProfilePhoto(file);
                        dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Imagen subida. No olvides guardar.', type: 'info' } });
                      } catch (err) {
                        dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: err?.message || 'Error al subir imagen.', type: 'error' } });
                      }
                    }}
                  />
                  <i className="fas fa-camera text-indigo-600"></i>
                </label>
              </div>

              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 text-sm font-semibold text-slate-700">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      await handleUploadProfilePhoto(file);
                      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: 'Imagen subida. No olvides guardar.', type: 'info' } });
                    } catch (err) {
                      dispatch({ type: 'SHOW_NOTIFICATION', payload: { message: err?.message || 'Error al subir imagen.', type: 'error' } });
                    }
                  }}
                />
                <i className="fas fa-upload"></i>
                <span>Subir foto</span>
              </label>

              <div className="flex-1 w-full">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nombre</label>
                    <input
                      type="text"
                      value={profileName}
                      onChange={(e) => setProfileName(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                    <input
                      type="tel"
                      value={profilePhone}
                      onChange={(e) => setProfilePhone(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña actual (para guardar cambios)</label>
                  <input
                    type="password"
                    value={profileCurrentPassword}
                    onChange={(e) => setProfileCurrentPassword(e.target.value)}
                    className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {profileError && (
                    <div className="mt-2 text-sm text-red-600">{profileError}</div>
                  )}
                  {!profileError && profileSuccess && (
                    <div className="mt-2 text-sm text-emerald-700">{profileSuccess}</div>
                  )}
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    disabled={profileSaving}
                    onClick={handleSaveProfile}
                    className="px-4 py-2 rounded-lg shadow-md bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                  >
                    Guardar Perfil
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-slate-800 mb-4">Cambiar Contraseña</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Contraseña actual</label>
                <input
                  type="password"
                  value={pwdCurrent}
                  onChange={(e) => setPwdCurrent(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nueva contraseña</label>
                <input
                  type="password"
                  value={pwdNext}
                  onChange={(e) => setPwdNext(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar nueva contraseña</label>
                <input
                  type="password"
                  value={pwdConfirm}
                  onChange={(e) => setPwdConfirm(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                disabled={pwdSaving}
                onClick={handleChangePassword}
                className="px-4 py-2 rounded-lg shadow-md bg-slate-900 hover:bg-slate-800 text-white disabled:opacity-60"
              >
                Cambiar Contraseña
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <button
        type="button"
        className="md:hidden fixed bottom-4 left-4 z-50 p-3 bg-slate-800 text-white rounded-full shadow-lg"
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
          className="fixed inset-0 z-30 bg-black bg-opacity-50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        ></div>
      )}

      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-40 w-72 bg-white shadow-xl p-4 transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="flex flex-col gap-3">
          <button
            className={`px-4 py-2 rounded-lg shadow-md flex items-center justify-start ${activeView === 'shops' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
            onClick={() => handleChangeView('shops')}
            type="button"
          >
            <i className="fas fa-store-alt mr-2"></i>
            Barberías
          </button>
          <button
            className={`px-4 py-2 rounded-lg shadow-md flex items-center justify-start ${activeView === 'appointments' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
            onClick={() => handleChangeView('appointments')}
            type="button"
          >
            <i className="fas fa-calendar-alt mr-2"></i>
            Mis Citas
          </button>
          <button
            className={`px-4 py-2 rounded-lg shadow-md flex items-center justify-start ${activeView === 'products' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
            onClick={() => handleChangeView('products')}
            type="button"
          >
            <i className="fas fa-shopping-bag mr-2"></i>
            Productos
          </button>
          <button
            className={`px-4 py-2 rounded-lg shadow-md flex items-center justify-start ${activeView === 'profile' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
            onClick={() => handleChangeView('profile')}
            type="button"
          >
            <i className="fas fa-user mr-2"></i>
            Mi Perfil
          </button>
          <button
            onClick={() => {
              setIsMobileMenuOpen(false);
              dispatch({ type: 'LOGOUT' });
            }}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md flex items-center justify-start"
            type="button"
          >
            <i className="fas fa-sign-out-alt mr-2"></i>
            Cerrar Sesión
          </button>
        </div>
      </aside>

      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Encuentra tu Barbería</h1>
          <div className="hidden md:flex flex-wrap gap-3">
            <button 
              className={`px-4 py-2 rounded-lg shadow-md flex items-center ${activeView === 'shops' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
              onClick={() => handleChangeView('shops')}
            >
              <i className="fas fa-store-alt mr-2"></i>
              Barberías
            </button>
            <button 
              className={`px-4 py-2 rounded-lg shadow-md flex items-center ${activeView === 'appointments' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
              onClick={() => handleChangeView('appointments')}
            >
              <i className="fas fa-calendar-alt mr-2"></i>
              Mis Citas
            </button>
            <button 
              className={`px-4 py-2 rounded-lg shadow-md flex items-center ${activeView === 'products' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
              onClick={() => handleChangeView('products')}
            >
              <i className="fas fa-shopping-bag mr-2"></i>
              Productos
            </button>
            <button 
              className={`px-4 py-2 rounded-lg shadow-md flex items-center ${activeView === 'profile' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}
              onClick={() => handleChangeView('profile')}
              type="button"
            >
              <i className="fas fa-user mr-2"></i>
              Mi Perfil
            </button>
            <button
              onClick={() => dispatch({ type: 'LOGOUT' })}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md flex items-center"
            >
              <i className="fas fa-sign-out-alt mr-2"></i>
              Cerrar Sesión
            </button>
          </div>
        </div>
        <div className="mb-8">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="p-2 border border-slate-300 rounded-md text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="Buscar Barbería"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(state.barberShops || []).filter(shop => {
            const term = (search || '').toLowerCase();
            const name = (shop.name || '').toLowerCase();
            const address = (shop.address || '').toLowerCase();
            const city = (shop.city || '').toLowerCase();
            return (
              name.includes(term) ||
              address.includes(term) ||
              city.includes(term)
            );
          }).map(shop => (
            <div key={shop.id} className="bg-white rounded-xl shadow-lg p-6 flex flex-col gap-4">
              <img
                src={state.barberShopPhotos?.[shop.id]?.[0] || 'https://placehold.co/400x200?text=Barbería'}
                alt={shop.name}
                className="rounded-lg object-cover w-full h-40 mb-2"
                style={{ minHeight: '160px', background: '#eee' }}
              />
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-slate-900 mb-1">{shop.name}</h2>
                <span className="inline-block bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-semibold mb-2">Abierto</span>
                <div className="flex items-center text-slate-600 text-sm mb-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenDirectionsToShop(shop);
                    }}
                    className="inline-flex items-center text-left hover:underline"
                    title="Abrir ruta en Google Maps"
                  >
                    <span className="inline-flex items-center mr-2 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mr-1 text-red-600" fill="currentColor" aria-hidden="true">
                        <path d="M12 2c3.87 0 7 3.13 7 7 0 5.25-7 13-7 13S5 14.25 5 9c0-3.87 3.13-7 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
                      </svg>
                      Google Maps
                    </span>
                    {shop.address}, {shop.city}
                  </button>
                </div>
                <div className="flex items-center text-slate-600 text-sm mb-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenWhatsAppToShop(shop);
                    }}
                    className="inline-flex items-center gap-2 hover:underline"
                    title="Abrir WhatsApp"
                  >
                    <svg viewBox="0 0 32 32" className="w-4 h-4 text-emerald-600" fill="currentColor" aria-hidden="true">
                      <path d="M19.11 17.45c-.2-.1-1.19-.59-1.38-.65-.18-.07-.32-.1-.46.1-.14.2-.53.65-.65.79-.12.14-.24.16-.44.06-.2-.1-.86-.32-1.64-1.02-.6-.54-1.01-1.2-1.13-1.4-.12-.2-.01-.31.09-.41.09-.09.2-.24.3-.36.1-.12.14-.2.2-.34.06-.14.03-.26-.02-.36-.05-.1-.46-1.11-.63-1.52-.17-.4-.35-.35-.46-.35h-.39c-.14 0-.36.05-.55.26-.2.2-.72.7-.72 1.7 0 1 .74 1.96.84 2.1.1.14 1.46 2.22 3.53 3.11.49.21.88.34 1.18.43.5.16.95.14 1.31.09.4-.06 1.19-.49 1.36-.96.17-.47.17-.87.12-.96-.05-.1-.18-.16-.38-.26z" />
                      <path d="M16 3C9.37 3 4 8.37 4 15c0 2.34.67 4.54 1.83 6.4L4 29l7.78-1.76C13.55 28.1 14.75 28.5 16 28.5c6.63 0 12-5.37 12-12S22.63 3 16 3zm0 22.5c-1.18 0-2.33-.29-3.36-.84l-.8-.42-4.62 1.05 1-4.5-.52-.83C6.89 18.5 6.5 16.77 6.5 15 6.5 9.76 10.76 5.5 16 5.5S25.5 9.76 25.5 15 21.24 25.5 16 25.5z" />
                    </svg>
                    <span>{shop.phone}</span>
                  </button>
                </div>
                {(() => {
                  const rating = Number(shop?.rating ?? 0) || 0;
                  const reviewCount = Number(shop?.reviewCount ?? shop?.review_count ?? 0) || 0;
                  const reviewsLabel = reviewCount === 1 ? '1 reseña' : `${reviewCount} reseñas`;
                  const eligibleCount = getEligibleAppointmentsForShop(shop.id).length;
                  return (
                    <div className="flex items-center justify-between gap-3 mb-1 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleOpenReviewsModal(shop)}
                        className="flex items-center gap-2 hover:underline"
                        title="Ver reseñas"
                      >
                        <span className="text-sm font-semibold text-slate-700">{formatAvgRatingEs(rating)}</span>
                        <RatingStars value={rating} idPrefix={`shop-${shop.id}`} sizeClass="w-4 h-4" />
                        <span className="text-xs text-slate-500">({reviewsLabel})</span>
                      </button>
                      {eligibleCount > 0 && (
                        <button
                          type="button"
                          onClick={() => handleOpenReviewsModal(shop, { openLeaveReview: true })}
                          className="text-xs font-semibold text-indigo-700 hover:underline"
                          title="Dejar tu reseña"
                        >
                          Dejar tu reseña
                        </button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <button
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg mt-2 shadow-sm text-sm"
                onClick={() => handleOpenModal(shop)}
              >
                Ver Detalles y Reservar
              </button>
            </div>
          ))}
        </div>
      </div>
      {/* Modal para detalles y reserva */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedShop ? `Barbería: ${selectedShop.name}` : ''} size="xl">
        {selectedShop && (
          <div className="space-y-6">
            {/* Galería de fotos */}
            <div className="flex gap-2 overflow-x-auto pb-2">
              {(selectedShop.photos || []).map((url, idx) => (
                <img key={idx} src={url} alt="Foto barbería" className="h-32 w-48 object-cover rounded shadow" />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-lg font-bold text-indigo-700 mb-2">Información</h3>
                <p>
                  <span className="font-semibold">Dirección:</span>{' '}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenDirectionsToShop(selectedShop);
                    }}
                    className="inline-flex items-center text-indigo-700 hover:underline"
                    title="Abrir ruta en Google Maps"
                  >
                    <span className="inline-flex items-center mr-2 px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 mr-1 text-red-600" fill="currentColor" aria-hidden="true">
                        <path d="M12 2c3.87 0 7 3.13 7 7 0 5.25-7 13-7 13S5 14.25 5 9c0-3.87 3.13-7 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
                      </svg>
                      Google Maps
                    </span>
                    {selectedShop.address}
                  </button>
                </p>
                <p><span className="font-semibold">Ciudad:</span> {selectedShop.city}</p>
                <p className="flex items-center">
                  <span className="font-semibold">Teléfono:</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOpenWhatsAppToShop(selectedShop);
                    }}
                    className="inline-flex items-center gap-2 ml-2 hover:underline"
                    title="Abrir WhatsApp"
                  >
                    <svg viewBox="0 0 32 32" className="w-4 h-4 text-emerald-600" fill="currentColor" aria-hidden="true">
                      <path d="M19.11 17.45c-.2-.1-1.19-.59-1.38-.65-.18-.07-.32-.1-.46.1-.14.2-.53.65-.65.79-.12.14-.24.16-.44.06-.2-.1-.86-.32-1.64-1.02-.6-.54-1.01-1.2-1.13-1.4-.12-.2-.01-.31.09-.41.09-.09.2-.24.3-.36.1-.12.14-.2.2-.34.06-.14.03-.26-.02-.36-.05-.1-.46-1.11-.63-1.52-.17-.4-.35-.35-.46-.35h-.39c-.14 0-.36.05-.55.26-.2.2-.72.7-.72 1.7 0 1 .74 1.96.84 2.1.1.14 1.46 2.22 3.53 3.11.49.21.88.34 1.18.43.5.16.95.14 1.31.09.4-.06 1.19-.49 1.36-.96.17-.47.17-.87.12-.96-.05-.1-.18-.16-.38-.26z" />
                      <path d="M16 3C9.37 3 4 8.37 4 15c0 2.34.67 4.54 1.83 6.4L4 29l7.78-1.76C13.55 28.1 14.75 28.5 16 28.5c6.63 0 12-5.37 12-12S22.63 3 16 3zm0 22.5c-1.18 0-2.33-.29-3.36-.84l-.8-.42-4.62 1.05 1-4.5-.52-.83C6.89 18.5 6.5 16.77 6.5 15 6.5 9.76 10.76 5.5 16 5.5S25.5 9.76 25.5 15 21.24 25.5 16 25.5z" />
                    </svg>
                    <span>{selectedShop.phone}</span>
                  </button>
                </p>
              </div>
              <div>
                <h3 className="text-lg font-bold text-indigo-700 mb-2">Servicios Disponibles</h3>
                <ul className="space-y-1">
                  {getServicesInShop(selectedShop).map(svc => (
                    <li key={svc.id} className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="service"
                        checked={selectedService?.id === svc.id}
                        onChange={() => setSelectedService(svc)}
                        className="accent-indigo-600"
                      />
                      <span>{svc.name} <span className="text-xs text-slate-500">({svc.baseDurationMinutes} min, RD${svc.basePrice})</span></span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              {(() => {
                const rating = Number(selectedShop?.rating ?? 0) || 0;
                const reviewCount = Number(selectedShop?.reviewCount ?? selectedShop?.review_count ?? 0) || 0;
                const reviewsLabel = reviewCount === 1 ? '1 reseña' : `${reviewCount} reseñas`;
                const eligibleCount = getEligibleAppointmentsForShop(selectedShop?.id).length;
                return (
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Reseñas</div>
                      <button
                        type="button"
                        onClick={() => handleOpenReviewsModal(selectedShop)}
                        className="flex items-center gap-2 mt-1 hover:underline"
                        title="Ver reseñas"
                      >
                        <span className="text-sm font-semibold text-slate-700">{formatAvgRatingEs(rating)}</span>
                        <RatingStars value={rating} idPrefix={`shop-modal-${selectedShop?.id ?? 'x'}`} sizeClass="w-4 h-4" />
                        <span className="text-xs text-slate-500">({reviewsLabel})</span>
                        <span className="text-xs text-indigo-700 font-semibold">Ver reseñas</span>
                      </button>
                    </div>
                    {eligibleCount > 0 && (
                      <button
                        type="button"
                        onClick={() => handleOpenReviewsModal(selectedShop, { openLeaveReview: true })}
                        className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                      >
                        Dejar tu reseña
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>

            <div>
              <h3 className="text-lg font-bold text-indigo-700 mb-2">Selecciona Barbero</h3>
              {barbersForCurrentSelection.length === 0 ? (
                <p className="text-sm text-slate-500">No hay barberos asignados para esta barbería/servicio.</p>
              ) : (
                <ul className="flex flex-wrap gap-3">
                  {barbersForCurrentSelection.map(barb => (
                    <li key={barb.id}>
                      <div className="flex flex-col items-stretch gap-2">
                        <button
                          type="button"
                          className={`flex flex-col items-center px-4 py-2 rounded-lg border transition ${selectedBarber?.id === barb.id ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
                          onClick={() => setSelectedBarber(barb)}
                        >
                          <img src={barb.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(barb.name)} alt={barb.name} className="w-12 h-12 rounded-full mb-1 border shadow" />
                          <span className="text-sm font-medium">{barb.name}</span>
                        </button>
                        <button
                          type="button"
                          className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleOpenChatOptionsForBarber(barb);
                          }}
                        >
                          Chatear
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {selectedBarber && (
              <div>
                <h3 className="text-lg font-bold text-indigo-700 mb-2 mt-4">Servicios del barbero seleccionado</h3>
                {getServicesForBarberInShop(selectedShop, selectedBarber).length === 0 ? (
                  <p className="text-sm text-slate-500">Este barbero aún no tiene servicios asignados.</p>
                ) : (
                  <ul className="space-y-1">
                    {getServicesForBarberInShop(selectedShop, selectedBarber).map(svc => (
                      <li key={svc.id} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="service-by-barber"
                          checked={selectedService?.id === svc.id}
                          onChange={() => setSelectedService(svc)}
                          className="accent-indigo-600"
                        />
                        <span>
                          {svc.name}{' '}
                          <span className="text-xs text-slate-500">({svc.baseDurationMinutes} min, RD${svc.basePrice})</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Fecha</label>
                <input
                  type="date"
                  className="w-full border border-slate-300 rounded-md p-2"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
                {selectedDayOffInfo && (
                  <p className="mt-1 text-xs text-red-600">
                    Este barbero ha marcado este día como libre
                    {selectedDayOffInfo.notes ? `: ${selectedDayOffInfo.notes}` : '.'}
                  </p>
                )}
                {selectedLeaveEarlyInfo && !selectedDayOffInfo && (
                  <p className="mt-1 text-xs text-amber-700">
                    Este barbero se retira temprano hoy (hasta {formatTimeTo12h(selectedLeaveEarlyInfo.cutoffTime)})
                    {selectedLeaveEarlyInfo.notes ? `: ${selectedLeaveEarlyInfo.notes}` : '.'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Hora</label>
                <select
                  className="w-full border border-slate-300 rounded-md p-2"
                  value={selectedTime}
                  onChange={e => setSelectedTime(e.target.value)}
                >
                  <option value="">Selecciona una hora</option>
                  {filteredAvailableTimes.map(time => (
                    <option key={time} value={time}>{formatTimeTo12h(time)}</option>
                  ))}
                </select>
                {selectedBarber && selectedDate && filteredAvailableTimes.length === 0 && !selectedDayOffInfo && (
                  <p className="mt-1 text-xs text-slate-500">
                    No hay horarios disponibles para este barbero en esta fecha (puede que ya haya pasado su horario de trabajo o no tenga horario configurado).
                  </p>
                )}
                {selectedBarber && selectedDate && filteredAvailableTimes.length === 0 && selectedDayOffInfo && (
                  <p className="mt-1 text-xs text-red-600">
                    Este barbero se ha tomado el día libre para esta fecha
                    {selectedDayOffInfo.notes ? `: ${selectedDayOffInfo.notes}` : '.'}
                  </p>
                )}
              </div>
              <div className="flex items-end">
                <button
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg shadow text-base disabled:opacity-60"
                  onClick={handleBookAppointment}
                  disabled={
                    bookingLoading ||
                    !selectedService ||
                    !selectedDate ||
                    !selectedTime ||
                    barbersForCurrentSelection.length === 0 ||
                    // Si hay más de un barbero para este servicio, obligar a seleccionar uno
                    (barbersForCurrentSelection.length > 1 && !selectedBarber)
                  }
                >
                  {bookingLoading ? 'Reservando...' : 'Reservar Cita'}
                </button>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-indigo-700 mb-2 mt-6">Productos Disponibles</h3>
              <div className="flex gap-4 overflow-x-auto">
                {productsForSelectedShop.length > 0 ? (
                  productsForSelectedShop.map(prod => (
                    <div key={prod.id} className="bg-slate-50 border rounded-lg p-4 min-w-[180px] flex flex-col items-center">
                      <img src={prod.photoUrl || 'https://placehold.co/120x120?text=Producto'} alt={prod.name} className="w-20 h-20 object-cover rounded mb-2" />
                      <span className="font-semibold text-slate-800 text-sm mb-1">{prod.name}</span>
                      {productHasDiscount(prod) ? (
                        <div className="text-xs text-slate-500 mb-1 flex flex-col items-center">
                          <span className="text-[10px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded mb-1">Oferta: {getProductOfferPercent(prod)}%</span>
                          <span>
                            <span className="line-through mr-1">RD${(Number(prod.price) || 0).toFixed(2)}</span>
                            <span className="text-indigo-700 font-semibold">RD${(Number(getProductEffectivePrice(prod)) || 0).toFixed(2)}</span>
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500 mb-1">RD${(Number(prod.price) || 0).toFixed(2)}</span>
                      )}
                      <button
                        className="mt-2 px-3 py-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow"
                        onClick={() => handleOpenProductModal(prod)}
                      >
                        Comprar
                      </button>
                    </div>
                  ))
                ) : (
                  <span className="text-slate-500">No hay productos registrados.</span>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
      {/* Modal de compra de producto */}
      <Modal
        isOpen={showProductModal}
        onClose={handleCloseProductModal}
        title={selectedProduct ? `Comprar: ${selectedProduct.name}` : 'Comprar producto'}
        size="md"
      >
        {selectedProduct && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <img
                src={selectedProduct.photoUrl || 'https://placehold.co/100x100?text=Producto'}
                alt={selectedProduct.name}
                className="w-20 h-20 object-cover rounded border"
              />
              <div>
                <div className="font-semibold text-slate-800 text-sm">{selectedProduct.name}</div>
                <div className="text-xs text-slate-500">Barbería: {resolvedPurchaseShop?.name}</div>
                {productHasDiscount(selectedProduct) ? (
                  <div className="text-sm mt-1">
                    <div className="text-[10px] font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded inline-block mb-1">Oferta: {getProductOfferPercent(selectedProduct)}%</div>
                    <div>
                      <span className="text-slate-400 line-through mr-2">RD${(Number(selectedProduct.price) || 0).toFixed(2)}</span>
                      <span className="text-indigo-700 font-bold">RD${(Number(getProductEffectivePrice(selectedProduct)) || 0).toFixed(2)}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-indigo-700 font-bold mt-1">RD${(Number(selectedProduct.price) || 0).toFixed(2)}</div>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-slate-800 mb-2">Método de entrega</h4>
              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="purchaseMethod"
                    value="pickup"
                    checked={purchaseMethod === 'pickup'}
                    onChange={() => setPurchaseMethod('pickup')}
                    className="accent-indigo-600"
                  />
                  <span>Retirar en la barbería</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="purchaseMethod"
                    value="delivery"
                    checked={purchaseMethod === 'delivery'}
                    onChange={() => setPurchaseMethod('delivery')}
                    className="accent-indigo-600"
                  />
                  <span>Envío a domicilio (pendiente configurar envíos de la barbería)</span>
                </label>
              </div>
            </div>
            {purchaseMethod === 'delivery' && (
              <div className="space-y-3 text-sm">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dirección de entrega</label>
                  <textarea
                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                    rows={2}
                    value={purchaseAddress}
                    onChange={e => setPurchaseAddress(e.target.value)}
                    placeholder="Calle, número, sector, ciudad"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Teléfono de contacto</label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded-md p-2 text-sm"
                    value={purchasePhone}
                    onChange={e => setPurchasePhone(e.target.value)}
                    placeholder="809-000-0000"
                  />
                </div>
              </div>
            )}
            {(selectedProduct?.barberId == null && selectedProduct?.barber_id == null) ? (
              <div>
                <h4 className="text-sm font-semibold text-slate-800 mb-2">Selecciona Barbero</h4>
                {getBarbersInShop(resolvedPurchaseShop).length === 0 ? (
                  <p className="text-sm text-slate-500">No hay barberos disponibles para esta barbería.</p>
                ) : (
                  <ul className="flex flex-wrap gap-3">
                    {getBarbersInShop(resolvedPurchaseShop).map(barb => (
                      <li key={barb.id}>
                        <button
                          type="button"
                          className={`flex flex-col items-center px-4 py-2 rounded-lg border transition ${String(purchaseBarberId) === String(barb.id) ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
                          onClick={() => setPurchaseBarberId(barb.id)}
                          disabled={purchaseLoading}
                        >
                          <img src={barb.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(barb.name)} alt={barb.name} className="w-10 h-10 rounded-full mb-1 border shadow" />
                          <span className="text-sm font-medium">{barb.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {purchaseBarberId == null && (
                  <p className="text-xs text-red-600 mt-2">Debes elegir un barbero para poder confirmar el pedido.</p>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-600">
                Este pedido se enviará al barbero asignado a este producto.
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Notas para la barbería (opcional)</label>
              <textarea
                className="w-full border border-slate-300 rounded-md p-2 text-sm"
                rows={2}
                value={purchaseNotes}
                onChange={e => setPurchaseNotes(e.target.value)}
                placeholder="Ej: Prefiero recogerlo después de mi cita"
              />
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button
                className="px-4 py-2 text-sm rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700"
                onClick={handleCloseProductModal}
                disabled={purchaseLoading}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                onClick={handleConfirmPurchase}
                disabled={purchaseLoading || ((selectedProduct?.barberId == null && selectedProduct?.barber_id == null) && purchaseBarberId == null)}
              >
                {purchaseLoading ? 'Procesando...' : 'Confirmar compra'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showReviewsModal}
        onClose={handleCloseReviewsModal}
        title={reviewsShop ? `Reseñas · ${reviewsShop.name}` : 'Reseñas'}
        size="lg"
      >
        {reviewsShop && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {(() => {
                const rating = Number(reviewsShop?.rating ?? 0) || 0;
                const reviewCount = Number(reviewsShop?.reviewCount ?? reviewsShop?.review_count ?? 0) || 0;
                const reviewsLabel = reviewCount === 1 ? '1 reseña' : `${reviewCount} reseñas`;
                const eligible = getEligibleAppointmentsForShop(reviewsShop?.id);
                return (
                  <>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-700">{formatAvgRatingEs(rating)}</span>
                        <RatingStars value={rating} idPrefix={`reviews-modal-${reviewsShop?.id ?? 'x'}`} sizeClass="w-4 h-4" />
                        <span className="text-xs text-slate-500">({reviewsLabel})</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Aquí puedes ver todas las reseñas de esta barbería.
                      </div>
                    </div>
                    {eligible.length > 0 && !reviewsModalShowLeaveReview && (
                      <button
                        type="button"
                        onClick={() => setReviewsModalShowLeaveReview(true)}
                        className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold"
                      >
                        Dejar tu reseña
                      </button>
                    )}
                  </>
                );
              })()}
            </div>

            <div>
              {shopReviewsLoading ? (
                <div className="text-sm text-slate-500">Cargando reseñas...</div>
              ) : shopReviews.length === 0 ? (
                <div className="text-sm text-slate-500">Aún no hay reseñas.</div>
              ) : (
                <div className="space-y-3">
                  {shopReviews.map((r) => {
                    const name = r?.user_name || 'Cliente';
                    const avatar =
                      r?.user_photo_url ||
                      r?.photo_url ||
                      'https://ui-avatars.com/api/?name=' +
                        encodeURIComponent(name) +
                        '&background=0f172a&color=fff&size=128';
                    const createdAt = r?.created_at ? new Date(r.created_at) : null;
                    const dateText =
                      createdAt && !Number.isNaN(createdAt.getTime())
                        ? createdAt.toLocaleDateString('es-DO', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          })
                        : '';
                    const rr = Number(r?.rating ?? 0) || 0;
                    return (
                      <div
                        key={r?.id ?? `${r?.user_id}-${r?.created_at}`}
                        className="bg-white border border-slate-200 rounded-lg p-3"
                      >
                        <div className="flex items-start gap-3">
                          <img
                            src={avatar}
                            alt={name}
                            className="w-9 h-9 rounded-full object-cover border"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="text-sm font-semibold text-slate-800">{name}</div>
                              <div className="text-[11px] text-slate-500">{dateText}</div>
                            </div>
                            <div className="flex items-center gap-1 text-yellow-400 text-xs mt-1">
                              {Array.from({ length: 5 }).map((_, idx) => {
                                const v = idx + 1;
                                const full = rr >= v;
                                const icon = full ? 'fa-star' : 'fa-star';
                                const cls = full ? 'fa-solid' : 'fa-regular';
                                return <i key={idx} className={`${cls} ${icon}`}></i>;
                              })}
                            </div>
                            {r?.comment && (
                              <div className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">
                                {r.comment}
                              </div>
                            )}
                            {r?.photo_url && (
                              <div className="mt-2">
                                <img
                                  src={r.photo_url}
                                  alt="Foto reseña"
                                  className="w-full max-w-sm rounded-lg border object-cover"
                                />
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {(() => {
              const userId = state?.currentUser?.id;
              const shopId = reviewsShop?.id;
              const eligible = getEligibleAppointmentsForShop(shopId);

              if (!reviewsModalShowLeaveReview) return null;

              if (eligible.length === 0) {
                return (
                  <div className="text-xs text-slate-500">
                    Para dejar una reseña necesitas tener una cita completada en esta barbería.
                  </div>
                );
              }

              const submit = async () => {
                if (!userId || !shopId) return;
                const apptId = Number(reviewAppointmentId || eligible[0]?.id);
                if (!Number.isFinite(apptId)) {
                  dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: { message: 'Selecciona una cita válida para reseñar.', type: 'error' },
                  });
                  return;
                }

                setReviewSubmitting(true);
                try {
                  const resp = await api.barberShops.addReview(shopId, {
                    userId,
                    appointmentId: apptId,
                    rating: reviewRating,
                    comment: reviewComment,
                    photoUrl: state?.currentUser?.photoUrl || state?.currentUser?.photo_url || null,
                  });

                  const nextRating = Number(resp?.rating ?? reviewsShop?.rating ?? 0) || 0;
                  const nextCount = Number(resp?.reviewCount ?? reviewsShop?.reviewCount ?? reviewsShop?.review_count ?? 0) || 0;

                  dispatch({
                    type: 'UPDATE_BARBERSHOP_STATE',
                    payload: { id: shopId, rating: nextRating, reviewCount: nextCount, review_count: nextCount },
                  });

                  setReviewsShop((prev) =>
                    prev ? { ...prev, rating: nextRating, reviewCount: nextCount, review_count: nextCount } : prev
                  );
                  setSelectedShop((prev) =>
                    prev && String(prev?.id) === String(shopId)
                      ? { ...prev, rating: nextRating, reviewCount: nextCount, review_count: nextCount }
                      : prev
                  );

                  const appts = Array.isArray(state.appointments) ? state.appointments : [];
                  const existingAppt = appts.find((a) => String(a?.id) === String(apptId)) || null;
                  dispatch({
                    type: 'UPDATE_APPOINTMENT',
                    payload: {
                      ...(existingAppt || { id: apptId }),
                      id: apptId,
                      clientReviewed: true,
                      client_reviewed: true,
                    },
                  });

                  setReviewComment('');
                  setReviewAppointmentId('');
                  setReviewsModalShowLeaveReview(false);

                  dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: { message: 'Reseña enviada.', type: 'success' },
                  });

                  setShopReviewsLoading(true);
                  try {
                    const refreshed = await api.barberShops.getReviews(shopId);
                    setShopReviews(Array.isArray(refreshed) ? refreshed : []);
                  } finally {
                    setShopReviewsLoading(false);
                  }
                } catch (e) {
                  dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: { message: e?.message || 'Error al enviar reseña.', type: 'error' },
                  });
                } finally {
                  setReviewSubmitting(false);
                }
              };

              return (
                <div className="border-t border-slate-200 pt-4">
                  <div className="text-sm font-semibold text-slate-800 mb-2">Dejar una reseña</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Cita</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={reviewAppointmentId}
                        onChange={(e) => setReviewAppointmentId(e.target.value)}
                      >
                        <option value="">Selecciona una cita</option>
                        {eligible.map((a) => (
                          <option key={a.id} value={a.id}>
                            #{a.id} ·
                            {(() => {
                              const dt = a.startTime ? new Date(a.startTime) : null;
                              if (!dt || Number.isNaN(dt.getTime())) return ' Fecha';
                              return ` ${dt.toLocaleDateString('es-DO', { year: 'numeric', month: '2-digit', day: '2-digit' })}`;
                            })()}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Rating</label>
                      <select
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        value={reviewRating}
                        onChange={(e) => setReviewRating(Number(e.target.value))}
                      >
                        {[5, 4, 3, 2, 1].map((v) => (
                          <option key={v} value={v}>
                            {v} estrellas
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Comentario (opcional)</label>
                    <textarea
                      className="w-full border border-slate-300 rounded-md p-2 text-sm"
                      rows={3}
                      value={reviewComment}
                      onChange={(e) => setReviewComment(e.target.value)}
                      placeholder="Cuéntanos tu experiencia"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
                    <button
                      type="button"
                      disabled={reviewSubmitting}
                      onClick={submit}
                      className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold disabled:opacity-60"
                    >
                      {reviewSubmitting ? 'Enviando...' : 'Enviar reseña'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewsModalShowLeaveReview(false)}
                      className="px-4 py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-sm font-semibold"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ClientDashboard;
