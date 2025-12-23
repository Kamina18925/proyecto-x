import React, { useContext, useState } from 'react';
import { AppContext } from '../App';

const StatCard = ({ icon, count, label, color, trend }) => {
  // Determinar el icono y color de tendencia
  let trendIcon = trend > 0 ? 'fa-arrow-up' : trend < 0 ? 'fa-arrow-down' : 'fa-minus';
  let trendColor = trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-slate-400';
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 transition-all duration-200 ease-in-out hover:shadow-md">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-2xl sm:text-3xl font-bold text-slate-800">{count}</div>
          <div className="text-sm text-slate-500 mt-1">{label}</div>
          {trend !== undefined && (
            <div className="flex items-center mt-2 text-xs">
              <span className={`${trendColor} mr-1`}>
                <i className={`fas ${trendIcon} mr-1`}></i>
                {Math.abs(trend)}%
              </span>
              <span className="text-slate-400">vs mes anterior</span>
            </div>
          )}
        </div>
        <div className={`bg-${color}-100 rounded-full p-3 flex items-center justify-center`}>
          <i className={`fas fa-${icon} text-xl text-${color}-500`}></i>
        </div>
      </div>
    </div>
  );
};

const AppointmentItem = ({ appointment, client, barber, service }) => {
  // Generar colores de estado
  const statusStyles = {
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-blue-100 text-blue-800',
    cancelled: 'bg-red-100 text-red-800',
    'in-progress': 'bg-amber-100 text-amber-800'
  };
  
  const statusNames = {
    completed: 'Completada',
    pending: 'Pendiente',
    cancelled: 'Cancelada',
    'in-progress': 'En progreso'
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: '2-digit', 
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  return (
    <div className="flex items-center p-3 border-b border-slate-100 hover:bg-slate-50 transition-colors last:border-b-0">
      <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3 flex-shrink-0">
        <i className="fas fa-user text-indigo-400"></i>
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-start">
          <div className="truncate">
            <div className="font-medium text-slate-800 truncate">{client?.name || 'Cliente'}</div>
            <div className="text-xs text-slate-500 truncate">{service?.name || 'Servicio'}</div>
          </div>
          <span className={`ml-2 px-2 py-1 rounded-full text-xs whitespace-nowrap ${statusStyles[appointment.status] || statusStyles.pending}`}>
            {statusNames[appointment.status] || 'Pendiente'}
          </span>
        </div>
        <div className="flex justify-between mt-1 text-xs">
          <div className="text-slate-500 truncate">
            <i className="fas fa-user-tie mr-1"></i> {barber?.name || 'Barbero'}
          </div>
          <div className="text-slate-500 whitespace-nowrap">
            <i className="far fa-clock mr-1"></i> {formatDate(appointment.startTime || appointment.date)}
          </div>
        </div>
      </div>
    </div>
  );
};

const BarberPerformanceCard = ({ barber, appointments, services }) => {
  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getServicePrice = (svc) => {
    if (!svc) return 0;
    return toNumber(
      svc.basePrice ??
      svc.base_price ??
      svc.price ??
      svc.precio ??
      0
    );
  };

  const getAppointmentPrice = (appt) => {
    if (!appt) return 0;
    const direct = appt.priceAtBooking ?? appt.price_at_booking ?? null;
    if (direct != null) return toNumber(direct);
    const svcId = appt.serviceId ?? appt.service_id ?? null;
    const svc = (services || []).find(s => String(s?.id) === String(svcId));
    return getServicePrice(svc);
  };

  // Calcular estadísticas
  const barberAppointments = appointments.filter(a => a.barberId === barber.id);
  const completedAppointments = barberAppointments.filter(a => a.status === 'completed');
  const completionRate = barberAppointments.length > 0 
    ? Math.round((completedAppointments.length / barberAppointments.length) * 100) 
    : 0;
    
  // Calcular ingresos
  const revenue = completedAppointments.reduce((sum, appointment) => {
    return sum + getAppointmentPrice(appointment);
  }, 0);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-center">
        <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
          <i className="fas fa-user-tie text-indigo-400 text-xl"></i>
        </div>
        <div>
          <h4 className="font-semibold text-slate-800">{barber.name}</h4>
          <div className="text-xs text-slate-500">{barber.email || 'Email'}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 mt-4 text-center">
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-sm text-slate-500">Citas</div>
          <div className="font-bold text-indigo-600">{barberAppointments.length}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-sm text-slate-500">Completadas</div>
          <div className="font-bold text-green-600">{completedAppointments.length}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-sm text-slate-500">Ratio</div>
          <div className="font-bold text-amber-600">{completionRate}%</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-2">
          <div className="text-sm text-slate-500">Ingresos</div>
          <div className="font-bold text-blue-600">RD${revenue}</div>
        </div>
      </div>
    </div>
  );
};

const ShopCard = ({ shop, appointments, barbers, revenue, onViewDetails }) => {
  const shopAppointments = appointments.filter(a => a.shopId === shop.id);
  const shopBarbers = barbers.filter(b => b.shopId === shop.id);
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow overflow-hidden">
      <div className="h-24 bg-gradient-to-r from-indigo-500 to-purple-600 relative">
        {shop.coverPhoto && (
          <img 
            src={shop.coverPhoto} 
            alt={shop.name} 
            className="w-full h-full object-cover opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-end p-3">
          <h3 className="text-white font-bold text-lg drop-shadow-sm">{shop.name}</h3>
        </div>
      </div>
      <div className="p-4">
        <div className="text-sm text-slate-500 mb-2">
          <i className="fas fa-map-marker-alt mr-1"></i> {shop.city || 'Sin ubicación'}
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-50 rounded p-2">
            <div className="text-xs text-slate-500">Barberos</div>
            <div className="font-semibold text-indigo-600">{shopBarbers.length}</div>
          </div>
          <div className="bg-slate-50 rounded p-2">
            <div className="text-xs text-slate-500">Citas</div>
            <div className="font-semibold text-green-600">{shopAppointments.length}</div>
          </div>
        </div>

        <div className="mt-2 text-sm text-slate-700">
          <span className="text-xs text-slate-500">Ingresos:</span>{' '}
          <span className="font-semibold text-indigo-700">RD${(Number(revenue) || 0).toLocaleString()}</span>
        </div>
        
        <div className="mt-3 text-right">
          <button 
            className="text-indigo-600 text-sm hover:text-indigo-800"
            onClick={onViewDetails}
            data-component-name="ShopCard"
          >
            <i className="fas fa-external-link-alt mr-1"></i> Ver detalles
          </button>
        </div>
      </div>
    </div>
  );
};

const OwnerSummary = ({ shop, appointments, barbers }) => {
  const { state } = useContext(AppContext);
  const owner = state.currentUser;
  const [period, setPeriod] = useState('week');

  const toNumber = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const getServicePrice = (svc) => {
    if (!svc) return 0;
    return toNumber(
      svc.basePrice ??
      svc.base_price ??
      svc.price ??
      svc.precio ??
      0
    );
  };

  const getAppointmentPrice = (appt) => {
    if (!appt) return 0;
    const direct = appt.priceAtBooking ?? appt.price_at_booking ?? null;
    if (direct != null) return toNumber(direct);
    const svcId = appt.serviceId ?? appt.service_id ?? null;
    const svc = (state.services || []).find(s => String(s?.id) === String(svcId));
    return getServicePrice(svc);
  };
  
  // Navegación entre secciones - con verificación adicional
  const handleNavigation = (section) => {
    try {
      // Buscar el elemento padre del dashboard
      const dashboardElement = document.querySelector('[data-component-name="OwnerDashboard"]');
      if (dashboardElement) {
        // Encontrar todos los botones de navegación
        const navButtons = dashboardElement.querySelectorAll('button[data-section]');
        let found = false;
        // Buscar y hacer clic en el botón de la sección correspondiente
        navButtons.forEach(button => {
          if (button.getAttribute('data-section') === section) {
            button.click();
            found = true;
          }
        });
        
        if (!found) {
          console.log(`No se encontró el botón para la sección: ${section}`);
        }
      } else {
        console.log('No se encontró el componente OwnerDashboard');
      }
    } catch (error) {
      console.error('Error al navegar:', error);
    }
  };
  
  // Abrir el formulario para añadir una barbería - con verificación adicional
  const handleAddBarberShop = () => {
    try {
      // Primero navegar a la sección de barberías
      handleNavigation('barberShops');
      // Luego, con un pequeño retraso, buscar y hacer clic en el botón de añadir
      setTimeout(() => {
        const addButton = document.querySelector('[data-component-name="OwnerBarberShopsManagement"] button[data-action="add"]');
        if (addButton) {
          addButton.click();
        } else {
          console.log('No se encontró el botón de añadir barbería');
        }
      }, 300);
    } catch (error) {
      console.error('Error al abrir formulario de añadir barbería:', error);
    }
  };
  
  // Estadísticas generales
  const totalAppointments = appointments?.length || 0;
  const pendingAppointments = appointments?.filter(a => a.status === 'pending').length || 0;
  const totalBarbers = barbers?.length || 0;
  
  // Calcular ingresos
  const calculateRevenue = () => {
    return (appointments || [])
      .filter(a => a.status === 'completed')
      .reduce((sum, appointment) => {
        return sum + getAppointmentPrice(appointment);
      }, 0);
  };
  
  const totalRevenue = calculateRevenue();
  
  // Filtrar citas recientes
  const recentAppointments = [...(appointments || [])]
    .sort((a, b) => new Date(b.startTime || b.date) - new Date(a.startTime || a.date))
    .slice(0, 5);
    
  // Obtener los mejores barberos
  const topBarbers = barbers?.slice(0, 3) || [];
    
  // Obtener las barberías visibles para este dueño (o todas si es admin)
  const isAdmin = ((owner?.role || owner?.rol || '') + '').toLowerCase().includes('admin');
  const shops = (state.barberShops || [])
    .filter(s => (isAdmin ? true : s.ownerId === owner?.id))
    .slice(0, 3);

  const shopRevenueMap = (appointments || []).reduce((acc, appt) => {
    const st = String(appt?.status || '').trim().toLowerCase();
    if (st !== 'completed' && st !== 'completada' && st !== 'completado') return acc;
    const sid = appt?.shopId ?? appt?.shop_id ?? null;
    if (sid == null) return acc;
    const key = String(sid);
    acc[key] = (acc[key] || 0) + getAppointmentPrice(appt);
    return acc;
  }, {});

  return (
    <div className="space-y-8" data-component-name="OwnerSummary">
      {/* Encabezado con selectores */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-800">Panel de Control</h2>
        <div className="flex bg-slate-100 rounded-lg p-1">
          <button 
            className={`px-4 py-1.5 text-sm font-medium rounded-md ${period === 'week' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
            onClick={() => setPeriod('week')}
          >
            Semana
          </button>
          <button 
            className={`px-4 py-1.5 text-sm font-medium rounded-md ${period === 'month' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
            onClick={() => setPeriod('month')}
          >
            Mes
          </button>
          <button 
            className={`px-4 py-1.5 text-sm font-medium rounded-md ${period === 'year' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-800'}`}
            onClick={() => setPeriod('year')}
          >
            Año
          </button>
        </div>
      </div>
      
      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          icon="calendar-check" 
          count={totalAppointments} 
          label="Citas Totales" 
          color="blue" 
          trend={8} 
        />
        <StatCard 
          icon="clock" 
          count={pendingAppointments} 
          label="Citas Pendientes" 
          color="amber" 
          trend={-3} 
        />
        <StatCard 
          icon="user-tie" 
          count={totalBarbers} 
          label="Barberos Activos" 
          color="indigo" 
          trend={0} 
        />
        <StatCard 
          icon="dollar-sign" 
          count={`RD$${totalRevenue.toLocaleString()}`} 
          label="Ingresos Totales" 
          color="green" 
          trend={12} 
        />
      </div>
      
      {/* Contenido principal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Citas recientes */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <h3 className="font-semibold text-slate-800">Citas Recientes</h3>
            <button 
              className="text-indigo-600 text-sm hover:text-indigo-800"
              onClick={() => handleNavigation('shopAppointments')}
            >
              Ver todas <i className="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {recentAppointments.map(appointment => {
              const client = state.users.find(u => u.id === appointment.clientId);
              const barber = state.users.find(u => u.id === appointment.barberId);
              const service = state.services.find(s => s.id === appointment.serviceId);
              return (
                <AppointmentItem 
                  key={appointment.id} 
                  appointment={appointment} 
                  client={client} 
                  barber={barber} 
                  service={service} 
                />
              );
            })}
            {recentAppointments.length === 0 && (
              <div className="p-4 text-center text-slate-500">
                No hay citas recientes.
              </div>
            )}
          </div>
        </div>
        
        {/* Panel de ingresos */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <h3 className="font-semibold text-slate-800">Resumen Financiero</h3>
          </div>
          <div className="p-4">
            <div className="text-center py-6 border-b border-slate-100">
              <div className="text-sm text-slate-500 mb-1">Ingresos Totales</div>
              <div className="text-3xl font-bold text-indigo-600">RD${totalRevenue.toLocaleString()}</div>
              <div className="flex items-center justify-center mt-2 text-sm text-green-500">
                <i className="fas fa-arrow-up mr-1"></i> 12% vs mes anterior
              </div>
            </div>
            
            <div className="pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-slate-800">Efectivo</div>
                  <div className="text-xs text-slate-500">60% de pagos</div>
                </div>
                <div className="text-lg font-semibold text-slate-800">RD${Math.round(totalRevenue * 0.6).toLocaleString()}</div>
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-slate-800">Tarjeta</div>
                  <div className="text-xs text-slate-500">35% de pagos</div>
                </div>
                <div className="text-lg font-semibold text-slate-800">RD${Math.round(totalRevenue * 0.35).toLocaleString()}</div>
              </div>
              
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm font-medium text-slate-800">Transferencia</div>
                  <div className="text-xs text-slate-500">5% de pagos</div>
                </div>
                <div className="text-lg font-semibold text-slate-800">RD${Math.round(totalRevenue * 0.05).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Sección inferior: Barberos y Barberías */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mejores barberos */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Barberos Destacados</h3>
            <button 
              className="text-indigo-600 text-sm hover:text-indigo-800"
              onClick={() => handleNavigation('manageBarbers')}
            >
              Ver todos <i className="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {topBarbers.map(barber => (
              <BarberPerformanceCard 
                key={barber.id} 
                barber={barber} 
                appointments={state.appointments} 
                services={state.services} 
              />
            ))}
            {topBarbers.length === 0 && (
              <div className="p-4 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-100">
                No hay barberos registrados.
              </div>
            )}
          </div>
        </div>
        
        {/* Barberías */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Mis Barberías</h3>
            <button 
              className="text-indigo-600 text-sm hover:text-indigo-800"
              onClick={() => handleNavigation('barberShops')}
            >
              Ver todas <i className="fas fa-chevron-right ml-1"></i>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
            {shops.map(shop => (
              <ShopCard 
                key={shop.id} 
                shop={shop} 
                appointments={state.appointments} 
                barbers={state.users.filter(u => u.role === 'barber')}
                revenue={shopRevenueMap[String(shop.id)] || 0}
                onViewDetails={() => {
                  handleNavigation('barberShops');
                }} 
              />
            ))}
            {shops.length === 0 && (
              <div className="p-4 text-center text-slate-500 bg-white rounded-xl shadow-sm border border-slate-100">
                No hay barberías registradas.
              </div>
            )}
            
            <div 
              className="bg-indigo-50 rounded-xl border border-indigo-100 p-4 flex flex-col items-center justify-center hover:bg-indigo-100 transition-colors cursor-pointer"
              onClick={handleAddBarberShop}
            >
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-2">
                <i className="fas fa-plus text-indigo-500 text-xl"></i>
              </div>
              <div className="font-medium text-indigo-700">Añadir Barbería</div>
              <div className="text-xs text-indigo-500 mt-1">Expande tu negocio</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerSummary;
