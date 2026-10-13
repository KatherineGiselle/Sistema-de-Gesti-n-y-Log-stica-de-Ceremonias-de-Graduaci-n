"""Genera un video MJPEG con un QR para probar la cámara (webcam falsa de Chromium).
Uso: python3 test/make-qr-mjpeg.py ITT-A-CAMARATEST1 salida.mjpeg      (requiere: pip install qrcode pillow)"""
import sys, io, qrcode
from PIL import Image
texto, salida = sys.argv[1], sys.argv[2]
qr = qrcode.QRCode(error_correction=qrcode.constants.ERROR_CORRECT_M, box_size=10, border=4)
qr.add_data(texto); qr.make(fit=True)
q = qr.make_image(fill_color="black", back_color="white").convert("RGB").resize((380, 380), Image.NEAREST)
datos = b""
for i in range(40):
    lienzo = Image.new("RGB", (640, 480), (235, 235, 235)); lienzo.paste(q, (130 + i % 3, 50 + i % 2))
    b = io.BytesIO(); lienzo.save(b, "JPEG", quality=90); datos += b.getvalue()
open(salida, "wb").write(datos)
