import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import BarberShopInfoView from './BarberShopInfoView';
import Modal from './ui/Modal';
import api from '../services/apiService';

const SHOP_CATEGORY_OPTIONS = [
  { key: 'barberia', label: 'Barbería' },
  { key: 'salon_belleza', label: 'Salón de Belleza' },
  { key: 'spa_estetica', label: 'Spa / Estética' },
  { key: 'unas', label: 'Uñas' },
  { key: 'depilacion', label: 'Depilación' },
];

const normalizeCategoriesLocal = (raw) => {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map(v => String(v || '').trim())
      .filter(Boolean);
  }
  return [];
};

const OwnerBarberShopsManagement = () => {
  const { state, dispatch } = useContext(AppContext);
  const owner = state.currentUser;
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showBarberAssign, setShowBarberAssign] = useState(null); // shopId o null
  const [selectedShop, setSelectedShop] = useState(null);
  const [form, setForm] = useState({ 
    name: '', 
    address: '', 
    sector: '',
    city: '', 
    phone: '',
    email: '',
    openHours: '',
    description: '',
    instagram: '',
    facebook: '',
    latitude: '',
    longitude: '',
    categories: ['barberia']
  });
  const [ownerForm, setOwnerForm] = useState({
    ownerName: '',
    ownerEmail: '',
    ownerPassword: '',
    ownerPasswordConfirm: '',
    ownerIsAlsoBarber: true,
  });
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedBarbers, setSelectedBarbers] = useState([]);
  const [barberSearchTerm, setBarberSearchTerm] = useState('');
  const [showServicesByBarberShop, setShowServicesByBarberShop] = useState(null);
  const [selectedServicesByBarber, setSelectedServicesByBarber] = useState({});
  const [newShopService, setNewShopService] = useState({ name: '', price: '', duration: '', description: '' });
  const [serviceFormError, setServiceFormError] = useState('');
  
  // Estado para el manejo de fotos
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [coverPhotoURL, setCoverPhotoURL] = useState('');

  const isAdmin = ((owner?.role || owner?.rol || '') + '').toLowerCase().includes('admin');

  // Saber si este dueño ya tiene al menos una barbería registrada
  const ownerHasAnyShop = (state.barberShops || []).some(s => s.ownerId === owner?.id);

  // Filtrar barberías visibles para este usuario con búsqueda y filtros
  const filterShops = () => {
    let shops = (state.barberShops || []).filter(s => isAdmin ? true : s.ownerId === owner?.id);
    
    // Aplicar búsqueda
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase().trim();
      shops = shops.filter(shop => 
        shop.name?.toLowerCase().includes(search) ||
        shop.city?.toLowerCase().includes(search) ||
        shop.address?.toLowerCase().includes(search)
      );
    }
    
    // Aplicar filtro por ciudad si no es 'all'
    if (filter !== 'all') {
      shops = shops.filter(shop => shop.city === filter);
    }
    
    return shops;
  };
  
  const myShops = filterShops();

  // Obtener todas las ciudades para el filtro (solo de las barberías visibles)
  const cities = [...new Set((state.barberShops || [])
    .filter(s => isAdmin ? true : s.ownerId === owner?.id)
    .map(shop => shop.city)
    .filter(Boolean))];

  const openUrlInNewTab = (url) => {
    let newWin = null;
    try {
      newWin = window.open('about:blank', '_blank');
    } catch {
      newWin = null;
    }

    if (!newWin || newWin === window) {
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'El navegador bloqueó la ventana emergente. Permite los popups para abrir el enlace.', type: 'error' }
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
    const sector = shop?.sector;
    const city = shop?.city;
    const destination = [address, sector, city].filter(Boolean).join(', ').trim();
    const shopLat = shop?.latitude ?? shop?.lat ?? shop?.schedule?.latitude ?? shop?.schedule?.lat;
    const shopLng = shop?.longitude ?? shop?.lng ?? shop?.schedule?.longitude ?? shop?.schedule?.lng;

    if (!destination) {
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Este negocio no tiene dirección registrada.', type: 'error' },
      });
      return;
    }

    const destParam = (shopLat != null && shopLng != null && String(shopLat) !== '' && String(shopLng) !== '')
      ? `${shopLat},${shopLng}`
      : destination;

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
        payload: { message: 'Este negocio no tiene WhatsApp configurado.', type: 'error' }
      });
      return;
    }

    openUrlInNewTab(url);
  };

  // Handlers
  const handleOpenAdd = () => {
    setForm({ 
      name: '', 
      address: '', 
      sector: '',
      city: '', 
      phone: '',
      email: '',
      openHours: '',
      description: '',
      instagram: '',
      facebook: '',
      latitude: '',
      longitude: '',
      categories: ['barberia']
    });
    setOwnerForm({
      ownerName: '',
      ownerEmail: '',
      ownerPassword: '',
      ownerPasswordConfirm: '',
      ownerIsAlsoBarber: true,
    });
    setError('');
    setCoverPhoto(null);
    setCoverPhotoURL('');
    setShowAdd(true);
  };
  
  const handleOpenEdit = (shop) => {
    const schedule = shop?.schedule || {};
    setForm({ 
      name: shop.name || '', 
      address: shop.address || '', 
      city: shop.city || '', 
      phone: shop.phone || '',
      email: shop.email || '',
      openHours: shop.openHours || '',
      description: shop.description || '',
      instagram: shop.instagram || '',
      facebook: shop.facebook || '',
      sector: shop.sector || schedule.sector || '',
      latitude: (shop.latitude ?? schedule.latitude ?? schedule.lat ?? '') + '',
      longitude: (shop.longitude ?? schedule.longitude ?? schedule.lng ?? '') + '',
      categories: (() => {
        const incoming = shop?.categories ?? schedule?.categories;
        const arr = normalizeCategoriesLocal(incoming);
        return arr.length ? arr : ['barberia'];
      })()
    });
    setSelectedShop(shop);
    setError('');
    
    // Si la barbería tiene una foto de portada, la mostramos
    if (state.barberShopPhotos?.[shop.id]?.[0]) {
      setCoverPhotoURL(state.barberShopPhotos[shop.id][0]);
    } else {
      setCoverPhotoURL('');
    }
    setCoverPhoto(null); // Reiniciamos la foto para que no se envíe una nueva si el usuario no cambia nada
    
    setShowEdit(true);
  };
  
  // Manejador para cuando el usuario selecciona una foto
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validar que sea una imagen
    if (!file.type.startsWith('image/')) {
      setError('El archivo seleccionado debe ser una imagen (JPG, PNG, etc.)');
      return;
    }
    
    // Validar tamaño máximo (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('La imagen debe ser menor a 10MB');
      return;
    }
    
    setCoverPhoto(file);
    
    // Crear una URL temporal para mostrar la vista previa
    const objectUrl = URL.createObjectURL(file);
    setCoverPhotoURL(objectUrl);
    
    // Limpiar mensaje de error si hay alguno
    if (error) setError('');
    
    console.log('Archivo seleccionado correctamente:', file.name);
  };
  const handleCloseModal = () => {
    setShowAdd(false);
    setShowEdit(false);
    setSelectedShop(null);
    setError('');
  };
  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleToggleCategory = (key) => {
    setForm(prev => {
      const current = Array.isArray(prev.categories) ? prev.categories : normalizeCategoriesLocal(prev.categories);
      const nextSet = new Set(current);
      if (nextSet.has(key)) nextSet.delete(key);
      else nextSet.add(key);
      const next = Array.from(nextSet);
      return { ...prev, categories: next.length ? next : ['barberia'] };
    });
  };

  const buildShopLocationQuery = (data) => {
    const addr = data?.address;
    const sector = data?.sector;
    const city = data?.city;
    return [addr, sector, city, 'República Dominicana'].filter(Boolean).join(', ');
  };

  const handleCaptureExactLocation = async () => {
    setError('');
    if (!navigator?.geolocation) {
      return setError('Tu navegador no soporta geolocalización. No se puede capturar la ubicación exacta.');
    }

    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && !isLocalhost) {
      return setError('La geolocalización requiere HTTPS. Abre la app por https o usa localhost.');
    }

    if (navigator?.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        if (perm?.state === 'denied') {
          return setError('Debes permitir la ubicación en el navegador para capturar la dirección exacta.');
        }
      } catch (e) {
        // ignorar (no todos los navegadores soportan el query de permisos para geolocalización)
      }
    }

    const getPosition = (options) => new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });

    const trySetCoords = (pos) => {
      const lat = pos?.coords?.latitude;
      const lng = pos?.coords?.longitude;
      if (lat == null || lng == null) {
        setError('No se pudo obtener la ubicación exacta. Activa la ubicación e inténtalo de nuevo.');
        return false;
      }
      setForm(prev => ({
        ...prev,
        latitude: String(lat),
        longitude: String(lng),
      }));
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: { message: 'Ubicación exacta capturada correctamente.', type: 'success' },
      });
      return true;
    };

    const handleGeoError = (err) => {
      const code = err?.code;
      if (code === 1) {
        setError('Debes permitir la ubicación para capturar la dirección exacta.');
        return;
      }
      if (code === 3) {
        setError('Tiempo de espera agotado al capturar ubicación. Intenta de nuevo o cambia a una red Wi‑Fi.');
        return;
      }
      if (code === 2) {
        setError('No se pudo obtener la ubicación (no disponible). Verifica GPS/Wi‑Fi e inténtalo de nuevo.');
        return;
      }
      setError('No se pudo capturar la ubicación exacta. Verifica la configuración e inténtalo de nuevo.');
    };

    const optionsHigh = { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 };
    const optionsLow = { enableHighAccuracy: false, timeout: 25000, maximumAge: 60000 };

    try {
      const pos = await getPosition(optionsHigh);
      if (trySetCoords(pos)) return;
    } catch (err) {
      const code = err?.code;
      if (code === 1) {
        handleGeoError(err);
        return;
      }

      try {
        const pos2 = await getPosition(optionsLow);
        if (trySetCoords(pos2)) return;
      } catch (err2) {
        handleGeoError(err2);
      }
    }
  };
  const handleOwnerChange = e => {
    const { name, value, type, checked } = e.target;
    setOwnerForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };
  // Función para simular la subida de una imagen (versión para desarrollo)
  const uploadImage = async (file) => {
    try {
      setUploading(true);
      setError('');
      
      // Validar el archivo
      if (!file || !file.type || !file.type.startsWith('image/')) {
        throw new Error('Tipo de archivo no válido. Solo se permiten imágenes.');
      }
      
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('La imagen es demasiado grande. Máximo 5MB.');
      }
      
      console.log('Procesando imagen:', {
        nombre: file.name,
        tamaño: Math.round(file.size / 1024) + 'KB',
        tipo: file.type
      });
      
      // Simular un pequeño retraso como en una carga real
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Crear una URL local para la imagen usando FileReader
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          const imageUrl = e.target.result;
          console.log('Imagen procesada correctamente');
          resolve({
            url: imageUrl,
            filename: file.name
          });
        };
        
        reader.onerror = function(error) {
          console.error('Error al procesar la imagen:', error);
          reject(new Error('Error al procesar la imagen'));
        };
        
        // Leer el archivo como una URL de datos
        reader.readAsDataURL(file);
      });
    } catch (err) {
      // Manejar cualquier error
      console.error('ERROR COMPLETO:', err);
      setError(err.message || 'Error al subir la imagen');
      return null;
    }
  };
  // Función handleDelete mejorada
const handleDelete = (shopId) => {
    if (confirm(`¿Está seguro que desea eliminar este negocio?`)) {
      console.log('Ejecutando eliminación:', shopId);
      
      try {
        // Dispatch para eliminar la barbería
        dispatch({ 
          type: 'DELETE_BARBERSHOP', 
          payload: { id: shopId } 
        });
  
        // Actualizar la UI
        if (selectedShop && selectedShop.id === shopId) {
          setSelectedShop(null);
        }
        
        alert('Negocio eliminado correctamente');
      } catch (e) {
        console.error('Error al eliminar:', e);
        alert('Error al eliminar el negocio');
      }
    }
  };

  // Manejo de asignación de barberos
  const handleOpenBarberAssign = (shop) => {
    setShowBarberAssign(shop.id);
    setBarberSearchTerm('');
    // Inicializar los barberos ya asignados a esta barbería
    const assignedBarberIds = state.users
      .filter(u => {
        const role = ((u.role || u.rol || '') + '').toLowerCase();
        if (!role.includes('barber')) return false;
        const rawShopId = (u.shopId !== undefined ? u.shopId : (u.shop_id !== undefined ? u.shop_id : null));
        const isAssignedByUser = rawShopId != null && String(rawShopId) === String(shop.id);
        const isAssignedByShopList = (shop.barberIds || []).some(id => String(id) === String(u.id));
        return isAssignedByUser || isAssignedByShopList;
      })
      .map(b => b.id);
    setSelectedBarbers(assignedBarberIds);
  };
  
  const handleBarberSelection = (barberId) => {
    setSelectedBarbers(prev => {
      if (prev.includes(barberId)) {
        return prev.filter(id => id !== barberId);
      } else {
        return [...prev, barberId];
      }
    });
  };
  
  const handleSaveBarberAssignments = () => {
    if (!showBarberAssign) return;
    
    // Obtener la barbería actual
    const shop = state.barberShops.find(s => String(s.id) === String(showBarberAssign));
    if (!shop) return;
    
    // Actualizar la barbería con los nuevos barberos asignados
    dispatch({
      type: 'EDIT_BARBERSHOP',
      payload: {
        ...shop,
        barberIds: selectedBarbers
      }
    });
    
    // Asignar/desasignar barberos a la barbería
    selectedBarbers.forEach(barberId => {
      dispatch({
        type: 'UPDATE_USER',
        payload: {
          id: barberId,
          shopId: shop.id
        }
      });
    });
    
    // Eliminar asignación para barberos no seleccionados que estaban asignados
    state.users
      .filter(u => {
        const role = ((u.role || u.rol || '') + '').toLowerCase();
        if (!role.includes('barber')) return false;
        const rawShopId = (u.shopId !== undefined ? u.shopId : (u.shop_id !== undefined ? u.shop_id : null));
        const isInThisShop = rawShopId != null && String(rawShopId) === String(shop.id);
        const isSelected = selectedBarbers.some(id => String(id) === String(u.id));
        return isInThisShop && !isSelected;
      })
      .forEach(barber => {
        dispatch({
          type: 'UPDATE_USER',
          payload: {
            id: barber.id,
            shopId: null
          }
        });
      });
      
    dispatch({
      type: 'SHOW_NOTIFICATION',
      payload: {
        message: 'Profesionales asignados correctamente',
        type: 'success'
      }
    });
    
    setShowBarberAssign(null);
  };

  // Auto-asignar al dueño actual como barbero usando su perfil de barbero existente (mismo email)
  const handleOwnerQuickAssignAsBarber = () => {
    if (!owner || !showBarberAssign) return;

    const shop = state.barberShops.find(s => s.id === showBarberAssign);
    if (!shop) return;
    
    // Usar siempre el propio usuario actual como perfil de barbero
    const ownerRoleRaw = (owner.role || owner.rol || '').toString();
    const ownerRoleLower = ownerRoleRaw.toLowerCase();

    // Si ya está asignado a otra barbería, pedir confirmación antes de moverlo
    if (owner.shopId && owner.shopId !== shop.id) {
      const previousShop = state.barberShops.find(s => s.id === owner.shopId);
      const confirmMove = window.confirm(
        `Ya estás asignado como profesional en "${previousShop?.name || 'otro negocio'}".\n\n¿Deseas asignarte ahora a "${shop.name}"?`
      );
      if (!confirmMove) return;
    }

    // Marcarlo como seleccionado en este modal
    setSelectedBarbers(prev => (
      prev.includes(owner.id) ? prev : [...prev, owner.id]
    ));

    // Construir nuevo rol asegurando que incluya "barber"
    let newRole = ownerRoleRaw || 'barber';
    if (!ownerRoleLower.includes('barber')) {
      // Si ya tiene algún rol (owner, admin, etc.), concatenar
      newRole = ownerRoleRaw ? `${ownerRoleRaw} barber` : 'barber';
    }

    // Actualizar su shopId y rol en la BD; los barberIds de la barbería se actualizan al guardar
    dispatch({
      type: 'UPDATE_USER',
      payload: {
        id: owner.id,
        shopId: shop.id,
        role: newRole
      }
    });

    dispatch({
      type: 'SHOW_NOTIFICATION',
      payload: {
        message: `Te has marcado como profesional en "${shop.name}". No olvides guardar las asignaciones.`,
        type: 'success'
      }
    });
  };

  const handleOpenServicesByBarber = (shop) => {
    setShowServicesByBarberShop(shop.id);
    const shopBarbers = state.users
      .filter(u => {
        const role = ((u.role || u.rol || '') + '').toLowerCase();
        if (!role.includes('barber')) return false;
        return u.shopId === shop.id || (shop.barberIds || []).includes(u.id);
      });
    const initial = {};
    shopBarbers.forEach(barber => {
      initial[barber.id] = [...(state.barberServices[barber.id] || [])];
    });
    setSelectedServicesByBarber(initial);
  };

  const toggleServiceForBarber = (barberId, serviceId) => {
    setSelectedServicesByBarber(prev => {
      const current = new Set(prev[barberId] || []);
      if (current.has(serviceId)) {
        current.delete(serviceId);
      } else {
        current.add(serviceId);
      }
      return {
        ...prev,
        [barberId]: Array.from(current)
      };
    });
  };

  const handleSaveServicesByBarber = async () => {
    if (!showServicesByBarberShop) return;
    const shop = state.barberShops.find(s => s.id === showServicesByBarberShop);
    if (!shop) {
      setShowServicesByBarberShop(null);
      return;
    }

    const shopBarbers = state.users
      .filter(u => {
        const role = ((u.role || u.rol || '') + '').toLowerCase();
        if (!role.includes('barber')) return false;
        return u.shopId === shop.id || (shop.barberIds || []).includes(u.id);
      });
    const barberIds = shopBarbers.map(b => b.id);

    // Fusionar los servicios seleccionados en esta sesión con los que ya había en el estado
    const mergedServicesByBarber = {};
    barberIds.forEach(id => {
      mergedServicesByBarber[id] = [
        ...((selectedServicesByBarber[id] !== undefined
          ? selectedServicesByBarber[id]
          : state.barberServices[id]) || []),
      ];
    });

    // Guardar en backend
    try {
      await api.barberServices.saveByShop(shop.id, mergedServicesByBarber);
    } catch (error) {
      console.error('Error al guardar servicios por barbero en backend:', error);
      // Aun así actualizar estado local para no perder cambios en la sesión
    }

    dispatch({
      type: 'SET_BARBER_SERVICES_FOR_BARBERS',
      payload: {
        barberIds,
        servicesByBarber: mergedServicesByBarber
      }
    });

    dispatch({
      type: 'SHOW_NOTIFICATION',
      payload: {
        message: 'Servicios por profesional actualizados correctamente',
        type: 'success'
      }
    });

    setShowServicesByBarberShop(null);
  };

  // Mostrar mensaje de carga si está subiendo
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validaciones básicas
    if (!form.name?.trim()) return setError('El nombre es obligatorio');
    if (!form.address?.trim()) return setError('La dirección es obligatoria');
    if (!form.city?.trim()) return setError('La ciudad es obligatoria');
    if (!String(form.latitude || '').trim() || !String(form.longitude || '').trim()) {
      return setError('Debes capturar la ubicación exacta (GPS) antes de guardar.');
    }
    const isCreating = !selectedShop;
    // Solo necesitamos datos del dueño cuando es la primera barbería de este dueño
    const needsOwnerData = isCreating && !ownerHasAnyShop;

    // Validaciones de datos del dueño solo si se necesitan
    if (needsOwnerData) {
      if (!ownerForm.ownerName.trim()) return setError('El nombre del dueño es obligatorio');
      if (!ownerForm.ownerEmail.trim()) return setError('El email del dueño es obligatorio');
      if (!ownerForm.ownerPassword) return setError('La contraseña del dueño es obligatoria');
      if (ownerForm.ownerPassword.length < 6) return setError('La contraseña del dueño debe tener al menos 6 caracteres');
      if (ownerForm.ownerPassword !== ownerForm.ownerPasswordConfirm) return setError('Las contraseñas del dueño no coinciden');
    }
    
    try {
      console.log('Iniciando envío del formulario...');
      
      const shopId = isCreating ? null : selectedShop.id;
      
      // Preparar los datos a enviar
      const shopData = {
        ...form,
        ...(shopId ? { id: shopId } : {}),
        ownerId: owner.id,
        ...(needsOwnerData ? {
          ownerName: ownerForm.ownerName,
          ownerEmail: ownerForm.ownerEmail,
          ownerPassword: ownerForm.ownerPassword,
          ownerIsAlsoBarber: ownerForm.ownerIsAlsoBarber,
        } : {}),
        // Guardar también la URL de foto en el backend
        photoUrl: coverPhoto ? '' : coverPhotoURL || ''
      };
      
      // Subir imagen primero si hay una nueva seleccionada
      let photoUrl = '';
      if (coverPhoto) {
        setError('');
        console.log('Subiendo imagen...');
        
        // Crear y enviar el FormData directamente
        const formData = new FormData();
        formData.append('image', coverPhoto);
        
        try {
          // Usamos la ruta relativa como estaba originalmente
          const imgResponse = await fetch('/api/upload', {
            method: 'POST',
            body: formData
          });
          
          if (imgResponse.ok) {
            const imgData = await imgResponse.json();
            photoUrl = imgData.url;
            console.log('Imagen subida con éxito:', photoUrl);
          } else {
            console.error('Error al subir imagen:', imgResponse.status);
            return setError('Error al subir la imagen. Intenta nuevamente.');
          }
        } catch (imgErr) {
          console.error('Error en carga de imagen:', imgErr);
          return setError('Error al subir la imagen. Intenta nuevamente.');
        }
      } else if (coverPhotoURL && !coverPhoto) {
        // Si hay una URL pero no hay archivo nuevo, usar la URL existente
        photoUrl = coverPhotoURL;
      }
      
      // Actualizar el estado con la nueva/actualizada barbería
      // Guardar en backend para persistir (incluye sector/lat/lng dentro de schedule)
      const payloadToSave = {
        ...shopData,
        photoUrl,
      };

      let saved;
      if (isCreating) {
        saved = await api.barberShops.create(payloadToSave);
      } else {
        saved = await api.barberShops.update(String(selectedShop.id), payloadToSave);
      }

      // Normalizar respuesta (schedule puede traer city/phone/etc)
      const schedule = saved?.schedule || {};
      const normalizedSaved = {
        ...saved,
        ownerId: saved?.ownerId !== undefined ? saved.ownerId : (saved?.owner_id !== undefined ? saved.owner_id : owner.id),
        city: saved?.city || schedule.city || payloadToSave.city || '',
        sector: saved?.sector || schedule.sector || payloadToSave.sector || '',
        phone: saved?.phone || schedule.phone || payloadToSave.phone || '',
        whatsappLink: saved?.whatsappLink || schedule.whatsappLink || payloadToSave.whatsappLink || '',
        openHours: saved?.openHours || schedule.openHours || payloadToSave.openHours || '',
        description: saved?.description || schedule.description || payloadToSave.description || '',
        email: saved?.email || schedule.email || payloadToSave.email || '',
        photoUrl: saved?.photoUrl || schedule.photoUrl || photoUrl || '',
        latitude: saved?.latitude ?? schedule.latitude ?? schedule.lat ?? payloadToSave.latitude ?? '',
        longitude: saved?.longitude ?? schedule.longitude ?? schedule.lng ?? payloadToSave.longitude ?? '',
        categories: (() => {
          const incoming = saved?.categories ?? schedule?.categories ?? payloadToSave.categories;
          const arr = normalizeCategoriesLocal(incoming);
          return arr.length ? arr : ['barberia'];
        })(),
      };

      if (isCreating) {
        dispatch({ type: 'ADD_BARBERSHOP', payload: normalizedSaved });
        dispatch({
          type: 'SHOW_NOTIFICATION',
          payload: { message: 'Negocio añadido correctamente', type: 'success' }
        });
      } else {
        dispatch({ type: 'EDIT_BARBERSHOP', payload: normalizedSaved });
        dispatch({
          type: 'SHOW_NOTIFICATION',
          payload: { message: 'Negocio actualizado correctamente', type: 'success' }
        });
      }
      
      // Si hay una foto, actualizar también las fotos de la barbería
      if (photoUrl) {
        const finalShopIdForPhoto = normalizedSaved?.id ?? shopId;
        dispatch({
          type: 'UPDATE_BARBERSHOP_PHOTO',
          payload: {
            shopId: finalShopIdForPhoto,
            photoUrl: photoUrl
          }
        });
      }
      
      // Limpiar las URLs temporales
      if (coverPhotoURL && coverPhoto) {
        URL.revokeObjectURL(coverPhotoURL);
      }
      
      // Cerrar modal y reiniciar estado
      handleCloseModal();
      
    } catch (err) {
      console.error('Error en formulario:', err);
      setError(err.message || 'Ocurrió un error inesperado');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Mis Negocios</h2>
        <button 
          className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded shadow text-sm font-semibold flex items-center" 
          onClick={handleOpenAdd}
          data-action="add"
          data-component-name="OwnerBarberShopsManagement"
        >
          <i className="fas fa-plus-circle mr-2"></i>Añadir Negocio
        </button>
      </div>
      
      {/* Búsqueda y filtros */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nombre, ciudad o dirección..."
              className="w-full p-2 pl-10 border border-slate-300 rounded-md"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <i className="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"></i>
          </div>
        </div>
        
        <div className="w-full md:w-48">
          <select 
            className="w-full p-2 border border-slate-300 rounded-md bg-white"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todas las ciudades</option>
            {cities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {myShops.map(shop => (
          <div key={shop.id} className="bg-white border border-slate-200 rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col">
            {/* Cabecera con imagen */}
            <div className="h-32 bg-gradient-to-r from-indigo-500 to-purple-600 relative">
              {/* Si hay foto de portada, mostrarla */}
              {state.barberShopPhotos?.[shop.id]?.[0] && (
                <img 
                  src={state.barberShopPhotos[shop.id][0]} 
                  alt={shop.name} 
                  className="w-full h-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                <h3 className="font-bold text-xl text-white text-center px-4 drop-shadow-md">{shop.name}</h3>
              </div>
            </div>
            
            {/* Contenido */}
            <div className="p-5 flex-grow flex flex-col">
              <div className="mb-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenDirectionsToShop(shop);
                  }}
                  className="group inline-flex items-start gap-2 text-left"
                  title="Abrir ruta en Google Maps"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 text-red-600 shrink-0 mt-1" fill="currentColor" aria-hidden="true">
                    <path d="M12 2c3.87 0 7 3.13 7 7 0 5.25-7 13-7 13S5 14.25 5 9c0-3.87 3.13-7 7-7zm0 9.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />
                  </svg>
                  <span className="text-sm text-slate-700 leading-snug group-hover:underline break-words">
                    {[shop.address, shop.sector, shop.city].filter(Boolean).join(', ')}
                  </span>
                </button>
              </div>

              <div className="mb-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleOpenWhatsAppToShop(shop);
                  }}
                  className="group inline-flex items-center gap-2 text-left"
                  title="Abrir WhatsApp"
                >
                  <svg viewBox="0 0 32 32" className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" aria-hidden="true">
                    <path d="M19.11 17.45c-.2-.1-1.19-.59-1.38-.65-.18-.07-.32-.1-.46.1-.14.2-.53.65-.65.79-.12.14-.24.16-.44.06-.2-.1-.86-.32-1.64-1.02-.6-.54-1.01-1.2-1.13-1.4-.12-.2-.01-.31.09-.41.09-.09.2-.24.3-.36.1-.12.14-.2.2-.34.06-.14.03-.26-.02-.36-.05-.1-.46-1.11-.63-1.52-.17-.4-.35-.35-.46-.35h-.39c-.14 0-.36.05-.55.26-.2.2-.72.7-.72 1.7 0 1 .74 1.96.84 2.1.1.14 1.46 2.22 3.53 3.11.49.21.88.34 1.18.43.5.16.95.14 1.31.09.4-.06 1.19-.49 1.36-.96.17-.47.17-.87.12-.96-.05-.1-.18-.16-.38-.26z" />
                    <path d="M16 3C9.37 3 4 8.37 4 15c0 2.34.67 4.54 1.83 6.4L4 29l7.78-1.76C13.55 28.1 14.75 28.5 16 28.5c6.63 0 12-5.37 12-12S22.63 3 16 3zm0 22.5c-1.18 0-2.33-.29-3.36-.84l-.8-.42-4.62 1.05 1-4.5-.52-.83C6.89 18.5 6.5 16.77 6.5 15 6.5 9.76 10.76 5.5 16 5.5S25.5 9.76 25.5 15 21.24 25.5 16 25.5z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-800 group-hover:underline">{shop.phone}</span>
                </button>
                <div className="ml-6 text-slate-500 text-xs break-all">{shop.email || 'Sin email'}</div>
              </div>

              {(() => {
                const raw = shop?.categories ?? shop?.schedule?.categories;
                const cats = normalizeCategoriesLocal(raw);
                if (!cats.length) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {cats.map(cat => {
                      const label = SHOP_CATEGORY_OPTIONS.find(o => o.key === cat)?.label || cat;
                      return (
                        <span key={cat} className="inline-flex items-center px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                          {label}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
              
              {shop.openHours && (
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-100 text-amber-500 mr-2">
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                      <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm0-18a8 8 0 1 0 0 16 8 8 0 0 0 0-16z" />
                      <path d="M12.75 7a.75.75 0 0 0-1.5 0v5c0 .2.08.39.22.53l3 3a.75.75 0 1 0 1.06-1.06l-2.78-2.78V7z" />
                    </svg>
                  </div>
                  <div className="text-slate-700">{shop.openHours}</div>
                </div>
              )}
              
              {/* Redes sociales */}
              {(shop.instagram || shop.facebook) && (
                <div className="flex gap-2 mb-3">
                  {shop.instagram && (
                    <a href={`https://instagram.com/${shop.instagram}`} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:text-pink-600">
                      <i className="fab fa-instagram text-lg"></i>
                    </a>
                  )}
                  {shop.facebook && (
                    <a href={`https://facebook.com/${shop.facebook}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-700">
                      <i className="fab fa-facebook-square text-lg"></i>
                    </a>
                  )}
                </div>
              )}
              
              {/* Si hay descripción, mostrarla */}
              {shop.description && (
                <div className="text-slate-600 text-sm mt-2 mb-4 line-clamp-2">
                  {shop.description}
                </div>
              )}
              
              {/* Estadísticas */}
              <div className="flex text-xs text-slate-500 mt-auto mb-4 space-x-4">
                <div>
                  <i className="fas fa-user-tie mr-1"></i>
                  {(() => {
                    const shopIdNum = Number(shop.id);
                    return state.users.filter(u => {
                      if (!u) return false;
                      const role = ((u.role || u.rol || '') + '').toLowerCase();
                      if (!role.includes('barber')) return false; // admite 'barbero', 'owner barber', etc.
                      const userShopIdNum = u.shopId != null ? Number(u.shopId) : null;
                      const inByShopId = userShopIdNum != null && !Number.isNaN(userShopIdNum) && userShopIdNum === shopIdNum;
                      const inByBarberIds = (shop.barberIds || []).includes(u.id);
                      return inByShopId || inByBarberIds;
                    }).length || 0;
                  })()} profesionales
                </div>
                <div>
                  <i className="fas fa-calendar-check mr-1"></i>
                  {state.appointments.filter(a => a.shopId === shop.id).length || 0} citas
                </div>
              </div>
              
              {/* Botones de acción */}
              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded shadow-sm text-xs font-semibold flex items-center justify-center" onClick={() => handleOpenEdit(shop)}>
                  <i className="fas fa-edit mr-1"></i>Editar
                </button>
                <a
                  href="#"
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded shadow-sm text-xs font-semibold flex items-center justify-center cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    handleDelete(shop.id);
                    return false;
                  }}
                  data-action="delete"
                  data-component-name="OwnerBarberShopsManagement"
                >
                  <i className="fas fa-trash-alt mr-1"></i>Eliminar
                </a>
                <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-3 py-1.5 rounded shadow-sm text-xs font-semibold flex items-center justify-center" onClick={() => handleOpenBarberAssign(shop)}>
                  <i className="fas fa-user-plus mr-1"></i>Asignar Profesionales
                </button>
                <button className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded shadow-sm text-xs font-semibold flex items-center justify-center" onClick={() => setSelectedShop(shop)}>
                  <i className="fas fa-eye mr-1"></i>Ver Detalles
                </button>
              </div>
              <button
                className="mt-2 bg-purple-500 hover:bg-purple-600 text-white px-3 py-1.5 rounded shadow-sm text-xs font-semibold flex items-center justify-center"
                onClick={() => handleOpenServicesByBarber(shop)}
              >
                <i className="fas fa-cut mr-1"></i>Servicios por Profesional
              </button>
            </div>
          </div>
        ))}
      </div>
      {myShops.length === 0 && (
        <div className="text-center text-slate-500 py-12">No tienes negocios registrados.</div>
      )}
      {/* Modal para añadir/editar barbería */}
      {(showAdd || showEdit) && (
        <Modal isOpen={showAdd || showEdit} onClose={handleCloseModal} title={showAdd ? 'Añadir Negocio' : 'Editar Negocio'} size="lg">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selector de foto de portada */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2">Foto de Portada</label>
              <div className="flex flex-col items-center space-y-3">
                {/* Vista previa de la imagen */}
                <div className="w-full h-32 bg-slate-100 rounded-lg overflow-hidden relative flex items-center justify-center">
                  {coverPhotoURL ? (
                    <>
                      <img 
                        src={coverPhotoURL} 
                        alt="Vista previa" 
                        className="w-full h-full object-cover"
                      />
                      <button 
                        type="button" 
                        className="absolute top-2 right-2 bg-red-500 text-white w-7 h-7 rounded-full flex items-center justify-center hover:bg-red-600"
                        onClick={() => {
                          if (coverPhotoURL) URL.revokeObjectURL(coverPhotoURL);
                          setCoverPhotoURL('');
                          setCoverPhoto(null);
                        }}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </>
                  ) : (
                    <div className="text-slate-400 flex flex-col items-center">
                      <i className="fas fa-image text-3xl mb-1"></i>
                      <span className="text-sm">Sin imagen de portada</span>
                    </div>
                  )}
                </div>
                
                {/* Botón para seleccionar archivo */}
                <div className="flex w-full justify-center">
                  <label className="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded cursor-pointer flex items-center">
                    <i className="fas fa-upload mr-2"></i>
                    {coverPhotoURL ? 'Cambiar imagen' : 'Subir imagen'}
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handlePhotoChange}
                    />
                  </label>
                </div>
                
                <p className="text-xs text-slate-500 text-center">
                  Formatos recomendados: JPG, PNG. Tamaño máximo: 10MB.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Nombre *</label>
                <input type="text" name="name" value={form.name} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Nombre del negocio" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Teléfono *</label>
                <input type="text" name="phone" value={form.phone} onChange={handleChange} className="w-full p-2 border rounded" placeholder="809-555-1234" />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Email</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} className="w-full p-2 border rounded" placeholder="barberia@example.com" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Horario</label>
                <input type="text" name="openHours" value={form.openHours} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Lun-Sab: 9am-7pm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">Categorías del negocio</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SHOP_CATEGORY_OPTIONS.map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={(Array.isArray(form.categories) ? form.categories : []).includes(opt.key)}
                      onChange={() => handleToggleCategory(opt.key)}
                      className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
              <div className="mt-1 text-xs text-slate-500">Selecciona una o varias categorías para que los clientes puedan encontrarte por filtros.</div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-1">Dirección *</label>
              <input type="text" name="address" value={form.address} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Calle Principal #123" />
              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  onClick={handleCaptureExactLocation}
                  className="px-3 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  Capturar ubicación exacta (GPS)
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(buildShopLocationQuery(form))}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold text-center"
                >
                  Verificar en Google Maps
                </a>
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Ubicación guardada (lat, lng): {String(form.latitude || '').trim() && String(form.longitude || '').trim() ? `${form.latitude}, ${form.longitude}` : 'No capturada'}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Ciudad *</label>
                <input type="text" name="city" value={form.city} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Santo Domingo" />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Sector</label>
                <input type="text" name="sector" value={form.sector || ''} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Piantini" />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-semibold mb-1">Descripción</label>
              <textarea name="description" value={form.description} onChange={handleChange} className="w-full p-2 border rounded" rows="3" placeholder="Breve descripción del negocio..."></textarea>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1">Instagram</label>
                <div className="flex items-center">
                  <span className="bg-slate-100 p-2 border border-r-0 rounded-l-md text-slate-500">@</span>
                  <input type="text" name="instagram" value={form.instagram} onChange={handleChange} className="w-full p-2 border rounded-r-md" placeholder="barberia_rd" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Facebook</label>
                <div className="flex items-center">
                  <span className="bg-slate-100 p-2 border border-r-0 rounded-l-md text-slate-500">facebook.com/</span>
                  <input type="text" name="facebook" value={form.facebook} onChange={handleChange} className="w-full p-2 border rounded-r-md" placeholder="stylex" />
                </div>
              </div>
            </div>

            {/* Datos del dueño de la barbería (solo al crear y si es la primera barbería de este dueño) */}
            {showAdd && !ownerHasAnyShop && (
              <div className="mt-4 border-t pt-4">
                <h3 className="text-md font-semibold text-slate-800 mb-2">Datos del dueño del negocio</h3>
                <p className="text-xs text-slate-500 mb-3">
                  Estos datos se usarán para crear la cuenta del dueño. Más adelante podrá iniciar sesión con este correo y contraseña.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Nombre completo del dueño *</label>
                    <input
                      type="text"
                      name="ownerName"
                      value={ownerForm.ownerName}
                      onChange={handleOwnerChange}
                      className="w-full p-2 border rounded"
                      placeholder="Ej: Juan Pérez"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Email del dueño *</label>
                    <input
                      type="email"
                      name="ownerEmail"
                      value={ownerForm.ownerEmail}
                      onChange={handleOwnerChange}
                      className="w-full p-2 border rounded"
                      placeholder="dueno@example.com"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Contraseña del dueño *</label>
                    <input
                      type="password"
                      name="ownerPassword"
                      value={ownerForm.ownerPassword}
                      onChange={handleOwnerChange}
                      className="w-full p-2 border rounded"
                      placeholder="Mínimo 6 caracteres"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1">Confirmar contraseña *</label>
                    <input
                      type="password"
                      name="ownerPasswordConfirm"
                      value={ownerForm.ownerPasswordConfirm}
                      onChange={handleOwnerChange}
                      className="w-full p-2 border rounded"
                      placeholder="Repite la contraseña"
                    />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    id="ownerIsAlsoBarber"
                    type="checkbox"
                    name="ownerIsAlsoBarber"
                    checked={ownerForm.ownerIsAlsoBarber}
                    onChange={handleOwnerChange}
                    className="h-4 w-4 text-indigo-600 border-slate-300 rounded"
                  />
                  <label htmlFor="ownerIsAlsoBarber" className="text-sm text-slate-700">
                    El dueño también trabajará como profesional en este negocio
                  </label>
                </div>
              </div>
            )}
            
            {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm mt-2">{error}</div>}
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded" onClick={handleCloseModal}>Cancelar</button>
              <button type="submit" className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded font-semibold">{showAdd ? 'Añadir' : 'Guardar'}</button>
            </div>
          </form>
        </Modal>
      )}

      {showServicesByBarberShop && (
        <Modal
          isOpen={!!showServicesByBarberShop}
          onClose={() => setShowServicesByBarberShop(null)}
          title="Servicios por Profesional"
          size="lg"
        >
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              Selecciona qué servicios generales ofrece cada profesional de este negocio.
            </div>
            {(() => {
              const shop = state.barberShops.find(s => s.id === showServicesByBarberShop);
              if (!shop) return <div className="text-slate-500 text-sm">No se encontró el negocio.</div>;

              // Bloque para crear un servicio exclusivo de esta barbería
              return (
                <div className="border rounded-lg p-3 bg-slate-50">
                  <h4 className="text-sm font-semibold text-slate-800 mb-2">Crear servicio exclusivo de este negocio</h4>
                  {serviceFormError && (
                    <div className="bg-red-50 text-red-600 text-xs p-2 rounded mb-2">{serviceFormError}</div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-2">
                    <div className="md:col-span-2">
                      <input
                        type="text"
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="Nombre del servicio"
                        value={newShopService.name}
                        onChange={e => setNewShopService({ ...newShopService, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="Precio RD$"
                        value={newShopService.price}
                        onChange={e => setNewShopService({ ...newShopService, price: e.target.value })}
                        min="0"
                      />
                    </div>
                    <div>
                      <input
                        type="number"
                        className="w-full border rounded px-2 py-1 text-sm"
                        placeholder="Duración (min)"
                        value={newShopService.duration}
                        onChange={e => setNewShopService({ ...newShopService, duration: e.target.value })}
                        min="5"
                        step="5"
                      />
                    </div>
                  </div>
                  <textarea
                    className="w-full border rounded px-2 py-1 text-xs mb-2"
                    rows="2"
                    placeholder="Descripción (opcional)"
                    value={newShopService.description}
                    onChange={e => setNewShopService({ ...newShopService, description: e.target.value })}
                  ></textarea>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="px-3 py-1.5 bg-green-500 text-white rounded text-xs font-semibold hover:bg-green-600"
                      onClick={() => {
                        setServiceFormError('');
                        const { name, price, duration, description } = newShopService;
                        if (!name || !price || !duration) {
                          setServiceFormError('Nombre, precio y duración son obligatorios.');
                          return;
                        }
                        const priceNum = parseFloat(price);
                        const durationNum = parseInt(duration);
                        if (Number.isNaN(priceNum) || Number.isNaN(durationNum) || priceNum <= 0 || durationNum <= 0) {
                          setServiceFormError('Precio y duración deben ser números positivos.');
                          return;
                        }

                        dispatch({
                          type: 'ADD_SERVICE',
                          payload: {
                            name,
                            price: priceNum,
                            duration: durationNum,
                            description: description || '',
                            shopId: shop.id
                          }
                        });

                        dispatch({
                          type: 'SHOW_NOTIFICATION',
                          payload: {
                            message: 'Servicio creado para este negocio',
                            type: 'success'
                          }
                        });

                        setNewShopService({ name: '', price: '', duration: '', description: '' });
                      }}
                    >
                      Crear servicio
                    </button>
                  </div>
                </div>
              );
            })()}

            {(() => {
              const shop = state.barberShops.find(s => s.id === showServicesByBarberShop);
              if (!shop) return null;

              const shopBarbers = state.users
                .filter(u => {
                  const role = ((u.role || u.rol || '') + '').toLowerCase();
                  if (!role.includes('barber')) return false;
                  return u.shopId === shop.id || (shop.barberIds || []).includes(u.id);
                });
              const generalServices = state.services.filter(s => {
                if (s.barberId) return false;
                const serviceShopId = s.shopId || s.shop_id;
                // Servicios sin shopId son generales, servicios con shopId solo se muestran en su barbería
                return serviceShopId == null || serviceShopId === shop.id;
              });

              if (shopBarbers.length === 0) {
                return <div className="text-slate-500 text-sm">No hay profesionales asignados a este negocio.</div>;
              }

              if (generalServices.length === 0) {
                return <div className="text-slate-500 text-sm">No hay servicios disponibles. Crea servicios en la sección "Servicios Tienda" o en este modal.</div>;
              }

              return (
                <div className="space-y-4">
                  {shopBarbers.map(barber => {
                    const selectedIds = selectedServicesByBarber[barber.id] || state.barberServices[barber.id] || [];
                    return (
                      <div key={barber.id} className="border rounded-lg p-3">
                        <div className="font-semibold text-slate-800 mb-2">{barber.name}</div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          {generalServices.map(service => (
                            <div key={service.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="form-checkbox text-indigo-600"
                                checked={selectedIds.includes(service.id)}
                                onChange={() => toggleServiceForBarber(barber.id, service.id)}
                              />
                              <span className="flex-1">
                                {service.name}{' '}
                                <span className="text-xs text-slate-500">RD${service.price} • {service.duration} min</span>
                              </span>
                              <button
                                type="button"
                                className="text-red-500 hover:text-red-600 text-xs"
                                onClick={() => {
                                  if (window.confirm(`¿Eliminar el servicio "${service.name}"?`)) {
                                    dispatch({ type: 'DELETE_SERVICE', payload: service.id });
                                  }
                                }}
                              >
                                <i className="fas fa-trash-alt"></i>
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                onClick={() => setShowServicesByBarberShop(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                onClick={handleSaveServicesByBarber}
              >
                Guardar cambios
              </button>
            </div>
          </div>
        </Modal>
      )}
      {/* Modal para ver detalles */}
      {selectedShop && !showEdit && !showAdd && (
        <Modal
          isOpen={!!selectedShop}
          onClose={() => setSelectedShop(null)}
          title="Detalles del Negocio"
          size="md"
        >
          <BarberShopInfoView shop={selectedShop} />
        </Modal>
      )}

      {/* Modal para asignar barberos */}
      {showBarberAssign && (
        <Modal
          isOpen={!!showBarberAssign}
          onClose={() => setShowBarberAssign(null)}
          title="Asignar Profesionales al Negocio"
          size="md"
        >
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Selecciona los profesionales que trabajarán en este negocio. Puedes seleccionar o deseleccionar haciendo clic en cada profesional.
            </p>

            {/* Atajo para que el propietario se auto-asigne como barbero usando su perfil existente */}
            {owner && !isAdmin && (
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-md text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="text-slate-700">
                  Como propietario, puedes usar tu propio perfil para trabajar como profesional en este negocio.
                </div>
                <button
                  type="button"
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-semibold hover:bg-indigo-700"
                  onClick={handleOwnerQuickAssignAsBarber}
                >
                  Añadirme como profesional aquí
                </button>
              </div>
            )}

            <div className="mb-2">
              <input
                type="text"
                className="w-full border rounded px-3 py-1.5 text-sm"
                placeholder="Buscar por nombre o correo..."
                value={barberSearchTerm}
                onChange={e => setBarberSearchTerm(e.target.value)}
              />
            </div>

            <div className="max-h-80 overflow-y-auto border rounded-lg divide-y divide-slate-100">
              {state.users
                .filter(u => u.role === 'barber')
                .filter(barber => {
                  if (!barberSearchTerm.trim()) return true;
                  const term = barberSearchTerm.toLowerCase();
                  const nameMatch = (barber.name || '').toLowerCase().includes(term);
                  const emailMatch = (barber.email || '').toLowerCase().includes(term);
                  return nameMatch || emailMatch;
                })
                .map(barber => (
                  <div
                    key={barber.id}
                    className={`flex items-center p-3 cursor-pointer hover:bg-slate-50 transition-colors ${selectedBarbers.includes(barber.id) ? 'bg-indigo-50' : ''}`}
                    onClick={() => handleBarberSelection(barber.id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                      {barber.avatar ? (
                        <img
                          src={barber.avatar}
                          alt={barber.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <i className="fas fa-user text-indigo-400"></i>
                      )}
                    </div>
                    <div className="flex-grow">
                      <div className="font-medium text-slate-800">{barber.name}</div>
                      <div className="text-xs text-slate-500">{barber.email || 'Sin email'}</div>
                    </div>
                    <div>
                      {selectedBarbers.includes(barber.id) ? (
                        <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full text-xs flex items-center">
                          <i className="fas fa-check mr-1"></i> Seleccionado
                        </span>
                      ) : (
                        <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-full text-xs">
                          Disponible
                        </span>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-slate-500">
                <span className="font-medium">{selectedBarbers.length}</span> profesionales seleccionados
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                  onClick={() => setShowBarberAssign(null)}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                  onClick={handleSaveBarberAssignments}
                >
                  Guardar Asignaciones
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default OwnerBarberShopsManagement;
