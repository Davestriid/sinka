const { Document, Packer, Paragraph, TextRun, PageBreak, AlignmentType, HeadingLevel } = require('docx');
const fs = require('fs');

async function crearManual(nombre, titulo, contenido) {
  const doc = new Document({ sections: [{ children: contenido }] });
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(nombre, buffer);
  console.log(`✓ ${nombre}`);
}

async function main() {
  const usuario = [
    new Paragraph({ text: 'MANUAL DE USUARIO', alignment: AlignmentType.CENTER, run: new TextRun({ size: 32, bold: true }), spacing: { before: 400 } }),
    new Paragraph({ text: 'SINKA', alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
    new Paragraph({ text: '', spacing: { line: 400 } }),
    new Paragraph({ text: 'Instituto Superior Tecnológico Sudamericano', alignment: AlignmentType.CENTER, spacing: { before: 200 } }),
    new Paragraph({ text: 'Loja - Ecuador 2025', alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
    new PageBreak(),
    new Paragraph({ text: 'Índice', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: '1 Introducción' }),
    new Paragraph({ text: '2 Registro' }),
    new Paragraph({ text: '3 Dashboard' }),
    new Paragraph({ text: '4 Sesión' }),
    new PageBreak(),
    new Paragraph({ text: '1. Introducción', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: 'SINKA conecta usuarios para trabajar juntos 25 minutos. Ganas experiencia y monedas cada sesión.' }),
    new Paragraph({ text: '2. Registro', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: '1. Accede a sinka-eight.vercel.app\n2. Haz clic en Regístrate\n3. Crea tu cuenta\n4. Elige nombre y símbolo' }),
    new Paragraph({ text: '3. Dashboard', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: 'Ve tu nivel, monedas, y sesiones completadas' }),
    new Paragraph({ text: '4. Sesión', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: 'Selecciona área, te empareja SINKA, trabaja 25 min con tu pareja, gana XP y monedas' })
  ];

  const admin = [
    new Paragraph({ text: 'MANUAL DE ADMINISTRADOR', alignment: AlignmentType.CENTER, run: new TextRun({ size: 32, bold: true }), spacing: { before: 400 } }),
    new Paragraph({ text: 'SINKA', alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
    new Paragraph({ text: '', spacing: { line: 400 } }),
    new Paragraph({ text: 'Instituto Superior Tecnológico Sudamericano', alignment: AlignmentType.CENTER, spacing: { before: 200 } }),
    new Paragraph({ text: 'Loja - Ecuador 2025', alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
    new PageBreak(),
    new Paragraph({ text: 'Índice', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: '1 Acceso' }),
    new Paragraph({ text: '2 Usuarios' }),
    new Paragraph({ text: '3 Monitoreo' }),
    new Paragraph({ text: '4 Configuración' }),
    new PageBreak(),
    new Paragraph({ text: '1. Acceso', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: 'Accede a /admin con credenciales administrativas. Requiere autenticación de dos factores.' }),
    new Paragraph({ text: '2. Usuarios', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: 'Gestiona: lista, edita, suspende cuentas' }),
    new Paragraph({ text: '3. Monitoreo', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: 'Ve sesiones activas, estadísticas, gráficos de uso, descarga reportes' }),
    new Paragraph({ text: '4. Configuración', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: 'Variables de entorno, base de datos, backups, permisos' })
  ];

  const programador = [
    new Paragraph({ text: 'MANUAL DE PROGRAMADOR', alignment: AlignmentType.CENTER, run: new TextRun({ size: 32, bold: true }), spacing: { before: 400 } }),
    new Paragraph({ text: 'SINKA', alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
    new Paragraph({ text: '', spacing: { line: 400 } }),
    new Paragraph({ text: 'Instituto Superior Tecnológico Sudamericano', alignment: AlignmentType.CENTER, spacing: { before: 200 } }),
    new Paragraph({ text: 'Loja - Ecuador 2025', alignment: AlignmentType.CENTER, spacing: { before: 100 } }),
    new PageBreak(),
    new Paragraph({ text: 'Índice', heading: HeadingLevel.HEADING_1 }),
    new Paragraph({ text: '1 Stack' }),
    new Paragraph({ text: '2 Instalación' }),
    new Paragraph({ text: '3 Backend' }),
    new Paragraph({ text: '4 Frontend' }),
    new Paragraph({ text: '5 Despliegue' }),
    new PageBreak(),
    new Paragraph({ text: '1. Stack Tecnológico', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: 'Frontend: Next.js, TypeScript, Tailwind, Zustand\nBackend: FastAPI, SQLAlchemy, PostgreSQL\nTiempo Real: WebSocket, WebRTC' }),
    new Paragraph({ text: '2. Instalación', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: 'cd backend && pip install -r requirements.txt\ncd frontend && npm install' }),
    new Paragraph({ text: '3. Backend', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: '/core, /models, /services, /routers. Endpoints: auth, users, sessions' }),
    new Paragraph({ text: '4. Frontend', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: '/app, /components, /hooks, /store. Componentes: Navbar, Dashboard, SessionCard, ChatBox' }),
    new Paragraph({ text: '5. Despliegue', heading: HeadingLevel.HEADING_1, spacing: { before: 200 } }),
    new Paragraph({ text: 'Vercel para frontend, Railway para backend' })
  ];

  try {
    await crearManual('Manual_de_Usuario_SINKA.docx', 'Usuario', usuario);
    await crearManual('Manual_de_Administrador_SINKA.docx', 'Admin', admin);
    await crearManual('Manual_de_Programador_SINKA.docx', 'Programador', programador);
    console.log('\n✅ Manuales creados en Manuales/');
  } catch (e) {
    console.error('❌', e.message);
  }
}

main();
