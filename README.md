# El Mejor DT — Playoffs Clausura 2026

Juego de fantasy (estilo "armá tu equipo") para los **playoffs del Torneo Clausura 2026**
de la Liga Profesional argentina: octavos, cuartos, semifinales y final.

- Plantel de 15 jugadores (2 ARQ, 5 DEF, 5 VOL, 3 DEL), presupuesto de $70M, máximo 3 por club.
- Formación, 11 titulares, 4 suplentes y capitán (suma doble).
- **PINs**: códigos de un solo uso que habilitan cambios de jugadores (4 por PIN).
- **Premios**: $100.000 al mejor de cada fecha y $1.000.000 al campeón del torneo.
- Panel de administración dentro de la app: fechas, partidos, puntajes, PINs, jugadores y ajustes.

## Estructura

| Carpeta | Qué es |
| --- | --- |
| `www/` | La app (HTML/CSS/JS sin dependencias). Es lo que se empaqueta en Android. |
| `server/` | Servidor Node.js (sin dependencias) + base SQLite. API y también sirve `www/`. |
| `android/` | Proyecto Android (Capacitor) para generar el APK/AAB de Play Store. |

## Probar en la compu

Requiere Node.js 22.13 o superior.

```bash
ADMIN_USER=admin ADMIN_PASSWORD=una-clave-segura npm start
# abrir http://localhost:3000
npm test
```

Si no definís `ADMIN_USER` / `ADMIN_PASSWORD`, el primer arranque crea el usuario `admin`
con una contraseña al azar que se muestra en la consola.

## Publicar el servidor en el VPS (Docker + nginx)

En el VPS (Ubuntu, con Docker, nginx y certbot ya instalados):

```bash
git clone https://github.com/chifuleta52-web/Elmejir77.git el-mejor-dt && cd el-mejor-dt
cp .env.example .env && nano .env        # contraseña de admin y token de Mercado Pago
docker compose up -d --build             # queda escuchando en 127.0.0.1:3010
sudo cp deploy/nginx.conf /etc/nginx/sites-available/futbol.matiaspendino.com
sudo ln -s /etc/nginx/sites-available/futbol.matiaspendino.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d futbol.matiaspendino.com
```

Antes, creá en tu DNS un registro **A** `futbol` apuntando a la IP del VPS.
Si el puerto 3010 ya está ocupado, cambialo en `docker-compose.yml` y en `deploy/nginx.conf`.

- Actualizar: `git pull && docker compose up -d --build`
- Logs: `docker compose logs -f`
- Base de datos: `./data/app.db`. Copia de seguridad diaria (agregar con `crontab -e`):
  `15 4 * * * cd /ruta/el-mejor-dt && docker compose exec -T app node server/src/backup.js /data/backups`
  (guarda las últimas 30 en `./data/backups`; conviene copiarlas también fuera del VPS).

## Venta de PINs con Mercado Pago

Con `MP_ACCESS_TOKEN` y `PUBLIC_URL` configurados, en la pestaña PINs aparece **Comprar PINs**:
el usuario elige cantidad, paga en Mercado Pago (Checkout Pro) y al aprobarse el pago los cambios
se suman solos. No hace falta generar ni mandar códigos. Los PINs manuales siguen funcionando.

- El token sale de [Mercado Pago Developers](https://www.mercadopago.com.ar/developers/panel/app):
  creá una aplicación (Checkout Pro) y copiá el **Access Token de producción**.
- El servidor recibe los avisos en `https://futbol.matiaspendino.com/api/payments/webhook` y
  siempre verifica el pago contra la API de Mercado Pago antes de acreditar.
- Las ventas se ven en Panel de administración → Resumen.
- El precio sale de Ajustes → Precio del PIN. Los reembolsos que hagas desde Mercado Pago no
  descuentan los cambios ya acreditados.
- Dentro de la app Android el botón está oculto por defecto (Google Play exige su propio sistema
  de cobro para compras digitales). Se puede mostrar desde Ajustes, bajo tu responsabilidad.

## Generar la app para Play Store

1. La URL del servidor está en `www/config.js` (`https://futbol.matiaspendino.com`).
2. Con Android Studio instalado: `npm install && npm run android:apk` (APK de prueba) o
   `npm run android:bundle` (AAB para Play Store).
3. O sin instalar nada: el workflow **Android** de GitHub Actions compila ambos y los deja
   como artefacto descargable. Configurá en el repositorio:
   - Variable `API_BASE` (opcional): otra URL de servidor.
   - Secrets para firmar el AAB: `ANDROID_KEYSTORE_BASE64` (el `.jks` en base64),
     `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.

   Crear la clave de firma (una sola vez, guardala bien):
   `keytool -genkey -v -keystore release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias elmejordt`

Para cada actualización subí `versionCode` en `android/app/build.gradle`.

## Cómo se administra el torneo

Todo desde **Más → Panel de administración** (con el usuario admin):

1. **Ajustes**: premios, precio del PIN y el texto de "cómo comprar un PIN" (alias, link de pago, WhatsApp).
2. **PINs**: generá lotes de códigos y entregalos a quien te pague. Cada código se usa una vez.
3. **Fechas**: los equipos se cierran solos a la hora del primer partido. Cuartos, semis y final
   tienen horarios estimados: corregilos cuando la Liga los confirme.
4. **Partidos**: cargá resultados y el clasificado (el rival queda eliminado) y creá los cruces siguientes.
5. **Puntajes**: por club, cargá minutos, goles, asistencias, tarjetas, etc. El ranking se actualiza al guardar.
6. **Fechas → Finalizar y premiar**: define el ganador de la fecha, abre la siguiente y,
   al terminar la final, define al campeón. En **Resumen** ves a quién pagarle y lo marcás como pagado.
7. **Jugadores**: corregí planteles, puestos y precios.

## Datos cargados

Cruces de octavos (20 al 25 de noviembre de 2026): Vélez–Belgrano, Defensa y Justicia–Barracas Central,
Argentinos–Independiente, Rosario Central–Gimnasia (Mza.), River–Lanús, Instituto–Huracán,
Gimnasia (LP)–Newell's y Boca–Independiente Rivadavia.

Los planteles (`server/src/seed-data.js`) se armaron a partir de las formaciones publicadas de las
últimas fechas del Clausura; **pueden faltar jugadores o haber puestos mal asignados**: revisalos
en el panel antes de abrir el juego al público. Los precios son ficticios.

## Antes de publicar

- **Legal**: un juego con pago (PINs) y premios en dinero puede requerir autorización del organismo
  de juegos de azar/loterías de tu jurisdicción y bases y condiciones registradas. Consultalo con un abogado.
- **Play Store**: Google restringe las apps con premios en dinero real y exige su sistema de pagos para
  compras digitales dentro de la app. Por eso la app no cobra: solo canjea PINs vendidos por fuera.
  Revisá las políticas de "Juegos, apuestas y concursos con dinero real" antes de enviar la app.
- Nombres de clubes y jugadores se usan solo como referencia; la app no usa escudos ni marcas oficiales.
