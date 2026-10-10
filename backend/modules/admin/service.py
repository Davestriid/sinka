"""
Servicio del panel de administracion.

Mayormente no tiene su propia tabla de "configuracion": lee y escribe
directamente sobre modelos de otros modulos (users, user_stats,
shop_items). Es un panel de operacion, no un dueno de datos nuevos.

Las dos excepciones son Setting (parametros configurables) y AuditLog
(rastro de acciones), que si viven en modules/admin/models.py porque no
pertenecen a ningun otro dominio.
"""
from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime, timezone

from modules.admin.models import AuditLog, Setting
from modules.admin.schemas import (
    AdminAnnouncementRow,
    AdminAuditRow,
    AdminPurchaseRow,
    AdminReportRow,
    AdminRevenue,
    AdminSettingRow,
    AdminShopItemRow,
    AdminStats,
    AdminUserList,
    AdminUserRow,
)
from modules.announcements.models import Announcement
from modules.gamification.models import ShopItem, UserStats
from modules.identity.models import User
from modules.identity.repositories.user_repository import UserRepository
from modules.payments.models import CoinPurchase
from modules.reports.models import Report
from modules.sessions.models import FocusSession

ESTADOS_REPORTE_VALIDOS = ("revisado", "descartado")

ROLES_VALIDOS = ("usuario", "admin", "superadmin")


class AdminService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.user_repo = UserRepository(db)

    # ------------------------------------------------------------------ #
    # Auditoria                                                         #
    # ------------------------------------------------------------------ #
    async def _auditar(
        self,
        admin_id: str,
        accion: str,
        objetivo_tipo: str | None = None,
        objetivo_id: str | None = None,
        detalle: str | None = None,
    ) -> None:
        """
        Deja constancia de una accion de administracion. Se llama al final
        de cada metodo que escribe algo, nunca se expone para editar/borrar.
        """
        self.db.add(
            AuditLog(
                admin_id=admin_id,
                accion=accion,
                objetivo_tipo=objetivo_tipo,
                objetivo_id=objetivo_id,
                detalle=detalle,
            )
        )
        await self.db.commit()

    async def listar_auditoria(self, limite: int = 100) -> list[AdminAuditRow]:
        logs = (
            await self.db.execute(
                select(AuditLog).order_by(AuditLog.created_at.desc()).limit(limite)
            )
        ).scalars().all()

        ids = {l.admin_id for l in logs}
        usuarios = (
            await self.db.execute(select(User.id, User.username).where(User.id.in_(ids)))
        ).all() if ids else []
        nombres = {uid: username for uid, username in usuarios}

        return [
            AdminAuditRow(
                id=l.id,
                admin_id=l.admin_id,
                admin_username=nombres.get(l.admin_id),
                accion=l.accion,
                objetivo_tipo=l.objetivo_tipo,
                objetivo_id=l.objetivo_id,
                detalle=l.detalle,
                created_at=l.created_at,
            )
            for l in logs
        ]

    # ------------------------------------------------------------------ #
    # Usuarios                                                          #
    # ------------------------------------------------------------------ #
    async def listar_usuarios(
        self,
        termino: str | None,
        pagina: int,
        por_pagina: int,
        role: str | None = None,
        banned: bool | None = None,
    ) -> AdminUserList:
        usuarios, total = await self.user_repo.listar_admin(
            termino, pagina, por_pagina, role, banned
        )
        return AdminUserList(
            items=[AdminUserRow.model_validate(u) for u in usuarios],
            total=total,
            pagina=pagina,
            por_pagina=por_pagina,
        )

    async def banear(self, user_id: str, banear: bool, admin_id: str) -> AdminUserRow:
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
        user.is_banned = banear
        await self.db.commit()
        await self.db.refresh(user)
        await self._auditar(
            admin_id,
            "suspender_usuario" if banear else "reactivar_usuario",
            objetivo_tipo="user",
            objetivo_id=user_id,
        )
        return AdminUserRow.model_validate(user)

    async def banear_lote(self, user_ids: list[str], banear: bool, admin_id: str) -> list[AdminUserRow]:
        """Accion en lote para la seleccion multiple del panel."""
        resultados: list[AdminUserRow] = []
        for uid in user_ids:
            user = await self.user_repo.get_by_id(uid)
            if not user:
                continue
            user.is_banned = banear
            resultados.append(user)
        await self.db.commit()
        for user in resultados:
            await self.db.refresh(user)
        await self._auditar(
            admin_id,
            "suspender_usuario_lote" if banear else "reactivar_usuario_lote",
            objetivo_tipo="user",
            detalle=f"{len(resultados)} usuarios: {', '.join(u.id for u in resultados)}",
        )
        return [AdminUserRow.model_validate(u) for u in resultados]

    async def cambiar_rol(self, user_id: str, nuevo_rol: str, quien_lo_pide_id: str) -> AdminUserRow:
        if nuevo_rol not in ROLES_VALIDOS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Rol invalido. Opciones: {ROLES_VALIDOS}",
            )
        if user_id == quien_lo_pide_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No puedes cambiar tu propio rol.",
            )
        user = await self.user_repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")
        user.role = nuevo_rol
        await self.db.commit()
        await self.db.refresh(user)
        await self._auditar(
            quien_lo_pide_id, "cambiar_rol", objetivo_tipo="user", objetivo_id=user_id, detalle=nuevo_rol
        )
        return AdminUserRow.model_validate(user)

    # ------------------------------------------------------------------ #
    # Tienda                                                            #
    # ------------------------------------------------------------------ #
    async def listar_items_tienda(self) -> list[AdminShopItemRow]:
        items = (await self.db.execute(select(ShopItem).order_by(ShopItem.category))).scalars().all()
        return [AdminShopItemRow.model_validate(i) for i in items]

    async def editar_item_tienda(self, item_id: str, cambios: dict, admin_id: str) -> AdminShopItemRow:
        item = (
            await self.db.execute(select(ShopItem).where(ShopItem.id == item_id))
        ).scalar_one_or_none()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Item no encontrado.")
        for campo, valor in cambios.items():
            if valor is not None:
                setattr(item, campo, valor)
        await self.db.commit()
        await self.db.refresh(item)
        await self._auditar(
            admin_id, "editar_item_tienda", objetivo_tipo="shop_item", objetivo_id=item_id,
            detalle=str(cambios),
        )
        return AdminShopItemRow.model_validate(item)

    async def ingresos(self, limite: int = 50) -> AdminRevenue:
        """Solo superadmin: dinero real cobrado via Stripe (ver router)."""
        pagadas = (
            await self.db.execute(select(CoinPurchase).where(CoinPurchase.estado == "pagado"))
        ).scalars().all()
        total_centavos = sum(c.precio_centavos for c in pagadas)

        recientes = (
            await self.db.execute(
                select(CoinPurchase).order_by(CoinPurchase.created_at.desc()).limit(limite)
            )
        ).scalars().all()

        return AdminRevenue(
            ingresos_centavos=total_centavos,
            compras_pagadas=len(pagadas),
            compras=[AdminPurchaseRow.model_validate(c) for c in recientes],
        )

    # ------------------------------------------------------------------ #
    # Buzon (reportes + feedback general)                               #
    # ------------------------------------------------------------------ #
    async def listar_reportes(
        self, estado: str | None = None, tipo: str | None = None
    ) -> list[AdminReportRow]:
        """Pendientes primero por defecto — es lo que un moderador quiere ver."""
        q = select(Report)
        if estado:
            q = q.where(Report.status == estado)
        if tipo:
            q = q.where(Report.tipo == tipo)
        q = q.order_by(Report.created_at.desc())
        reportes = (await self.db.execute(q)).scalars().all()

        # Un solo viaje por los usuarios involucrados, no uno por reporte.
        # reported_user_id puede ser None (feedback general sin usuario
        # reportado), asi que se descarta antes del IN para no meter NULL.
        ids = {r.reporter_id for r in reportes} | {
            r.reported_user_id for r in reportes if r.reported_user_id
        } | {
            r.replied_by for r in reportes if r.replied_by
        }
        usuarios = (
            await self.db.execute(select(User.id, User.username).where(User.id.in_(ids)))
        ).all() if ids else []
        nombres = {uid: username for uid, username in usuarios}

        return [self._fila_reporte(r, nombres) for r in reportes]

    def _fila_reporte(self, r: Report, nombres: dict[str, str]) -> AdminReportRow:
        """Arma una fila para el panel a partir de un Report y un mapa id->username
        ya resuelto, para no repetir el mismo armado en listar/resolver/responder."""
        return AdminReportRow(
            id=r.id,
            reporter_id=r.reporter_id,
            reporter_username=nombres.get(r.reporter_id),
            reported_user_id=r.reported_user_id,
            reported_username=nombres.get(r.reported_user_id) if r.reported_user_id else None,
            tipo=r.tipo,
            reason=r.reason,
            details=r.details,
            status=r.status,
            created_at=r.created_at,
            resolved_at=r.resolved_at,
            admin_reply=r.admin_reply,
            replied_at=r.replied_at,
            replied_by_username=nombres.get(r.replied_by) if r.replied_by else None,
        )

    async def resolver_reporte(self, report_id: str, nuevo_estado: str, admin_id: str) -> AdminReportRow:
        if nuevo_estado not in ESTADOS_REPORTE_VALIDOS:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Estado invalido. Opciones: {ESTADOS_REPORTE_VALIDOS}",
            )
        reporte = (
            await self.db.execute(select(Report).where(Report.id == report_id))
        ).scalar_one_or_none()
        if not reporte:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")

        reporte.status = nuevo_estado
        reporte.resolved_at = datetime.now(timezone.utc)
        reporte.resolved_by = admin_id
        await self.db.commit()
        await self.db.refresh(reporte)

        mapa = await self._nombres_de(reporte)

        await self._auditar(
            admin_id, "resolver_reporte", objetivo_tipo="report", objetivo_id=report_id,
            detalle=nuevo_estado,
        )

        return self._fila_reporte(reporte, mapa)

    async def responder_reporte(self, report_id: str, mensaje: str, admin_id: str) -> AdminReportRow:
        """
        Guarda la respuesta de un admin a un mensaje del buzon. El usuario que
        lo envio la ve en GET /reports/mine.

        Responder marca el reporte como "revisado" automaticamente si seguia
        "pendiente" — en la practica, escribirle una respuesta a alguien ya
        es la forma de atender el mensaje; no tiene sentido dejarlo pendiente
        despues de eso. Si un admin ya lo habia descartado y aun asi quiere
        responder (p.ej. para explicar por que), se respeta ese estado.
        """
        reporte = (
            await self.db.execute(select(Report).where(Report.id == report_id))
        ).scalar_one_or_none()
        if not reporte:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reporte no encontrado.")

        reporte.admin_reply = mensaje
        reporte.replied_at = datetime.now(timezone.utc)
        reporte.replied_by = admin_id
        if reporte.status == "pendiente":
            reporte.status = "revisado"
            reporte.resolved_at = reporte.replied_at
            reporte.resolved_by = admin_id
        await self.db.commit()
        await self.db.refresh(reporte)

        mapa = await self._nombres_de(reporte)

        await self._auditar(
            admin_id, "responder_reporte", objetivo_tipo="report", objetivo_id=report_id,
        )

        return self._fila_reporte(reporte, mapa)

    async def _nombres_de(self, reporte: Report) -> dict[str, str]:
        """id->username de todo usuario que aparece en una fila de buzon."""
        ids_a_buscar = {reporte.reporter_id}
        if reporte.reported_user_id:
            ids_a_buscar.add(reporte.reported_user_id)
        if reporte.replied_by:
            ids_a_buscar.add(reporte.replied_by)
        filas = (
            await self.db.execute(select(User.id, User.username).where(User.id.in_(ids_a_buscar)))
        ).all()
        return {uid: username for uid, username in filas}

    # ------------------------------------------------------------------ #
    # Anuncios                                                          #
    # ------------------------------------------------------------------ #
    async def crear_anuncio(
        self,
        titulo: str,
        mensaje: str,
        admin_id: str,
        starts_at: datetime | None = None,
        expires_at: datetime | None = None,
    ) -> AdminAnnouncementRow:
        anuncio = Announcement(
            titulo=titulo, mensaje=mensaje, creado_por_id=admin_id,
            starts_at=starts_at, expires_at=expires_at,
        )
        self.db.add(anuncio)
        await self.db.commit()
        await self.db.refresh(anuncio)
        await self._auditar(
            admin_id, "crear_anuncio", objetivo_tipo="announcement", objetivo_id=anuncio.id,
            detalle=titulo,
        )
        return AdminAnnouncementRow.model_validate(anuncio)

    async def listar_anuncios(self) -> list[AdminAnnouncementRow]:
        anuncios = (
            await self.db.execute(select(Announcement).order_by(Announcement.created_at.desc()))
        ).scalars().all()
        return [AdminAnnouncementRow.model_validate(a) for a in anuncios]

    async def desactivar_anuncio(self, anuncio_id: str, admin_id: str) -> AdminAnnouncementRow:
        anuncio = (
            await self.db.execute(select(Announcement).where(Announcement.id == anuncio_id))
        ).scalar_one_or_none()
        if not anuncio:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Anuncio no encontrado.")
        anuncio.activo = False
        await self.db.commit()
        await self.db.refresh(anuncio)
        await self._auditar(
            admin_id, "desactivar_anuncio", objetivo_tipo="announcement", objetivo_id=anuncio_id
        )
        return AdminAnnouncementRow.model_validate(anuncio)

    # ------------------------------------------------------------------ #
    # Parametros configurables                                         #
    # ------------------------------------------------------------------ #
    async def listar_parametros(self) -> list[AdminSettingRow]:
        settings = (
            await self.db.execute(select(Setting).order_by(Setting.code))
        ).scalars().all()
        return [AdminSettingRow.model_validate(s) for s in settings]

    async def crear_parametro(
        self, code: str, name: str, value: dict, description: str | None, admin_id: str
    ) -> AdminSettingRow:
        existente = (
            await self.db.execute(select(Setting).where(Setting.code == code))
        ).scalar_one_or_none()
        if existente:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Ya existe un parametro con ese codigo.",
            )
        setting = Setting(code=code, name=name, value=value, description=description)
        self.db.add(setting)
        await self.db.commit()
        await self.db.refresh(setting)
        await self._auditar(
            admin_id, "crear_parametro", objetivo_tipo="setting", objetivo_id=setting.id,
            detalle=code,
        )
        return AdminSettingRow.model_validate(setting)

    async def actualizar_parametro(self, setting_id: str, value: dict, admin_id: str) -> AdminSettingRow:
        setting = (
            await self.db.execute(select(Setting).where(Setting.id == setting_id))
        ).scalar_one_or_none()
        if not setting:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parametro no encontrado.")
        setting.value = value
        await self.db.commit()
        await self.db.refresh(setting)
        await self._auditar(
            admin_id, "actualizar_parametro", objetivo_tipo="setting", objetivo_id=setting_id,
            detalle=f"{setting.code} -> {value}",
        )
        return AdminSettingRow.model_validate(setting)

    # ------------------------------------------------------------------ #
    # Estadisticas                                                      #
    # ------------------------------------------------------------------ #
    async def estadisticas(self) -> AdminStats:
        total_usuarios = await self.user_repo.contar_todos()
        banneados = (
            await self.db.execute(select(func.count(User.id)).where(User.is_banned.is_(True)))
        ).scalar_one()
        total_sesiones = (await self.db.execute(select(func.count(FocusSession.id)))).scalar_one()
        pomodoros = (
            await self.db.execute(select(func.coalesce(func.sum(UserStats.pomodoros_completed), 0)))
        ).scalar_one()
        coins = (
            await self.db.execute(select(func.coalesce(func.sum(UserStats.focus_coins), 0)))
        ).scalar_one()
        items_tienda = (await self.db.execute(select(func.count(ShopItem.id)))).scalar_one()

        return AdminStats(
            total_usuarios=total_usuarios,
            usuarios_banneados=banneados,
            total_sesiones=total_sesiones,
            total_pomodoros=int(pomodoros),
            focuscoins_en_circulacion=int(coins),
            items_en_tienda=items_tienda,
        )
