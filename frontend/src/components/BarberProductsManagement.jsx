import React, { useContext, useState, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { useDropzone } from 'react-dropzone';
import Resizer from 'react-image-file-resizer';

// Componente especializado para drag-and-drop de imágenes usando react-dropzone
const ImageDropzone = ({ onImageSelected, setError }) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png']
    },
    maxSize: 5 * 1024 * 1024,
    onDropAccepted: (files) => {
      onImageSelected(files[0]);
    },
    onDropRejected: (fileRejections) => {
      const rejection = fileRejections[0];
      if (rejection.errors[0].code === 'file-too-large') {
        setError('La imagen debe ser menor a 5MB');
      } else {
        setError('Solo se permiten archivos de imagen (JPEG, JPG, PNG)');
      }
    }
  });

  return (
    <div 
      {...getRootProps()} 
      className={`border-2 border-dashed rounded-lg p-4 transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 bg-slate-50'}`}
    >
      <input {...getInputProps()} />
      <div className="text-center py-4">
        <i className="fas fa-cloud-upload-alt text-3xl text-slate-400 mb-2"></i>
        <p className="text-sm text-slate-500">
          {isDragActive 
            ? 'Suelta la imagen aquí...'
            : 'Arrastra y suelta tu imagen aquí o haz clic para seleccionar'}
        </p>
        <p className="text-xs text-slate-400 mt-1">PNG, JPG o JPEG (máx. 5MB)</p>
      </div>
    </div>
  );
};

const BarberProductsManagement = ({ user, shop }) => {
  const { state, dispatch } = useContext(AppContext);
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [showSell, setShowSell] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  const [sellQuantity, setSellQuantity] = useState(1);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    stock: '',
    category: '',
    photoUrl: '',
    description: '',
    offer: ''
  });
  const [isEditing, setIsEditing] = useState(false);
  const [currentProductId, setCurrentProductId] = useState(null);
  const formRef = useRef(null);
  const isMounted = useRef(true);
  
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (!showAdd) {
      setPreview('');
      setNewProduct(p => ({ ...p, photoUrl: '' }));
      setError('');
    }
  }, [showAdd]);

  // Filtrar productos de la barbería y productos personales del barbero
  const allProducts = state.products || [];
  const shopProducts = allProducts
    .filter(p => shop && p.shopId === shop.id && !p.barberId)
    .sort((a, b) => {
      const nameA = a?.name || '';
      const nameB = b?.name || '';
      return nameA.localeCompare(nameB);
    });

  const handleOpenSell = (product) => {
    setCurrentProduct(product);
    setSellQuantity(1);
    setShowSell(true);
  };

  const myProducts = allProducts
    .filter(p => shop && p.shopId === shop.id && p.barberId === user?.id)
    .sort((a, b) => {
      const nameA = a?.name || '';
      const nameB = b?.name || '';
      return nameA.localeCompare(nameB);
    });

  // Función para procesar y redimensionar imágenes antes de subir
  const resizeImage = (file) => {
    return new Promise((resolve, reject) => {
      try {
        // Verificar si el archivo es válido
        if (!file || typeof file !== 'object') {
          return reject(new Error('Archivo inválido'));
        }

        Resizer.imageFileResizer(
          file,
          800,           // max width
          800,           // max height
          'JPEG',        // format
          85,            // quality
          0,             // rotation
          (resizedFile) => {
            resolve(resizedFile);
          },
          'file',        // output type
          400,           // min width
          400,           // min height
          // Si falla el redimensionamiento, usamos el archivo original
          (error) => {
            console.warn('Error al redimensionar, usando archivo original:', error);
            resolve(file);
          }
        );
      } catch (error) {
        console.error('Error en el procesamiento de imagen:', error);
        reject(error);
      }
    });
  };

  // Crear versión personal de un producto de la barbería
  const handleCloneFromShopProduct = (product) => {
    setIsEditing(false);
    setCurrentProductId(null);
    setNewProduct({ 
      name: product.name || '',
      price: product.price || '',
      stock: product.stock || '',
      category: product.category || '',
      photoUrl: product.photoUrl || '',
      offer: product.offer || ''
    });
    setPreview(product.photoUrl || '');
    try {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      // no-op
    }
  };

  // Función mejorada para manejar la subida de imágenes con validación completa (versión simulada para desarrollo)
  const handleImageUpload = async (file) => {
    // Validación defensiva
    if (!file) {
      setError('No se seleccionó ningún archivo');
      return;
    }
    
    try {
      setUploading(true);
      setError('');
      
      // Validación de tipo de archivo con manejo de errores robusto
      const fileType = file.type || '';
      if (!fileType.startsWith('image/')) {
        throw new Error('Solo se permiten archivos de imagen');
      }
      
      // Validación de tamaño con manejo de errores robusto
      const fileSize = file.size || 0;
      if (fileSize > 5 * 1024 * 1024) {
        throw new Error('La imagen debe ser menor a 5MB');
      }
      
      // Procesamos y optimizamos la imagen antes de usar
      const processedImage = await resizeImage(file);
      
      // Simular un pequeño retraso como en una carga real
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Crear una URL local para la imagen usando FileReader
      const reader = new FileReader();
      
      reader.onload = function(e) {
        if (isMounted.current) {
          const imageUrl = e.target.result;
          setNewProduct(p => ({ ...p, photoUrl: imageUrl }));
          setPreview(imageUrl);
          setUploading(false);
        }
      };
      
      reader.onerror = function() {
        if (isMounted.current) {
          setError('Error al procesar la imagen');
          setUploading(false);
        }
      };
      
      // Leer el archivo como una URL de datos
      reader.readAsDataURL(processedImage);
      
    } catch (error) {
      console.error('Error en el proceso de imagen:', error);
      
      // Verificamos que el componente siga montado antes de mostrar el error
      if (isMounted.current) {
        setError('Error al procesar la imagen: ' + (error.message || 'Error desconocido'));
        setUploading(false);
      }
    }
  };
  
  // Eliminar imagen con protección mejorada
  const handleRemoveImage = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (uploading) return; // Evitar eliminar durante la carga
    
    // Usar setTimeout para diferir la eliminación hasta después del ciclo de renderizado actual
    setTimeout(() => {
      if (isMounted.current) {
        setPreview('');
        setNewProduct(p => ({ ...p, photoUrl: '' }));
        setError('');
      }
    }, 0);
  };

  // Manejar inputs
  const handleInputChange = e => {
    const { name, value } = e.target;
    setNewProduct(np => ({ ...np, [name]: value }));
  };

  // Iniciar edición de un producto
  const handleEditProduct = (product) => {
    setIsEditing(true);
    setCurrentProductId(product.id);
    setNewProduct({ 
      name: product.name, 
      price: product.price, 
      stock: product.stock, 
      category: product.category || '',
      photoUrl: product.photoUrl,
      offer: product.offer || ''
    });
    setPreview(product.photoUrl);
    try {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      // no-op
    }
  };

  // Guardar producto (nuevo o editado)
  const handleSubmitProduct = e => {
    e.preventDefault();
    if (!newProduct.name || !newProduct.price || !newProduct.stock || !newProduct.category || !newProduct.photoUrl) {
      dispatch({ 
        type: 'SHOW_NOTIFICATION', 
        payload: { message: 'Por favor completa todos los campos requeridos.', type: 'error' }
      });
      return;
    }

    const productData = {
      name: newProduct.name,
      price: Number(newProduct.price),
      stock: Number(newProduct.stock),
      category: newProduct.category,
      shopId: shop?.id,
      barberId: user?.id,
      photoUrl: newProduct.photoUrl
    };

    // Añadir oferta si existe
    if (newProduct.offer && newProduct.offer.trim()) {
      productData.offer = newProduct.offer.trim();
    }

    if (isEditing) {
      dispatch({
        type: 'UPDATE_PRODUCT',
        payload: {
          id: currentProductId,
          ...productData
        }
      });
      dispatch({ 
        type: 'SHOW_NOTIFICATION', 
        payload: { message: 'Producto actualizado con éxito', type: 'success' }
      });
    } else {
      dispatch({
        type: 'ADD_PRODUCT',
        payload: {
          productData: productData,
          shopId: shop?.id,
          ownerOrBarberId: user?.id,
          barberId: user?.id
        }
      });
      dispatch({ 
        type: 'SHOW_NOTIFICATION', 
        payload: { message: 'Producto añadido con éxito', type: 'success' }
      });
    }
    
    // Limpiar formulario
    setNewProduct({ name: '', price: '', stock: '', category: '', photoUrl: '', offer: '' });
    setPreview('');
    setIsEditing(false);
    setCurrentProductId(null);
  };

  // Cancelar edición
  const handleCancelEdit = () => {
    setIsEditing(false);
    setCurrentProductId(null);
    setNewProduct({ name: '', price: '', stock: '', category: '', photoUrl: '', offer: '' });
    setPreview('');
  };

  // Eliminar producto
  const handleDeleteProduct = (productId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      dispatch({
        type: 'DELETE_PRODUCT',
        payload: { id: productId }
      });
      dispatch({ 
        type: 'SHOW_NOTIFICATION', 
        payload: { message: 'Producto eliminado con éxito', type: 'info' }
      });
    }
  };

  return (
    <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg">
      <h2 className="text-2xl font-bold text-slate-800 mb-6 flex items-center">
        <i className="fas fa-box-open mr-3 text-indigo-600"></i>
        {isEditing ? 'Editar Producto' : 'Gestionar Mis Productos'}
      </h2>
      
      {/* Formulario para agregar/editar producto */}
      <div ref={formRef} className="mb-8 bg-slate-50 p-5 rounded-lg shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-indigo-700 mb-4">{isEditing ? 'Actualizar Producto' : 'Agregar Nuevo Producto'}</h3>
        <form className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" onSubmit={handleSubmitProduct}>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Nombre</label>
            <input 
              type="text" 
              name="name" 
              placeholder="Ej: Gel para cabello" 
              className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
              value={newProduct.name} 
              onChange={handleInputChange} 
              required 
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Precio (RD$)</label>
            <input 
              type="number" 
              name="price" 
              placeholder="0" 
              min="0" 
              className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
              value={newProduct.price} 
              onChange={handleInputChange} 
              required 
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Stock</label>
            <input 
              type="number" 
              name="stock" 
              placeholder="0" 
              min="0" 
              className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
              value={newProduct.stock} 
              onChange={handleInputChange} 
              required 
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Categoría</label>
            <input 
              type="text" 
              name="category" 
              placeholder="Ej: Gel, Shampoo, Crema, etc." 
              className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
              value={newProduct.category} 
              onChange={handleInputChange} 
              required 
            />
          </div>
          
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Oferta (opcional)</label>
            <input 
              type="text" 
              name="offer" 
              placeholder="Ej: 2x1, 20% descuento" 
              className="w-full p-2.5 border border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500" 
              value={newProduct.offer} 
              onChange={handleInputChange} 
            />
          </div>
          
          <div className="space-y-1 lg:col-span-3">
            <label className="text-sm font-medium text-slate-700">Imagen</label>
            {/* Zona de carga de imagen para nuevo producto */}
            <div className="mb-4">
              <label className="block text-slate-700 text-sm font-medium mb-1">
                Imagen del producto
              </label>
              <div className="min-h-36">
                {preview ? (
                  <div className="w-full relative bg-white p-4 border border-slate-200 rounded-lg">
                    <img 
                      src={preview} 
                      alt="Vista previa" 
                      className="w-full max-h-32 object-contain rounded"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveImage}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 text-xs shadow-md"
                      disabled={uploading}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                ) : uploading ? (
                  <div className="border-2 border-dashed border-slate-300 rounded-lg min-h-36 w-full flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent mx-auto mb-2"></div>
                      <p className="text-sm text-slate-500">Subiendo imagen...</p>
                    </div>
                  </div>
                ) : (
                  <ImageDropzone 
                    onImageSelected={handleImageUpload} 
                    setError={setError} 
                  />
                )}
              </div>
            </div>
            {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          </div>
          
          <div className="md:col-span-2 lg:col-span-3 flex items-center justify-between mt-2 pt-4 border-t border-slate-200">
            <div></div>
            <div className="flex space-x-3">
              {isEditing && (
                <button 
                  type="button" 
                  onClick={handleCancelEdit} 
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-300 font-medium text-sm"
                >
                  Cancelar
                </button>
              )}
              <button 
                type="submit" 
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md shadow font-medium text-sm transition-colors"
              >
                {isEditing ? 'Actualizar Producto' : 'Guardar Producto'}
              </button>
            </div>
          </div>
        </form>
      </div>
      
      {/* Lista de productos de la barbería */}
      <h3 className="text-xl font-semibold text-slate-800 mb-4">Productos de la barbería ({shopProducts.length})</h3>

      {shopProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 mb-10">
          {shopProducts.map((prod, index) => {
            const hasOffer = prod.offer !== undefined && prod.offer !== null && prod.offer !== '' && !Number.isNaN(Number(prod.offer));
            const offerPercent = hasOffer ? Number(prod.offer) : 0;
            const basePrice = Number(prod.price) || 0;
            const discountedPrice = hasOffer ? basePrice * (1 - offerPercent / 100) : basePrice;
            return (
              <div key={`${prod.id}-${index}`} className="bg-white rounded-lg shadow p-5 flex flex-col relative">
                <div className="absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                  Tienda
                </div>

                <img
                  src={prod.photoUrl || 'https://placehold.co/300x200/E2E8F0/4A5568?text=Producto'}
                  alt={prod.name}
                  className="w-full h-32 object-cover rounded mb-3"
                />

                <h3 className="font-semibold text-lg text-slate-800 mb-1">{prod.name}</h3>
                {prod.category && <div className="text-xs text-indigo-500 mb-1">{prod.category}</div>}
                {prod.description && <div className="text-slate-700 text-sm mb-2">{prod.description}</div>}
                {hasOffer && (
                  <div className="text-xs font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded inline-block mb-2">
                    Oferta: {offerPercent}%
                  </div>
                )}

                <div className="mt-auto mb-1">
                  {hasOffer ? (
                    <div>
                      <div className="text-sm text-slate-500 line-through">RD${basePrice.toFixed(2)}</div>
                      <div className="text-lg font-bold text-green-600">RD${discountedPrice.toFixed(2)}</div>
                    </div>
                  ) : (
                    <div className="text-lg font-bold text-slate-800">RD${basePrice.toFixed(2)}</div>
                  )}
                </div>

                <div className="text-xs text-slate-500 mb-2">
                  {prod.stock > 0 ? `Stock: ${prod.stock}` : <span className="text-red-500 font-medium">Agotado</span>}
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded shadow text-xs font-semibold flex-1"
                    onClick={() => handleOpenSell(prod)}
                    disabled={prod.stock === 0}
                  >
                    <i className="fas fa-shopping-cart mr-1"></i>Vender
                  </button>
                  <button
                    className="bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded shadow text-xs font-semibold flex-1"
                    onClick={() => handleCloneFromShopProduct(prod)}
                  >
                    <i className="fas fa-copy mr-1"></i>Crear versión personal
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 bg-slate-50 rounded-lg border border-slate-200 mb-10">
          <p className="text-slate-600">La barbería aún no tiene productos registrados.</p>
        </div>
      )}

      {/* Lista de productos personales del barbero */}
      <h3 className="text-xl font-semibold text-slate-800 mb-4">Mis Productos ({myProducts.length})</h3>
      
      {myProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {myProducts.map((prod, index) => {
            const hasOffer = prod.offer !== undefined && prod.offer !== null && prod.offer !== '' && !Number.isNaN(Number(prod.offer));
            const offerPercent = hasOffer ? Number(prod.offer) : 0;
            const basePrice = Number(prod.price) || 0;
            const discountedPrice = hasOffer ? basePrice * (1 - offerPercent / 100) : basePrice;
            return (
              <div key={`${prod.id}-${index}`} className="bg-white rounded-lg shadow p-5 flex flex-col relative">
                <div className="absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-full bg-purple-100 text-purple-800">
                  Profesional
                </div>

                <div className="absolute top-2 left-2 flex space-x-1 z-30">
                  <button
                    type="button"
                    aria-label="Editar producto"
                    title="Editar"
                    className="w-6 h-6 rounded-full bg-transparent flex items-center justify-center cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleEditProduct(prod);
                    }}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 shadow" />
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar producto"
                    title="Eliminar"
                    className="w-6 h-6 rounded-full bg-transparent flex items-center justify-center cursor-pointer"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteProduct(prod.id);
                    }}
                  >
                    <span className="w-3.5 h-3.5 rounded-full bg-red-600 shadow" />
                  </button>
                </div>

                <img
                  src={prod.photoUrl || 'https://placehold.co/300x200/E2E8F0/4A5568?text=Producto'}
                  alt={prod.name}
                  className="w-full h-32 object-cover rounded mb-3"
                />

                <h3 className="font-semibold text-lg text-slate-800 mb-1">{prod.name}</h3>
                {prod.category && <div className="text-xs text-indigo-500 mb-1">{prod.category}</div>}
                {prod.description && <div className="text-slate-700 text-sm mb-2">{prod.description}</div>}
                {hasOffer && (
                  <div className="text-xs font-bold text-red-500 bg-red-100 px-1.5 py-0.5 rounded inline-block mb-2">
                    Oferta: {offerPercent}%
                  </div>
                )}

                <div className="mt-auto mb-1">
                  {hasOffer ? (
                    <div>
                      <div className="text-sm text-slate-500 line-through">RD${basePrice.toFixed(2)}</div>
                      <div className="text-lg font-bold text-green-600">RD${discountedPrice.toFixed(2)}</div>
                    </div>
                  ) : (
                    <div className="text-lg font-bold text-slate-800">RD${basePrice.toFixed(2)}</div>
                  )}
                </div>

                <div className="text-xs text-slate-500 mb-2">
                  {prod.stock > 0 ? `Stock: ${prod.stock}` : <span className="text-red-500 font-medium">Agotado</span>}
                </div>

                <div className="flex gap-2 mt-2">
                  <button
                    disabled={prod.stock === 0}
                    className="bg-teal-500 hover:bg-teal-600 text-white px-3 py-1 rounded shadow text-xs font-semibold flex-1 disabled:bg-slate-300 disabled:cursor-not-allowed"
                    onClick={() => handleOpenSell(prod)}
                  >
                    <i className="fas fa-shopping-cart mr-1"></i>Vender
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-slate-200">
          <i className="fas fa-box-open text-5xl text-slate-400 mb-4"></i>
          <p className="text-lg text-slate-600">No tienes productos personales registrados.</p>
          <p className="text-slate-500 mt-1">Usa el formulario de arriba o clona un producto de la barbería para crear tu versión.</p>
        </div>
      )}
      
      {/* Modal para vender producto (barbero) */}
      {showSell && currentProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded-lg shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-4">Vender {currentProduct.name}</h3>
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2">Cantidad a vender</label>
              <div className="flex items-center">
                <button 
                  className="bg-gray-200 px-3 py-1 rounded-l" 
                  onClick={() => setSellQuantity(q => Math.max(1, q - 1))}
                >-</button>
                <input 
                  type="number" 
                  className="w-16 text-center border-t border-b" 
                  value={sellQuantity} 
                  onChange={e => setSellQuantity(Math.max(1, Math.min(currentProduct.stock, parseInt(e.target.value) || 1)))}
                  min="1" 
                  max={currentProduct.stock}
                />
                <button 
                  className="bg-gray-200 px-3 py-1 rounded-r" 
                  onClick={() => setSellQuantity(q => Math.min(currentProduct.stock, q + 1))}
                >+</button>
              </div>
              <p className="text-sm text-gray-500 mt-1">Stock disponible: {currentProduct.stock}</p>
            </div>
            <div className="text-right font-bold text-lg mb-4">
              Total: RD${(Number(currentProduct.price || 0) * sellQuantity).toFixed(2)}
            </div>
            <div className="flex justify-end space-x-3">
              <button 
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
                onClick={() => {
                  setShowSell(false);
                  setSellQuantity(1);
                  setCurrentProduct(null);
                }}
              >
                Cancelar
              </button>
              <button 
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                onClick={() => {
                  if (currentProduct.stock < sellQuantity) {
                    dispatch({ 
                      type: 'SHOW_NOTIFICATION', 
                      payload: { 
                        message: `No hay suficiente stock disponible.`, 
                        type: 'error' 
                      } 
                    });
                    return;
                  }

                  dispatch({
                    type: 'SELL_PRODUCT',
                    payload: {
                      productId: currentProduct.id,
                      quantity: sellQuantity,
                      barberId: user?.id,
                      sellerId: user?.id,
                    }
                  });

                  setShowSell(false);
                  setSellQuantity(1);
                  setCurrentProduct(null);
                }}
                disabled={currentProduct.stock < 1}
              >
                Confirmar Venta
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BarberProductsManagement;
