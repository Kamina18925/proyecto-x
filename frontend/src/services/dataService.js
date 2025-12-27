// Importar los servicios de API
import api from './apiService';

// Funciones para mantener compatibilidad con el código existente
// pero ahora usan la API en lugar de localStorage

// Esta función ya no guarda directamente en localStorage, sino que se usa como puente
// para realizar operaciones en la base de datos cuando se hace dispatch de acciones
export const saveStateToLocalStorage = (state) => {
  // No hacemos nada aquí porque las operaciones individuales 
  // ya se realizan a través de la API en las acciones específicas
  console.log('Estado actualizado en memoria');
  return true;
};

// Función para cargar el estado inicial desde el backend
export const loadStateFromLocalStorage = () => {
  // Esta función no debería llamarse directamente, ya que ahora 
  // los datos se cargan asíncronamente desde la API
  console.warn('loadStateFromLocalStorage está obsoleto, usar loadInitialState');
  return undefined;
};

// Nueva función para cargar el estado inicial desde la API
export const loadInitialState = async () => {
  try {
    // Cargar datos de todas las entidades en paralelo
    const [
      usersResponse, 
      barberShopsResponse, 
      servicesResponse, 
      appointmentsResponse, 
      productsResponse,
      barberServicesResponse,
      barberAvailabilityResponse,
      barberBreaksResponse,
    ] = await Promise.all([
      api.users.getAll(),
      api.barberShops.getAll(),
      api.services.getAll(),
      api.appointments.getAll(),
      api.products.getAll(),
      api.barberServices.getAll(),
      api.barberAvailability.getAll(),
      api.barberBreaks.getAll(),
    ]);

    // Normalizar usuarios al formato esperado por el frontend
    const users = (usersResponse || []).map(u => ({
      ...u,
      // Asegurar name/phone consistentes
      name: u.name || u.nombre,
      telefono: u.telefono || u.phone,
      phone: u.phone || u.telefono,
      whatsappLink: u.whatsappLink !== undefined
        ? u.whatsappLink
        : (u.whatsapp_link !== undefined ? u.whatsapp_link : ''),
      // Permiso para borrar historial
      canDeleteHistory: u.canDeleteHistory !== undefined
        ? u.canDeleteHistory
        : (u.can_delete_history !== undefined ? u.can_delete_history : false),
      // Foto de usuario/barbero
      photoUrl: u.photoUrl || u.photo_url || '',
      // Mapear shop_id de BD a shopId usado en el estado
      shopId: u.shopId !== undefined ? u.shopId : (u.shop_id !== undefined ? u.shop_id : null),
    }));

    // Normalizar barberías al formato esperado por el frontend
    const barberShops = (barberShopsResponse || []).map(bs => {
      const schedule = bs.schedule || {};
      return {
        ...bs,
        // ownerId en camelCase
        ownerId: bs.ownerId !== undefined ? bs.ownerId : (bs.owner_id !== undefined ? bs.owner_id : null),
        // Datos derivados de schedule JSONB
        city: bs.city || schedule.city || '',
        sector: bs.sector || schedule.sector || '',
        phone: bs.phone || schedule.phone || '',
        whatsappLink: bs.whatsappLink || schedule.whatsappLink || '',
        openHours: bs.openHours || schedule.openHours || '',
        description: bs.description || schedule.description || '',
        email: bs.email || schedule.email || '',
        photoUrl: bs.photoUrl || schedule.photoUrl || '',
        rating: bs.rating != null ? Number(bs.rating) : 0,
        reviewCount: bs.reviewCount !== undefined
          ? bs.reviewCount
          : (bs.review_count !== undefined ? bs.review_count : 0),
        latitude: bs.latitude !== undefined ? bs.latitude : (schedule.latitude !== undefined ? schedule.latitude : (schedule.lat !== undefined ? schedule.lat : '')),
        longitude: bs.longitude !== undefined ? bs.longitude : (schedule.longitude !== undefined ? schedule.longitude : (schedule.lng !== undefined ? schedule.lng : '')),
      };
    });
    
    // Construir mapa inicial de fotos de barberías a partir de photoUrl
    const barberShopPhotos = {};
    barberShops.forEach(shop => {
      if (shop.photoUrl) {
        barberShopPhotos[shop.id] = [shop.photoUrl];
      }
    });
    
    // Normalizar productos al formato esperado por el frontend
    const normalizedProducts = (productsResponse || []).map(p => ({
      ...p,
      // Mapear BD -> estado
      shopId: p.shopId !== undefined ? p.shopId : (p.shop_id !== undefined ? p.shop_id : null),
      barberId: p.barberId !== undefined ? p.barberId : (p.barber_id !== undefined ? p.barber_id : null),
      photoUrl: p.photoUrl || p.image_url || p.imageUrl || '',
      offer: p.offer !== undefined ? p.offer : (p.discount_price !== undefined ? p.discount_price : null),
    }));

    // Eliminar productos duplicados por id (si la API devuelve más de uno con el mismo id)
    const productsMap = new Map();
    normalizedProducts.forEach(prod => {
      if (prod && prod.id != null && !productsMap.has(prod.id)) {
        productsMap.set(prod.id, prod);
      }
    });
    const products = Array.from(productsMap.values());

    // Normalizar servicios al formato esperado por el frontend (para área de cliente)
    const services = (servicesResponse || []).map(s => ({
      ...s,
      shopId: s.shopId !== undefined ? s.shopId : (s.shop_id !== undefined ? s.shop_id : null),
      basePrice: s.basePrice !== undefined ? s.basePrice : (s.price !== undefined ? s.price : 0),
      baseDurationMinutes: s.baseDurationMinutes !== undefined ? s.baseDurationMinutes : (s.duration !== undefined ? s.duration : 0),
    }));

    // Normalizar citas al formato esperado por el frontend
    const appointments = (appointmentsResponse || []).map(a => ({
      id: a.id,
      clientId: a.clientId !== undefined ? a.clientId : (a.client_id !== undefined ? a.client_id : null),
      barberId: a.barberId !== undefined ? a.barberId : (a.barber_id !== undefined ? a.barber_id : null),
      shopId: a.shopId !== undefined ? a.shopId : (a.shop_id !== undefined ? a.shop_id : null),
      serviceId: a.serviceId !== undefined ? a.serviceId : (a.service_id !== undefined ? a.service_id : null),
      startTime: a.startTime || a.date || null,
      status: a.status || 'confirmed',
      notes: a.notes || null,
      notesBarber: a.notesBarber || a.notes_barber || null,
      clientReviewed: a.clientReviewed !== undefined ? a.clientReviewed : (a.client_reviewed !== undefined ? a.client_reviewed : false),
      actualEndTime: a.actualEndTime || a.actual_end_time || null,
      paymentMethod: a.paymentMethod || a.payment_method || null,
      paymentStatus: a.paymentStatus || a.payment_status || null,
      paymentMarkedAt: a.paymentMarkedAt || a.payment_marked_at || null,
      paymentMarkedBy: a.paymentMarkedBy || a.payment_marked_by || null,
      // Campos adicionales opcionales
      priceAtBooking: a.priceAtBooking || a.price_at_booking || null,
      clientPhoneNumberAtBooking: a.clientPhoneNumberAtBooking || a.client_phone_number_at_booking || null,
      hiddenForClient: a.hiddenForClient !== undefined ? a.hiddenForClient : (a.hidden_for_client !== undefined ? a.hidden_for_client : false),
    }));

    // Construir mapa barberServices: { barberId: [serviceId, ...] }
    const barberServices = {};
    (barberServicesResponse || []).forEach(row => {
      const barberId = row.barber_id ?? row.barberId;
      const serviceId = row.service_id ?? row.serviceId;
      if (barberId == null || serviceId == null) return;
      if (!barberServices[barberId]) barberServices[barberId] = [];
      if (!barberServices[barberId].includes(serviceId)) {
        barberServices[barberId].push(serviceId);
      }
    });

    // Construir mapa de disponibilidad de barberos: { barberId: [ { day, startTime, endTime }, ... ] }
    const barberAvailability = {};
    (barberAvailabilityResponse || []).forEach(row => {
      const barberId = row.barber_id ?? row.barberId;
      const availability = row.availability || [];
      if (barberId == null) return;
      barberAvailability[barberId] = availability;
    });

    const barberBreaks = {};
    (barberBreaksResponse || []).forEach(row => {
      const barberId = row.barber_id ?? row.barberId;
      const breaks = row.breaks || row.breakItems || [];
      if (barberId == null) return;
      barberBreaks[barberId] = Array.isArray(breaks) ? breaks : [];
    });

    // Construir y retornar el estado completo
    return {
      users,
      barberShops,
      barberShopPhotos,
      services,
      appointments,
      products,
      barberServices,
      barberAvailability,
      barberBreaks,
    };
  } catch (error) {
    console.error('Error al cargar el estado inicial:', error);
    return undefined;
  }
};

// Conversaciones para dueño (supervisión)
export const loadOwnerConversations = async (ownerId) => {
  try {
    if (ownerId == null) return [];
    const res = await api.chat.getOwnerConversations(ownerId);
    return Array.isArray(res) ? res : [];
  } catch (error) {
    console.error('Error al cargar conversaciones del dueño:', error);
    return [];
  }
};

// Marcar una cita como completada
export const completeAppointment = async (appointmentId) => {
  try {
    return await api.appointments.complete(appointmentId);
  } catch (error) {
    console.error('Error al completar cita:', error);
    throw error;
  }
};

// =====================
// Helpers de Chat Interno
// =====================

// Obtener o crear conversación cliente-barbero asociada a una cita
export const getOrCreateConversationForAppointment = async (appointmentId) => {
  if (appointmentId == null) return null;
  try {
    const res = await api.chat.getConversationByAppointment(appointmentId);
    return res?.conversationId ?? null;
  } catch (error) {
    console.error('Error al obtener/crear conversación para cita:', error);
    return null;
  }
};

export const getOrCreateDirectConversation = async (clientId, barberId) => {
  if (clientId == null || barberId == null) return null;
  try {
    const res = await api.chat.getOrCreateDirectConversation(clientId, barberId);
    return res?.conversationId ?? null;
  } catch (error) {
    console.error('Error al obtener/crear conversación directa:', error);
    return null;
  }
};

export const loadUserConversations = async (userId) => {
  if (userId == null) return [];
  try {
    const res = await api.chat.getUserConversations(userId);
    return Array.isArray(res) ? res : [];
  } catch (error) {
    console.error('Error al cargar conversaciones del usuario:', error);
    return [];
  }
};

export const archiveConversation = async (conversationId, userId) => {
  if (conversationId == null || userId == null) return { archived: false };
  try {
    return await api.chat.archiveConversation(conversationId, userId);
  } catch (error) {
    console.error('Error al archivar conversación:', error);
    throw error;
  }
};

// Cargar mensajes de una conversación
export const loadMessagesForConversation = async (conversationId) => {
  if (conversationId == null) return [];
  try {
    const res = await api.chat.getMessages(conversationId);
    return Array.isArray(res) ? res : [];
  } catch (error) {
    console.error('Error al cargar mensajes de chat:', error);
    return [];
  }
};

// Marcar mensajes como leídos para un usuario en una conversación
export const markChatMessagesAsRead = async (conversationId, userId) => {
  try {
    if (conversationId == null || userId == null) return { updatedCount: 0 };
    return await api.chat.markAsRead(conversationId, userId);
  } catch (error) {
    console.error('Error al marcar mensajes como leídos:', error);
    return { updatedCount: 0 };
  }
};

// Enviar mensaje de chat
export const sendChatMessage = async ({
  conversationId,
  senderId,
  receiverId,
  text,
  isSystem = false,
  relatedAction = null,
  relatedId = null,
}) => {
  try {
    if (!conversationId || !senderId || !receiverId || !text) {
      throw new Error('Faltan datos para enviar mensaje de chat');
    }
    return await api.chat.sendMessage({
      conversationId,
      senderId,
      receiverId,
      text,
      isSystem,
      relatedAction,
      relatedId,
    });
  } catch (error) {
    console.error('Error al enviar mensaje de chat:', error);
    throw error;
  }
};

// Marcar una cita como no_show
export const markNoShowAppointment = async (appointmentId) => {
  try {
    return await api.appointments.noShow(appointmentId);
  } catch (error) {
    console.error('Error al marcar cita como no_show:', error);
    throw error;
  }
};

// Proponer adelanto de cita (usa el endpoint de chat/notificación)
export const proposeAdvanceAppointment = async (appointmentId, newTime) => {
  try {
    return await api.appointments.proposeAdvance(appointmentId, { newTime });
  } catch (error) {
    console.error('Error al proponer adelanto de cita:', error);
    throw error;
  }
};

// Cargar notificaciones de un usuario
export const loadNotificationsForUser = async (userId) => {
  try {
    if (userId == null) return [];
    const res = await api.notifications.getByUser(userId);
    return Array.isArray(res) ? res : [];
  } catch (error) {
    console.error('Error al cargar notificaciones:', error);
    return [];
  }
};

// Limpiar historial de notificaciones para el cliente (soft delete)
export const clearNotificationHistoryForUser = async (userId) => {
  try {
    if (userId == null) return { success: true, affected: 0 };
    return await api.notifications.clearHistory(userId);
  } catch (error) {
    console.error('Error al limpiar historial de notificaciones:', error);
    throw error;
  }
};

// Limpiar historial de notificaciones
export const clearNotificationHistory = async (userId) => {
  try {
    if (userId == null) return { success: true, affected: 0 };
    return await api.notifications.clearHistory(userId);
  } catch (error) {
    console.error('Error al limpiar historial de notificaciones:', error);
    throw error;
  }
};

// Responder a una notificación (aceptar / rechazar)
export const respondToNotification = async (notificationId, accepted) => {
  try {
    return await api.notifications.respond(notificationId, accepted);
  } catch (error) {
    console.error('Error al responder notificación:', error);
    throw error;
  }
};

// Funciones para autenticación y gestión de usuarios
export const login = async (credentials) => {
  try {
    const response = await api.users.login(credentials);
    // ... (rest of the code remains the same)
    return response;
  } catch (error) {
    console.error('Error en login:', error);
    throw error;
  }
};

// Funciones para cargar datos individuales (por tipo de entidad)
export const loadUsers = async () => {
  try {
    return await api.users.getAll();
  } catch (error) {
    console.error('Error al cargar usuarios:', error);
    return [];
  }
};

export const loadBarberShops = async () => {
  try {
    return await api.barberShops.getAll();
  } catch (error) {
    console.error('Error al cargar barberías:', error);
    return [];
  }
};

export const loadServices = async () => {
  try {
    return await api.services.getAll();
  } catch (error) {
    console.error('Error al cargar servicios:', error);
    return [];
  }
};

export const loadAppointments = async () => {
  try {
    const appointmentsResponse = await api.appointments.getAll();

    // Normalizar citas al formato esperado por el frontend
    const appointments = (appointmentsResponse || []).map(a => ({
      id: a.id,
      clientId: a.clientId !== undefined ? a.clientId : (a.client_id !== undefined ? a.client_id : null),
      barberId: a.barberId !== undefined ? a.barberId : (a.barber_id !== undefined ? a.barber_id : null),
      shopId: a.shopId !== undefined ? a.shopId : (a.shop_id !== undefined ? a.shop_id : null),
      serviceId: a.serviceId !== undefined ? a.serviceId : (a.service_id !== undefined ? a.service_id : null),
      startTime: a.startTime || a.date || null,
      status: a.status || 'confirmed',
      notes: a.notes || null,
      notesBarber: a.notesBarber || a.notes_barber || null,
      clientReviewed: a.clientReviewed !== undefined ? a.clientReviewed : (a.client_reviewed !== undefined ? a.client_reviewed : false),
      cancelledAt: a.cancelledAt || a.cancelled_at || null,
      actualEndTime: a.actualEndTime || a.actual_end_time || null,
      paymentMethod: a.paymentMethod || a.payment_method || null,
      paymentStatus: a.paymentStatus || a.payment_status || null,
      paymentMarkedAt: a.paymentMarkedAt || a.payment_marked_at || null,
      paymentMarkedBy: a.paymentMarkedBy || a.payment_marked_by || null,
      // Campos adicionales opcionales
      priceAtBooking: a.priceAtBooking || a.price_at_booking || null,
      clientPhoneNumberAtBooking: a.clientPhoneNumberAtBooking || a.client_phone_number_at_booking || null,
      hiddenForClient: a.hiddenForClient !== undefined ? a.hiddenForClient : (a.hidden_for_client !== undefined ? a.hidden_for_client : false),
    }));

    return appointments;
  } catch (error) {
    console.error('Error al cargar citas:', error);
    return [];
  }
};

export const loadProducts = async () => {
  try {
    const productsResponse = await api.products.getAll();

    const normalizedProducts = (productsResponse || []).map(p => ({
      ...p,
      shopId: p.shopId !== undefined ? p.shopId : (p.shop_id !== undefined ? p.shop_id : null),
      barberId: p.barberId !== undefined ? p.barberId : (p.barber_id !== undefined ? p.barber_id : null),
      photoUrl: p.photoUrl || p.image_url || p.imageUrl || '',
      offer: p.offer !== undefined ? p.offer : (p.discount_price !== undefined ? p.discount_price : null),
    }));

    const productsMap = new Map();
    normalizedProducts.forEach(prod => {
      if (prod && prod.id != null && !productsMap.has(prod.id)) {
        productsMap.set(prod.id, prod);
      }
    });

    return Array.from(productsMap.values());
  } catch (error) {
    console.error('Error al cargar productos:', error);
    return [];
  }
};

// Funciones específicas para cada tipo de documento
// Ahora implementadas para usar la API real

// Usuarios
export const saveUser = async (user) => {
  try {
    if (user.id) {
      return await api.users.update(user.id, user);
    } else {
      return await api.users.create(user);
    }
  } catch (error) {
    console.error('Error al guardar usuario:', error);
    throw error;
  }
};

// Barberías
export const saveBarberShop = async (shop) => {
  try {
    if (shop.id) {
      return await api.barberShops.update(shop.id, shop);
    } else {
      return await api.barberShops.create(shop);
    }
  } catch (error) {
    console.error('Error al guardar barbería:', error);
    throw error;
  }
};

// Servicios
export const saveService = async (service) => {
  try {
    if (service.id) {
      return await api.services.update(service.id, service);
    } else {
      return await api.services.create(service);
    }
  } catch (error) {
    console.error('Error al guardar servicio:', error);
    throw error;
  }
};

// Citas
export const saveAppointment = async (appointment) => {
  try {
    // Mapear formato frontend -> backend
    const body = {
      // fecha/hora unificados en la columna date (timestamp)
      date: appointment.date || appointment.startTime || appointment.start_time,
      status: appointment.status || 'confirmed',
      notes: appointment.notes || null,
      client_id: appointment.clientId !== undefined ? appointment.clientId : appointment.client_id,
      barber_id: appointment.barberId !== undefined ? appointment.barberId : appointment.barber_id,
      shop_id: appointment.shopId !== undefined ? appointment.shopId : appointment.shop_id,
      service_id: appointment.serviceId !== undefined ? appointment.serviceId : appointment.service_id,
      // Campos adicionales opcionales
      price_at_booking: appointment.priceAtBooking || appointment.price_at_booking || null,
      client_phone_number_at_booking: appointment.clientPhoneNumberAtBooking || appointment.client_phone_number_at_booking || null,
      client_reviewed: appointment.clientReviewed !== undefined
        ? appointment.clientReviewed
        : (appointment.client_reviewed !== undefined ? appointment.client_reviewed : undefined),
    };

    let saved;
    if (appointment.id) {
      saved = await api.appointments.update(appointment.id, body);
    } else {
      saved = await api.appointments.create(body);
    }

    // Normalizar respuesta backend -> formato frontend
    const normalized = {
      id: saved.id,
      clientId: saved.clientId !== undefined ? saved.clientId : (saved.client_id !== undefined ? saved.client_id : appointment.clientId),
      barberId: saved.barberId !== undefined ? saved.barberId : (saved.barber_id !== undefined ? saved.barber_id : appointment.barberId),
      shopId: saved.shopId !== undefined ? saved.shopId : (saved.shop_id !== undefined ? saved.shop_id : appointment.shopId),
      serviceId: saved.serviceId !== undefined ? saved.serviceId : (saved.service_id !== undefined ? saved.service_id : appointment.serviceId),
      startTime: saved.startTime || saved.date || appointment.startTime || null,
      status: saved.status || appointment.status || 'confirmed',
      notes: saved.notes || appointment.notes || null,
      notesBarber: saved.notesBarber || saved.notes_barber || appointment.notesBarber || appointment.notes_barber || null,
      actualEndTime: saved.actualEndTime || saved.actual_end_time || appointment.actualEndTime || appointment.actual_end_time || null,
      paymentMethod: saved.paymentMethod || saved.payment_method || appointment.paymentMethod || appointment.payment_method || null,
      paymentStatus: saved.paymentStatus || saved.payment_status || appointment.paymentStatus || appointment.payment_status || null,
      paymentMarkedAt: saved.paymentMarkedAt || saved.payment_marked_at || appointment.paymentMarkedAt || appointment.payment_marked_at || null,
      paymentMarkedBy: saved.paymentMarkedBy || saved.payment_marked_by || appointment.paymentMarkedBy || appointment.payment_marked_by || null,
      priceAtBooking: saved.priceAtBooking || saved.price_at_booking || appointment.priceAtBooking || null,
      clientPhoneNumberAtBooking: saved.clientPhoneNumberAtBooking || saved.client_phone_number_at_booking || appointment.clientPhoneNumberAtBooking || null,
      clientReviewed: saved.clientReviewed !== undefined
        ? saved.clientReviewed
        : (saved.client_reviewed !== undefined ? saved.client_reviewed : (appointment.clientReviewed !== undefined ? appointment.clientReviewed : (appointment.client_reviewed !== undefined ? appointment.client_reviewed : false))),
    };

    return normalized;
  } catch (error) {
    console.error('Error al guardar cita:', error);
    throw error;
  }
};

// Productos
export const saveProduct = async (product) => {
  try {
    if (product.id) {
      return await api.products.update(product.id, product);
    } else {
      return await api.products.create(product);
    }
  } catch (error) {
    console.error('Error al guardar producto:', error);
    throw error;
  }
};

// Cancelar una cita
export const cancelAppointment = async (appointmentId) => {
  try {
    return await api.appointments.cancel(appointmentId);
  } catch (error) {
    console.error('Error al cancelar cita:', error);
    throw error;
  }
};

// Eliminar una cita
export const deleteAppointment = async (appointmentId) => {
  try {
    return await api.appointments.delete(appointmentId);
  } catch (error) {
    console.error('Error al eliminar cita:', error);
    throw error;
  }
};

// Eliminar citas por clientId y status
export const deleteAppointmentsByClientAndStatus = async (clientId, keepActive = true) => {
  try {
    return await api.appointments.deleteHistory(clientId, keepActive);
  } catch (error) {
    console.error('Error al eliminar historial de citas:', error);
    throw error;
  }
};
