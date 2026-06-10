# conftest.py global — fixtures compartidas entre todos los tests
import sys
import os

# Asegurar que el directorio backend esté en el path de importación
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
