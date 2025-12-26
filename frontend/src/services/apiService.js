// API Service - Maneja las comunicaciones con el backend
const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
    ? import.meta.env.VITE_API_BASE_URL
    : ((typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
      ? 'http://localhost:3000/api'
      : 'https://barber-backend-l519.onrender.com/api');

// Función auxiliar para manejar errores de fetch
const handleFetchError = async (response) => {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const error = new Error(errorData?.message || response.statusText || 'Error desconocido');
    error.status = response.status;
    error.data = errorData;
    throw error;
  }
  return response;
};

// Función auxiliar para realizar peticiones HTTP
const fetchWithErrorHandling = async (url, options = {}) => {
  try {
    // Modo de depuración para ver qué se está enviando
    console.log('Enviando petición a:', url);
    console.log('Método:', options.method || 'GET');
    console.log('Datos enviados:', options.body ? JSON.parse(options.body) : 'Sin datos');
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    // Depuración de respuesta
    console.log('Respuesta recibida. Status:', response.status);
    const responseClone = response.clone();
    let responseData;
    try {
      responseData = await responseClone.text();
      console.log('Respuesta del servidor:', responseData ? JSON.parse(responseData) : 'Sin contenido');
    } catch (e) {
      console.log('No se pudo leer la respuesta como JSON:', responseData);
    }
    
    await handleFetchError(response);
    
    // Para peticiones DELETE que pueden no devolver contenido
    if (response.status === 204) {
      return { success: true };
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error en petición a ${url}:`, error);
    throw error;
  }
};

// API para usuarios
export const userApi = {
  login: (credentials) => 
    fetchWithErrorHandling(`${API_BASE_URL}/users/login`, {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  
  // Registro de nuevos usuarios (usa la misma ruta que createUser en el backend)
  register: (userData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/users`, {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
    
  // Función para solicitar recuperación de contraseña
  forgotPassword: (data) => 
    fetchWithErrorHandling(`${API_BASE_URL}/users/forgot-password`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    
  // Función para restablecer contraseña con token
  resetPassword: (data) => 
    fetchWithErrorHandling(`${API_BASE_URL}/users/reset-password`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  getAll: () => 
    fetchWithErrorHandling(`${API_BASE_URL}/users`),
  
  getById: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/users/${id}`),
  
  create: (userData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/users`, {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  
  update: (id, userData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),

  updateProfile: (id, profileData) =>
    fetchWithErrorHandling(`${API_BASE_URL}/users/${id}/profile`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),

  changePassword: (id, data) =>
    fetchWithErrorHandling(`${API_BASE_URL}/users/${id}/change-password`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  delete: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/users/${id}`, {
      method: 'DELETE',
    }),
};

// API para barberías
export const barberShopApi = {
  getAll: () => 
    fetchWithErrorHandling(`${API_BASE_URL}/barbershops`),
  
  getById: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/barbershops/${id}`),

  getReviews: (shopId) =>
    fetchWithErrorHandling(`${API_BASE_URL}/barbershops/${shopId}/reviews`),

  addReview: (shopId, data) =>
    fetchWithErrorHandling(`${API_BASE_URL}/barbershops/${shopId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  create: (shopData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/barbershops`, {
      method: 'POST',
      body: JSON.stringify(shopData),
    }),
  
  update: (id, shopData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/barbershops/${id}`, {
      method: 'PUT',
      body: JSON.stringify(shopData),
    }),
  
  delete: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/barbershops/${id}`, {
      method: 'DELETE',
    }),
};

// API para servicios
export const serviceApi = {
  getAll: () => 
    fetchWithErrorHandling(`${API_BASE_URL}/services`),
  
  getByShop: (shopId) => 
    fetchWithErrorHandling(`${API_BASE_URL}/services/shop/${shopId}`),
  
  getById: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/services/${id}`),
  
  create: (serviceData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/services`, {
      method: 'POST',
      body: JSON.stringify(serviceData),
    }),
  
  update: (id, serviceData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/services/${id}`, {
      method: 'PUT',
      body: JSON.stringify(serviceData),
    }),
  
  delete: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/services/${id}`, {
      method: 'DELETE',
    }),
};

// API para citas
export const appointmentApi = {
  getAll: () => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments`),
  
  getByClient: (clientId) => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/client/${clientId}`),
  
  getByBarber: (barberId) => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/barber/${barberId}`),
  
  getByShop: (shopId) => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/shop/${shopId}`),
  
  getById: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/${id}`),
  
  create: (appointmentData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    }),
  
  // Crear un día libre para un barbero
  createDayOff: (data) =>
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/day-off`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createLeaveEarly: (data) =>
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/leave-early`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  update: (id, appointmentData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(appointmentData),
    }),
  
  cancel: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/${id}/cancel`, {
      method: 'PUT',
    }),
  
  complete: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/${id}/complete`, {
      method: 'PUT',
    }),

  updatePayment: (id, data) =>
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/${id}/payment`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  
  noShow: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/${id}/no-show`, {
      method: 'PUT',
    }),
  
  // Proponer adelanto de cita (chat + notificación interna)
  proposeAdvance: (id, data) =>
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/${id}/propose-advance`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  
  deleteHistory: (clientId, keepActive = true) => 
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/history/${clientId}`, {
      method: 'DELETE',
      body: JSON.stringify({ keepActive }),
    }),

  // Eliminación permanente de historial por barbero (solo días anteriores)
  deleteBarberHistory: (barberId, mode, requesterId, requesterRole) =>
    fetchWithErrorHandling(`${API_BASE_URL}/appointments/history/barber/${barberId}`, {
      method: 'DELETE',
      body: JSON.stringify({ mode, requesterId, requesterRole }),
    }),
};

// API para productos
export const productApi = {
  getAll: () => 
    fetchWithErrorHandling(`${API_BASE_URL}/products`),
  
  getByShop: (shopId) => 
    fetchWithErrorHandling(`${API_BASE_URL}/products/shop/${shopId}`),
  
  getByBarber: (barberId) => 
    fetchWithErrorHandling(`${API_BASE_URL}/products/barber/${barberId}`),
  
  getById: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/products/${id}`),
  
  create: (productData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/products`, {
      method: 'POST',
      body: JSON.stringify(productData),
    }),
  
  update: (id, productData) => 
    fetchWithErrorHandling(`${API_BASE_URL}/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(productData),
    }),
  
  delete: (id) => 
    fetchWithErrorHandling(`${API_BASE_URL}/products/${id}`, {
      method: 'DELETE',
    }),
};

// API para notificaciones internas
export const notificationApi = {
  // Obtener todas las notificaciones de un usuario
  getByUser: (userId) =>
    fetchWithErrorHandling(`${API_BASE_URL}/notifications/user/${userId}`),

  // Limpiar historial de notificaciones para el cliente (soft delete)
  clearHistory: (userId) =>
    fetchWithErrorHandling(`${API_BASE_URL}/notifications/user/${userId}/clear-history`, {
      method: 'POST',
    }),

  // Responder a una notificación (aceptar / rechazar propuesta de adelanto)
  respond: (id, accepted) =>
    fetchWithErrorHandling(`${API_BASE_URL}/notifications/${id}/respond`, {
      method: 'POST',
      body: JSON.stringify({ accepted }),
    }),
};

// API para servicios por barbero
export const barberServicesApi = {
  // Obtener todas las relaciones barber_id <-> service_id
  getAll: () =>
    fetchWithErrorHandling(`${API_BASE_URL}/barber-services`),

  // Guardar relaciones de todos los barberos de una barbería
  saveByShop: (shopId, barberServices) =>
    fetchWithErrorHandling(`${API_BASE_URL}/barber-services/by-shop/${shopId}`, {
      method: 'PUT',
      body: JSON.stringify({ barberServices }),
    }),
  // Guardar relaciones de un solo barbero
  saveForBarber: (barberId, serviceIds) =>
    fetchWithErrorHandling(`${API_BASE_URL}/barber-services-single/${barberId}`, {
      method: 'PUT',
      body: JSON.stringify({ serviceIds }),
    }),
};

// API para chat interno
export const chatApi = {
  // Obtener o crear conversación cliente-barbero por cita
  getConversationByAppointment: (appointmentId) =>
    fetchWithErrorHandling(`${API_BASE_URL}/chat/conversations/by-appointment/${appointmentId}`),

  // Obtener o crear conversación directa cliente-barbero (sin cita)
  getOrCreateDirectConversation: (clientId, barberId) =>
    fetchWithErrorHandling(`${API_BASE_URL}/chat/conversations/direct`, {
      method: 'POST',
      body: JSON.stringify({ clientId, barberId }),
    }),

  // Listar conversaciones de un usuario
  getUserConversations: (userId) =>
    fetchWithErrorHandling(`${API_BASE_URL}/chat/conversations/user/${userId}`),

  // Archivar (eliminar individual) conversación para un usuario
  archiveConversation: (conversationId, userId) =>
    fetchWithErrorHandling(`${API_BASE_URL}/chat/conversations/${conversationId}/archive`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Obtener mensajes de una conversación
  getMessages: (conversationId) =>
    fetchWithErrorHandling(`${API_BASE_URL}/chat/conversations/${conversationId}/messages`),

  // Enviar mensaje
  sendMessage: (data) =>
    fetchWithErrorHandling(`${API_BASE_URL}/chat/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Marcar mensajes como leídos para un usuario en una conversación
  markAsRead: (conversationId, userId) =>
    fetchWithErrorHandling(`${API_BASE_URL}/chat/conversations/${conversationId}/mark-read`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  // Listar conversaciones para un dueño (owner)
  getOwnerConversations: (ownerId) =>
    fetchWithErrorHandling(`${API_BASE_URL}/chat/owner/${ownerId}/conversations`),
};

// API para disponibilidad de barberos
export const barberAvailabilityApi = {
  async getAll() {
    return fetchWithErrorHandling(`${API_BASE_URL}/barber-availability`);
  },
  async saveForBarber(barberId, availability) {
    return fetchWithErrorHandling(`${API_BASE_URL}/barber-availability/${barberId}`, {
      method: 'PUT',
      body: JSON.stringify({ availability }),
    });
  },
};

export const barberBreaksApi = {
  async getAll() {
    return fetchWithErrorHandling(`${API_BASE_URL}/barber-breaks`);
  },
  async saveForBarber(barberId, breaks) {
    return fetchWithErrorHandling(`${API_BASE_URL}/barber-breaks/${barberId}`, {
      method: 'PUT',
      body: JSON.stringify({ breaks }),
    });
  },
};

// API para hora del servidor
export const timeApi = {
  getNow: () => fetchWithErrorHandling(`${API_BASE_URL}/time/now`),
};

// Exportar todas las APIs juntas
export default {
  users: userApi,
  barberShops: barberShopApi,
  services: serviceApi,
  appointments: appointmentApi,
  products: productApi,
  barberServices: barberServicesApi,
  chat: chatApi,
  barberAvailability: barberAvailabilityApi,
  barberBreaks: barberBreaksApi,
  time: timeApi,
  notifications: notificationApi,
};
