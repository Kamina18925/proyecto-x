import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../App';
import BarberOverview from './BarberOverview';
import BarberAppointmentsView from './BarberAppointmentsView';
import BarberAvailabilityManagement from './BarberAvailabilityManagement';
import BarberServicesManagement from './BarberServicesManagement';
import BarberProductsManagement from './BarberProductsManagement';
import BarberShopInfoView from './BarberShopInfoView';

// Fiel al HTML original: navegación, layout, clases y lógica
const navItems = [
  { key: 'barberOverview', label: 'Resumen', icon: 'fas fa-chart-line' },
  { key: 'barberAppointments', label: 'Mis Citas', icon: 'fas fa-calendar-check' },
  { key: 'barberAvailability', label: 'Mi Disponibilidad', icon: 'fas fa-user-clock' },
  { key: 'barberServices', label: 'Mis Servicios', icon: 'fas fa-cut' },
  { key: 'barberProducts', label: 'Mis Productos', icon: 'fas fa-box-open' },
  { key: 'barberShopInfo', label: 'Info de Barbería', icon: 'fas fa-store-alt' },
];

const BarberDashboard = () => {
  const { state, dispatch } = useContext(AppContext);

  // Preferir el usuario desde la lista global (ya normalizado con shopId, photoUrl, etc.)
  const baseUser = state.currentUser;
  const barberFromList = (state.users || []).find(u => u.id === baseUser?.id);
  const barber = barberFromList || baseUser;
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const currentBarberView = state.currentSubView || 'barberOverview';

  // Obtener barbería usando shopId normalizado o, en su defecto, shop_id
  const barberShopId = barber?.shopId ?? barber?.shop_id ?? null;
  const barberShop = state.barberShops.find(shop => shop.id === barberShopId);

  useEffect(() => {
    const onUnread = (ev) => {
      const count = ev?.detail?.count ?? 0;
      setChatUnreadCount(typeof count === 'number' ? count : 0);
    };
    window.addEventListener('chat-unread-changed', onUnread);
    return () => window.removeEventListener('chat-unread-changed', onUnread);
  }, []);

  const handleOpenChatFromSidebar = () => {
    try {
      window.dispatchEvent(new Event('open-chat-widget'));
    } catch (e) {
      console.error('No se pudo abrir el chat desde el panel de barbero:', e);
    }
  };

  // Lógica de renderizado exactamente como en el HTML fuente
  const renderBarberView = () => {
    if (!barberShop && !['barberOverview', 'barberAvailability', 'barberProducts'].includes(currentBarberView)) {
      return (
        <div className="text-center p-8 bg-white rounded-lg shadow">
          <p className="text-xl text-gray-600">No estás asignado a una barbería.</p>
          <p className="mt-2 text-gray-500">Contacta al administrador.</p>
        </div>
      );
    }
    switch (currentBarberView) {
      case 'barberOverview':
        return <BarberOverview barber={barber} shop={barberShop} />;
      case 'barberShopInfo':
        return <BarberShopInfoView shop={barberShop} />;
      case 'barberServices':
        return <BarberServicesManagement barber={barber} shop={barberShop} />;
      case 'barberAppointments':
        return <BarberAppointmentsView barber={barber} shop={barberShop} />;
      case 'barberAvailability':
        return <BarberAvailabilityManagement barberId={barber.id} />;
      case 'barberProducts':
        return <BarberProductsManagement user={barber} shop={barberShop} />;
      default:
        return <BarberOverview barber={barber} shop={barberShop} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex min-h-screen overflow-hidden">
        <button
          type="button"
          className="lg:hidden fixed bottom-4 left-4 z-50 p-3 bg-slate-800 text-white rounded-full shadow-lg"
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
            className="fixed inset-0 z-30 bg-black bg-opacity-50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          ></div>
        )}

        <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-800 text-slate-100 p-4 lg:p-5 space-y-6 min-h-screen flex flex-col shadow-lg transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-auto`}>
          <div>
            <h2 className="text-3xl font-bold text-center md:text-left text-white"> Style<span className="text-indigo-400">x</span> </h2>
            <p className="text-xs text-center md:text-left text-slate-400 mt-1">Panel de Barbero</p>
          </div>
          <nav className="space-y-1.5 flex-grow">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => {
                  dispatch({ type: 'SET_SUB_VIEW', payload: item.key });
                  setIsMobileMenuOpen(false);
                }}
                disabled={!barberShop && !['barberOverview', 'barberAvailability', 'barberProducts'].includes(item.key)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 transition-colors duration-150 ease-in-out
                  ${currentBarberView === item.key ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}
                  ${!barberShop && !['barberOverview', 'barberAvailability', 'barberProducts'].includes(item.key) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <i className={`${item.icon} w-5 h-5 text-center text-base`}></i>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="border-t border-slate-700 pt-4 space-y-2">
            <button
              type="button"
              onClick={() => {
                handleOpenChatFromSidebar();
                setIsMobileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors duration-150 ease-in-out"
            >
              <i className="fas fa-comments w-5 h-5 text-center text-base"></i>
              <span className="flex items-center gap-1">
                Mensajes
                {chatUnreadCount > 0 && (
                  <span className="inline-flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 min-w-[18px] h-[18px]">
                    {chatUnreadCount}
                  </span>
                )}
              </span>
            </button>
            {((barber?.role || barber?.rol || '') + '').toLowerCase().includes('owner') && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  dispatch({ type: 'SET_VIEW', payload: 'ownerDashboard' });
                }}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 text-slate-300 hover:bg-indigo-700 hover:text-white transition-colors duration-150 ease-in-out"
              >
                <i className="fas fa-store-alt w-5 h-5 text-center text-base"></i>
                <span>Ir al Panel de Propietario</span>
              </button>
            )}
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                dispatch({ type: 'LOGOUT' });
              }}
              className="w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 text-slate-300 hover:bg-red-700 hover:text-white transition-colors duration-150 ease-in-out"
            >
              <i className="fas fa-sign-out-alt w-5 h-5 text-center text-base"></i>
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </aside>
        <main className="flex-1 w-full p-6 md:p-8 lg:p-10 custom-scrollbar overflow-y-auto" style={{maxHeight: '100vh'}}>
          <header className="mb-8">
            <h1 className="text-3xl font-bold text-slate-800">¡Hola de nuevo, {barber.name}!</h1>
            {barberShop && <p className="text-md text-slate-500 mt-1">Gestiona tu actividad en <span className="font-semibold text-indigo-600">{barberShop.name}</span>.</p>}
            {!barberShop && currentBarberView !== 'barberProducts' && <p className="text-md text-orange-600 mt-1">Aún no estás asignado a una barbería.</p>}
            {!barberShop && currentBarberView === 'barberProducts' && <p className="text-md text-slate-500 mt-1">Gestionando tus productos personales.</p>}
          </header>
          {renderBarberView()}
        </main>
      </div>
    </div>
  );
};

export default BarberDashboard;
