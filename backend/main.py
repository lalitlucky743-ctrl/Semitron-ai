import os
import uuid
import bcrypt
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional
from jose import JWTError, jwt
from groq import Groq
from dotenv import load_dotenv
from datetime import datetime, timedelta

load_dotenv()

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")
SECRET_KEY = os.getenv("JWT_SECRET_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Groq client
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY")) if os.getenv("GROQ_API_KEY") else None

# In-memory storage
users = {}

# Helper functions for password hashing using bcrypt directly
def get_password_hash(password: str) -> str:
    # bcrypt max password length is 72 bytes
    if len(password.encode('utf-8')) > 72:
        raise ValueError("Password cannot be longer than 72 characters")
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    user = users.get(username)
    if user is None:
        raise credentials_exception
    return user

# Models
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

# Auth endpoints
@app.post("/api/register", response_model=Token)
async def register(user: UserRegister):
    if user.username in users:
        raise HTTPException(status_code=400, detail="Username already registered")
    try:
        hashed_password = get_password_hash(user.password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user_id = str(uuid.uuid4())
    users[user.username] = {
        "password_hash": hashed_password,
        "user_id": user_id,
        "conversations": {},
        "messages": {},
    }
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = users.get(form_data.username)
    if not user or not verify_password(form_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect username or password")
    access_token = create_access_token(data={"sub": form_data.username})
    return {"access_token": access_token, "token_type": "bearer"}

# Protected endpoints
@app.get("/api/conversations")
async def get_conversations(current_user: dict = Depends(get_current_user)):
    convs = current_user["conversations"]
    return {"conversations": [{"id": cid, "title": title} for cid, title in convs.items()]}

@app.post("/api/conversations")
async def create_conversation(title: str = "New Chat", current_user: dict = Depends(get_current_user)):
    conv_id = str(uuid.uuid4())
    current_user["conversations"][conv_id] = title
    current_user["messages"][conv_id] = []
    return {"id": conv_id, "title": title}

@app.get("/api/conversations/{conv_id}/messages")
async def get_messages(conv_id: str, current_user: dict = Depends(get_current_user)):
    msgs = current_user["messages"].get(conv_id, [])
    return {"messages": msgs}

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    conv_id = request.conversation_id
    if not conv_id:
        conv_id = str(uuid.uuid4())
        current_user["conversations"][conv_id] = "New Chat"
        current_user["messages"][conv_id] = []
    
    if conv_id not in current_user["messages"]:
        current_user["conversations"][conv_id] = "New Chat"
        current_user["messages"][conv_id] = []
    
    current_user["messages"][conv_id].append({"role": "user", "content": request.message})
    
    if groq_client:
        try:
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=current_user["messages"][conv_id],
                temperature=0.7,
            )
            reply = response.choices[0].message.content
        except Exception as e:
            reply = f"Groq error: {str(e)}"
    else:
        reply = f"Echo: {request.message} (Groq API key missing)"
    
    current_user["messages"][conv_id].append({"role": "assistant", "content": reply})
    return ChatResponse(reply=reply, conversation_id=conv_id)