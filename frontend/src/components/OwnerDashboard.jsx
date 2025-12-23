import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../App';
import OwnerProductsManagement from './OwnerProductsManagement';
import OwnerSummary from './OwnerSummary';
import OwnerBarbersManagement from './OwnerBarbersManagement';
import OwnerAppointmentsManagement from './OwnerAppointmentsManagement';
import OwnerServicesManagement from './OwnerServicesManagement';
import OwnerBarberShopsManagement from './OwnerBarberShopsManagement';
import OwnerChatSupervision from './OwnerChatSupervision';

// Los componentes ya están importados desde sus propios archivos

// Ahora importado desde su propio archivo

const navItems = [
  { key: 'summary', label: 'Resumen General', icon: 'fas fa-home' },
  { key: 'barberShops', label: 'Barberías', icon: 'fas fa-store-alt' },
  { key: 'shopServices', label: 'Servicios Tienda', icon: 'fas fa-cut' },
  { key: 'manageBarbers', label: 'Gestionar Barberos', icon: 'fas fa-user-tie' },
  { key: 'shopAppointments', label: 'Citas Tienda', icon: 'fas fa-calendar-check' },
  { key: 'shopProducts', label: 'Productos Tienda', icon: 'fas fa-box-open' }
  ,{ key: 'chatSupervision', label: 'Chats', icon: 'fas fa-comments' }
];

const sectionTitles = {
  summary: 'Resumen General',
  barberShops: 'Barberías',
  shopServices: 'Servicios Tienda',
  manageBarbers: 'Gestionar Barberos',
  shopAppointments: 'Citas Tienda',
  shopProducts: 'Productos Tienda',
  chatSupervision: 'Supervisión de Chats',
};

const OwnerDashboard = () => {
  const { state, dispatch } = useContext(AppContext);
  const owner = state.currentUser;
  const [activeSection, setActiveSection] = useState('summary');
  const [selectedShopId, setSelectedShopId] = useState(null);
  const [shopSearch, setShopSearch] = useState('');
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const getAppointmentShopId = (a) => (a?.shopId ?? a?.shop_id ?? null);
  const getUserShopId = (u) => (u?.shopId ?? u?.shop_id ?? null);

  const handleOpenChatFromSidebar = () => {
    try {
      window.dispatchEvent(new Event('open-chat-widget'));
    } catch (e) {
      console.error('No se pudo abrir el chat desde el panel de propietario:', e);
    }
  };

  useEffect(() => {
    const onUnread = (ev) => {
      const count = ev?.detail?.count ?? 0;
      setChatUnreadCount(typeof count === 'number' ? count : 0);
    };
    window.addEventListener('chat-unread-changed', onUnread);
    return () => window.removeEventListener('chat-unread-changed', onUnread);
  }, []);

  const isAdmin = ((owner?.role || owner?.rol || '') + '').toLowerCase().includes('admin');
  const visibleShops = (state.barberShops || []).filter(shop =>
    isAdmin ? true : shop.ownerId === owner?.id
  );

  const currentShop = visibleShops.find(s => s.ownerId === owner?.id) || null;
  const selectedShop = visibleShops.find(s => s.id === selectedShopId) || null;

  const summaryAppointments = isAdmin
    ? (state.appointments || [])
    : (state.appointments || []).filter(a => String(getAppointmentShopId(a) ?? '') === String(currentShop?.id ?? ''));

  const summaryBarbers = isAdmin
    ? (state.users || []).filter(u => String(u?.role || u?.rol || '').toLowerCase().includes('barber'))
    : (state.users || []).filter(u => {
      const role = String(u?.role || u?.rol || '').toLowerCase();
      if (!role.includes('barber')) return false;
      const inList = currentShop?.barberIds?.includes?.(u.id) || false;
      const inShop = String(getUserShopId(u) ?? '') === String(currentShop?.id ?? '');
      return inList || inShop;
    });

  const filteredShops = visibleShops.filter(shop => {
    if (!shopSearch.trim()) return true;
    const term = shopSearch.toLowerCase();
    return (
      (shop.name || '').toLowerCase().includes(term) ||
      (shop.address || '').toLowerCase().includes(term) ||
      (shop.city || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="min-h-screen bg-slate-100 font-inter" data-component-name="OwnerDashboard">
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
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-800 text-slate-100 p-4 lg:p-5 space-y-6 min-h-screen flex flex-col shadow-lg transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:inset-auto`}
        >
          <div>
            <h2 className="text-3xl font-bold text-center md:text-left text-white tracking-tight">Barber<span className="text-indigo-400">RD</span></h2>
            <p className="text-xs text-center md:text-left text-slate-400 mt-1">Panel de Propietario</p>
          </div>
          <nav className="space-y-1.5 flex-grow">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => {
                  setActiveSection(item.key);
                  setIsMobileMenuOpen(false);
                }}
                data-section={item.key}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center space-x-3 transition-colors duration-150 ease-in-out ${activeSection === item.key ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-700 hover:text-white'}`}
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
        {/* Main content */}
        <main className="flex-1 w-full p-6 md:p-8 lg:p-10 custom-scrollbar overflow-y-auto" style={{maxHeight: '100vh'}}>
          <header className="mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Panel de Administración</h1>
            </div>
            {owner?.shop_id || owner?.shopId ? (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  dispatch({ type: 'SET_VIEW', payload: 'barberDashboard' });
                }}
                className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-slate-800 text-slate-100 hover:bg-slate-900 shadow-sm"
              >
                <i className="fas fa-exchange-alt mr-2"></i>
                Cambiar a modo Barbero
              </button>
            ) : null}
          </header>
          <section>
            <h2 className="text-xl font-semibold text-slate-700 mb-6">{sectionTitles[activeSection]}</h2>
            {activeSection === 'summary' && (
                <OwnerSummary 
                  shop={currentShop} 
                  appointments={summaryAppointments} 
                  barbers={summaryBarbers} 
                />
              )}
            {activeSection === 'barberShops' && (
                <OwnerBarberShopsManagement />
              )}
            {activeSection === 'shopProducts' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow p-4 mb-4">
                  <h3 className="text-lg font-semibold text-slate-700 mb-3">Seleccionar barbería</h3>
                  <div className="flex flex-col md:flex-row md:items-center gap-3">
                    <div className="flex-1">
                      <input
                        type="text"
                        className="w-full border border-slate-300 rounded-md p-2 text-sm"
                        placeholder="Buscar barbería por nombre, dirección o ciudad..."
                        value={shopSearch}
                        onChange={e => setShopSearch(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="mt-3 max-h-48 overflow-y-auto border border-slate-200 rounded">
                    {filteredShops.length === 0 && (
                      <div className="p-3 text-sm text-slate-500">No hay barberías que coincidan con la búsqueda.</div>
                    )}
                    {filteredShops.map(shop => (
                      <button
                        key={shop.id}
                        type="button"
                        onClick={() => setSelectedShopId(shop.id)}
                        className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${selectedShopId === shop.id ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        <div className="font-medium">{shop.name}</div>
                        <div className="text-[11px] text-slate-500">{shop.address}</div>
                      </button>
                    ))}
                  </div>
                  {selectedShop && (
                    <div className="mt-3 text-sm text-slate-600">
                      Gestionando productos de: <span className="font-semibold text-indigo-700">{selectedShop.name}</span>
                    </div>
                  )}
                </div>
                {selectedShop ? (
                  <OwnerProductsManagement shop={selectedShop} />
                ) : (
                  <div className="bg-white rounded-xl shadow p-8 text-center text-slate-500">
                    <p className="text-base">Selecciona una barbería para gestionar sus productos.</p>
                  </div>
                )}
              </div>
            )}
            {activeSection === 'manageBarbers' && (
                <OwnerBarbersManagement />
              )}
              {activeSection === 'shopAppointments' && (
                <OwnerAppointmentsManagement />
              )}
              {activeSection === 'shopServices' && (
                <div className="space-y-6">
                  <div className="bg-white rounded-xl shadow p-4 mb-4">
                    <h3 className="text-lg font-semibold text-slate-700 mb-3">Seleccionar barbería</h3>
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1">
                        <input
                          type="text"
                          className="w-full border border-slate-300 rounded-md p-2 text-sm"
                          placeholder="Buscar barbería por nombre, dirección o ciudad..."
                          value={shopSearch}
                          onChange={e => setShopSearch(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="mt-3 max-h-48 overflow-y-auto border border-slate-200 rounded">
                      {filteredShops.length === 0 && (
                        <div className="p-3 text-sm text-slate-500">No hay barberías que coincidan con la búsqueda.</div>
                      )}
                      {filteredShops.map(shop => (
                        <button
                          key={shop.id}
                          type="button"
                          onClick={() => setSelectedShopId(shop.id)}
                          className={`w-full text-left px-3 py-2 text-sm border-b last:border-b-0 ${selectedShopId === shop.id ? 'bg-indigo-50 text-indigo-700' : 'bg-white text-slate-700 hover:bg-slate-50'}`}
                        >
                          <div className="font-medium">{shop.name}</div>
                          <div className="text-[11px] text-slate-500">{shop.address}</div>
                        </button>
                      ))}
                    </div>
                    {selectedShop && (
                      <div className="mt-3 text-sm text-slate-600">
                        Gestionando servicios de: <span className="font-semibold text-indigo-700">{selectedShop.name}</span>
                      </div>
                    )}
                  </div>
                  {selectedShop ? (
                    <>
                      <h2 className="text-2xl font-bold text-slate-700 mb-4">Servicios Tienda</h2>
                      <OwnerServicesManagement shop={selectedShop} />
                    </>
                  ) : (
                    <div className="bg-white rounded-xl shadow p-8 text-center text-slate-500">
                      <p className="text-base">Selecciona una barbería para gestionar sus servicios.</p>
                    </div>
                  )}
                </div>
              )}
              {activeSection === 'chatSupervision' && (
                <OwnerChatSupervision ownerId={owner?.id} />
              )}
              {activeSection !== 'summary' && activeSection !== 'barberShops' && activeSection !== 'shopProducts' && activeSection !== 'manageBarbers' && activeSection !== 'shopAppointments' && activeSection !== 'shopServices' && (
                <div className="bg-white rounded-xl shadow p-8 flex flex-col items-center justify-center min-h-[200px] text-slate-500">
                  <i className="fas fa-tools text-4xl text-indigo-300 mb-4"></i>
                  <span className="text-lg font-semibold">Próximamente: {sectionTitles[activeSection]}</span>
                </div>
              )}
          </section>
        </main>
      </div>
    </div>
  );
};
export default OwnerDashboard;
