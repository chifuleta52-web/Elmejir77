// Configuración de la app.
// - En la web (servida por el mismo servidor) la API está en el mismo dominio.
// - En la app de Android (Capacitor) hay que apuntar al servidor público.
(function () {
  var SERVER = 'https://futbol.matiaspendino.com';
  var native = !!window.Capacitor || (location.hostname === 'localhost' && location.protocol === 'https:') || location.protocol === 'capacitor:';
  window.APP_CONFIG = { API_BASE: native ? SERVER : '', NATIVE: native };
})();
