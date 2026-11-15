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

## Publicar el servidor

La app necesita un servidor público con HTTPS (ranking, PINs y premios se validan ahí).
Sirve cualquier hosting que corra Docker o Node con disco persistente:

```bash
docker build -t el-mejor-dt .
docker run -d -p 3000:3000 -v dt-data:/data \
  -e ADMIN_USER=admin -e ADMIN_PASSWORD=una-clave-segura el-mejor-dt
```

Variables: `PORT`, `DB_PATH` (archivo SQLite; **hacé copias de seguridad**), `ADMIN_USER`,
`ADMIN_PASSWORD`, `TRUST_PROXY=1` si está detrás de un proxy.

## Generar la app para Play Store

1. Poné la URL del servidor en `www/config.js` (`API_BASE: 'https://tu-servidor.com'`).
2. Con Android Studio instalado: `npm install && npm run android:apk` (APK de prueba) o
   `npm run android:bundle` (AAB para Play Store).
3. O sin instalar nada: el workflow **Android** de GitHub Actions compila ambos y los deja
   como artefacto descargable. Configurá en el repositorio:
   - Variable `API_BASE`: URL del servidor.
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
