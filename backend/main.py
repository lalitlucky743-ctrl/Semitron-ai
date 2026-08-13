import os
import uuid
import bcrypt

from datetime import datetime, timedelta
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from groq import Groq
from jose import JWTError, jwt
from pydantic import BaseModel


# =========================================================
# ENVIRONMENT
# =========================================================

load_dotenv()


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
# TEMPORARY IN-MEMORY STORAGE
# =========================================================

users = {}


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
    token: str = Depends(oauth2_scheme)
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

    user = users.get(username)

    if user is None:
        raise credentials_exception

    return user


# =========================================================
# MODELS
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


@app.get("/health")
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
async def register(user: UserRegister):

    username = user.username.strip()

    if not username:
        raise HTTPException(
            status_code=400,
            detail="Username cannot be empty"
        )

    if username in users:

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

    user_id = str(uuid.uuid4())

    users[username] = {
        "user_id": user_id,
        "password_hash": hashed_password,
        "conversations": {},
        "messages": {},
    }

    access_token = create_access_token(
        data={
            "sub": username
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
    form_data: OAuth2PasswordRequestForm = Depends()
):

    username = form_data.username.strip()

    user = users.get(username)

    if not user:

        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )

    if not verify_password(
        form_data.password,
        user["password_hash"]
    ):

        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password"
        )

    access_token = create_access_token(
        data={
            "sub": username
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
    current_user: dict = Depends(get_current_user)
):

    conversations = current_user["conversations"]

    return {
        "conversations": [
            {
                "id": conversation_id,
                "title": title
            }
            for conversation_id, title
            in conversations.items()
        ]
    }


@app.post("/api/conversations")
async def create_conversation(
    title: str = "New Chat",
    current_user: dict = Depends(get_current_user)
):

    conversation_id = str(uuid.uuid4())

    current_user["conversations"][
        conversation_id
    ] = title

    current_user["messages"][
        conversation_id
    ] = []

    return {
        "id": conversation_id,
        "title": title
    }


@app.get(
    "/api/conversations/{conv_id}/messages"
)
async def get_messages(
    conv_id: str,
    current_user: dict = Depends(get_current_user)
):

    messages = current_user["messages"].get(
        conv_id,
        []
    )

    return {
        "messages": messages
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
    current_user: dict = Depends(get_current_user)
):

    conversation_id = request.conversation_id

    # Create new conversation if needed
    if not conversation_id:

        conversation_id = str(uuid.uuid4())

        current_user["conversations"][
            conversation_id
        ] = "New Chat"

        current_user["messages"][
            conversation_id
        ] = []

    # Make sure conversation exists
    if conversation_id not in current_user["messages"]:

        current_user["conversations"][
            conversation_id
        ] = "New Chat"

        current_user["messages"][
            conversation_id
        ] = []

    # Add user message
    current_user["messages"][
        conversation_id
    ].append({
        "role": "user",
        "content": request.message
    })

    # =====================================================
    # GROQ
    # =====================================================

    if groq_client:

        try:

            response = groq_client.chat.completions.create(

                model="llama-3.3-70b-versatile",

                messages=current_user[
                    "messages"
                ][conversation_id],

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

    # Add assistant response
    current_user["messages"][
        conversation_id
    ].append({
        "role": "assistant",
        "content": reply
    })

    return ChatResponse(
        reply=reply,
        conversation_id=conversation_id
    )