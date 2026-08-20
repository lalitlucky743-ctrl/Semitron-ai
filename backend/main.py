import os
import uuid

import bcrypt

from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
)

from fastapi.middleware.cors import CORSMiddleware

from fastapi.security import (
    OAuth2PasswordBearer,
    OAuth2PasswordRequestForm,
)

from groq import Groq

from jose import JWTError, jwt

from pydantic import BaseModel

from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import User, Conversation, Message


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()


# =========================================================
# DATABASE
# =========================================================

Base.metadata.create_all(bind=engine)


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="Semitron AI API",
    version="1.0.0",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        "https://semitron-ai.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# SECURITY
# =========================================================

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/api/login"
)

SECRET_KEY = os.getenv("JWT_SECRET_KEY")

if not SECRET_KEY:
    raise RuntimeError(
        "JWT_SECRET_KEY environment variable is not configured."
    )

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = 30


# =========================================================
# GROQ
# =========================================================

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

groq_client = (
    Groq(api_key=GROQ_API_KEY)
    if GROQ_API_KEY
    else None
)


# =========================================================
# PASSWORD HELPERS
# =========================================================

def get_password_hash(password: str) -> str:

    password_bytes = password.encode("utf-8")

    if len(password_bytes) > 72:
        raise ValueError(
            "Password cannot be longer than 72 characters"
        )

    salt = bcrypt.gensalt()

    hashed = bcrypt.hashpw(
        password_bytes,
        salt
    )

    return hashed.decode("utf-8")


def verify_password(
    plain_password: str,
    hashed_password: str
) -> bool:

    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


# =========================================================
# JWT
# =========================================================

def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None
):

    to_encode = data.copy()

    if expires_delta:

        expire = datetime.utcnow() + expires_delta

    else:

        expire = datetime.utcnow() + timedelta(
            minutes=ACCESS_TOKEN_EXPIRE_MINUTES
        )

    to_encode.update({
        "exp": expire
    })

    encoded_jwt = jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM
    )

    return encoded_jwt


# =========================================================
# CURRENT USER
# =========================================================

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={
            "WWW-Authenticate": "Bearer"
        },
    )

    try:

        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM]
        )

        username = payload.get("sub")

        if username is None:
            raise credentials_exception

    except JWTError:

        raise credentials_exception

    user = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if user is None:
        raise credentials_exception

    return user


# =========================================================
# SCHEMAS
# =========================================================

class UserRegister(BaseModel):

    username: str

    password: str


class Token(BaseModel):

    access_token: str

    token_type: str


class ChatRequest(BaseModel):

    message: str

    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):

    reply: str

    conversation_id: str


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get("/")
async def root():

    return {
        "message": "Semitron AI API is running",
        "status": "ok"
    }


@app.api_route(
    "/health",
    methods=["GET", "HEAD"]
)
async def health():

    return {
        "status": "healthy"
    }


# =========================================================
# REGISTER
# =========================================================

@app.post(
    "/api/register",
    response_model=Token
)
async def register(
    user: UserRegister,
    db: Session = Depends(get_db)
):

    username = user.username.strip()

    if not username:

        raise HTTPException(
            status_code=400,
            detail="Username cannot be empty"
        )

    existing_user = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if existing_user:

        raise HTTPException(
            status_code=400,
            detail="Username already registered"
        )

    try:

        hashed_password = get_password_hash(
            user.password
        )

    except ValueError as e:

        raise HTTPException(
            status_code=400,
            detail=str(e)
        )

    new_user = User(
        username=username,
        hashed_password=hashed_password
    )

    db.add(new_user)

    db.commit()

    db.refresh(new_user)

    access_token = create_access_token(
        data={
            "sub": new_user.username
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =========================================================
# LOGIN
# =========================================================

@app.post(
    "/api/login",
    response_model=Token
)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):

    username = form_data.username.strip()

    user = (
        db.query(User)
        .filter(User.username == username)
        .first()
    )

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )

    if not verify_password(
        form_data.password,
        user.hashed_password
    ):

        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )

    access_token = create_access_token(
        data={
            "sub": user.username
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


# =========================================================
# CONVERSATIONS
# =========================================================

@app.get("/api/conversations")
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    conversations = (
        db.query(Conversation)
        .filter(
            Conversation.user_id == current_user.id
        )
        .order_by(
            Conversation.created_at.desc()
        )
        .all()
    )

    return {
        "conversations": [
            {
                "id": conversation.id,
                "title": conversation.title
            }
            for conversation in conversations
        ]
    }


# =========================================================
# CREATE CONVERSATION
# =========================================================

@app.post("/api/conversations")
async def create_conversation(
    title: str = "New Chat",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    conversation_id = str(uuid.uuid4())

    conversation = Conversation(
        id=conversation_id,
        user_id=current_user.id,
        title=title
    )

    db.add(conversation)

    db.commit()

    db.refresh(conversation)

    return {
        "id": conversation.id,
        "title": conversation.title
    }


# =========================================================
# GET MESSAGES
# =========================================================

@app.get(
    "/api/conversations/{conv_id}/messages"
)
async def get_messages(
    conv_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conv_id,
            Conversation.user_id == current_user.id
        )
        .first()
    )

    if conversation is None:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    messages = (
        db.query(Message)
        .filter(
            Message.conversation_id == conv_id
        )
        .order_by(
            Message.created_at.asc()
        )
        .all()
    )

    return {
        "messages": [
            {
                "role": message.role,
                "content": message.content
            }
            for message in messages
        ]
    }


# =========================================================
# CHAT
# =========================================================

@app.post(
    "/api/chat",
    response_model=ChatResponse
)
async def chat(
    request: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):

    conversation_id = request.conversation_id

    # =====================================================
    # CREATE NEW CONVERSATION
    # =====================================================

    if not conversation_id:

        conversation_id = str(uuid.uuid4())

        conversation = Conversation(
            id=conversation_id,
            user_id=current_user.id,
            title="New Chat"
        )

        db.add(conversation)

        db.commit()

    # =====================================================
    # FIND EXISTING CONVERSATION
    # =====================================================

    conversation = (
        db.query(Conversation)
        .filter(
            Conversation.id == conversation_id,
            Conversation.user_id == current_user.id
        )
        .first()
    )

    if conversation is None:

        raise HTTPException(
            status_code=404,
            detail="Conversation not found"
        )

    # =====================================================
    # SAVE USER MESSAGE
    # =====================================================

    user_message = Message(
        conversation_id=conversation_id,
        role="user",
        content=request.message
    )

    db.add(user_message)

    db.commit()

    # =====================================================
    # LOAD CHAT HISTORY
    # =====================================================

    history = (
        db.query(Message)
        .filter(
            Message.conversation_id == conversation_id
        )
        .order_by(
            Message.created_at.asc()
        )
        .all()
    )

    messages_for_ai = [
        {
            "role": message.role,
            "content": message.content
        }
        for message in history
    ]

    # =====================================================
    # GROQ
    # =====================================================

    if groq_client:

        try:

            response = groq_client.chat.completions.create(

                model="llama-3.1-8b-instant",

                messages=messages_for_ai,

                temperature=0.7,
            )

            reply = response.choices[
                0
            ].message.content

        except Exception as e:

            reply = f"Groq error: {str(e)}"

    else:

        reply = (
            f"Echo: {request.message} "
            "(Groq API key missing)"
        )

    # =====================================================
    # SAVE ASSISTANT MESSAGE
    # =====================================================

    assistant_message = Message(
        conversation_id=conversation_id,
        role="assistant",
        content=reply
    )

    db.add(assistant_message)

    db.commit()

    # =====================================================
    # RETURN
    # =====================================================

    return ChatResponse(
        reply=reply,
        conversation_id=conversation_id
    )