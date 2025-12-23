import React, { useContext } from 'react';
import { AppContext } from '../App';

const BarberShopInfoView = ({ shop }) => {
  const { state } = useContext(AppContext);
  
  // Contar barberos y citas asociadas a esta barbería
  const shopIdNum = Number(shop.id);
  const barbers = state.users.filter(u => {
    if (!u || (u.role !== 'barber' && u.role !== 'Barber')) return false;
    const userShopIdNum = u.shopId != null ? Number(u.shopId) : null;
    const inByShopId = userShopIdNum != null && !Number.isNaN(userShopIdNum) && userShopIdNum === shopIdNum;
    const inByBarberIds = (shop.barberIds || []).includes(u.id);
    return inByShopId || inByBarberIds;
  });
  const appointments = state.appointments.filter(a => a.shopId === shop.id);
  
  // Encontrar servicios asociados a esta barbería
  const shopServices = state.services.filter(s => s.shopId === shop.id);
  
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Cabecera con imagen o gradiente */}
      <div className="h-40 bg-gradient-to-r from-indigo-600 to-purple-700 relative">
        {state.barberShopPhotos?.[shop.id]?.[0] && (
          <img 
            src={state.barberShopPhotos[shop.id][0]} 
            alt={shop.name} 
            className="w-full h-full object-cover opacity-80"
          />
        )}
        <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center">
          <h2 className="text-2xl font-bold text-white text-center px-4 drop-shadow-lg">{shop.name}</h2>
        </div>
      </div>
      
      <div className="p-6">
        {/* Información principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center">
              <i className="fas fa-info-circle mr-2 text-indigo-500"></i>
              Información General
            </h3>
            
            <div className="bg-slate-50 p-4 rounded-lg">
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-indigo-100 text-indigo-500 mr-2">
                  <i className="fas fa-map-marker-alt"></i>
                </div>
                <div>
                  <div className="text-slate-800 font-medium">Ubicación</div>
                  <div className="text-slate-600">{shop.address}</div>
                  <div className="text-slate-500 text-sm">{shop.city}{shop.sector ? `, ${shop.sector}` : ''}</div>
                </div>
              </div>
              
              <div className="flex items-center mb-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-green-100 text-green-500 mr-2">
                  <i className="fas fa-phone-alt"></i>
                </div>
                <div>
                  <div className="text-slate-800 font-medium">Contacto</div>
                  <div className="text-slate-600">{shop.phone}</div>
                  {shop.email && <div className="text-slate-500 text-sm">{shop.email}</div>}
                </div>
              </div>
              
              {shop.openHours && (
                <div className="flex items-center mb-3">
                  <div className="w-8 h-8 flex items-center justify-center rounded-full bg-amber-100 text-amber-500 mr-2">
                    <i className="fas fa-clock"></i>
                  </div>
                  <div>
                    <div className="text-slate-800 font-medium">Horario</div>
                    <div className="text-slate-600">{shop.openHours}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center">
              <i className="fas fa-chart-pie mr-2 text-indigo-500"></i>
              Estadísticas
            </h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-indigo-500 mb-1">{barbers.length}</div>
                <div className="text-slate-600 text-sm">Barberos</div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-green-500 mb-1">{appointments.length}</div>
                <div className="text-slate-600 text-sm">Citas</div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-purple-500 mb-1">{shopServices.length}</div>
                <div className="text-slate-600 text-sm">Servicios</div>
              </div>
              
              <div className="bg-slate-50 p-4 rounded-lg text-center">
                <div className="text-3xl font-bold text-amber-500 mb-1">{shop.rating || '★★★★'}</div>
                <div className="text-slate-600 text-sm">Calificación</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Descripción */}
        {shop.description && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center">
              <i className="fas fa-quote-left mr-2 text-indigo-500"></i>
              Descripción
            </h3>
            <div className="bg-slate-50 p-4 rounded-lg">
              <p className="text-slate-700">{shop.description}</p>
            </div>
          </div>
        )}
        
        {/* Redes sociales */}
        {(shop.instagram || shop.facebook) && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center">
              <i className="fas fa-hashtag mr-2 text-indigo-500"></i>
              Redes Sociales
            </h3>
            <div className="flex gap-4">
              {shop.instagram && (
                <a 
                  href={`https://instagram.com/${shop.instagram}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-lg hover:opacity-90"
                >
                  <i className="fab fa-instagram text-xl mr-2"></i>
                  <span>@{shop.instagram}</span>
                </a>
              )}
              {shop.facebook && (
                <a 
                  href={`https://facebook.com/${shop.facebook}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="flex items-center bg-blue-600 text-white px-4 py-2 rounded-lg hover:opacity-90"
                >
                  <i className="fab fa-facebook-square text-xl mr-2"></i>
                  <span>{shop.facebook}</span>
                </a>
              )}
            </div>
          </div>
        )}
        
        {/* Barberos */}
        <div>
          <h3 className="text-lg font-semibold text-slate-700 mb-2 flex items-center">
            <i className="fas fa-user-tie mr-2 text-indigo-500"></i>
            Barberos en esta barbería
          </h3>
          
          {barbers.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {barbers.map(barber => (
                <div key={barber.id} className="bg-slate-50 p-3 rounded-lg flex items-center">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                    {barber.avatar ? 
                      <img src={barber.avatar} alt={barber.name} className="w-full h-full rounded-full object-cover" /> : 
                      <i className="fas fa-user text-indigo-400"></i>
                    }
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">{barber.name}</div>
                    <div className="text-xs text-slate-500">{barber.email || 'Sin email'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 italic">No hay barberos asignados a esta barbería.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default BarberShopInfoView;
