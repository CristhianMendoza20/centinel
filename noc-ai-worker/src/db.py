import psycopg2
import psycopg2.extras
import os
from dotenv import load_dotenv

# Load from backend env (subir 2 niveles: src/ → noc-ai-worker/ → proyecto general postgres/ → noc-backend/)
env_path = os.path.join(os.path.dirname(__file__), '../../noc-backend/.env')
load_dotenv(env_path)

def get_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', ''),
        dbname=os.getenv('DB_NAME', 'vigia_centinel')
    )
