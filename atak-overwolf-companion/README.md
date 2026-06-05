# ATAK AI Companion - Overwolf

## IMPORTANTE: Esto NO se carga dentro de la web de atak.gg

La app de Overwolf es una **aplicación de escritorio separada** (como Porofessor, Blitz o Itero). 
No se carga dentro del sitio web atak.gg. Es un programa que se instala en Overwolf y aparece como overlay mientras juegas League.

---

## Pasos exactos para cargar la app en Overwolf (Desarrollo)

1. **Cierra Overwolf completamente**
   - Botón derecho en el icono de Overwolf en la bandeja del sistema → Exit

2. **Asegúrate de tener estos archivos en la carpeta:**
   - manifest.json (el que acabamos de poner)
   - icon.png (1x1 rojo que creamos)
   - in_game.html
   - in_game.js

3. **Abre Overwolf**

4. **Activa modo desarrollador**
   - Ve a Overwolf Settings (engranaje)
   - Support tab
   - Marca la opción **"Enable developer mode"**

5. **Carga la app unpacked**
   - En la misma ventana de Support, busca **"Development options"** o "Load unpacked extension"
   - Haz clic en **Load unpacked extension**
   - Selecciona **la carpeta completa** `atak-overwolf-companion` (no entres dentro, selecciona la carpeta padre)

6. Si todo va bien, deberías ver la app en tu lista de apps de Overwolf.

7. **Prueba**
   - Abre League of Legends
   - Entra a una partida custom o normal
   - El overlay debería aparecer automáticamente

---

## Si sigue dando "invalid manifest"

- Borra completamente la carpeta y vuélvela a crear con los archivos mínimos.
- Asegúrate de que no haya archivos extra (node_modules, .git, etc.).
- Prueba renombrar temporalmente la carpeta a algo sin espacios ni caracteres raros.
- Reinicia la PC después de varios intentos fallidos (a veces Overwolf cachea mal).

---

## Siguiente paso cuando cargue

Una vez que cargue en Overwolf, dime y seguimos:
- Mejorar el overlay con datos reales de League (usando Overwolf Game Events)
- Conectar el AI Coach en tiempo real
- Hacer que aparezca solo cuando estás en partida

¿Ya probaste los pasos de arriba con el manifest actual + icon.png? Dime exactamente qué error te sale ahora (copia el mensaje).
