"""
Envio de correo saliente — por ahora solo se usa para el enlace de
verificacion de cuenta (ver modules/identity).

Usa smtplib de la libreria estandar en vez de agregar una dependencia nueva
(aiosmtplib, sendgrid, etc.): el volumen de correo de esta app es bajo
(un correo por registro, algun reenvio) y no justifica otra libreria. Como
smtplib es sincrono, se corre en un hilo aparte (asyncio.to_thread) para no
bloquear el event loop de FastAPI.

Si SMTP_HOST no esta configurado (desarrollo local sin credenciales), el
envio se omite con un aviso en el log en vez de fallar — asi el registro de
usuarios nuevos sigue funcionando igual aunque nadie haya configurado correo
todavia. En produccion, configurar SMTP_HOST/SMTP_USER/SMTP_PASSWORD/EMAIL_FROM
(ver .env.example) es lo que activa el envio real.
"""
import asyncio
import logging
import smtplib
from email.message import EmailMessage

from core.config import settings

logger = logging.getLogger("sinka.email")


def _enviar_sincrono(destinatario: str, asunto: str, texto: str, html: str) -> None:
    msg = EmailMessage()
    msg["Subject"] = asunto
    msg["From"] = settings.email_from or settings.smtp_user
    msg["To"] = destinatario
    msg.set_content(texto)
    msg.add_alternative(html, subtype="html")

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
        server.starttls()
        if settings.smtp_user:
            server.login(settings.smtp_user, settings.smtp_password)
        server.send_message(msg)


async def enviar_correo(destinatario: str, asunto: str, texto: str, html: str) -> bool:
    """
    Devuelve True si se envio (o se intento enviar sin errores), False si no
    hay SMTP configurado. Nunca lanza — un fallo de correo no debe tumbar el
    registro ni el login de nadie; solo queda en el log.
    """
    if not settings.smtp_host:
        logger.warning(
            "SMTP no configurado (SMTP_HOST vacio) — no se envio correo a %s. "
            "Configura SMTP_HOST/SMTP_USER/SMTP_PASSWORD/EMAIL_FROM para activar el envio real.",
            destinatario,
        )
        return False
    try:
        await asyncio.to_thread(_enviar_sincrono, destinatario, asunto, texto, html)
        return True
    except Exception:
        logger.exception("No se pudo enviar el correo a %s", destinatario)
        return False


def enlace_verificacion(token: str) -> str:
    return f"{settings.frontend_url}/verificar-email?token={token}"


async def enviar_verificacion(destinatario: str, username: str, token: str) -> bool:
    enlace = enlace_verificacion(token)
    asunto = "Confirma tu correo en SINKA"
    texto = (
        f"Hola {username},\n\n"
        f"Confirma tu correo para terminar de activar tu cuenta en SINKA:\n{enlace}\n\n"
        "Si no creaste esta cuenta, puedes ignorar este mensaje.\n\n"
        "Este enlace vence en 24 horas."
    )
    html = f"""
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2>Hola {username},</h2>
      <p>Confirma tu correo para terminar de activar tu cuenta en SINKA.</p>
      <p>
        <a href="{enlace}"
           style="display:inline-block; padding:12px 24px; background:#4a7c59;
                  color:#fff; border-radius:8px; text-decoration:none;">
          Confirmar mi correo
        </a>
      </p>
      <p style="color:#888; font-size:13px;">
        Si el botón no funciona, copia este enlace en tu navegador:<br>
        {enlace}
      </p>
      <p style="color:#888; font-size:13px;">
        Si no creaste esta cuenta, puedes ignorar este mensaje. Este enlace vence en 24 horas.
      </p>
    </div>
    """
    return await enviar_correo(destinatario, asunto, texto, html)
