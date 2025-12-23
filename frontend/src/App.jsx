import React, { useReducer, createContext, useEffect, useState, useRef } from 'react';
import LoginPage from './components/LoginPage';
import ClientDashboard from './components/ClientDashboard';
import BarberDashboard from './components/BarberDashboard';
import OwnerDashboard from './components/OwnerDashboard';
import Notification from './components/Notification';
import Modal from './components/Modal';
import ChatWidget from './components/ChatWidget';
import { setupImageUploadInterceptor } from './utils/imageUtils';
import { saveStateToLocalStorage, loadInitialState, saveUser, saveBarberShop, saveService, saveAppointment, saveProduct, cancelAppointment, completeAppointment, markNoShowAppointment, deleteAppointmentsByClientAndStatus, loadNotificationsForUser, loadAppointments, loadProducts, loadUsers } from './services/dataService';
import { userApi, barberShopApi, serviceApi, productApi, barberAvailabilityApi, barberBreaksApi, barberServicesApi } from './services/apiService';
// Estado inicial limpio - todos los datos vendrán de la API
const initialState = {
  currentSubView: 'barberOverview',
  currentUser: null,
  isAuthenticated: false,
  currentView: 'login',
  notification: null,
  modal: null,
  // Estas listas se llenarán con datos de la API
  users: [],
  barberShops: [],
  services: [],
  appointments: [],
  products: [],
  // Otras estructuras que se completarán con datos de la API
  barberAvailability: {},
  barberBreaks: {},
  barberServices: {},
  barberShopPhotos: {},
  // Tiempo de llegada configurable por barbero (lead time para que el cliente llegue)
  barberArrivalBuffers: {}
};

function appReducer(state, action) {
  switch (action.type) {
    // Nuevo caso para establecer todos los datos (usado cuando se cargan desde Firestore)
    case 'SET_ALL_DATA': {
      const incoming = action.payload || {};

      // Si vienen citas nuevas desde el backend, fusionarlas con las existentes
      // para conservar campos locales como notesBarber.
      let mergedAppointments = incoming.appointments;
      if (Array.isArray(incoming.appointments) && Array.isArray(state.appointments)) {
        mergedAppointments = incoming.appointments.map(newAppt => {
          const existing = state.appointments.find(a => a.id === newAppt.id);
          if (!existing) return newAppt;

          return {
            ...newAppt,
            // Conservar notas del barbero si ya existían en memoria
            notesBarber: existing.notesBarber ?? newAppt.notesBarber,
          };
        });
      }

      return {
        ...state,
        ...incoming,
        ...(mergedAppointments ? { appointments: mergedAppointments } : {}),
      };
    }
    case 'ADD_PRODUCT':
      // Usar los datos reales devueltos por la API (createProduct)
      // En createApiDispatch, para ADD_PRODUCT, action.payload.productData ya es savedProduct
      const pd = action.payload.productData || {};

      const normalizedProduct = {
        // Usar id real si viene de la BD, si no, fallback temporal
        id: pd.id || ('product_' + Date.now()),
        name: pd.name || action.payload.productData?.name,
        description: pd.description || action.payload.productData?.description || '',
        price: pd.price ?? action.payload.productData?.price ?? 0,
        stock: pd.stock ?? action.payload.productData?.stock ?? 0,
        category: action.payload.productData?.category || pd.category || '',
        // Mapear imagen de BD -> estado
        photoUrl: pd.photoUrl || pd.image_url || pd.imageUrl || action.payload.productData?.photoUrl || '',
        // shopId y dueño/barbero
        shopId: pd.shopId !== undefined ? pd.shopId : (pd.shop_id !== undefined ? pd.shop_id : action.payload.shopId),
        ownerId: action.payload.ownerOrBarberId,
        barberId: action.payload.barberId || null,
        offer: action.payload.productData?.offer ?? pd.discount_price ?? null,
        createdAt: pd.created_at || new Date().toISOString()
      };

      return {
        ...state,
        products: [...state.products, normalizedProduct]
      };

    case 'SET_SUB_VIEW':
      return {
        ...state,
        currentSubView: action.payload
      };

    case 'LOGIN': {
      // En este punto, action.payload contiene los datos del usuario autenticado desde la API
      const userData = action.payload;
      
      // Depurar los datos del usuario recibidos
      console.log('LOGIN: Datos de usuario recibidos:', userData);
      
      // Verificar y adaptar los campos necesarios para asegurar compatibilidad
      // Usar tanto rol (español) como role (inglés), lo que esté disponible
      const userRole = userData.rol || userData.role || 'client';
      const userName = userData.nombre || userData.name || 'Usuario';
      
      console.log('LOGIN: Rol detectado:', userRole);
      
      // Selecciona el dashboard y subvista inicial según rol
      let currentView = 'login';
      
      // Normalizar el rol a minúsculas para comparaciones flexibles
      const normalizedRole = userRole.toLowerCase();
      
      if (normalizedRole.includes('client')) currentView = 'clientDashboard';
      else if (normalizedRole.includes('barber')) currentView = 'barberDashboard';
      else if (normalizedRole.includes('owner')) currentView = 'ownerDashboard';
      else if (normalizedRole.includes('admin')) currentView = 'ownerDashboard'; // Los admin ven el dashboard de owner
      
      console.log('LOGIN: Vista seleccionada:', currentView);
      
      return {
        ...state,
        isAuthenticated: true,
        currentUser: userData,
        currentView,
        notification: { message: `¡Bienvenido ${userName}!`, type: 'success', id: Date.now() },
      };
    }
    case 'LOGOUT':
      console.log('LOGOUT: Cerrando sesión de usuario');
      return { 
        ...state, 
        isAuthenticated: false, 
        currentUser: null, 
        currentView: 'login',
        currentSubView: 'barberOverview', // Restablecer subvista predeterminada
        notification: { message: 'Sesión cerrada correctamente', type: 'info', id: Date.now() }
      };
    case 'SET_VIEW':
      return { ...state, currentView: action.payload };
    case 'REGISTER_USER': {
      const newUser = action.payload;
      // Ya no es necesario verificar duplicados aquí, la API se encarga de eso
      // y devolverá un error si el email ya está registrado
      
      // Actualizamos el estado con el nuevo usuario que viene de la respuesta de la API
      return {
        ...state,
        notification: { message: `¡Bienvenido ${newUser.nombre || newUser.name}! Cuenta creada con éxito. Ahora puedes iniciar sesión.`, type: 'success', id: Date.now() },
      };
    }
    case 'SHOW_MODAL':
      return {
        ...state,
        modal: action.payload || null,
      };
    case 'HIDE_MODAL':
      return {
        ...state,
        modal: null,
      };
    case 'SHOW_NOTIFICATION':
      return { ...state, notification: { ...action.payload, id: Date.now() } };
    case 'HIDE_NOTIFICATION':
      return { ...state, notification: null };
      
    // Gestión de Servicios
    case 'ADD_SERVICE': {
      const newService = action.payload;

      // Actualizar lista global de servicios
      const updatedServices = [...state.services, newService];

      // Si es un servicio personal de barbero, asociarlo también en barberServices
      let updatedBarberServices = state.barberServices;
      if (newService.barberId) {
        const barberId = newService.barberId;
        const existing = state.barberServices?.[barberId] || [];
        // Evitar duplicados
        const alreadyHas = existing.some(id => String(id) === String(newService.id));
        updatedBarberServices = {
          ...state.barberServices,
          [barberId]: alreadyHas ? existing : [...existing, newService.id]
        };
      }

      return {
        ...state,
        services: updatedServices,
        barberServices: updatedBarberServices
      };
    }
      
    case 'UPDATE_SERVICE':
      return {
        ...state,
        services: state.services.map(service => 
          service.id === action.payload.id ? action.payload : service
        )
      };
      
    case 'DELETE_SERVICE': {
      const serviceIdToDelete = action.payload;

      // Eliminar el servicio de la lista de servicios
      const remainingServices = state.services.filter(service => service.id !== serviceIdToDelete);

      // Eliminar referencias a este servicio en barberServices
      const updatedBarberServices = Object.fromEntries(
        Object.entries(state.barberServices || {}).map(([barberId, serviceIds]) => [
          barberId,
          (serviceIds || []).filter(id => id !== serviceIdToDelete)
        ])
      );

      return {
        ...state,
        services: remainingServices,
        barberServices: updatedBarberServices,
      };
    }

    case 'ADD_BARBER_SERVICE':
      return {
        ...state,
        barberServices: {
          ...state.barberServices,
          [action.payload.barberId]: [
            ...(state.barberServices[action.payload.barberId] || []),
            action.payload.serviceId
          ]
        }
      };
    
    case 'SET_BARBER_SERVICES_FOR_BARBERS': {
      const { barberIds, servicesByBarber } = action.payload;
      const updatedBarberServices = { ...state.barberServices };
      barberIds.forEach(id => {
        updatedBarberServices[id] = [...(servicesByBarber[id] || [])];
      });
      return {
        ...state,
        barberServices: updatedBarberServices
      };
    }
    
    // Disponibilidad de barberos
    case 'UPDATE_BARBER_AVAILABILITY': {
      const { barberId, availability } = action.payload || {};
      if (!barberId) return state;
      return {
        ...state,
        barberAvailability: {
          ...state.barberAvailability,
          [barberId]: Array.isArray(availability) ? availability : [],
        },
      };
    }

    case 'SET_BARBER_AVAILABILITY': {
      const map = action.payload || {};
      return {
        ...state,
        barberAvailability: map,
      };
    }

    case 'UPDATE_BARBER_BREAKS': {
      const { barberId, breaks } = action.payload || {};
      if (!barberId) return state;
      return {
        ...state,
        barberBreaks: {
          ...state.barberBreaks,
          [barberId]: Array.isArray(breaks) ? breaks : [],
        },
      };
    }

    case 'SET_BARBER_BREAKS': {
      const map = action.payload || {};
      return {
        ...state,
        barberBreaks: map,
      };
    }

    // Tiempo de llegada (buffer) por barbero
    case 'UPDATE_BARBER_ARRIVAL_BUFFER': {
      const { barberId, enabled, minutes } = action.payload || {};
      if (!barberId) return state;
      return {
        ...state,
        barberArrivalBuffers: {
          ...state.barberArrivalBuffers,
          [barberId]: {
            enabled: !!enabled,
            minutes: !!enabled ? (Number.isFinite(minutes) ? Number(minutes) : 20) : 0,
          },
        },
      };
    }
      
    // Gestión de Barberías
    case 'ADD_BARBERSHOP':
      return {
        ...state,
        barberShops: [...state.barberShops, action.payload],
      };
      
    case 'EDIT_BARBERSHOP':
      return {
        ...state,
        barberShops: state.barberShops.map(shop => 
          shop.id === action.payload.id ? action.payload : shop
        )
      };
      
    case 'DELETE_BARBERSHOP':
      return {
        ...state,
        barberShops: state.barberShops.filter(shop => shop.id !== action.payload.id)
      };
      
    case 'DELETE_PRODUCT':
      // Eliminamos el producto y todas sus referencias
      const productToDelete = state.products.find(p => p.id === action.payload.id);
      
      const updatedProducts = state.products.filter(product => product.id !== action.payload.id);
      
      // Eliminamos cualquier venta asociada al producto
      const updatedSales = (state.sales || []).filter(sale => sale.productId !== action.payload.id);
      
      // Actualizamos las notificaciones
      const notifications = state.notifications || [];
      notifications.unshift({
        id: 'notification_' + Date.now(),
        message: `Producto eliminado: ${productToDelete?.name || 'Producto'}`,
        type: 'success',
        read: false,
        date: new Date().toISOString()
      });
      
      return {
        ...state,
        products: updatedProducts,
        sales: updatedSales,
        notifications
      };
      
    case 'UPDATE_PRODUCT': {
      const p = action.payload || {};
      return {
        ...state,
        products: state.products.map(product => {
          if (product.id !== p.id) return product;

          const normalized = {
            ...p,
            // Mapear imagen y descuento desde la respuesta de la API si vienen
            photoUrl: p.photoUrl || p.image_url || product.photoUrl || '',
            offer: p.offer !== undefined ? p.offer : (p.discount_price !== undefined ? p.discount_price : product.offer),
            shopId: p.shopId !== undefined ? p.shopId : (p.shop_id !== undefined ? p.shop_id : product.shopId),
          };

          return { ...product, ...normalized };
        })
      };
    }
      
    case 'SELL_PRODUCT':
      // Obtener el producto a vender
      const productToSell = state.products.find(p => p.id === action.payload.productId);
      
      // Si no existe el producto o no hay suficiente stock, no hacer nada
      if (!productToSell || productToSell.stock < action.payload.quantity) {
        return state;
      }
      
      // Crear registro de venta
      const saleId = 'sale_' + Date.now();
      const newSale = {
        id: saleId,
        productId: action.payload.productId,
        productName: productToSell.name,
        quantity: action.payload.quantity,
        price: productToSell.price,
        total: productToSell.price * action.payload.quantity,
        barberId: action.payload.barberId,
        shopId: productToSell.shopId,
        date: new Date().toISOString(),
        sellerId: action.payload.sellerId || action.payload.barberId
      };
      
      // Actualizar el stock del producto
      const productsWithUpdatedStock = state.products.map(product => 
        product.id === action.payload.productId
          ? { ...product, stock: product.stock - action.payload.quantity }
          : product
      );
      
      return {
        ...state,
        products: productsWithUpdatedStock,
        sales: [...(state.sales || []), newSale],
        notifications: [
          {
            id: 'notification_' + Date.now(),
            message: `Venta registrada: ${action.payload.quantity} unidad(es) de ${productToSell.name}`,
            type: 'success',
            read: false,
            date: new Date().toISOString()
          },
          ...(state.notifications || [])
        ]
      };
      
    case 'ADD_SALE':
      return {
        ...state,
        sales: [...(state.sales || []), action.payload],
        notifications: [
          {
            id: 'notification_' + Date.now(),
            message: `Venta registrada: ${action.payload.quantity} unidades de ${action.payload.productName}`,
            type: 'success',
            read: false,
            date: new Date().toISOString()
          },
          ...(state.notifications || [])
        ]
      };
      
    case 'DELETE_APPOINTMENTS_BY_SHOP':
      return {
        ...state,
        appointments: state.appointments.filter(appointment => appointment.shopId !== action.payload.shopId)
      };
      
    case 'DELETE_BARBERSHOP_PHOTOS':
      return {
        ...state,
        barberShopPhotos: Object.fromEntries(
          Object.entries(state.barberShopPhotos || {}).filter(([key]) => key !== action.payload.shopId)
        )
      };
      
    case 'UPDATE_BARBERSHOP_PHOTO':
      return {
        ...state,
        barberShopPhotos: {
          ...state.barberShopPhotos,
          [action.payload.shopId]: [action.payload.photoUrl, ...(state.barberShopPhotos?.[action.payload.shopId]?.slice(1) || [])]
        }
      };
      
    // Gestión de Usuarios
    case 'UPDATE_USER':
      return {
        ...state,
        users: state.users.map(user => 
          String(user.id) === String(action.payload.id) 
            ? { ...user, ...action.payload }
            : user
        ),
        currentUser:
          state.currentUser && String(state.currentUser.id) === String(action.payload.id)
            ? { ...state.currentUser, ...action.payload }
            : state.currentUser
      };
      
    case 'DELETE_USER':
      // Encontramos el usuario a eliminar
      const userToDelete = state.users.find(u => u.id === action.payload.id);
      
      // Si es un barbero, necesitamos actualizar las barberías y las citas
      if (userToDelete && userToDelete.role === 'barber') {
        // Encontramos la barbería asociada
        const barberShopsToUpdate = state.barberShops.map(shop => 
          shop.barberIds && shop.barberIds.includes(action.payload.id)
            ? { ...shop, barberIds: shop.barberIds.filter(id => id !== action.payload.id) }
            : shop
        );
        
        // Actualizamos las citas asignadas a este barbero
        const appointmentsToUpdate = state.appointments.map(appointment => 
          appointment.barberId === action.payload.id
            ? { ...appointment, barberId: null, status: 'pendiente' }
            : appointment
        );
        
        // Actualizamos las notificaciones
        const notifications = state.notifications || [];
        notifications.unshift({
          id: 'notification_' + Date.now(),
          message: `Barbero eliminado: ${userToDelete.name || 'Usuario'}`,
          type: 'success',
          read: false,
          date: new Date().toISOString()
        });
        
        return {
          ...state,
          users: state.users.filter(user => user.id !== action.payload.id),
          barberShops: barberShopsToUpdate,
          appointments: appointmentsToUpdate,
          notifications
        };
      }
      
      // Para usuarios que no son barberos
      return {
        ...state,
        users: state.users.filter(user => user.id !== action.payload.id)
      };
    
    case 'UPDATE_BARBER':
      return {
        ...state,
        users: state.users.map(user => 
          user.id === action.payload.id 
            ? { ...user, ...action.payload.data }
            : user
        )
      };
      
    case 'UNASSIGN_BARBER_APPOINTMENTS':
      return {
        ...state,
        appointments: state.appointments.map(appointment => 
          appointment.barberId === action.payload.barberId 
          ? { ...appointment, barberId: null, status: 'pendiente' }
          : appointment
        )
      };
      
    case 'ADD_APPOINTMENT':
      return {
        ...state,
        appointments: [...state.appointments, action.payload]
      };

    case 'UPDATE_APPOINTMENT':
      return {
        ...state,
        appointments: state.appointments.map(appt =>
          String(appt.id) === String(action.payload.id) ? { ...appt, ...action.payload } : appt
        )
      };

    case 'UPDATE_APPOINTMENT_BARBER_NOTES': {
      const { appointmentId, notesBarber } = action.payload || {};
      if (appointmentId == null) return state;

      return {
        ...state,
        appointments: state.appointments.map(appt =>
          String(appt.id) === String(appointmentId)
            ? { ...appt, notesBarber }
            : appt
        ),
      };
    }

    case 'COMPLETE_APPOINTMENT': {
      const idToComplete = action.payload && (action.payload.id ?? action.payload.appointmentId);
      if (idToComplete == null) return state;
      const completedAt = action.payload.completedAt || new Date().toISOString();

      return {
        ...state,
        appointments: state.appointments.map(appt =>
          String(appt.id) === String(idToComplete)
            ? { ...appt, status: 'completed', actualEndTime: completedAt }
            : appt
        ),
      };
    }

    case 'NO_SHOW_APPOINTMENT': {
      const idToNoShow = action.payload && (action.payload.id ?? action.payload.appointmentId);
      if (idToNoShow == null) return state;

      return {
        ...state,
        appointments: state.appointments.map(appt =>
          String(appt.id) === String(idToNoShow)
            ? { ...appt, status: 'no_show' }
            : appt
        ),
      };
    }

    case 'ADD_BARBER_TO_SHOP': {
      // El id REAL ya viene en action.payload.barber.id (asignado en createApiDispatch)
      const barberId = action.payload.barber.id;

      // Crear el objeto del nuevo barbero para el estado local
      const newBarber = {
        id: barberId,
        ...action.payload.barber,
        shopId: action.payload.shopId,
        createdAt: new Date().toISOString(),
        active: true
      };

      // Obtener la barbería para actualizar los barberIds
      const shopToUpdate = state.barberShops.find(shop => String(shop.id) === String(action.payload.shopId));

      if (!shopToUpdate) {
        return {
          ...state,
          users: (() => {
            const exists = state.users.some((u) => String(u.id) === String(barberId));
            if (exists) {
              return state.users.map((u) => (String(u.id) === String(barberId) ? { ...u, ...newBarber } : u));
            }
            return [...state.users, newBarber];
          })(),
        };
      }

      return {
        ...state,
        // Añadir el barbero a los usuarios
        users: (() => {
          const exists = state.users.some((u) => String(u.id) === String(barberId));
          if (exists) {
            return state.users.map((u) => (String(u.id) === String(barberId) ? { ...u, ...newBarber } : u));
          }
          return [...state.users, newBarber];
        })(),

        // Actualizar los barberIds de la barbería
        barberShops: state.barberShops.map(shop =>
          String(shop.id) === String(action.payload.shopId)
            ? {
                ...shop,
                barberIds: [...(shop.barberIds || []), barberId]
              }
            : shop
        )
      };
    }
      
    case 'CANCEL_APPOINTMENT':
      // Buscar la cita por ID (admite id o appointmentId en el payload)
      const idToCancel = (action.payload && (action.payload.id ?? action.payload.appointmentId));
      const appointmentToCancel = state.appointments.find(appt => String(appt.id) === String(idToCancel));
      
      // Si no existe la cita, no hacer nada
      if (!appointmentToCancel) {
        return state;
      }
      
      // Actualizar el estado de la cita a 'cancelled'
      const updatedAppointments = state.appointments.map(appointment => 
        String(appointment.id) === String(idToCancel)
          ? { ...appointment, status: 'cancelled', cancelledAt: new Date().toISOString() }
          : appointment
      );
      
      return {
        ...state,
        appointments: updatedAppointments
      };
    
    case 'DELETE_CLIENT_APPOINTMENTS_HISTORY':
      // Eliminar historial (canceladas/completadas) del cliente
      // Si keepActive=true, conservar solo las citas ACTIVAS y FUTURAS del cliente
      const nowMs = action.payload?.nowMs ?? Date.now();
      const filteredAppointments = state.appointments.filter(appointment => {
        const apptClientId = appointment.clientId !== undefined ? appointment.clientId : appointment.client_id;
        const sameClient = apptClientId != null && action.payload?.clientId != null
          ? String(apptClientId) === String(action.payload.clientId)
          : false;
        if (!sameClient) return true; // Citas de otros clientes se mantienen

        if (action.payload.keepActive) {
          // Mantener citas FUTURAS que NO estén finalizadas (cancelada/completada/no_show)
          const status = String(appointment.status || '').trim().toLowerCase();
          const isCancelled =
            status === 'cancelled' ||
            status === 'cancelada' ||
            status.startsWith('cancelled') ||
            status.startsWith('cancelada') ||
            status.startsWith('cancel');
          const isCompleted = status === 'completed' || status === 'completada' || status === 'completado' || status.startsWith('complet');
          const isNoShow = status === 'no_show' || status === 'no-show' || status === 'noshow';
          if (isCancelled || isCompleted || isNoShow) return false;

          const start = appointment.startTime || appointment.date || appointment.start_time;
          if (!start) return true;
          const ms = new Date(start).getTime();
          if (Number.isNaN(ms)) return true;
          return ms >= nowMs;
        }

        // Si no se quiere mantener activas, eliminar todas las del cliente
        return false;
      });

      return {
        ...state,
        appointments: filteredAppointments
      };
      
    default:
      return state;
  }
}

export const AppContext = createContext();

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    // Puedes loguear el error aquí si quieres
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ color: 'red', padding: 32 }}><h2>¡Error crítico en la app!</h2><pre>{String(this.state.error)}</pre></div>;
    }
    return this.props.children;
  }
}

// Wrapper para el dispatch que realiza operaciones asíncronas en la BD
const createApiDispatch = (dispatch) => {
  return async (action) => {
    // Para acciones que requieren operaciones en la API
    try {
      switch (action.type) {
        case 'LOGIN':
          // La autenticación se maneja de forma especial
          dispatch(action); // Primero actualizamos el estado local
          break;
          
        case 'ADD_PRODUCT':
        case 'UPDATE_PRODUCT': {
          // Guardar el producto en la BD
          const productData = action.type === 'ADD_PRODUCT' 
            ? action.payload.productData 
            : action.payload;
            
          const savedProduct = await saveProduct({
            ...productData,
            shopId: action.payload.shopId || productData.shopId,
            barberId: action.payload.barberId || productData.barberId,
            ownerId: action.payload.ownerOrBarberId || productData.ownerId
          });
          
          // Actualizar la acción con la respuesta de la API
          const updatedProductAction = {
            ...action,
            payload: action.type === 'ADD_PRODUCT' 
              ? { ...action.payload, productData: savedProduct }
              : savedProduct
          };
          
          dispatch(updatedProductAction);
          break;
        }
        
        case 'COMPLETE_APPOINTMENT': {
          const idToComplete = action.payload && (action.payload.id ?? action.payload.appointmentId);
          if (idToComplete != null) {
            await completeAppointment(idToComplete);
            dispatch({
              ...action,
              payload: {
                ...action.payload,
                id: idToComplete,
              },
            });
          } else {
            console.warn('COMPLETE_APPOINTMENT llamado sin id válido. Acción ignorada.', action);
          }
          break;
        }

        case 'NO_SHOW_APPOINTMENT': {
          const idToNoShow = action.payload && (action.payload.id ?? action.payload.appointmentId);
          if (idToNoShow != null) {
            await markNoShowAppointment(idToNoShow);
            dispatch({
              ...action,
              payload: {
                ...action.payload,
                id: idToNoShow,
              },
            });
          } else {
            console.warn('NO_SHOW_APPOINTMENT llamado sin id válido. Acción ignorada.', action);
          }
          break;
        }

        case 'DELETE_PRODUCT': {
          const { id } = action.payload;
          if (id !== undefined && id !== null) {
            await productApi.delete(id);
          }
          dispatch(action);
          break;
        }

        case 'DELETE_USER': {
          const id = action.payload?.id;
          if (id !== undefined && id !== null) {
            await userApi.delete(id);
          }
          dispatch(action);
          break;
        }
          
        case 'ADD_APPOINTMENT':
        case 'UPDATE_APPOINTMENT': {
          // Guardar la cita en la BD
          const appointmentData = action.payload;
          const savedAppointment = await saveAppointment(appointmentData);
          
          // Actualizar la acción con la respuesta de la API
          dispatch({
            ...action,
            payload: savedAppointment
          });

          // Solo para nuevas citas, mostrar notificación de éxito
          if (action.type === 'ADD_APPOINTMENT') {
            dispatch({
              type: 'SHOW_NOTIFICATION',
              payload: {
                message: '¡Cita reservada con éxito!',
                type: 'success',
              },
            });
          }

          break;
        }
          
        case 'CANCEL_APPOINTMENT': {
          // Cancelar la cita en la BD (admite id o appointmentId en el payload)
          const idToCancel = action.payload && (action.payload.id ?? action.payload.appointmentId);
          if (idToCancel != null) {
            await cancelAppointment(idToCancel);
            dispatch({
              ...action,
              payload: {
                ...action.payload,
                id: idToCancel,
              },
            });
          } else {
            console.warn('CANCEL_APPOINTMENT llamado sin id válido. Acción ignorada.', action);
          }
          break;
        }
          
        case 'DELETE_CLIENT_APPOINTMENTS_HISTORY': {
          // Intentar eliminar historial de citas en la BD.
          // Si la ruta no existe (404) u ocurre un error, seguimos adelante
          // y borramos el historial solo en el estado del frontend.
          try {
            await deleteAppointmentsByClientAndStatus(
              action.payload.clientId,
              action.payload.keepActive
            );
          } catch (e) {
            console.warn('No se pudo eliminar historial en la API (se continuará solo en memoria):', e?.message || e);
          }

          // En todos los casos, actualizar el estado local
          dispatch(action);
          break;
        }

        case 'ADD_SERVICE':
        case 'UPDATE_SERVICE': {
          // Guardar servicio (general, exclusivo de barbería o personal de barbero) en la BD
          const originalPayload = action.payload || {};
          const serviceData = originalPayload;

          const savedService = await saveService(serviceData);

          // Reinyectar barberId y shopId para que el reducer pueda actualizar barberServices y filtros
          const mergedService = {
            ...savedService,
            barberId:
              savedService.barberId !== undefined ? savedService.barberId :
              (savedService.barber_id !== undefined ? savedService.barber_id : originalPayload.barberId),
            shopId:
              savedService.shopId !== undefined ? savedService.shopId :
              (savedService.shop_id !== undefined ? savedService.shop_id : originalPayload.shopId),
          };

          dispatch({
            ...action,
            payload: mergedService
          });
          break;
        }

        case 'UPDATE_BARBER_AVAILABILITY': {
          const { barberId, availability } = action.payload;
          await barberAvailabilityApi.saveForBarber(barberId, availability);
          dispatch(action);
          break;
        }

        case 'UPDATE_BARBER_BREAKS': {
          const { barberId, breaks } = action.payload || {};
          if (barberId != null) {
            await barberBreaksApi.saveForBarber(barberId, breaks);
          }
          dispatch(action);
          break;
        }

        case 'SET_BARBER_SERVICES_FOR_BARBERS': {
          const { barberIds, servicesByBarber } = action.payload || {};
          if (Array.isArray(barberIds)) {
            for (const id of barberIds) {
              const svcIds = servicesByBarber?.[id] || [];
              await barberServicesApi.saveForBarber(id, svcIds);
            }
          }
          dispatch(action);
          break;
        }

        case 'DELETE_SERVICE': {
          const serviceId = action.payload;
          if (serviceId !== undefined && serviceId !== null) {
            await serviceApi.delete(serviceId);
          }
          dispatch(action);
          break;
        }
          
        case 'ADD_BARBERSHOP': {
          // Datos que ya arma OwnerBarberShopsManagement
          const shop = action.payload;

          // Crear barbería en la API
          const created = await barberShopApi.create({
            name: shop.name,
            address: shop.address,
            phone: shop.phone,
            city: shop.city,
            email: shop.email,
            ownerId: shop.ownerId,
            openHours: shop.openHours,
            description: shop.description,
            instagram: shop.instagram,
            facebook: shop.facebook,
            photoUrl: shop.photoUrl,
            ownerName: shop.ownerName,
            ownerEmail: shop.ownerEmail,
            ownerPassword: shop.ownerPassword,
            ownerIsAlsoBarber: shop.ownerIsAlsoBarber,
          });

          // created.id es el ID REAL de la BD
          const actionWithRealId = {
            ...action,
            payload: {
              ...shop,
              id: created.id
            }
          };

          dispatch(actionWithRealId);
          break;
        }

        case 'EDIT_BARBERSHOP': {
          const shop = action.payload;

          await barberShopApi.update(shop.id, {
            name: shop.name,
            address: shop.address,
            phone: shop.phone,
            city: shop.city,
            email: shop.email,
            openHours: shop.openHours,
            description: shop.description,
            instagram: shop.instagram,
            facebook: shop.facebook,
            photoUrl: shop.photoUrl
          });

          dispatch(action);
          break;
        }

        case 'DELETE_BARBERSHOP': {
          const { id } = action.payload;
          await barberShopApi.delete(id);
          dispatch(action);
          break;
        }

        case 'UPDATE_USER': {
          const { id, ...rest } = action.payload;

          // Construimos body traduciendo shopId -> shop_id
          const body = {
            ...rest,
            ...(rest.shopId !== undefined ? { shop_id: rest.shopId } : {}),
            ...(rest.canDeleteHistory !== undefined ? { can_delete_history: rest.canDeleteHistory } : {})
          };

          await userApi.update(id, body);

          dispatch(action);
          break;
        }

        case 'UPDATE_BARBER': {
          const { id, data } = action.payload;

          // data contiene name, email, phone, password?, photoUrl, shopId...
          const body = {
            ...data,
            ...(data.shopId !== undefined ? { shop_id: data.shopId } : {})
          };

          await userApi.update(id, body);

          dispatch(action);
          break;
        }

        case 'ADD_BARBER_TO_SHOP': {
          // 1) Crear usuario barbero en BD (incluyendo foto si existe)
          const rawShopId = action.payload.shopId;
          const shopIdNum = rawShopId == null || rawShopId === '' ? null : Number(rawShopId);
          const shop_id = shopIdNum == null || Number.isNaN(shopIdNum) ? null : shopIdNum;

          const newBarber = await userApi.create({
            name: action.payload.barber.name,
            email: action.payload.barber.email,
            phone: action.payload.barber.phone,
            password: action.payload.barber.password,
            role: 'barber',
            photoUrl: action.payload.barber.photoUrl || undefined,
            ...(shop_id != null ? { shop_id, shopId: shop_id } : {}),
          });

          // Asegurar que el shop_id quede persistido incluso si el endpoint create lo ignora
          if (shop_id != null) {
            try {
              await userApi.update(newBarber.id, { shop_id, shopId: shop_id });
            } catch (e) {
              console.warn('No se pudo persistir shop_id del barbero (se continuará igualmente):', e?.message || e);
            }
          }

          // 2) (Opcional) actualizar barbería en la API solo si el shopId es numérico
          try {
            const numericShopId = parseInt(action.payload.shopId, 10);

            if (!Number.isNaN(numericShopId)) {
              await barberShopApi.update(numericShopId, {
                // TODO: cuando definamos bien la API, aquí enviaremos barberIds o similar
              });
            } else {
              console.warn(
                'shopId no es numérico, se omite actualización de barbería en la API:',
                action.payload.shopId
              );
            }
          } catch (e) {
            console.warn('No se pudo actualizar la barbería en la API (paso opcional por ahora):', e.message);
          }

          // 3) Re-dispatch con el id real del barbero devuelto por la BD
          const actionWithRealIdBarber = {
            ...action,
            payload: {
              ...action.payload,
              barber: { ...action.payload.barber, id: newBarber.id }
            }
          };

          dispatch(actionWithRealIdBarber);
          break;
        }

        // Para el resto de acciones, simplemente hacemos dispatch
        default:
          dispatch(action);
          break;
      }
      
      // Guardar el estado actualizado en memoria (para compatibilidad)
      setTimeout(() => {
        const state = window.appState;
        if (state) {
          saveStateToLocalStorage(state);
        }
      }, 0);
      
    } catch (error) {
      console.error('Error en apiDispatch:', error);
      
      // Notificar al usuario del error
      dispatch({ 
        type: 'SHOW_NOTIFICATION', 
        payload: { 
          message: `Error: ${error.message || 'Ha ocurrido un error'}`, 
          type: 'error' 
        } 
      });
    }
  };
};

const App = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const globalNotifAudioRef = useRef(null);
  const globalNotifCountRef = useRef(0);
  const latestUsersRef = useRef([]);
  
  // Inicializar con el estado predeterminado mientras se cargan los datos
  const [state, dispatchBase] = useReducer(appReducer, initialState);
  
  // Crear un dispatch que realiza operaciones en la API
  const dispatch = createApiDispatch(dispatchBase);
  
  // Guardar el estado en una variable global para compatibilidad
  window.appState = state;
  
  // Cargar datos iniciales y configurar la aplicación
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Configurar el interceptor para simular la carga de imágenes
        setupImageUploadInterceptor();
        console.log('Interceptor de carga de imágenes configurado');
        
        // Cargar datos desde la API (primer carga)
        console.log('Cargando datos desde la API...');
        const initialData = await loadInitialState();
        
        if (initialData) {
          // Actualizar el estado con los datos cargados
          dispatchBase({ type: 'SET_ALL_DATA', payload: initialData });
          console.log('Datos cargados correctamente desde la API');
        } else {
          console.warn('No se pudieron cargar datos desde la API, usando datos iniciales');
        }
      } catch (err) {
        console.error('Error al inicializar la aplicación:', err);
        setError('Error al cargar los datos. Por favor, recarga la página.');
      } finally {
        // Finalizar carga, independientemente del resultado
        setIsLoading(false);
      }
    };
    
    initializeApp();
  }, []);

  // Inicializar audio de notificación global (se usa cuando llega una nueva notificación)
  useEffect(() => {
    // (Temporal) Desactivar sonido global hasta tener una ruta de audio válida
    globalNotifAudioRef.current = null;
  }, []);

  useEffect(() => {
    latestUsersRef.current = Array.isArray(state.users) ? state.users : [];
  }, [state.users]);

  useEffect(() => {
    if (!state.isAuthenticated) return undefined;

    let cancelled = false;

    const pollUsers = async () => {
      try {
        const usersResponse = await loadUsers();
        if (cancelled || !Array.isArray(usersResponse)) return;

        const users = (usersResponse || []).map(u => ({
          ...u,
          name: u.name || u.nombre,
          telefono: u.telefono || u.phone,
          phone: u.phone || u.telefono,
          canDeleteHistory: u.canDeleteHistory !== undefined
            ? u.canDeleteHistory
            : (u.can_delete_history !== undefined ? u.can_delete_history : false),
          photoUrl: u.photoUrl || u.photo_url || '',
          shopId: (() => {
            const rawShopId = u.shopId !== undefined
              ? u.shopId
              : (u.shop_id !== undefined ? u.shop_id : undefined);

            // Si la API no envía el campo, dejar undefined para poder conservar el valor previo
            if (rawShopId === undefined) return undefined;

            // Si la API lo envía como null/vacío, significa "no asignado"
            if (rawShopId == null || rawShopId === '') return null;

            const n = Number(rawShopId);
            return Number.isNaN(n) ? null : n;
          })(),
        }));

        const prevUsers = Array.isArray(latestUsersRef.current) ? latestUsersRef.current : [];
        const usersMap = new Map();
        prevUsers.forEach((u) => {
          const id = u?.id;
          if (id != null) usersMap.set(String(id), u);
        });
        users.forEach((u) => {
          const id = u?.id;
          if (id == null) return;
          const key = String(id);
          const prev = usersMap.get(key);
          if (!prev) {
            usersMap.set(key, u);
            return;
          }

          const merged = { ...prev, ...u };
          // Solo conservar shopId previo si la API NO envió el campo (undefined).
          // Si la API envía null, respetamos null (desasignado).
          if (u.shopId === undefined && prev.shopId !== undefined) {
            merged.shopId = prev.shopId;
          }
          usersMap.set(key, merged);
        });
        const mergedUsers = Array.from(usersMap.values());

        dispatchBase({
          type: 'SET_ALL_DATA',
          payload: { users: mergedUsers },
        });
      } catch (e) {
        console.warn('Error durante el polling de usuarios (se continuará en el siguiente ciclo):', e?.message || e);
      }
    };

    void pollUsers();

    const intervalId = setInterval(pollUsers, 30000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [state.isAuthenticated]);

  // POLLING global: volver a sincronizar citas frecuentemente para evitar solapamientos de horarios
  useEffect(() => {
    let cancelled = false;

    const pollData = async () => {
      try {
        const freshAppointments = await loadAppointments();
        if (!cancelled && Array.isArray(freshAppointments)) {
          // Solo refrescamos citas; el resto de datos se mantiene
          dispatchBase({
            type: 'SET_ALL_DATA',
            payload: { appointments: freshAppointments },
          });
        }
      } catch (e) {
        console.warn('Error durante el polling de citas (se continuará en el siguiente ciclo):', e?.message || e);
      }
    };

    // Iniciar intervalo de polling de citas (cada ~3 segundos)
    const intervalId = setInterval(pollData, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  // POLLING global: refrescar servicios y asignaciones barber<->servicios para reflejar cambios sin recargar
  useEffect(() => {
    if (!state.isAuthenticated) return undefined;

    let cancelled = false;

    const pollServicesAndAssignments = async () => {
      try {
        const [freshServices, barberServicesRows] = await Promise.all([
          serviceApi.getAll(),
          barberServicesApi.getAll(),
        ]);

        if (cancelled) return;

        // Normalizar servicios al formato esperado por el frontend
        const normalizedServices = (freshServices || []).map(s => ({
          ...s,
          shopId: s.shopId !== undefined ? s.shopId : (s.shop_id !== undefined ? s.shop_id : null),
          basePrice: s.basePrice !== undefined ? s.basePrice : (s.price !== undefined ? s.price : 0),
          baseDurationMinutes: s.baseDurationMinutes !== undefined ? s.baseDurationMinutes : (s.duration !== undefined ? s.duration : 0),
        }));

        // Construir mapa barberServices: { barberId: [serviceId, ...] }
        const barberServicesMap = {};
        (barberServicesRows || []).forEach(row => {
          const barberId = row.barber_id ?? row.barberId;
          const serviceId = row.service_id ?? row.serviceId;
          if (barberId == null || serviceId == null) return;
          if (!barberServicesMap[barberId]) barberServicesMap[barberId] = [];
          if (!barberServicesMap[barberId].some(id => String(id) === String(serviceId))) {
            barberServicesMap[barberId].push(serviceId);
          }
        });

        dispatchBase({
          type: 'SET_ALL_DATA',
          payload: {
            services: normalizedServices,
            barberServices: barberServicesMap,
          },
        });
      } catch (e) {
        console.warn('Error durante el polling de servicios/asignaciones (se continuará en el siguiente ciclo):', e?.message || e);
      }
    };

    // Primera carga inmediata para minimizar desfase
    void pollServicesAndAssignments();

    // Intervalo cada ~20 segundos (suficiente para “casi tiempo real” sin saturar)
    const intervalId = setInterval(pollServicesAndAssignments, 20000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [state.isAuthenticated]);

  // POLLING global: volver a sincronizar productos para que cliente/admin vean cambios sin recargar
  useEffect(() => {
    let cancelled = false;

    const pollProducts = async () => {
      try {
        const freshProducts = await loadProducts();
        if (!cancelled && Array.isArray(freshProducts)) {
          dispatchBase({
            type: 'SET_ALL_DATA',
            payload: { products: freshProducts },
          });
        }
      } catch (e) {
        console.warn('Error durante el polling de productos (se continuará en el siguiente ciclo):', e?.message || e);
      }
    };

    // Primera carga inmediata para minimizar desfase visual
    void pollProducts();

    // Intervalo cada ~10 segundos (suficiente para sensación "tiempo real" sin saturar el servidor)
    const intervalId = setInterval(pollProducts, 10000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  // POLLING global de notificaciones para el usuario logueado (sonido + toast)
  useEffect(() => {
    if (!state.isAuthenticated || !state.currentUser?.id) return undefined;

    let cancelled = false;
    const userId = state.currentUser.id;

    const pollNotifications = async () => {
      try {
        const list = await loadNotificationsForUser(userId);
        if (cancelled || !Array.isArray(list)) return;

        const newCount = list.length;
        const prevCount = globalNotifCountRef.current || 0;

        if (newCount > prevCount) {
          // Toast global reutilizando el sistema de Notification existente
          dispatch({
            type: 'SHOW_NOTIFICATION',
            payload: {
              message: 'Tienes una nueva notificación de tu barbería.',
              type: 'info',
            },
          });
        }

        globalNotifCountRef.current = newCount;
      } catch (e) {
        console.warn('Error durante el polling global de notificaciones:', e?.message || e);
      }
    };

    // Primera comprobación inmediata
    void pollNotifications();

    // Intervalo cada ~3 segundos para sensación más "en tiempo real" sin saturar el servidor
    const intervalId = setInterval(pollNotifications, 3000);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [state.isAuthenticated, state.currentUser?.id, dispatch]);

  const renderCurrentView = () => {
    // Depurar el estado actual para diagnosticar problemas
    console.log('RenderCurrentView - Estado actual:', {
      isAuthenticated: state.isAuthenticated,
      currentView: state.currentView,
      currentUser: state.currentUser ? {
        id: state.currentUser.id,
        role: state.currentUser.role || state.currentUser.rol,
        name: state.currentUser.name || state.currentUser.nombre
      } : 'No hay usuario'
    });
    
    // Si no hay autenticación, mostrar login
    if (!state.isAuthenticated) {
      console.log('No autenticado - mostrando LoginPage');
      return <LoginPage />;
    }
    
    // Seguridad adicional: si currentUser es null o undefined
    if (!state.currentUser) {
      console.error('Error: Usuario autenticado pero sin datos de usuario');
      return <LoginPage />;
    }
    
    // Usar switch para determinar la vista según currentView
    console.log('Usuario autenticado - mostrando vista:', state.currentView);
    
    try {
      switch (state.currentView) {
        case 'clientDashboard':
          return <ClientDashboard />;
        case 'barberDashboard':
          return <BarberDashboard />;
        case 'ownerDashboard':
          return <OwnerDashboard />;
        default:
          console.warn('Vista no reconocida:', state.currentView, '- mostrando LoginPage');
          return <LoginPage />;
      }
    } catch (error) {
      console.error('Error al renderizar la vista:', error);
      return <div className="p-4 bg-red-100 text-red-700 rounded-md">
        <h2 className="text-xl font-bold">Error al cargar la vista</h2>
        <p>{error.message}</p>
      </div>;
    }
  };

  // Mostrar un indicador de carga mientras se inicializan los datos
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-lg font-semibold text-gray-700">Cargando datos...</p>
        </div>
      </div>
    );
  }
  
  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <ErrorBoundary>
        <div className="min-h-screen bg-slate-100">
          {state.notification && <Notification message={state.notification.message} type={state.notification.type} id={state.notification.id} />}
          {state.modal && (
            <Modal
              title={state.modal.props?.title}
              onClose={() => dispatch({ type: 'HIDE_MODAL' })}
            >
              {state.modal.content}
            </Modal>
          )}
          {renderCurrentView()}
          {/* Widget de chat flotante, visible para cualquier usuario autenticado */}
          <ChatWidget />
        </div>
      </ErrorBoundary>
    </AppContext.Provider>
  );
};

export default App;