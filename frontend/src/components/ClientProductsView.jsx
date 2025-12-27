import React, { useContext, useState } from 'react';
import { AppContext } from '../App';
import { getOrCreateDirectConversation, sendChatMessage } from '../services/dataService';
import Modal from './ui/Modal';

const ClientProductsView = ({ onBack }) => {
  const { state, dispatch } = useContext(AppContext);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedShop, setSelectedShop] = useState('all');

  const [selectBarberOpen, setSelectBarberOpen] = useState(false);
  const [selectBarberProduct, setSelectBarberProduct] = useState(null);
  const [selectBarberShopId, setSelectBarberShopId] = useState(null);
  const [selectBarberId, setSelectBarberId] = useState(null);
  const [selectBarberSending, setSelectBarberSending] = useState(false);

  const normalizeId = (value) => {
    if (value == null) return null;
    const s = String(value).trim();
    if (!s) return null;
    const n = Number(s);
    if (Number.isFinite(n) && n === 0) return null;
    return value;
  };

  // Obtener todas las categorías únicas de productos
  const categories = [...new Set(state.products.map(p => p.category))].filter(Boolean);
  
  // Obtener todas las barberías
  const shops = state.barberShops || [];

  // Filtrar productos según los criterios seleccionados
  const filteredProducts = state.products.filter(product => {
    // Filtrar por término de búsqueda
    const matchesSearch = 
      (product.name || '').toLowerCase().includes(search.toLowerCase()) || 
      (product.category || '').toLowerCase().includes(search.toLowerCase()) ||
      (product.description || '').toLowerCase().includes(search.toLowerCase());
    
    // Filtrar por categoría seleccionada
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    
    // Filtrar por barbería seleccionada
    const selectedShopId = selectedShop === 'all' ? null : Number(selectedShop);
    const productShopId = product?.shopId != null ? Number(product.shopId) : null;
    const matchesShop = selectedShopId == null || (productShopId != null && !Number.isNaN(productShopId) && productShopId === selectedShopId);
    
    return matchesSearch && matchesCategory && matchesShop;
  });

  // Función para obtener el nombre del barbero
  const getBarberName = (barberId) => {
    const normalized = normalizeId(barberId);
    if (normalized == null) return 'Tienda';
    const users = Array.isArray(state.users) ? state.users : [];
    const barber = users.find(u => String(u?.id) === String(normalized));
    return barber ? barber.name : 'Profesional';
  };

  // Función para obtener el nombre de la barbería
  const getShopName = (shopId) => {
    if (!shopId) return 'Desconocida';
    const shopIdNum = Number(shopId);
    const shop = state.barberShops.find(s => Number(s.id) === shopIdNum);
    return shop ? shop.name : 'Barbería';
  };

  const getBarbersForShop = (shopId) => {
    if (shopId == null) return [];
    const users = Array.isArray(state.users) ? state.users : [];
    return users.filter((u) => {
      const role = String(u?.role || u?.rol || '').toLowerCase();
      if (!role.includes('barber')) return false;
      const uShopId = u?.shopId ?? u?.shop_id ?? null;
      if (uShopId == null) return false;
      return String(uShopId) === String(shopId);
    });
  };

  const closeSelectBarberModal = () => {
    setSelectBarberOpen(false);
    setSelectBarberProduct(null);
    setSelectBarberShopId(null);
    setSelectBarberId(null);
    setSelectBarberSending(false);
  };

  const sendShopProductInquiry = async ({ product, shopId, targetBarberId }) => {
    const me = state.currentUser;
    if (!me?.id) return;

    const convId = await getOrCreateDirectConversation(me.id, targetBarberId);
    if (!convId) {
      dispatch({
        type: 'SHOW_NOTIFICATION',
        payload: {
          message: 'No se pudo abrir la conversación con el profesional.',
          type: 'error',
        },
      });
      return;
    }

    const rawOffer = product?.offer ?? product?.discount_price ?? product?.discountPrice ?? null;
    const offerPercentRaw = rawOffer !== undefined && rawOffer !== null && rawOffer !== '' ? Number(rawOffer) : NaN;
    const hasOffer = !Number.isNaN(offerPercentRaw) && offerPercentRaw > 0;
    const offerPercent = hasOffer ? offerPercentRaw : 0;
    const basePrice = Number(product?.price) || 0;
    const discountedPrice = hasOffer ? basePrice * (1 - offerPercent / 100) : basePrice;

    const shopName = getShopName(shopId);
    const lines = [
      `Hola, estoy interesado en este producto disponible en tienda:`,
      `Producto: ${product.name}`,
      `Barbería: ${shopName}`,
      `Precio: RD$${(hasOffer ? discountedPrice : basePrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${hasOffer ? ` (Oferta: ${offerPercent}%)` : ''}`,
    ];
    if (product?.photoUrl) lines.push(`Foto: ${product.photoUrl}`);

    await sendChatMessage({
      conversationId: convId,
      senderId: me.id,
      receiverId: targetBarberId,
      text: lines.join('\n'),
    });

    try {
      const event = new CustomEvent('open-chat-widget', {
        detail: { barberId: targetBarberId },
      });
      window.dispatchEvent(event);
    } catch (e) {
      console.error('No se pudo abrir el chat automáticamente:', e);
    }
  };
  
  // Función para obtener el color de fondo según la categoría
  const getCategoryColor = (category) => {
    const categories = {
      'Gel': 'bg-blue-100 text-blue-800',
      'Shampoo': 'bg-green-100 text-green-800',
      'Aceite': 'bg-amber-100 text-amber-800',
      'Cera': 'bg-purple-100 text-purple-800',
      'Crema': 'bg-pink-100 text-pink-800',
      'Loción': 'bg-indigo-100 text-indigo-800',
      'Spray': 'bg-teal-100 text-teal-800'
    };
    
    // Buscar coincidencias parciales si no hay una coincidencia exacta
    const exactMatch = categories[category];
    if (exactMatch) return exactMatch;
    
    const lowerCategory = category?.toLowerCase() || '';
    for (const [key, value] of Object.entries(categories)) {
      if (lowerCategory.includes(key.toLowerCase())) {
        return value;
      }
    }
    
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-800">Productos Disponibles</h2>
        {onBack && (
          <button 
            onClick={onBack}
            className="flex items-center text-slate-600 hover:text-indigo-600 transition-colors"
          >
            <i className="fas fa-arrow-left mr-2"></i>
            Volver
          </button>
        )}
      </div>
      
      {/* Filtros */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-grow">
            <input
              type="text"
              placeholder="Buscar productos..."
              className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
            >
              <option value="all">Todas las categorías</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <select
              className="p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              value={selectedShop}
              onChange={e => setSelectedShop(e.target.value)}
            >
              <option value="all">Todas las barberías</option>
              {shops.map(shop => (
                <option key={shop.id} value={shop.id}>{shop.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      {/* Resultados */}
      <div className="mb-4 text-sm text-slate-500">
        Mostrando {filteredProducts.length} productos
      </div>
      
      {/* Lista de productos */}
      {filteredProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {filteredProducts.map(product => {
            const rawOffer = product?.offer ?? product?.discount_price ?? product?.discountPrice ?? null;
            const offerPercentRaw = rawOffer !== undefined && rawOffer !== null && rawOffer !== '' ? Number(rawOffer) : NaN;
            const hasOffer = !Number.isNaN(offerPercentRaw) && offerPercentRaw > 0;
            const offerPercent = hasOffer ? offerPercentRaw : 0;
            const basePrice = Number(product?.price) || 0;
            const discountedPrice = hasOffer ? basePrice * (1 - offerPercent / 100) : basePrice;

            return (
            <div key={product.id} className="bg-white rounded-lg shadow overflow-hidden flex flex-col transition-all hover:shadow-md">
              <div className="relative">
                <img 
                  src={product.photoUrl || 'https://placehold.co/300x200/E2E8F0/4A5568?text=Producto'} 
                  alt={product.name} 
                  className="w-full h-48 object-contain bg-slate-100"
                />
                {hasOffer && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                    Oferta: {offerPercent}%
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <div className="text-white font-bold text-lg drop-shadow-md">{product.name}</div>
                </div>
              </div>
              
              <div className="p-3 flex-grow">
                <div className={`inline-block px-2 py-1 rounded text-xs font-medium ${getCategoryColor(product.category)} mb-2`}>
                  {product.category}
                </div>
                {product.description && (
                  <p className="text-sm text-slate-600 mb-2 line-clamp-2">{product.description}</p>
                )}
                
                <div className="mt-auto">
                  <div className="flex justify-between items-center mt-3">
                    <div className="text-lg font-bold text-slate-800">
                      {hasOffer ? (
                        <div className="flex flex-col">
                          <div className="text-sm text-slate-500 line-through">RD${basePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                          <div className="text-lg font-bold text-emerald-600">RD${discountedPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        </div>
                      ) : (
                        <span>RD${basePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {product.stock > 0 ? `${product.stock} disponible(s)` : (
                        <span className="text-red-500 font-medium">Agotado</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-3 text-xs">
                    <div className="flex items-center bg-indigo-50 p-2 rounded-md">
                      <div className="bg-indigo-100 p-1.5 rounded-md mr-2">
                        <i className="fas fa-store-alt text-indigo-600"></i>
                      </div>
                      <div>
                        <div className="text-slate-500 text-xs">Barbería</div>
                        <div className="font-medium text-indigo-700">{getShopName(product.shopId)}</div>
                      </div>
                    </div>
                    
                    {normalizeId(product?.barberId ?? product?.barber_id) != null && (
                      <div className="flex items-center bg-purple-50 p-2 rounded-md mt-2">
                        <div className="bg-purple-100 p-1.5 rounded-md mr-2">
                          <i className="fas fa-user-tie text-purple-600"></i>
                        </div>
                        <div>
                          <div className="text-slate-500 text-xs">Vendido por</div>
                          <div className="font-medium text-purple-700">{getBarberName(product?.barberId ?? product?.barber_id)}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="p-2 bg-gradient-to-b from-slate-50 to-slate-100 border-t">
                {product.stock > 0 ? (
                  <button 
                    className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-medium py-2 px-3 rounded-md text-sm transition-all shadow-md hover:shadow-lg flex items-center justify-center"
                    onClick={async () => {
                      try {
                        const me = state.currentUser;
                        if (!me?.id) return;

                        const productBarberId = normalizeId(product?.barberId ?? product?.barber_id ?? null);
                        const productShopId = normalizeId(product?.shopId ?? product?.shop_id ?? null);

                        // Si el producto está asignado a un barbero específico, mantener comportamiento actual
                        if (productBarberId != null) {
                          await sendShopProductInquiry({
                            product,
                            shopId: productShopId,
                            targetBarberId: productBarberId,
                          });
                          return;
                        }

                        // Producto de la barbería: pedir seleccionar barbero
                        if (productShopId == null) {
                          dispatch({
                            type: 'SHOW_NOTIFICATION',
                            payload: {
                              message: 'Este producto no tiene barbería asignada.',
                              type: 'error',
                            },
                          });
                          return;
                        }

                        const barbers = getBarbersForShop(productShopId);
                        if (!barbers.length) {
                          dispatch({
                            type: 'SHOW_NOTIFICATION',
                            payload: {
                              message: 'No hay profesionales disponibles en esta barbería para contactar.',
                              type: 'error',
                            },
                          });
                          return;
                        }

                        setSelectBarberProduct(product);
                        setSelectBarberShopId(productShopId);
                        setSelectBarberId(null);
                        setSelectBarberOpen(true);
                      } catch (e) {
                        console.error('Error enviando mensaje por Disponible en Tienda:', e);
                        dispatch({
                          type: 'SHOW_NOTIFICATION',
                          payload: {
                            message: 'No se pudo enviar el mensaje al profesional.',
                            type: 'error',
                          },
                        });
                      }
                    }}
                  >
                    <i className="fas fa-shopping-bag mr-2"></i>
                    Disponible en Tienda
                  </button>
                ) : (
                  <button 
                    className="w-full bg-slate-200 text-slate-500 font-medium py-2.5 px-3 rounded-md text-sm cursor-not-allowed flex items-center justify-center"
                    disabled
                  >
                    <i className="fas fa-times-circle mr-2"></i>
                    Agotado
                  </button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
          <i className="fas fa-search text-5xl text-slate-400 mb-4"></i>
          <p className="text-lg text-slate-600">No se encontraron productos con los filtros seleccionados.</p>
          <p className="text-slate-500 mt-1">Intenta con otros criterios de búsqueda.</p>
        </div>
      )}

      <Modal
        isOpen={selectBarberOpen}
        onClose={closeSelectBarberModal}
        title={selectBarberProduct ? `¿Con qué profesional deseas comprar?` : 'Selecciona profesional'}
        size="md"
      >
        {selectBarberProduct && selectBarberShopId != null && (
          <div className="space-y-4">
            <div className="text-sm text-slate-600">
              Producto: <span className="font-semibold">{selectBarberProduct.name}</span>
              <br />
              Barbería: <span className="font-semibold">{getShopName(selectBarberShopId)}</span>
            </div>

            <div>
              <div className="text-sm font-semibold text-slate-800 mb-2">Selecciona un profesional</div>
              <ul className="flex flex-wrap gap-3">
                {getBarbersForShop(selectBarberShopId).map((barb) => (
                  <li key={barb.id}>
                    <button
                      type="button"
                      className={`flex flex-col items-center px-4 py-2 rounded-lg border transition ${String(selectBarberId) === String(barb.id) ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300 bg-white hover:bg-slate-100'}`}
                      onClick={() => setSelectBarberId(barb.id)}
                      disabled={selectBarberSending}
                    >
                      <img
                        src={barb.photoUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(barb.name)}
                        alt={barb.name}
                        className="w-10 h-10 rounded-full mb-1 border shadow"
                      />
                      <span className="text-sm font-medium">{barb.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
              {selectBarberId == null && (
                <p className="text-xs text-red-600 mt-2">Debes elegir un profesional para continuar.</p>
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700"
                onClick={closeSelectBarberModal}
                disabled={selectBarberSending}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-60"
                disabled={selectBarberSending || selectBarberId == null}
                onClick={async () => {
                  if (!selectBarberProduct || selectBarberShopId == null || selectBarberId == null) return;
                  try {
                    setSelectBarberSending(true);
                    await sendShopProductInquiry({
                      product: selectBarberProduct,
                      shopId: selectBarberShopId,
                      targetBarberId: selectBarberId,
                    });
                    closeSelectBarberModal();
                  } catch (e) {
                    console.error('Error enviando mensaje al profesional seleccionado:', e);
                    dispatch({
                      type: 'SHOW_NOTIFICATION',
                      payload: {
                        message: 'No se pudo enviar el mensaje al profesional.',
                        type: 'error',
                      },
                    });
                    setSelectBarberSending(false);
                  }
                }}
              >
                {selectBarberSending ? 'Enviando...' : 'Continuar'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ClientProductsView;
