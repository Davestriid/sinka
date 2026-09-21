# SINKA

Plataforma web de concentración colaborativa en línea con emparejamiento aleatorio.

Proyecto de investigación de fin de carrera — Tecnología Superior en Desarrollo de
Software, Instituto Superior Tecnológico Sudamericano, Loja, Ecuador.

**Autor:** John David Calle Hernández
**Director:** Ing. David Paúl Rosales Herrera, Mgs.
**Periodo:** Abril – Septiembre 2026

---

## Qué hace

SINKA conecta de forma aleatoria a dos personas que quieren concentrarse al mismo
tiempo dentro de una misma área de trabajo. Ambas comparten un temporizador Pomodoro
sincronizado, pueden verse por cámara mientras trabajan en silencio y conversar
durante los descansos.

El problema que atiende viene del estudio de mercado aplicado a 106 personas de la
ciudad de Loja: más de tres cuartas partes de la muestra pierde al menos una hora
diaria en distracciones, y a más de la mitad le toma más de quince minutos entrar en
modo de concentración.

## Funcionalidades

| Módulo | Qué resuelve |
| :--- | :--- |
| Identidad | Registro e ingreso con JWT y contraseñas cifradas con bcrypt |
| Emparejamiento | Cola por afinidad de actividad, con respaldo general tras 30 segundos |
| Sesiones | Temporizador Pomodoro compartido, cámara por WebRTC y chat de descanso |
| Social | Amistades, solicitudes con cuota diaria y jardín de vínculos |
| Grupos | Salas por área con código de invitación y sala de espera |
| Citas | Sesiones acordadas para una hora concreta |
| Gamificación | Experiencia, niveles, rachas, monedas y tabla de posiciones |
| Confianza | Penalización por abandono y prioridad en el emparejamiento |

## Tecnologías

**Backend** — FastAPI sobre Python 3.11, SQLAlchemy con Alembic, PostgreSQL y Redis.
Arquitectura de monolito modular: cada módulo de dominio separa API, servicios y
repositorios, y se comunican por un bus de eventos interno.

**Frontend** — Next.js 14 con App Router, React y TypeScript.

**Tiempo real** — WebSocket para el temporizador compartido y la señalización, WebRTC
de par a par para la cámara. No hay servidor de medios centralizado.

## Estructura

```
backend/
  core/               Configuración, base de datos, caché, bus de eventos
  modules/            Siete módulos de dominio
  alembic/versions/   Nueve migraciones versionadas
  tests/unit/         Suite de pruebas
frontend/
  src/app/            Quince pantallas
  src/lib/            Cliente de API, WebRTC, detector de actividad
```

## Ejecutar en local

Requisitos: Python 3.11, Node.js 20, una base PostgreSQL y una instancia de Redis.

```bash
# Backend
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env          # completar con credenciales propias
alembic upgrade head
uvicorn main:app --reload

# Frontend
cd frontend
npm install
copy .env.local.example .env.local
npm run dev
```

En Windows, el archivo `INICIAR_SINKA.bat` levanta las dos partes a la vez.

## Pruebas

```bash
cd backend
pytest tests/unit -q
```

La suite cubre la lógica de negocio propia del proyecto sin depender de la base de
datos ni de la red: emparejamiento por afinidad, crecimiento del jardín, cálculo de
experiencia y monedas, condiciones de la sala de espera, puntaje de confianza y el
acuerdo para extender una sesión.

## Despliegue

El frontend se aloja en Vercel y el backend en Render, ambos con despliegue automático
desde la rama `main`. La base de datos PostgreSQL está gestionada por Supabase y Redis
por Upstash. Las migraciones se aplican solas en cada despliegue del backend.

## Licencia

Trabajo académico. Los derechos fueron cedidos al Instituto Superior Tecnológico
Sudamericano conforme al acta de cesión que consta en el documento de titulación.
