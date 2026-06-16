from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


UserRole = Literal["customer", "admin"]


class UserRegister(BaseModel):
    full_name: str = Field(min_length=2, max_length=255)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: UserRole

    model_config = ConfigDict(from_attributes=True)


class AuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse
