# English Trainer 🇬🇧

Aplicación web para aprender inglés técnico (DevOps/Cloud) con conversaciones interactivas usando Gemini AI.

## Características

- 💬 **Conversación Interactiva**: Chat fluido con profesor de inglés IA
- 📚 **Vocabulario DevOps**: Lista de términos técnicos con ejemplos
- ✍️ **Práctica**: Ejercicios de traducción con feedback automático
- 🔐 **Seguridad**: API keys encriptadas en Firebase
- 🌐 **Bilingüe**: Responde en inglés por defecto, español cuando lo pides

## Tecnologías

- Firebase (Authentication + Realtime Database)
- Gemini 2.5 Flash Lite API
- Vanilla JavaScript
- CryptoJS para encriptación

## Configuración

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/)
2. Habilita Authentication (Google) y Realtime Database
3. Copia tu configuración de Firebase
4. Crea `js/firebase-config.js`:

```javascript
const firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "tu-proyecto.firebaseapp.com",
    databaseURL: "https://tu-proyecto.firebaseio.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789",
    appId: "tu-app-id"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();
```

5. Obtén tu API key de [Google AI Studio](https://aistudio.google.com/app/apikey)
6. Configúrala en la app (pestaña Configuración)

## Uso

1. Abre `index.html` en tu navegador
2. Inicia sesión con Google
3. Configura tu API key de Gemini
4. ¡Empieza a practicar inglés!

## Estructura

```
english-trainer/
├── index.html          # Página principal
├── css/
│   └── style.css      # Estilos
├── js/
│   ├── firebase-config.js  # Configuración Firebase (no incluido)
│   └── app.js         # Lógica principal
└── README.md
```

## Licencia

MIT
