import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../App';
import Modal from './ui/Modal';

const OwnerAppointmentsManagement = () => {
  const { state } = useContext(AppContext);
  const owner = state.currentUser;
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'completed', 'cancelled'
  const [search, setSearch] = useState('');
  const [selectedShop, setSelectedShop] = useState('all');
  const [showAllForShopId, setShowAllForShopId] = useState(null);

  // Obtener todas las barberías visibles para este usuario
  const isAdmin = ((owner?.role || owner?.rol || '') + '').toLowerCase().includes('admin');
  const allShops = (state.barberShops || []).filter(shop =>
    isAdmin ? true : shop.ownerId === owner?.id
  );

  const ownerShopIds = allShops.map(s => s.id);
  const selectedShopIdNum = selectedShop === 'all' ? null : Number(selectedShop);
  
  // Filtrar citas según los criterios seleccionados
  const filteredAppointments = state.appointments.filter(appointment => {
    // Un dueño normal solo ve citas de sus barberías
    if (!isAdmin && !ownerShopIds.includes(appointment.shopId)) {
      return false;
    }
    // Filtro por barbería
    if (selectedShopIdNum !== null && appointment.shopId !== selectedShopIdNum) {
      return false;
    }
    
    // Filtro por estado
    if (filter !== 'all' && appointment.status !== filter) {
      return false;
    }
    
    // Filtro por búsqueda (nombre de cliente, barbero, servicio)
    if (search) {
      const client = state.users.find(user => user.id === appointment.clientId);
      const barber = state.users.find(user => user.id === appointment.barberId);
      const service = state.masterServices.find(service => service.id === appointment.serviceId);
      const shop = state.barberShops.find(shop => shop.id === appointment.shopId);
      
      const searchLower = search.toLowerCase();
      const clientMatch = client && client.name.toLowerCase().includes(searchLower);
      const barberMatch = barber && barber.name.toLowerCase().includes(searchLower);
      const serviceMatch = service && service.name.toLowerCase().includes(searchLower);
      const shopMatch = shop && shop.name.toLowerCase().includes(searchLower);
      
      return clientMatch || barberMatch || serviceMatch || shopMatch;
    }
    
    return true;
  });

  // Agrupar citas por barbería
  const appointmentsByShop = {};
  
  filteredAppointments.forEach(appointment => {
    if (!appointmentsByShop[appointment.shopId]) {
      appointmentsByShop[appointment.shopId] = [];
    }
    appointmentsByShop[appointment.shopId].push(appointment);
  });

  // Función para formatear fecha
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Función para obtener el color de estado
  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'confirmed': return 'Confirmada';
      case 'pending': return 'Pendiente';
      case 'cancelled': return 'Cancelada';
      case 'completed': return 'Completada';
      default: return status;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Gestión de Citas</h2>
        <div className="flex flex-wrap gap-3">
          <select 
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={selectedShop}
            onChange={(e) => setSelectedShop(e.target.value)}
          >
            <option value="all">Todas las barberías</option>
            {allShops.map(shop => (
              <option key={shop.id} value={shop.id}>{shop.name}</option>
            ))}
          </select>
          
          <select 
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">Todos los estados</option>
            <option value="confirmed">Confirmadas</option>
            <option value="pending">Pendientes</option>
            <option value="completed">Completadas</option>
            <option value="cancelled">Canceladas</option>
          </select>
          
          <input
            type="text"
            placeholder="Buscar por cliente, barbero..."
            className="border border-slate-300 rounded-md px-3 py-2 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {Object.keys(appointmentsByShop).length > 0 ? (
          Object.keys(appointmentsByShop).map(shopId => {
            const shopIdNum = Number(shopId);
            const shop = state.barberShops.find(s => s.id === shopIdNum);
            const appointments = appointmentsByShop[shopId];
            
            return (
              <div key={shopId} className="bg-slate-50 rounded-lg shadow p-5 border border-slate-200">
                <div className="flex items-center mb-4">
                  <img 
                    src={state.barberShopPhotos?.[shopId]?.[0] || 'https://placehold.co/60x60?text=Barbería'}
                    alt={shop?.name} 
                    className="w-12 h-12 rounded-full object-cover mr-3 border-2 border-indigo-100"
                  />
                  <div>
                    <h3 className="font-semibold text-lg text-slate-800">{shop?.name || 'Barbería'}</h3>
                    <div className="text-xs text-slate-500">
                      {appointments.length} {appointments.length === 1 ? 'cita' : 'citas'}
                    </div>
                  </div>
                </div>
                
                <div className="overflow-hidden rounded-lg border border-slate-200 mb-3">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase">Cliente</th>
                        <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                        <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {appointments.slice(0, 5).map(appointment => {
                        const client = state.users.find(u => u.id === appointment.clientId);
                        
                        return (
                          <tr key={appointment.id} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-sm text-slate-700">{client?.name || 'Cliente'}</td>
                            <td className="py-2 px-3 text-sm text-slate-700">{formatDate(appointment.startTime)}</td>
                            <td className="py-2 px-3">
                              <span className={`inline-block text-xs px-2 py-1 rounded-full ${getStatusColor(appointment.status)}`}>
                                {getStatusText(appointment.status)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                
                {appointments.length > 5 && (
                  <div className="text-center">
                    <button
                      className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                      onClick={() => setShowAllForShopId(shopIdNum)}
                      type="button"
                    >
                      Ver todas ({appointments.length})
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-2 text-center py-8 text-slate-500">
            No se encontraron citas con los filtros seleccionados.
          </div>
        )}
      </div>
      
      <div className="mt-6 border-t border-slate-200 pt-6">
        <h3 className="text-lg font-semibold text-slate-700 mb-3">Resumen de Citas</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="text-3xl font-bold text-blue-700 mb-1">
              {filteredAppointments.length}
            </div>
            <div className="text-sm text-blue-600">Total de citas</div>
          </div>
          
          <div className="bg-green-50 rounded-lg p-4 border border-green-100">
            <div className="text-3xl font-bold text-green-700 mb-1">
              {filteredAppointments.filter(a => a.status === 'confirmed').length}
            </div>
            <div className="text-sm text-green-600">Confirmadas</div>
          </div>
          
          <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
            <div className="text-3xl font-bold text-yellow-700 mb-1">
              {filteredAppointments.filter(a => a.status === 'pending').length}
            </div>
            <div className="text-sm text-yellow-600">Pendientes</div>
          </div>
          
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <div className="text-3xl font-bold text-red-700 mb-1">
              {filteredAppointments.filter(a => a.status === 'cancelled').length}
            </div>
            <div className="text-sm text-red-600">Canceladas</div>
          </div>
        </div>
      </div>

      <Modal
        isOpen={showAllForShopId !== null}
        onClose={() => setShowAllForShopId(null)}
        title={(() => {
          const shop = (state.barberShops || []).find(s => s.id === showAllForShopId);
          return `Todas las citas - ${shop?.name || 'Barbería'}`;
        })()}
        size="lg"
      >
        {(() => {
          const list = (filteredAppointments || [])
            .filter(a => a.shopId === showAllForShopId)
            .slice()
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

          return (
            <div className="overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase">Cliente</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase">Barbero</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase">Fecha</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-slate-500 uppercase">Estado</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {list.map(appointment => {
                    const client = (state.users || []).find(u => u.id === appointment.clientId);
                    const barber = (state.users || []).find(u => u.id === appointment.barberId);
                    return (
                      <tr key={appointment.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 text-sm text-slate-700">{client?.name || 'Cliente'}</td>
                        <td className="py-2 px-3 text-sm text-slate-700">{barber?.name || '—'}</td>
                        <td className="py-2 px-3 text-sm text-slate-700">{formatDate(appointment.startTime)}</td>
                        <td className="py-2 px-3">
                          <span className={`inline-block text-xs px-2 py-1 rounded-full ${getStatusColor(appointment.status)}`}>
                            {getStatusText(appointment.status)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {list.length === 0 && (
                <div className="text-center text-slate-500 py-8">
                  No hay citas para mostrar.
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
};

export default OwnerAppointmentsManagement;
