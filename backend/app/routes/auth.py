from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.user import UserRegister, UserLogin, Token
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=Token, status_code=201)
def register(data: UserRegister, db: Session = Depends(get_db)):
    user = auth_service.register_teacher(data, db)
    token_data = auth_service.login(user.email, data.password, db)
    return token_data


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    return auth_service.login(data.identifier, data.password, db)
