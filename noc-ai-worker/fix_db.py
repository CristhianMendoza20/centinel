import psycopg2

try:
    conn = psycopg2.connect(host="localhost", port=5432, dbname="vigia_centinel", user="postgres", password="Deadpool1243")
    conn.autocommit = True
    cursor = conn.cursor()
    
    # Insertar camaras de prueba si no existen
    cursor.execute("""
        INSERT INTO camaras (id, nombre, url_rtsp, latitud, longitud, activa)
        VALUES 
            (1, 'Cam Test 1 (Simulación)', 'videos de prueba/video2.mp4', -17.7833, -63.1821, true),
            (2, 'Cam Test 2 (Simulación)', 'videos de prueba/video3.mp4', -17.7834, -63.1822, true)
        ON CONFLICT (id) DO NOTHING;
    """)
    print("Cámaras insertadas en PostgreSQL exitosamente.")
    
    # Actualizar secuencia para futuras inserciones desde la UI
    cursor.execute("SELECT setval(pg_get_serial_sequence('camaras', 'id'), coalesce(max(id), 1) + 1, false) FROM camaras;")
    
except Exception as e:
    print("Error:", e)
finally:
    if 'conn' in locals():
        conn.close()
