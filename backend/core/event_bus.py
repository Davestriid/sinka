import asyncio
import logging
from collections import defaultdict
from typing import Any, Callable

logger = logging.getLogger(__name__)


class InternalEventBus:
    def __init__(self) -> None:
        self._subscribers: dict[str, list[Callable]] = defaultdict(list)

    def subscribe(self, event: str, handler: Callable) -> None:
        self._subscribers[event].append(handler)

    async def publish(self, event: str, payload: Any) -> None:
        handlers = self._subscribers.get(event, [])
        if not handlers:
            return
        results = await asyncio.gather(
            *[handler(payload) for handler in handlers],
            return_exceptions=True,
        )
        for handler, result in zip(handlers, results):
            if isinstance(result, Exception):
                logger.error(
                    "EventBus: handler '%s' falló en evento '%s': %s",
                    handler.__name__,
                    event,
                    result,
                    exc_info=result,
                )


EventBus = InternalEventBus()
