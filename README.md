# Finanzas personales

Aplicación web progresiva local para llevar cuentas y movimientos personales. El perfil y los datos se guardan en IndexedDB en el dispositivo; no hay registro online, servidor ni sincronización en la nube.

## Empezar

Requiere Node.js 20.19+ o 22.12+.

```sh
npm install
npm run dev
```

Para crear la versión instalable: `npm run build`. La PWA genera manifiesto y service worker para instalación y uso sin conexión de los archivos de la aplicación.

## Qué incluye esta primera versión

- Inicio con saldo de cuentas activas, disponible tras descontar pagos pendientes, totales del mes, vencimientos recurrentes e ingresos previstos.
- Gestión local de cuentas con saldo inicial, categorías de ingresos y gastos, presupuestos y nombre del espacio.
- Registro de gastos e ingresos pagados/pendientes, transferencias entre cuentas y movimientos recurrentes con frecuencia y antelación del recordatorio.
- Movimientos en lista filtrable y calendario agrupado por fecha, resumen mensual y presupuestos con seguimiento por categoría.
- Documentos adjuntos locales (imagen o PDF) asociados a movimientos.
- Copia exportable `.fbk` de los datos locales, incluidos los documentos, cifrada con AES-GCM y clave derivada por PBKDF2; restauración validada y opción de guardar una copia antes de reemplazar los datos.
- Recordatorios mediante notificaciones del navegador para movimientos recurrentes: opt-in desde Ajustes, permiso del sistema, prueba y prevención de duplicados.
- Generación automática de un movimiento pendiente por cada ocurrencia recurrente vencida, con clave única de recurrencia y fecha.
- Edición de movimientos con recálculo de saldos, filtros por estado/categoría/cuenta/fecha, estadísticas mensuales y papelera recuperable que conserva adjuntos.
- Bloqueo de pantalla opcional con PIN local (hash PBKDF2 con sal) y autenticador de plataforma compatible con WebAuthn cuando el dispositivo lo ofrece; restablecer un PIN olvidado requiere borrar los datos locales.
- Datos persistidos con Dexie sobre IndexedDB, actualizados en las vistas mediante `dexie-react-hooks`.
- Asistente de primera apertura en dos pasos: crear perfil local y añadir opcionalmente una primera cuenta bancaria, de ahorro, efectivo o tarjeta. El usuario puede continuar sin cuenta y añadirla después desde Ajustes. La app no solicita credenciales bancarias.

Los importes se guardan en euros. Los movimientos pendientes no cambian saldos; al marcarlos pagados/recibidos se aplica el cambio. Las transferencias mueven el saldo entre cuentas y no cuentan como gasto o ingreso. Al llegar una fecha recurrente, la app crea una sola vez el movimiento pendiente y avanza la fecha. El navegador puede suspender una web cerrada o en segundo plano, por lo que esta versión no garantiza avisos puntuales fuera de la app. El PIN bloquea la pantalla, pero no cifra la base de datos local; utiliza la copia cifrada para proteger datos fuera del dispositivo.

## Decisiones y estructura

- **React + TypeScript + Vite** para una interfaz modular, con tipado y ciclo de desarrollo rápido.
- **PWA** con `vite-plugin-pwa`; manifiesto, icono SVG y service worker.
- **Dexie + IndexedDB** para datos y documentos exclusivamente en el dispositivo.
- El onboarding solo se muestra cuando falta el perfil local; no modifica perfiles ni cuentas de instalaciones ya configuradas. El perfil y la cuenta inicial se guardan juntos en una transacción.
- Navegación inferior entre Inicio, Calendario, Gastos, Estadísticas y Ajustes. El botón `+` aparece solo en Inicio.
- Interfaz sencilla inspirada en iOS, adaptable a móvil y escritorio, con soporte de áreas seguras del teléfono.

```text
src/
  app/         composición de la aplicación y navegación
  components/  componentes reutilizables
  data/        Dexie y versiones del esquema IndexedDB
  features/    pantallas y formularios por área
  hooks/       consultas reactivas
  models/      modelos de dominio
  services/    inicialización y operaciones financieras
  styles/      tokens y estilos globales
  utils/       utilidades compartidas
```

Los backups exportados son la única forma de mover los datos entre dispositivos. La contraseña no se almacena: si se pierde, no se podrá restaurar ese archivo.
