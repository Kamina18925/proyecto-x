import React, { useContext, useState } from 'react';
import { AppContext } from '../App';

const OwnerServicesManagement = ({ shop }) => {
  const { state, dispatch } = useContext(AppContext);
  const [showAddGeneral, setShowAddGeneral] = useState(false);
  const [showEditGeneral, setShowEditGeneral] = useState(null); // serviceId o null
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null); // serviceId o null
  const [showAddExclusive, setShowAddExclusive] = useState(false);
  const [showEditExclusive, setShowEditExclusive] = useState(null); // serviceId exclusivo o null
  const [showDeleteExclusiveConfirm, setShowDeleteExclusiveConfirm] = useState(null); // serviceId exclusivo o null
  const [showAddBarber, setShowAddBarber] = useState(null); // barberId o null
  const [formGeneral, setFormGeneral] = useState({ name: '', price: '', duration: '', description: '' });
  const [formExclusive, setFormExclusive] = useState({ name: '', price: '', duration: '', description: '' });
  const [formBarber, setFormBarber] = useState({ name: '', price: '', duration: '', description: '' });
  const [formError, setFormError] = useState('');
  const [exclusiveFormError, setExclusiveFormError] = useState('');
  const [barberFormError, setBarberFormError] = useState('');
  
  const currentUser = state.currentUser;
  const isAdmin = (((currentUser?.role || currentUser?.rol || '') + '').toLowerCase()).includes('admin');
  
  // Verificar si hay múltiples propietarias (dueñas)
  const ownerUsers = Array.isArray(state.users) ? state.users.filter(u => u.role === 'owner') : [];
  const hasMultipleOwners = ownerUsers.length > 1;

  // Servicios generales: sin barberId y sin shopId (globales para todas las barberías)
  const generalServices = Array.isArray(state.services)
    ? state.services.filter(s => {
        if (s.barberId) return false;
        const serviceShopId = s.shopId ?? s.shop_id ?? null;
        // Solo consideramos generales los que NO tienen barbería asignada
        return serviceShopId == null;
      })
    : [];

  // Servicios exclusivos para la barbería seleccionada (sin barberId, con shopId = shop.id)
  const exclusiveServicesForShop = Array.isArray(state.services) && shop
    ? state.services.filter(s => {
        if (s.barberId) return false;
        const serviceShopId = s.shopId ?? s.shop_id ?? null;
        return serviceShopId != null && String(serviceShopId) === String(shop.id);
      })
    : [];

  // Barberos de la barbería actual
  const barbersInShop = shop
    ? (Array.isArray(state.users) ? state.users : []).filter(u => {
        const role = (u.role || u.rol || '').toLowerCase();
        if (!role.includes('barber')) return false;

        const rawShopId = u.shopId !== undefined ? u.shopId : (u.shop_id !== undefined ? u.shop_id : null);
        const inByShopId = rawShopId != null && String(rawShopId) === String(shop.id);
        const inByBarberIds = (shop.barberIds || []).includes(u.id);
        return inByShopId || inByBarberIds;
      })
    : [];

  const barberServices = state.barberServices || {};
  const barberIdsInShop = barbersInShop.map(b => b.id);

  const isServiceActiveInShop = (serviceId) => {
    if (!shop) return false;
    const targetId = String(serviceId);
    return barberIdsInShop.some(barberId => {
      const svcIds = barberServices[barberId] || [];
      const svcIdsStr = svcIds.map(id => String(id));
      return svcIdsStr.includes(targetId);
    });
  };

  // Servicios que se mostrarán en la vista:
  // - Para el propietario queremos ver TODO lo creado (generales y exclusivos),
  //   aunque todavía no estén asignados a ningún barbero.
  // - Seguimos usando isServiceActiveInShop solo para mensajes de ayuda.
  const activeGeneralServicesForShop = generalServices;
  const activeExclusiveServicesForShop = exclusiveServicesForShop;

  // Función para gestionar propietarias (dueñas)
  const handleOwnerUsers = () => {
    if (hasMultipleOwners) {
      // Muestra diálogo de confirmación
      if (window.confirm('Hay múltiples propietarias en el sistema. ¿Deseas limitar a una sola propietaria?')) {
        // Obtener la propietaria más reciente
        const sortedOwners = [...ownerUsers].sort((a, b) => 
          new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        );
        
        // Mantener solo a la propietaria más reciente
        const ownerToKeep = sortedOwners[0];
        
        // Cambiar el rol de los demás propietarios a 'barber' (barbero)
        sortedOwners.slice(1).forEach(owner => {
          dispatch({
            type: 'UPDATE_USER',
            payload: {
              id: owner.id,
              role: 'barber'
            }
          });
        });
        
        // Mostrar notificación
        dispatch({
          type: 'SHOW_NOTIFICATION',
          payload: {
            message: `Sistema limitado a una sola propietaria: ${ownerToKeep.name}`,
            type: 'success'
          }
        });
      }
    }
  };
  
  return (
    <div className="space-y-8">
      {/* Advertencia de múltiples propietarias */}
      {hasMultipleOwners && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <i className="fas fa-exclamation-triangle text-yellow-400"></i>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>Advertencia:</strong> Hay múltiples propietarias en el sistema. Se recomienda tener una sola propietaria (dueña).
              </p>
              <div className="mt-2">
                <button 
                  className="text-xs bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-medium py-1 px-2 rounded"
                  onClick={handleOwnerUsers}
                >
                  Limitar a una propietaria
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para eliminar servicio exclusivo */}
      {showDeleteExclusiveConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">Confirmar eliminación</h3>
            <p className="text-slate-600 mb-4">
              ¿Estás seguro de que deseas eliminar este servicio exclusivo? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-2">
              <button
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                onClick={() => setShowDeleteExclusiveConfirm(null)}
              >
                Cancelar
              </button>
              <button
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                onClick={() => {
                  dispatch({
                    type: 'DELETE_SERVICE',
                    payload: showDeleteExclusiveConfirm
                  });

                  dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: {
                      message: 'Servicio exclusivo eliminado correctamente',
                      type: 'success'
                    }
                  });

                  setShowDeleteExclusiveConfirm(null);
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {isAdmin && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-indigo-700">Servicios Generales</h2>
            <button className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded shadow" onClick={() => {
              setShowAddGeneral(true);
              setFormGeneral({ name: '', price: '', duration: '', description: '' });
              setFormError('');
            }}>
              <i className="fas fa-plus-circle mr-2"></i>Nuevo Servicio General
            </button>
          </div>
          {shop && activeGeneralServicesForShop.length === 0 && (
            <p className="text-slate-500 mb-3 text-sm">
              Esta barbería aún no ofrece ningún servicio general asignado a sus barberos.
            </p>
          )}
          {(!shop ? generalServices : activeGeneralServicesForShop).length > 0 ? (
            <ul className="divide-y divide-slate-200">
              {(!shop ? generalServices : activeGeneralServicesForShop).map(service => (
                <li key={service.id} className="py-2 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-indigo-700">{service.name}</span> <span className="text-slate-500 text-sm">RD${service.price} • {service.duration} min</span>
                  </div>
                  <div>
                    <button 
                      className="bg-yellow-400 hover:bg-yellow-500 text-white px-2 py-1 rounded text-xs mr-2" 
                      onClick={() => {
                        setShowEditGeneral(service.id);
                        setFormGeneral({
                          name: service.name,
                          price: service.price.toString(),
                          duration: service.duration.toString(),
                          description: service.description || ''
                        });
                        setFormError('');
                      }}
                    >
                      Editar
                    </button>
                    <button 
                      className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => setShowDeleteConfirm(service.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">No hay servicios generales registrados.</p>
          )}
        </div>
      )}

      {/* Servicios exclusivos de la barbería seleccionada */}
      {shop && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-indigo-700">Servicios exclusivos de esta barbería</h2>
            <button
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded shadow text-sm"
              onClick={() => {
                setShowAddExclusive(true);
                setFormExclusive({ name: '', price: '', duration: '', description: '' });
                setExclusiveFormError('');
              }}
            >
              <i className="fas fa-plus-circle mr-2"></i>Nuevo servicio exclusivo
            </button>
          </div>
          {activeExclusiveServicesForShop.length > 0 ? (
            <ul className="divide-y divide-slate-200">
              {activeExclusiveServicesForShop.map(service => (
                <li key={service.id} className="py-2 flex justify-between items-center">
                  <div>
                    <span className="font-semibold text-indigo-700">{service.name}</span>{' '}
                    <span className="text-slate-500 text-sm">RD${service.price} • {service.duration} min</span>
                  </div>
                  <div>
                    <button
                      className="bg-yellow-400 hover:bg-yellow-500 text-white px-2 py-1 rounded text-xs mr-2"
                      onClick={() => {
                        setShowEditExclusive(service.id);
                        setFormExclusive({
                          name: service.name,
                          price: service.price.toString(),
                          duration: service.duration.toString(),
                          description: service.description || ''
                        });
                        setExclusiveFormError('');
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                      onClick={() => setShowDeleteExclusiveConfirm(service.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-slate-500">Esta barbería no tiene servicios exclusivos asignados a sus barberos.</p>
          )}
        </div>
      )}

      {/* La asignación de servicios por barbero ahora se gestionará desde la sección de Barberías */}

      {isAdmin && showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-2">Confirmar eliminación</h3>
            <p className="text-slate-600 mb-4">
              ¿Estás seguro de que deseas eliminar este servicio? Esta acción no se puede deshacer.
            </p>
            <div className="flex justify-end space-x-2">
              <button 
                className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                onClick={() => setShowDeleteConfirm(null)}
              >
                Cancelar
              </button>
              <button 
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                onClick={() => {
                  // Eliminar el servicio
                  dispatch({
                    type: 'DELETE_SERVICE',
                    payload: showDeleteConfirm
                  });
                  
                  // Mostrar notificación
                  dispatch({
                    type: 'SHOW_NOTIFICATION',
                    payload: {
                      message: 'Servicio eliminado correctamente',
                      type: 'success'
                    }
                  });
                  
                  // Cerrar el modal
                  setShowDeleteConfirm(null);
                }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {isAdmin && showEditGeneral && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Editar Servicio</h3>
            {formError && <div className="bg-red-50 text-red-500 p-2 rounded mb-3 text-sm">{formError}</div>}
            
            <form onSubmit={(e) => {
              e.preventDefault();
              
              // Validar campos
              if (!formGeneral.name || !formGeneral.price || !formGeneral.duration) {
                setFormError('Todos los campos marcados con * son obligatorios');
                return;
              }
              
              // Convertir precio y duración a números
              const price = parseFloat(formGeneral.price);
              const duration = parseInt(formGeneral.duration);
              
              // Validar que sean números válidos
              if (isNaN(price) || isNaN(duration) || price <= 0 || duration <= 0) {
                setFormError('El precio y la duración deben ser números positivos');
                return;
              }
              
              // Actualizar el servicio
              const updatedService = {
                id: showEditGeneral,
                name: formGeneral.name,
                price,
                duration,
                description: formGeneral.description || ''
              };
              
              // Dispatch para actualizar el servicio
              dispatch({
                type: 'UPDATE_SERVICE',
                payload: updatedService
              });
              
              // Mostrar notificación de éxito
              dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                  message: 'Servicio actualizado correctamente',
                  type: 'success'
                }
              });
              
              // Cerrar el modal
              setShowEditGeneral(null);
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del servicio *</label>
                <input 
                  type="text"
                  className="w-full p-2 border border-slate-300 rounded"
                  value={formGeneral.name}
                  onChange={(e) => setFormGeneral({...formGeneral, name: e.target.value})}
                  placeholder="Ej: Corte de cabello"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio (RD$) *</label>
                  <input 
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded"
                    value={formGeneral.price}
                    onChange={(e) => setFormGeneral({...formGeneral, price: e.target.value})}
                    placeholder="Ej: 350"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duración (min) *</label>
                  <input 
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded"
                    value={formGeneral.duration}
                    onChange={(e) => setFormGeneral({...formGeneral, duration: e.target.value})}
                    placeholder="Ej: 30"
                    min="5"
                    step="5"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <textarea 
                  className="w-full p-2 border border-slate-300 rounded"
                  value={formGeneral.description}
                  onChange={(e) => setFormGeneral({...formGeneral, description: e.target.value})}
                  placeholder="Descripción detallada del servicio..."
                  rows="3"
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button 
                  type="button" 
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                  onClick={() => setShowEditGeneral(null)}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                >
                  Actualizar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdmin && showAddGeneral && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Nuevo Servicio General</h3>
            {formError && <div className="bg-red-50 text-red-500 p-2 rounded mb-3 text-sm">{formError}</div>}
            
            <form onSubmit={(e) => {
              e.preventDefault();
              
              // Validar campos
              if (!formGeneral.name || !formGeneral.price || !formGeneral.duration) {
                setFormError('Todos los campos marcados con * son obligatorios');
                return;
              }
              
              // Convertir precio y duración a números
              const price = parseFloat(formGeneral.price);
              const duration = parseInt(formGeneral.duration);
              
              // Validar que sean números válidos
              if (isNaN(price) || isNaN(duration) || price <= 0 || duration <= 0) {
                setFormError('El precio y la duración deben ser números positivos');
                return;
              }
              
              // Crear el nuevo servicio (sin id, el backend lo asignará)
              const newService = {
                name: formGeneral.name,
                price,
                duration,
                description: formGeneral.description || ''
              };
              
              // Dispatch para añadir el servicio al estado global
              dispatch({
                type: 'ADD_SERVICE',
                payload: newService
              });
              
              // Mostrar notificación de éxito
              dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                  message: 'Servicio creado correctamente',
                  type: 'success'
                }
              });
              
              // Cerrar el modal
              setShowAddGeneral(false);
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del servicio *</label>
                <input 
                  type="text"
                  className="w-full p-2 border border-slate-300 rounded"
                  value={formGeneral.name}
                  onChange={(e) => setFormGeneral({...formGeneral, name: e.target.value})}
                  placeholder="Ej: Corte de cabello"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio (RD$) *</label>
                  <input 
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded"
                    value={formGeneral.price}
                    onChange={(e) => setFormGeneral({...formGeneral, price: e.target.value})}
                    placeholder="Ej: 350"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duración (min) *</label>
                  <input 
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded"
                    value={formGeneral.duration}
                    onChange={(e) => setFormGeneral({...formGeneral, duration: e.target.value})}
                    placeholder="Ej: 30"
                    min="5"
                    step="5"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <textarea 
                  className="w-full p-2 border border-slate-300 rounded"
                  value={formGeneral.description}
                  onChange={(e) => setFormGeneral({...formGeneral, description: e.target.value})}
                  placeholder="Descripción detallada del servicio..."
                  rows="3"
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button 
                  type="button" 
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                  onClick={() => setShowAddGeneral(false)}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Guardar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para añadir servicio exclusivo */}
      {showAddExclusive && shop && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Nuevo servicio exclusivo para {shop.name}</h3>
            {exclusiveFormError && <div className="bg-red-50 text-red-500 p-2 rounded mb-3 text-sm">{exclusiveFormError}</div>}

            <form onSubmit={(e) => {
              e.preventDefault();

              if (!formExclusive.name || !formExclusive.price || !formExclusive.duration) {
                setExclusiveFormError('Todos los campos marcados con * son obligatorios');
                return;
              }

              const price = parseFloat(formExclusive.price);
              const duration = parseInt(formExclusive.duration);

              if (isNaN(price) || isNaN(duration) || price <= 0 || duration <= 0) {
                setExclusiveFormError('El precio y la duración deben ser números positivos');
                return;
              }

              const newService = {
                name: formExclusive.name,
                price,
                duration,
                description: formExclusive.description || '',
                shopId: shop.id,
              };

              dispatch({ type: 'ADD_SERVICE', payload: newService });

              dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                  message: 'Servicio exclusivo creado correctamente',
                  type: 'success',
                },
              });

              setShowAddExclusive(false);
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del servicio *</label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-300 rounded"
                  value={formExclusive.name}
                  onChange={(e) => setFormExclusive({ ...formExclusive, name: e.target.value })}
                  placeholder="Ej: Corte VIP"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio (RD$) *</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded"
                    value={formExclusive.price}
                    onChange={(e) => setFormExclusive({ ...formExclusive, price: e.target.value })}
                    placeholder="Ej: 800"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duración (min) *</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded"
                    value={formExclusive.duration}
                    onChange={(e) => setFormExclusive({ ...formExclusive, duration: e.target.value })}
                    placeholder="Ej: 45"
                    min="5"
                    step="5"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <textarea
                  className="w-full p-2 border border-slate-300 rounded"
                  value={formExclusive.description}
                  onChange={(e) => setFormExclusive({ ...formExclusive, description: e.target.value })}
                  placeholder="Descripción detallada del servicio..."
                  rows="3"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                  onClick={() => setShowAddExclusive(false)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                >
                  Guardar servicio exclusivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para editar servicio exclusivo */}
      {showEditExclusive && shop && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Editar servicio exclusivo</h3>
            {exclusiveFormError && <div className="bg-red-50 text-red-500 p-2 rounded mb-3 text-sm">{exclusiveFormError}</div>}

            <form onSubmit={(e) => {
              e.preventDefault();

              if (!formExclusive.name || !formExclusive.price || !formExclusive.duration) {
                setExclusiveFormError('Todos los campos marcados con * son obligatorios');
                return;
              }

              const price = parseFloat(formExclusive.price);
              const duration = parseInt(formExclusive.duration);

              if (isNaN(price) || isNaN(duration) || price <= 0 || duration <= 0) {
                setExclusiveFormError('El precio y la duración deben ser números positivos');
                return;
              }

              const updatedService = {
                id: showEditExclusive,
                name: formExclusive.name,
                price,
                duration,
                description: formExclusive.description || '',
                shopId: shop.id,
              };

              dispatch({ type: 'UPDATE_SERVICE', payload: updatedService });

              dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                  message: 'Servicio exclusivo actualizado correctamente',
                  type: 'success',
                },
              });

              setShowEditExclusive(null);
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre del servicio *</label>
                <input
                  type="text"
                  className="w-full p-2 border border-slate-300 rounded"
                  value={formExclusive.name}
                  onChange={(e) => setFormExclusive({ ...formExclusive, name: e.target.value })}
                  placeholder="Ej: Corte VIP"
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio (RD$) *</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded"
                    value={formExclusive.price}
                    onChange={(e) => setFormExclusive({ ...formExclusive, price: e.target.value })}
                    placeholder="Ej: 800"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duración (min) *</label>
                  <input
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded"
                    value={formExclusive.duration}
                    onChange={(e) => setFormExclusive({ ...formExclusive, duration: e.target.value })}
                    placeholder="Ej: 45"
                    min="5"
                    step="5"
                  />
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <textarea
                  className="w-full p-2 border border-slate-300 rounded"
                  value={formExclusive.description}
                  onChange={(e) => setFormExclusive({ ...formExclusive, description: e.target.value })}
                  placeholder="Descripción detallada del servicio..."
                  rows="3"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 mt-6">
                <button
                  type="button"
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                  onClick={() => setShowEditExclusive(null)}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                >
                  Actualizar servicio exclusivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para añadir servicio individual a un barbero */}
      {showAddBarber && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">
              Nuevo Servicio Individual
              <span className="block text-sm font-normal text-slate-500 mt-1">
                {state.users.find(u => u.id === showAddBarber)?.name || 'Barbero'}
              </span>
            </h3>
            {barberFormError && <div className="bg-red-50 text-red-500 p-2 rounded mb-3 text-sm">{barberFormError}</div>}
            
            <form onSubmit={(e) => {
              e.preventDefault();
              
              // Validar campos
              if (!formBarber.name || !formBarber.price || !formBarber.duration) {
                setBarberFormError('Todos los campos marcados con * son obligatorios');
                return;
              }
              
              // Convertir precio y duración a números
              const price = parseFloat(formBarber.price);
              const duration = parseInt(formBarber.duration);
              
              // Validar que sean números válidos
              if (isNaN(price) || isNaN(duration) || price <= 0 || duration <= 0) {
                setBarberFormError('El precio y la duración deben ser números positivos');
                return;
              }
              
              // Crear el nuevo servicio
              const serviceId = 'svc' + Date.now(); // Genera un ID único
              const newService = {
                id: serviceId,
                name: formBarber.name,
                price,
                duration,
                description: formBarber.description || '',
                barberId: showAddBarber
              };
              
              // Dispatch para añadir el servicio al estado global
              dispatch({
                type: 'ADD_SERVICE',
                payload: newService
              });
              
              // Dispatch para añadir el servicio a la lista de servicios del barbero
              dispatch({
                type: 'ADD_BARBER_SERVICE',
                payload: {
                  barberId: showAddBarber,
                  serviceId: serviceId
                }
              });
              
              // Mostrar notificación de éxito
              dispatch({
                type: 'SHOW_NOTIFICATION',
                payload: {
                  message: 'Servicio individual agregado correctamente',
                  type: 'success'
                }
              });
              
              // Cerrar el modal
              setShowAddBarber(null);
            }}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Seleccionar servicio general *</label>
                <select 
                  className="w-full p-2 border border-slate-300 rounded mb-2"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) {
                      const selectedService = generalServices.find(s => s.id === e.target.value);
                      if (selectedService) {
                        setFormBarber({
                          name: selectedService.name,
                          price: selectedService.price.toString(),
                          duration: selectedService.duration.toString(),
                          description: selectedService.description || ''
                        });
                      }
                    }
                  }}
                >
                  <option value="">-- Selecciona un servicio existente --</option>
                  {generalServices.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} - RD${service.price} - {service.duration} min
                    </option>
                  ))}
                </select>
                
                <label className="block text-sm font-medium text-slate-700 mb-1 mt-4">Nombre del servicio *</label>
                <input 
                  type="text"
                  className="w-full p-2 border border-slate-300 rounded"
                  value={formBarber.name}
                  onChange={(e) => setFormBarber({...formBarber, name: e.target.value})}
                  placeholder="Ej: Corte personalizado"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio (RD$) *</label>
                  <input 
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded"
                    value={formBarber.price}
                    onChange={(e) => setFormBarber({...formBarber, price: e.target.value})}
                    placeholder="Ej: 450"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Duración (min) *</label>
                  <input 
                    type="number"
                    className="w-full p-2 border border-slate-300 rounded"
                    value={formBarber.duration}
                    onChange={(e) => setFormBarber({...formBarber, duration: e.target.value})}
                    placeholder="Ej: 35"
                    min="5"
                    step="5"
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Descripción (opcional)</label>
                <textarea 
                  className="w-full p-2 border border-slate-300 rounded"
                  value={formBarber.description}
                  onChange={(e) => setFormBarber({...formBarber, description: e.target.value})}
                  placeholder="Descripción detallada del servicio..."
                  rows="3"
                ></textarea>
              </div>
              
              <div className="flex justify-end space-x-2 mt-6">
                <button 
                  type="button" 
                  className="px-4 py-2 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                  onClick={() => setShowAddBarber(null)}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Guardar Servicio
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OwnerServicesManagement;
