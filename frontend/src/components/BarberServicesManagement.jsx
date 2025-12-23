import React, { useContext, useState } from 'react';
import { AppContext } from '../App';

const BarberServicesManagement = ({ barber, shop }) => {
  const { state, dispatch } = useContext(AppContext);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', price: '', duration: '', description: '' });
  const [error, setError] = useState('');
  const [editingService, setEditingService] = useState(null); // null = creando, objeto = editando

  // Servicios visibles para este barbero en su panel:
  // - Todos los servicios generales (sin shopId)
  // - Todos los servicios exclusivos de su barbería actual (shopId = shop.id)
  const allServices = Array.isArray(state.services) ? state.services : [];
  const barberShopId = shop?.id ?? null;

  // Lista de servicios visibles en esta vista (generales + exclusivos de la barbería)
  const barberServices = allServices.filter(svc => {
    const serviceShopId = svc.shopId ?? svc.shop_id ?? null;
    // Generales (sin barbería) o exclusivos de esta barbería
    return serviceShopId == null || (barberShopId != null && String(serviceShopId) === String(barberShopId));
  });

  // IDs de servicios actualmente asignados a este barbero (barberServices global)
  const assignedServiceIds = (state.barberServices?.[barber?.id] || []).map(id => String(id));

  const toggleServiceForBarber = (serviceId) => {
    if (!barber?.id) return;
    const sid = String(serviceId);
    const current = new Set(assignedServiceIds);
    if (current.has(sid)) current.delete(sid); else current.add(sid);

    const newIds = Array.from(current).map(x => Number.isNaN(Number(x)) ? x : Number(x));

    dispatch({
      type: 'SET_BARBER_SERVICES_FOR_BARBERS',
      payload: {
        barberIds: [barber.id],
        servicesByBarber: {
          [barber.id]: newIds,
        },
      },
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-indigo-700">Mis Servicios</h2>
        <button
          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded shadow"
          onClick={() => {
            setEditingService(null);
            setForm({ name: '', price: '', duration: '', description: '' });
            setError('');
            setShowAdd(true);
          }}
        >
          <i className="fas fa-plus-circle mr-2"></i>Nuevo Servicio
        </button>
      </div>
      {barberServices.length > 0 ? (
        <div className="space-y-4">
          {barberServices.map(service => (
            <div key={service.id} className="p-4 border-l-4 border-indigo-400 bg-white rounded-lg shadow flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <div className="font-semibold text-indigo-700 text-lg flex items-center">
                  <i className="fas fa-cut mr-2 text-indigo-400"></i>{service.name}
                </div>
                <div className="text-slate-600 text-sm">RD${service.price} • {service.duration} min</div>
                <label className="mt-1 inline-flex items-center text-xs text-slate-600">
                  <input
                    type="checkbox"
                    className="form-checkbox h-4 w-4 text-indigo-600 mr-1"
                    checked={assignedServiceIds.includes(String(service.id))}
                    onChange={() => toggleServiceForBarber(service.id)}
                  />
                  Yo ofrezco este servicio
                </label>
                {service.description && <div className="text-slate-400 text-xs mt-1">{service.description}</div>}
              </div>
              <div className="flex gap-2 mt-2 md:mt-0">
                <button
                  className="bg-yellow-400 hover:bg-yellow-500 text-white px-3 py-1 rounded shadow text-xs font-semibold flex items-center"
                  onClick={() => {
                    setEditingService(service);
                    setForm({
                      name: service.name || '',
                      price: String(service.price ?? ''),
                      duration: String(service.duration ?? ''),
                      description: service.description || ''
                    });
                    setError('');
                    setShowAdd(true);
                  }}
                >
                  <i className="fas fa-edit mr-1"></i>Editar
                </button>
                <button
                  className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded shadow text-xs font-semibold flex items-center"
                  onClick={() => {
                    if (!window.confirm('¿Seguro que deseas eliminar este servicio?')) return;
                    if (!service.id) return;
                    dispatch({ type: 'DELETE_SERVICE', payload: service.id });
                  }}
                >
                  <i className="fas fa-trash-alt mr-1"></i>Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">No tienes servicios personalizados.</p>
      )}
      {/* Modal o formulario para añadir servicio */}
      {showAdd && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">{editingService ? 'Editar Servicio' : 'Nuevo Servicio Personal'}</h3>
            <form onSubmit={e => {
              e.preventDefault();
              if (!form.name || !form.price || !form.duration) {
                setError('Todos los campos obligatorios.');
                return;
              }
              const payloadBase = {
                name: form.name,
                price: Number(form.price),
                duration: Number(form.duration),
                description: form.description,
                barberId: barber?.id,
                shopId: shop?.id
              };

              if (editingService && editingService.id) {
                // Actualizar servicio existente
                dispatch({
                  type: 'UPDATE_SERVICE',
                  payload: {
                    ...editingService,
                    ...payloadBase,
                    id: editingService.id
                  }
                });
              } else {
                // Crear nuevo servicio personal
                dispatch({
                  type: 'ADD_SERVICE',
                  payload: payloadBase
                });
              }
              setShowAdd(false);
              setForm({ name: '', price: '', duration: '', description: '' });
              setError('');
              setEditingService(null);
            }} className="space-y-3">
              <input
                type="text"
                className="w-full border p-2 rounded"
                placeholder="Nombre del servicio"
                value={form?.name || ''}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
              <input
                type="number"
                className="w-full border p-2 rounded"
                placeholder="Precio"
                value={form?.price || ''}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                required
              />
              <input
                type="number"
                className="w-full border p-2 rounded"
                placeholder="Duración (min)"
                value={form?.duration || ''}
                onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                required
              />
              <textarea
                className="w-full border p-2 rounded"
                placeholder="Descripción"
                value={form?.description || ''}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
              />
              {error && <div className="text-red-500 text-sm">{error}</div>}
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded"
                  onClick={() => {
                    setShowAdd(false);
                    setError('');
                    setEditingService(null);
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded">
                  {editingService ? 'Guardar cambios' : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarberServicesManagement;
