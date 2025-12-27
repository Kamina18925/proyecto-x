import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import Modal from './ui/Modal';

const OwnerBarbersManagement = () => {
  const { state, dispatch } = useContext(AppContext);
  const owner = state.currentUser;
  const ownerShops = state.barberShops.filter(s => String(s.ownerId) === String(owner?.id));
  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', specialties: '', password: '', photoUrl: '' });
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedShopFilter, setSelectedShopFilter] = useState('all');
  
  // Función para manejar la subida de imágenes (versión simulada para desarrollo)
  const handleImageUpload = async (file) => {
    try {
      setUploading(true);
      setError('');
      
      // Validación de tipo de archivo
      if (!file.type.startsWith('image/')) {
        throw new Error('Solo se permiten archivos de imagen');
      }
      
      // Validación de tamaño
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('La imagen debe ser menor a 5MB');
      }
      
      // Simular un pequeño retraso como en una carga real
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Crear una URL local para la imagen usando FileReader
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const imageUrl = e.target.result;
        setForm(f => ({ ...f, photoUrl: imageUrl }));
        setUploading(false);
      };
      
      reader.onerror = function() {
        setError('Error al procesar la imagen');
        setUploading(false);
      };
      
      // Leer el archivo como una URL de datos
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading image:', error);
      setError('Error al subir la imagen: ' + error.message);
      setUploading(false);
    }
  };

  // Todos los barberos visibles para este usuario
  const isAdmin = ((owner?.role || owner?.rol || '') + '').toLowerCase().includes('admin');
  const ownerShopIds = ownerShops.map(s => s.id);
  const visibleShops = isAdmin ? (state.barberShops || []) : ownerShops;

  const allBarbers = state.users.filter(u => {
    const role = ((u.role || u.rol || '') + '').toLowerCase();
    if (!role.includes('barber')) return false; // admite 'barber', 'barbero', 'owner barber', etc.
    if (isAdmin) return true;
    // Un dueño normal ve barberos de sus barberías y también los no asignados (para poder asignarlos)
    const rawShopId = (u.shopId !== undefined ? u.shopId : (u.shop_id !== undefined ? u.shop_id : null));
    const userShopId = rawShopId != null && rawShopId !== '' ? String(rawShopId) : '';
    if (!userShopId) return true;
    return ownerShopIds.some((id) => String(id) === userShopId);
  });

  // Aplicar filtros de barbería y búsqueda
  let filteredBarbers = allBarbers.filter(barber => {
    // Filtro por barbería / estado de asignación
    if (selectedShopFilter === 'unassigned') {
      const rawShopId = (barber.shopId !== undefined ? barber.shopId : (barber.shop_id !== undefined ? barber.shop_id : null));
      if (rawShopId != null && rawShopId !== '') return false;
    } else if (selectedShopFilter !== 'all' && selectedShopFilter !== 'recent') {
      const shopIdNum = Number(selectedShopFilter);
      const rawShopId = (barber.shopId !== undefined ? barber.shopId : (barber.shop_id !== undefined ? barber.shop_id : null));
      if (String(rawShopId ?? '') !== String(shopIdNum)) {
        return false;
      }
    }

    // Filtro por búsqueda (nombre, email, teléfono)
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      const nameMatch = (barber.name || '').toLowerCase().includes(t);
      const emailMatch = (barber.email || '').toLowerCase().includes(t);
      const phoneMatch = (barber.phone || '').toLowerCase().includes(t);
      if (!nameMatch && !emailMatch && !phoneMatch) return false;
    }

    return true;
  });

  // Si se selecciona "recent", ordenar por fecha de creación (o id) y limitar a los más recientes
  if (selectedShopFilter === 'recent') {
    filteredBarbers = [...filteredBarbers]
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        if (dateA === dateB) {
          return (b.id || 0) - (a.id || 0);
        }
        return dateB - dateA;
      })
      .slice(0, 8);
  }

  const barbers = filteredBarbers;

  // Obtener el nombre de la barbería a la que está asignado un barbero
  const getBarberShopName = (barber) => {
    const rawShopId = (barber.shopId !== undefined ? barber.shopId : (barber.shop_id !== undefined ? barber.shop_id : null));
    if (rawShopId == null || rawShopId === '') return 'No asignado';
    const barberShopId = Number(rawShopId);
    const shop = visibleShops.find(s => Number(s.id) === barberShopId);
    return shop ? shop.name : 'No asignado';
  };

  const handleOpenAdd = () => {
    setForm({ name: '', email: '', phone: '', password: '', photoUrl: '' });
    setPreview('');
    setError('');
    setShowAdd(true);
  };
  const handleOpenEdit = (barber) => {
    setForm({ 
      name: barber.name, 
      email: barber.email, 
      phone: barber.phone, 
      password: '',
      photoUrl: barber.photoUrl || ''
    });
    setPreview(barber.photoUrl || '');
    setSelectedBarber(barber);
    setError('');
    setShowEdit(true);
  };
  const handleCloseModal = () => {
    setShowAdd(false);
    setShowEdit(false);
    setSelectedBarber(null);
    setError('');
  };
  const handleChange = e => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone || (!selectedBarber && !form.password)) {
      setError('Todos los campos son obligatorios. La contraseña es obligatoria para nuevos profesionales.');
      return;
    }
    if (uploading) {
      setError('Espere a que se complete la carga de la imagen.');
      return;
    }
    
    if (showAdd) {
      dispatch({ type: 'ADD_BARBER_TO_SHOP', payload: {
        // Si solo hay una barbería, la usamos por defecto; si no, de momento se crea sin asignar
        shopId: ownerShops.length === 1 ? ownerShops[0].id : null,
        barber: { 
          name: form.name, 
          email: form.email, 
          phone: form.phone, 
          role: 'barber',
          password: form.password,
          photoUrl: form.photoUrl || ''
        }
      }});
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { 
        message: `El profesional ${form.name} ha sido añadido exitosamente. Podrá acceder con su email y contraseña.`, 
        type: 'success' 
      }});
    } else if (showEdit && selectedBarber) {
      const updateData = { 
        name: form.name, 
        email: form.email, 
        phone: form.phone, 
        photoUrl: form.photoUrl || ''
      };
      
      // Solo actualizar la contraseña si se ha proporcionado una nueva
      if (form.password) {
        updateData.password = form.password;
      }
      
      dispatch({ type: 'UPDATE_BARBER', payload: { 
        id: selectedBarber.id, 
        data: updateData
      }});
      
      dispatch({ type: 'SHOW_NOTIFICATION', payload: { 
        message: `Los datos del profesional ${form.name} han sido actualizados exitosamente.`, 
        type: 'success' 
      }});
    }
    handleCloseModal();
  };
  const handleDelete = (barberId) => {
    if (window.confirm('¿Seguro que deseas eliminar este profesional?')) {
      // Eliminar del array de usuarios
      dispatch({ type: 'DELETE_USER', payload: { id: barberId } });
      
      // Desasociar al barbero de todas sus citas
      dispatch({ type: 'UNASSIGN_BARBER_APPOINTMENTS', payload: { barberId: barberId } });
      
      // Mostrar notificación
      dispatch({ 
        type: 'SHOW_NOTIFICATION', 
        payload: { 
          message: 'Profesional eliminado correctamente', 
          type: 'success' 
        } 
      });
      
      if (selectedBarber && selectedBarber.id === barberId) setSelectedBarber(null);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-4 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Gestión de Profesionales</h2>
          <p className="text-sm text-slate-500 mt-1">Aquí puedes ver todos los profesionales, filtrarlos por barbería y realizar búsquedas rápidas.</p>
        </div>
        <button className="bg-green-500 hover:bg-green-600 text-white px-5 py-2 rounded shadow text-sm font-semibold flex items-center" onClick={handleOpenAdd}>
          <i className="fas fa-plus-circle mr-2"></i>Añadir Profesional
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="md:w-1/3">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Filtrar por barbería</label>
          <select
            className="w-full border rounded px-2 py-2 text-sm"
            value={selectedShopFilter}
            onChange={e => setSelectedShopFilter(e.target.value)}
          >
            <option value="all">Todas las barberías</option>
            <option value="unassigned">Solo no asignados</option>
            <option value="recent">Profesionales recientes</option>
            {ownerShops.length > 0 && (
              <optgroup label="Barberías">
                {ownerShops.map(shop => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))}
              </optgroup>
            )}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Buscar por nombre, email o teléfono</label>
          <input
            type="text"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Ej: Juan, juan@correo.com, 809..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {barbers.map(barber => (
          <div key={barber.id} className="bg-white rounded-lg shadow p-5 flex flex-col h-full border border-slate-200 hover:border-indigo-200 transition-colors">
            <div className="flex items-center mb-3">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-indigo-100 shadow mr-3 flex-shrink-0">
                <img 
                  src={barber.photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(barber.name)}&background=random`} 
                  alt={barber.name} 
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-slate-800">{barber.name}</h3>
                <div className="text-xs text-indigo-500">{barber.email}</div>
              </div>
            </div>
            <div className="text-slate-700 text-sm mb-2 flex items-center">
              <i className="fas fa-phone text-indigo-400 mr-2"></i>
              {barber.phone}
            </div>
            <div className="text-slate-700 text-sm mb-2 mt-1 flex items-center justify-between">
              <div className="flex items-center">
                <i className="fas fa-store text-indigo-400 mr-2"></i>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-700">
                  {getBarberShopName(barber)}
                </span>
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Asignar a barbería</label>
              <select
                className="w-full border rounded px-2 py-1 text-sm"
                value={(barber.shopId !== undefined ? barber.shopId : (barber.shop_id !== undefined ? barber.shop_id : '')) ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  const newShopId = value === '' ? null : Number(value);
                  dispatch({
                    type: 'UPDATE_USER',
                    payload: {
                      id: barber.id,
                      shopId: newShopId
                    }
                  });
                }}
              >
                <option value="">No asignado</option>
                {visibleShops.map(shop => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))}
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-semibold text-slate-600 mb-1">Permisos del profesional</label>
              <label className="flex items-center gap-2 text-xs text-slate-700 select-none">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={!!barber.canDeleteHistory}
                  onChange={(e) => {
                    dispatch({
                      type: 'UPDATE_USER',
                      payload: {
                        id: barber.id,
                        canDeleteHistory: e.target.checked,
                      },
                    });
                  }}
                />
                Permitir eliminar historial de citas
              </label>
            </div>
            <div className="flex gap-2 mt-auto pt-3 border-t border-slate-100">
              <button 
                className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1.5 rounded shadow text-xs font-semibold flex-1 flex items-center justify-center" 
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenEdit(barber);
                }}
                data-action="edit"
                data-component-name="OwnerBarbersManagement"
              >
                <i className="fas fa-edit mr-1.5"></i>Editar
              </button>
              <button 
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded shadow text-xs font-semibold flex-1 flex items-center justify-center" 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDelete(barber.id);
                }}
                data-action="delete"
                data-component-name="OwnerBarbersManagement"
              >
                <i className="fas fa-trash-alt mr-1.5"></i>Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>
      {barbers.length === 0 && (
        <div className="text-center text-slate-500 py-12">No hay profesionales registrados en esta barbería.</div>
      )}
      {/* Modal para añadir/editar barbero */}
      {(showAdd || showEdit) && (
        <Modal isOpen={showAdd || showEdit} onClose={handleCloseModal} title={showAdd ? 'Añadir Profesional' : 'Editar Profesional'} size="md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-1">Nombre</label>
              <input type="text" name="name" value={form.name} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Email</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} className="w-full p-2 border rounded" />
              <p className="text-xs text-slate-500 mt-1"><i className="fas fa-info-circle mr-1 text-indigo-400"></i>Este email será el nombre de usuario para acceder a la aplicación</p>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Teléfono</label>
              <input type="text" name="phone" value={form.phone} onChange={handleChange} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Contraseña</label>
              <input type="password" name="password" value={form.password} onChange={handleChange} className="w-full p-2 border rounded" />
              <p className="text-xs text-slate-500 mt-1"><i className="fas fa-info-circle mr-1 text-indigo-400"></i>Contraseña para que el profesional acceda a la aplicación</p>
              {!selectedBarber && <p className="text-xs text-slate-500 mt-1"><i className="fas fa-exclamation-circle mr-1 text-amber-500"></i>Obligatorio para nuevos profesionales</p>}
              {selectedBarber && <p className="text-xs text-slate-500 mt-1"><i className="fas fa-exclamation-circle mr-1 text-amber-500"></i>Dejar vacío para mantener la contraseña actual</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">Foto del Profesional</label>
              <div 
                className={`w-full border-2 border-dashed rounded-md p-4 mb-2 transition-colors ${preview || form.photoUrl ? 'border-green-400 bg-green-50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50'}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) {
                    setError('');
                    await handleImageUpload(file);
                  } else {
                    setError('Solo se permiten archivos de imagen');
                  }
                }}
              >
                <div className="flex flex-col items-center justify-center py-2">
                  {(preview || form.photoUrl) ? (
                    <>
                      <img src={preview || form.photoUrl} alt="Vista previa" className="w-full max-h-32 object-contain rounded mb-2" />
                      <p className="text-sm text-green-600 font-medium mb-1">¡Imagen cargada correctamente!</p>
                      <button 
                        type="button" 
                        className="text-xs text-red-500 hover:text-red-700"
                        onClick={() => {
                          setPreview('');
                          setForm(f => ({ ...f, photoUrl: '' }));
                        }}
                      >
                        Eliminar imagen
                      </button>
                    </>
                  ) : (
                    <>
                      <i className="fas fa-cloud-upload-alt text-3xl text-slate-400 mb-2"></i>
                      <p className="text-sm text-slate-500 text-center">
                        Arrastra y suelta la foto aquí o
                        <label className="ml-1 text-indigo-600 hover:text-indigo-800 cursor-pointer">
                          busca en tu dispositivo
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files[0];
                              if (file) {
                                setError('');
                                await handleImageUpload(file);
                              }
                            }}
                          />
                        </label>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">PNG, JPG o JPEG (máx. 5MB)</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <div className="flex gap-2 justify-end">
              <button type="button" className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded" onClick={handleCloseModal}>Cancelar</button>
              <button 
                type="submit" 
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center justify-center min-w-[90px]"
                disabled={uploading}
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Cargando...
                  </>
                ) : (showAdd ? 'Añadir' : 'Guardar')}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default OwnerBarbersManagement;
