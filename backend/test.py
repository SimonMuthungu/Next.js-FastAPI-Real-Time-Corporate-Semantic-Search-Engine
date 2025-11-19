from google.genai import Client
from dotenv import load_dotenv
import os
load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

client = Client(api_key=GEMINI_API_KEY)

resp = client.models.embed_content(
    model="models/text-embedding-004",
    contents="hello world"
)

print(resp)
