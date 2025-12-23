/**
 * Utilidades para el manejo de imágenes en modo desarrollo
 * Estas funciones simulan la carga de imágenes sin necesidad de un backend real
 */

/**
 * Simula la carga de una imagen y devuelve una URL de datos (base64)
 * @param {File} file - El archivo de imagen a cargar
 * @returns {Promise<{url: string, filename: string}>} - Promesa que resuelve con la URL de datos y el nombre del archivo
 */
export const uploadImage = (file) => {
  return new Promise((resolve, reject) => {
    // Validar el archivo
    if (!file || !file.type || !file.type.startsWith('image/')) {
      reject(new Error('Tipo de archivo no válido. Solo se permiten imágenes.'));
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('La imagen es demasiado grande. Máximo 5MB.'));
      return;
    }
    
    // Simular un pequeño retraso como en una carga real
    setTimeout(() => {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        const imageUrl = e.target.result;
        resolve({
          url: imageUrl,
          filename: file.name
        });
      };
      
      reader.onerror = function() {
        reject(new Error('Error al procesar la imagen'));
      };
      
      // Leer el archivo como una URL de datos
      reader.readAsDataURL(file);
    }, 800);
  });
};

/**
 * Intercepta las solicitudes fetch a la API de carga de imágenes y las redirige a la función local
 * Esta función debe ser llamada al inicio de la aplicación
 */
export const setupImageUploadInterceptor = () => {
  const originalFetch = window.fetch;
  
  window.fetch = function(url, options) {
    // Interceptar solo las solicitudes a la API de carga de imágenes
    if (typeof url === 'string' && url.includes('/api/upload') && options && options.method === 'POST') {
      console.log('Interceptando solicitud de carga de imagen');
      
      // Extraer el archivo de FormData
      const formData = options.body;
      if (formData instanceof FormData) {
        const file = formData.get('image');
        
        if (file instanceof File) {
          // Usar nuestra función local en su lugar
          return uploadImage(file)
            .then(result => {
              // Simular una respuesta fetch exitosa
              return {
                ok: true,
                status: 200,
                json: () => Promise.resolve(result),
                text: () => Promise.resolve(JSON.stringify(result))
              };
            })
            .catch(error => {
              // Simular una respuesta fetch fallida
              console.error('Error en carga simulada:', error);
              return {
                ok: false,
                status: 500,
                statusText: error.message,
                text: () => Promise.resolve(error.message),
                json: () => Promise.reject(error)
              };
            });
        }
      }
    }
    
    // Para todas las demás solicitudes, usar el fetch original
    return originalFetch.apply(this, arguments);
  };
  
  console.log('Interceptor de carga de imágenes configurado');
};
