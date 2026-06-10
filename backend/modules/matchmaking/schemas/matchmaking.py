from pydantic import BaseModel


class MatchResponse(BaseModel):
    id: str
    user_a_id: str
    user_b_id: str
    status: str

    model_config = {"from_attributes": True}


class QueuedMessage(BaseModel):
    type: str = "QUEUED"
    position: int


class MatchedMessage(BaseModel):
    type: str = "MATCHED"
    session_id: str
    partner_username: str
    partner_id: str


class QueueTimeoutMessage(BaseModel):
    type: str = "QUEUE_TIMEOUT"
    message: str = "No se encontro pareja en el tiempo limite. Intentalo de nuevo."


class ErrorMessage(BaseModel):
    type: str = "ERROR"
    detail: str
